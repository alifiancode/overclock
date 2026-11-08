import { Euler, Group, Mesh, Object3D, PointLight, Quaternion, SphereGeometry, Vector3 } from 'three';
import { WEAPON_ORDER, type WeaponId } from '../data/weapons.ts';
import {
    HAND_POSE_SIZE,
    POSES,
    boneQuat,
    clamp,
    createFoot,
    createGait,
    damp,
    dampAngle,
    footPath,
    gaitFor,
    handQuat,
    lerp,
    packPose,
    smooth,
    solveTwoBone,
    wrapAngle,
} from './humanoid.ts';
import { BUILDS, type Gender } from './human/skeleton.ts';
import { applyHand, bindBody, bindHand, createBones, part, playerGeometry, playerMaterials, type HandRig } from './playerParts.ts';
import type { ReloadEvent } from './sfx.ts';
import { buildWeapon, type Anchor, type Grip, type PoseKey, type ReloadStep, type WeaponModel } from './weaponModels.ts';

export type RigInput = {
    speed: number;
    moveYaw: number;
    moving: boolean;
    facingTarget: number;
    weapon: WeaponId;
    aim: boolean;
    hasTarget: boolean;
    targetX: number;
    targetY: number;
    targetZ: number;
    reloading: boolean;
    reloadProgress: number;
    shots: number;
    melee: number;
    loot: number;
    lootKind: number;
    lootItem: string;
    lootX: number;
    lootY: number;
    lootZ: number;
    hurt: number;
    alive: boolean;
    wade: number;
};

export type RigEvents = {
    step: (side: number) => void;
    reload: (event: ReloadEvent) => void;
    equip: () => void;
};

export type PlayerRig = {
    root: Group;
    lantern: PointLight;
    update: (input: RigInput, dt: number, events: RigEvents) => void;
    muzzle: (out: Vector3) => Vector3;
    facing: () => number;
    reachError: [number, number];
};

export function createRigInput(): RigInput {
    return {
        speed: 0,
        moveYaw: 0,
        moving: false,
        facingTarget: 0,
        weapon: 'pistol',
        aim: false,
        hasTarget: false,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        reloading: false,
        reloadProgress: 0,
        shots: 0,
        melee: 0,
        loot: 0,
        lootKind: 0,
        lootItem: '',
        lootX: 0,
        lootY: 0,
        lootZ: 0,
        hurt: 0,
        alive: true,
        wade: 0,
    };
}

const TAU = Math.PI * 2;
const TOE_OUT = 0.1;
const FLASH_TIME = 0.055;
const MELEE_TIME = 0.32;
const REACH_TIME = 0.66;
const EQUIP_TIME = 0.4;
const HURT_RATE = 6;
const DEATH_TIME = 1.5;
const MAX_STEP = 0.05;

const euler = new Euler();
const qa = new Quaternion();
const qb = new Quaternion();
const qc = new Quaternion();
const weaponQuat = new Quaternion();
const weaponPos = new Vector3();
const va = new Vector3();
const vb = new Vector3();
const vc = new Vector3();
const vd = new Vector3();
const ve = new Vector3();
const pole = new Vector3();
const mid = new Vector3();
const end = new Vector3();
const shoulder = new Vector3();
const fingerDir = new Vector3();
const palmDir = new Vector3();
const poseA: number[] = new Array<number>(HAND_POSE_SIZE).fill(0);
const poseB: number[] = new Array<number>(HAND_POSE_SIZE).fill(0);
const poseOut: number[] = new Array<number>(HAND_POSE_SIZE).fill(0);
const poseTmp: PoseKey = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
const poseBase: PoseKey = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
const poseFinal: PoseKey = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };

let hitGeometry: SphereGeometry | null = null;

function mixPose(out: PoseKey, a: PoseKey, b: PoseKey, t: number) {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    out.pitch = a.pitch + (b.pitch - a.pitch) * t;
    out.yaw = a.yaw + (b.yaw - a.yaw) * t;
    out.roll = a.roll + (b.roll - a.roll) * t;
}

function gripQuat(out: Quaternion, grip: { fingers: readonly [number, number, number]; palm: readonly [number, number, number] }): Quaternion {
    fingerDir.set(grip.fingers[0], grip.fingers[1], grip.fingers[2]);
    palmDir.set(grip.palm[0], grip.palm[1], grip.palm[2]);
    return handQuat(out, fingerDir, palmDir);
}

function anchorToChest(anchor: Anchor | Grip, framed: boolean, outPos: Vector3, outQuat: Quaternion) {
    outPos.set(anchor.at[0], anchor.at[1], anchor.at[2]);
    gripQuat(outQuat, anchor);
    if (framed) {
        outPos.applyQuaternion(weaponQuat).add(weaponPos);
        outQuat.premultiply(weaponQuat);
    }
}

function mixNumbers(out: number[], a: number[], b: number[], t: number) {
    for (let i = 0; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
}

function bump(p: number): number {
    return Math.sin(Math.PI * clamp(p, 0, 1));
}

function segmentAt(steps: ReloadStep[], p: number): number {
    let i = 0;
    while (i < steps.length - 2 && p >= steps[i + 1].t) i++;
    return i;
}

function hitSphere(): SphereGeometry {
    if (!hitGeometry) hitGeometry = new SphereGeometry(0.45, 10, 8);
    return hitGeometry;
}

export function createPlayerRig(gender: Gender = 'male'): PlayerRig {
    const g = playerGeometry(gender);
    const m = playerMaterials();
    const B = BUILDS[gender];
    const standHip = B.ankle + B.shin + B.thigh;

    const root = new Group();
    root.position.y = 0.3;
    const legs = new Group();
    root.add(legs);
    const bones = createBones(B, root, legs);
    const pelvis = bones.byName.pelvis;
    const chest = bones.byName.chest;
    const head = bones.byName.head;
    const hairA = bones.byName.hairA;
    const hairB = bones.byName.hairB;
    const hairC = bones.byName.hairC;
    const thigh = [bones.byName.thighL, bones.byName.thighR];
    const shin = [bones.byName.shinL, bones.byName.shinR];
    const foot = [bones.byName.footL, bones.byName.footR];
    const upper = [bones.byName.upperL, bones.byName.upperR];
    const lower = [bones.byName.lowerL, bones.byName.lowerR];
    const hands: HandRig[] = [bindHand(bones, 1), bindHand(bones, -1)];
    bindBody(gender, bones, root);

    chest.add(part(g.gear, m.gearVC, true));
    chest.add(part(g.glow, m.orange));
    head.add(part(g.headset, m.gear));
    head.add(part(g.headsetGlow, m.cyan));
    thigh[1].add(part(g.holster, m.gearVC, true));

    const lantern = new PointLight('#ffb45e', 24, 15, 1.6);
    lantern.position.set(0, -0.3, -0.05);
    hands[0].wrist.add(lantern);
    hands[0].wrist.add(part(g.lamp, m.gear));
    const lens = new Mesh(g.lens, m.lens);
    hands[0].wrist.add(lens);

    const weaponHolder = new Group();
    chest.add(weaponHolder);
    const models = {} as Record<WeaponId, WeaponModel>;
    const flashes = {} as Record<WeaponId, Group>;
    const slideBase = {} as Record<WeaponId, number>;
    const props = {} as Record<WeaponId, Mesh>;
    const gunProps = {} as Record<WeaponId, Object3D>;
    for (const id of WEAPON_ORDER) {
        const model = buildWeapon(id);
        weaponHolder.add(model.group);
        models[id] = model;
        const flash = new Group();
        flash.add(part(g.flame, m.flash));
        flash.visible = false;
        model.muzzle.add(flash);
        flashes[id] = flash;
        slideBase[id] = model.slide ? model.slide.position.z : 0;
        const prop = model.prop;
        prop.visible = false;
        prop.position.set(0, -0.075, 0.03);
        if (model.spec.prop === 'mag') prop.rotation.set(0, 0, Math.PI / 2);
        else prop.rotation.set(0, Math.PI / 2, 0);
        hands[0].wrist.add(prop);
        props[id] = prop;
        const gun = buildWeapon(id).group;
        gun.visible = false;
        gun.scale.setScalar(0.5);
        gun.position.set(0, -0.09, 0.05);
        gun.rotation.set(0, Math.PI / 2, 0);
        hands[0].wrist.add(gun);
        gunProps[id] = gun;
    }
    const coinProp = part(g.coin, m.gold);
    coinProp.visible = false;
    coinProp.position.set(0, -0.07, 0.035);
    hands[0].wrist.add(coinProp);
    const crateProp = part(g.crate, m.ammo);
    crateProp.visible = false;
    crateProp.position.set(0, -0.075, 0.05);
    hands[0].wrist.add(crateProp);

    const hitFlash = new Mesh(hitSphere(), m.hit);
    hitFlash.position.set(0, 0.35, 0);
    hitFlash.scale.setScalar(0);
    chest.add(hitFlash);

    const gait = createGait();
    const footState = createFoot();
    const hip = [new Vector3(), new Vector3()];
    const ankle = [new Vector3(), new Vector3()];
    const handPos = [new Vector3(), new Vector3()];
    const handQ = [new Quaternion(), new Quaternion()];
    const reachError: [number, number] = [0, 0];
    const lootTarget = new Vector3();

    let initialized = false;
    let time = 0;
    let facing = 0;
    let legYaw = 0;
    let phaseAcc = 0;
    let speed = 0;
    let dir = 1;
    let aimW = 0;
    let current: WeaponId = 'pistol';
    let equipT = EQUIP_TIME;
    let lastShots = 0;
    let lastMelee = 0;
    let lastLoot = 0;
    let lastHurt = 0;
    let shotEnv = 0;
    let flashT = 0;
    let slideShot = 0;
    let slideEventT = 1;
    let meleeT = MELEE_TIME;
    let reachT = REACH_TIME;
    let reachKind = 0;
    let reachItem = '';
    let flinch = 0;
    let tailA = 0;
    let tailB = 0;
    let tailC = 0;
    let tailSideA = 0;
    let tailSideB = 0;
    let tailSideC = 0;
    let flinchSide = 1;
    let deathT = 0;
    let prevReload = -1;
    let cycleA = 0;
    let cycleB = 0;
    const lookPhase = Math.random() * TAU;

    function showWeapon(id: WeaponId) {
        for (const other of WEAPON_ORDER) models[other].group.visible = other === id;
        for (const other of WEAPON_ORDER) {
            props[other].visible = false;
            gunProps[other].visible = false;
        }
        const mag = models[id].mag;
        if (mag) mag.visible = true;
    }

    function applyProp(action: string | undefined, model: WeaponModel) {
        if (!action) return;
        const prop = props[model.id];
        const mag = model.mag;
        if (action === 'pull') {
            if (mag) mag.visible = false;
            prop.visible = true;
        } else if (action === 'stow') {
            prop.visible = false;
        } else if (action === 'fresh') {
            prop.visible = true;
        } else {
            prop.visible = false;
            if (mag) mag.visible = true;
        }
    }

    function fireReloadEvent(model: WeaponModel, step: ReloadStep, events: RigEvents) {
        if (step.event) {
            events.reload(step.event);
            if (model.spec.slideEvents.includes(step.event)) slideEventT = 0;
        }
        applyProp(step.prop, model);
    }

    function reloadStart(model: WeaponModel) {
        props[model.id].visible = false;
        if (model.spec.prop === 'rocket' && model.mag) model.mag.visible = false;
    }

    function reloadEnd(model: WeaponModel) {
        props[model.id].visible = false;
        if (model.mag) model.mag.visible = true;
    }

    function solveLeg(i: number) {
        const s = i === 0 ? 1 : -1;
        pole.set(s * Math.sin(TOE_OUT), 0, Math.cos(TOE_OUT));
        solveTwoBone(hip[i], ankle[i], B.thigh, B.shin, pole, mid, end);
        boneQuat(qa, hip[i], mid, pole);
        thigh[i].position.copy(hip[i]);
        thigh[i].quaternion.copy(qa);
        boneQuat(qb, mid, end, pole);
        shin[i].quaternion.copy(qa).invert().multiply(qb);
        return qb;
    }

    function solveArm(i: number, target: Vector3, orientation: Quaternion) {
        const side = i === 0 ? 1 : -1;
        shoulder.set(side * B.shoulderX, B.shoulderY, 0);
        pole.set(side * 0.5, -1, -0.35).normalize();
        const miss = solveTwoBone(shoulder, target, B.upperArm, B.foreArm, pole, mid, end);
        reachError[i] = miss;
        vd.copy(pole).negate();
        boneQuat(qa, shoulder, mid, vd);
        upper[i].position.copy(shoulder);
        upper[i].quaternion.copy(qa);
        boneQuat(qb, mid, end, vd);
        lower[i].quaternion.copy(qa).invert().multiply(qb);
        hands[i].wrist.quaternion.copy(qb).invert().multiply(orientation);
    }

    function setHandPose(i: number, target: number[], dt: number, trigger: number) {
        const hand = hands[i];
        const k = 1 - Math.exp(-24 * dt);
        for (let n = 0; n < HAND_POSE_SIZE; n++) {
            let goal = target[n];
            if (trigger > 0 && (n === 4 || n === 5)) goal += trigger * 0.45;
            hand.current[n] += (goal - hand.current[n]) * k;
        }
        applyHand(hand);
    }

    function update(input: RigInput, rawDt: number, events: RigEvents) {
        const dt = Math.min(rawDt, MAX_STEP);
        time += dt;
        if (!initialized) {
            initialized = true;
            current = input.weapon;
            showWeapon(current);
            facing = input.facingTarget;
            legYaw = facing;
            lastShots = input.shots;
            lastMelee = input.melee;
            lastLoot = input.loot;
            lastHurt = input.hurt;
            for (let i = 0; i < 2; i++) {
                packPose(POSES.relaxed, hands[i].current);
            }
        }

        if (input.weapon !== current) {
            current = input.weapon;
            showWeapon(current);
            equipT = 0;
            slideShot = 0;
            flashT = 0;
            events.equip();
        }
        const model = models[current];
        const spec = model.spec;

        if (input.shots !== lastShots) {
            lastShots = input.shots;
            shotEnv = Math.min(1.5, shotEnv + 1);
            flashT = FLASH_TIME;
            slideShot = 1;
            flashes[current].rotation.z = Math.random() * TAU;
        }
        if (input.melee !== lastMelee) {
            lastMelee = input.melee;
            meleeT = 0;
        }
        if (input.loot !== lastLoot) {
            lastLoot = input.loot;
            reachT = 0;
            reachKind = input.lootKind;
            reachItem = input.lootItem;
            lootTarget.set(input.lootX, input.lootY - root.position.y + 0.12, input.lootZ);
            lootTarget.applyAxisAngle(vb.set(0, 1, 0), -facing);
            lootTarget.y -= chest.position.y;
        }
        if (input.hurt !== lastHurt) {
            lastHurt = input.hurt;
            flinch = 1;
            flinchSide = Math.random() < 0.5 ? -1 : 1;
        }

        shotEnv *= Math.exp(-dt / spec.kick.decay);
        flashT = Math.max(0, flashT - dt);
        slideShot *= Math.exp(-dt / 0.06);
        slideEventT = Math.min(1, slideEventT + dt / 0.32);
        meleeT = Math.min(MELEE_TIME, meleeT + dt);
        reachT = Math.min(REACH_TIME, reachT + dt);
        equipT = Math.min(EQUIP_TIME, equipT + dt);
        flinch *= Math.exp(-dt * HURT_RATE);

        if (input.alive) deathT = 0;
        else deathT += dt;
        const deathP = clamp(deathT / DEATH_TIME, 0, 1);
        const buckle = smooth(0, 0.45, deathP);
        const fall = smooth(0.3, 1, deathP);
        const alive = input.alive;

        aimW = damp(aimW, input.aim && alive ? 1 : 0, input.aim ? 14 : 5, dt);
        const meleeP = meleeT / MELEE_TIME;
        const meleeActive = meleeT < MELEE_TIME;
        const meleeW = meleeActive ? smooth(0, 0.18, meleeP) * (1 - smooth(0.78, 1, meleeP)) : 0;
        const reachP = reachT / REACH_TIME;
        const reachActive = reachT < REACH_TIME && alive;
        const reachW = reachActive ? smooth(0, 0.3, reachP) * (1 - smooth(0.82, 1, reachP)) : 0;
        const reachBump = reachActive ? bump(reachP) : 0;

        speed = damp(speed, input.moving && alive ? input.speed : 0, 12, dt);
        const moveW = smooth(0.2, 1.2, speed);
        gaitFor(Math.max(speed, 0.45), input.wade, gait);

        const facingRate = alive ? 16 : 0;
        facing = dampAngle(facing, input.facingTarget, facingRate, dt);
        const rel = wrapAngle(input.moveYaw - facing);
        if (dir > 0 && Math.abs(rel) > 1.95) dir = -1;
        else if (dir < 0 && Math.abs(rel) < 1.2) dir = 1;
        const legTarget = moveW > 0.05 && alive ? (dir > 0 ? input.moveYaw : input.moveYaw + Math.PI) : facing;
        legYaw = dampAngle(legYaw, legTarget, 18, dt);
        const legTwist = clamp(wrapAngle(legYaw - facing), -1.9, 1.9);
        root.rotation.y = facing;
        legs.rotation.y = legTwist;

        if (alive) phaseAcc += gait.cycleRate * dt * smooth(0.02, 0.25, speed);
        const ph = phaseAcc % 1;
        const centered = TAU * (ph - gait.duty * 0.5);
        const bobWave = Math.cos(2 * centered);
        const bob = lerp(1, -1, gait.run) * gait.bob * bobWave;
        const breathing = Math.sin(time * 1.4) * 0.0035;
        let hipY = standHip - 0.014 + breathing - moveW * gait.crouch + moveW * bob;
        hipY = lerp(hipY, 0.5, buckle);
        hipY = lerp(hipY, standHip - 0.01, smooth(0.5, 0.95, deathP));
        hipY -= 0.06 * reachBump;
        const sway = Math.cos(centered) * 0.022 * moveW * (1 - gait.run * 0.4);
        const pelvisYaw = Math.sin(centered) * 0.09 * moveW;
        pelvis.position.set(sway, hipY, 0);
        pelvis.rotation.set(0, pelvisYaw, Math.sin(centered) * 0.03 * moveW);

        if (alive && moveW > 0.4) {
            const indexA = Math.floor(phaseAcc);
            const indexB = Math.floor(phaseAcc + 0.5);
            if (indexA !== cycleA) events.step(0);
            if (indexB !== cycleB) events.step(1);
            cycleA = indexA;
            cycleB = indexB;
        } else {
            cycleA = Math.floor(phaseAcc);
            cycleB = Math.floor(phaseAcc + 0.5);
        }

        const hipCos = Math.cos(pelvisYaw);
        const hipSin = Math.sin(pelvisYaw);
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? 1 : -1;
            const p = (phaseAcc + (i === 0 ? 0 : 0.5)) % 1;
            footPath(p, gait, footState);
            const gz = dir * footState.z;
            const idleZ = s * 0.035;
            const stanceX = lerp(0.108, lerp(0.1, 0.082, gait.run), moveW);
            const z = lerp(idleZ, gz, moveW);
            const y = lerp(B.ankle, footState.y, moveW);
            hip[i].set(sway + s * B.hipX * hipCos, hipY, -s * B.hipX * hipSin);
            ankle[i].set(s * stanceX, y, z);
            const pitch = lerp(0, footState.pitch * (dir > 0 ? 1 : 0.5), moveW);
            const shinQuat = solveLeg(i);
            euler.set(-pitch, s * TOE_OUT, 0, 'YXZ');
            qc.setFromEuler(euler);
            foot[i].quaternion.copy(shinQuat).invert().multiply(qc);
        }

        const lean = (0.03 + 0.12 * gait.run) * moveW * (dir > 0 ? 1 : 0.3);
        const kick = spec.kick.torso * shotEnv;
        let chestPitch = lean + 0.28 * reachBump + 0.18 * flinch - kick - 0.3 * fall;
        chestPitch += buckle * 0.25;
        const reachTwist = clamp(Math.atan2(lootTarget.x - 0.19, lootTarget.z + 0.25), -0.7, 0.7) * 0.45 * reachBump;
        const chestYaw = -pelvisYaw * 1.3 + legTwist * 0.25 * moveW + flinch * 0.2 * flinchSide + reachTwist;
        const chestRoll = Math.sin(time * 0.7) * 0.008 + Math.sin(centered) * 0.02 * moveW + flinch * 0.1 * flinchSide;
        const meleeTwist = meleeActive ? -0.3 * smooth(0, 0.25, meleeP) + 0.75 * smooth(0.2, 0.45, meleeP) - 0.45 * smooth(0.5, 1, meleeP) : 0;
        chest.position.set(sway * 0.6, hipY + B.waist, 0);
        euler.set(chestPitch, chestYaw + meleeTwist, chestRoll, 'YXZ');
        chest.quaternion.setFromEuler(euler);

        const aimDistance = Math.hypot(input.targetX, input.targetZ);
        const aimPitch = input.hasTarget ? clamp(Math.atan2(input.targetY, Math.max(0.5, aimDistance)), -0.4, 0.5) : 0;
        const targetYaw = input.hasTarget ? wrapAngle(Math.atan2(input.targetX, input.targetZ) - facing) : 0;

        mixPose(poseBase, spec.carry, spec.aim, aimW);
        const stride = Math.sin(TAU * ph);
        const carryBob = moveW * (1 - aimW * 0.6);
        poseBase.y += Math.sin(2 * TAU * ph + 0.6) * 0.012 * carryBob + breathing * 0.5;
        poseBase.x += stride * 0.008 * carryBob;
        poseBase.pitch += aimPitch * aimW + Math.sin(2 * TAU * ph) * 0.02 * carryBob;
        poseBase.yaw -= chestYaw * aimW * 0.8;

        let reloadBlend = 0;
        let reloadSeg = 0;
        let reloadK = 0;
        const reloadP = input.reloading ? clamp(input.reloadProgress, 0, 1) : -1;
        if (reloadP >= 0) {
            if (prevReload < 0) reloadStart(model);
            reloadSeg = segmentAt(spec.steps, reloadP);
            const a = spec.steps[reloadSeg];
            const b = spec.steps[reloadSeg + 1];
            reloadK = smooth(0, 1, (reloadP - a.t) / Math.max(0.001, b.t - a.t));
            reloadBlend = lerp(a.weapon, b.weapon, reloadK);
            for (let n = 1; n < spec.steps.length; n++) {
                const step = spec.steps[n];
                if (prevReload < step.t && reloadP >= step.t) fireReloadEvent(model, step, events);
            }
        } else if (prevReload >= 0) {
            reloadEnd(model);
        }
        prevReload = reloadP;

        mixPose(poseTmp, poseBase, spec.reload, reloadBlend);
        mixPose(poseFinal, poseTmp, spec.stow, (1 - smooth(0, 1, equipT / EQUIP_TIME)) * (alive ? 1 : 0));
        if (meleeW > 0) mixPose(poseFinal, poseFinal, spec.carry, meleeW * 0.85);
        if (reachW > 0) mixPose(poseFinal, poseFinal, spec.carry, reachW * 0.6);
        if (deathP > 0) mixPose(poseFinal, poseFinal, spec.stow, smooth(0, 0.6, deathP));
        poseFinal.z -= spec.kick.back * shotEnv;
        poseFinal.pitch += spec.kick.pitch * shotEnv;
        poseFinal.y += 0.006 * shotEnv;

        weaponPos.set(poseFinal.x, poseFinal.y, poseFinal.z);
        euler.set(-poseFinal.pitch, poseFinal.yaw, poseFinal.roll, 'YXZ');
        weaponQuat.setFromEuler(euler);
        weaponHolder.position.copy(weaponPos);
        weaponHolder.quaternion.copy(weaponQuat);

        if (model.slide) {
            const pump = slideEventT < 1 ? Math.sin(Math.PI * slideEventT) : 0;
            model.slide.position.z = slideBase[current] - spec.slideTravel * Math.max(slideShot * 0.6, pump);
        }
        const flash = flashes[current];
        flash.visible = flashT > 0 && alive;
        if (flash.visible) flash.scale.setScalar(spec.flash * (0.65 + 0.7 * (flashT / FLASH_TIME)));

        anchorToChest(spec.right, true, handPos[1], handQ[1]);

        let leftPos = handPos[0];
        let leftQuat = handQ[0];
        packPose(POSES[spec.left.pose], poseOut);
        if (reloadP >= 0) {
            const a = spec.anchors[spec.steps[reloadSeg].anchor];
            const b = spec.anchors[spec.steps[reloadSeg + 1].anchor];
            anchorToChest(a, a.frame === 'weapon', va, qa);
            anchorToChest(b, b.frame === 'weapon', vb, qb);
            leftPos.lerpVectors(va, vb, reloadK);
            leftQuat.copy(qa).slerp(qb, reloadK);
            packPose(POSES[a.pose], poseA);
            packPose(POSES[b.pose], poseB);
            mixNumbers(poseOut, poseA, poseB, reloadK);
        } else {
            anchorToChest(spec.left, true, leftPos, leftQuat);
        }

        if (reachW > 0) {
            vb.copy(lootTarget);
            const pocketK = smooth(0.45, 0.8, reachP);
            va.set(0.12, 0.2, 0.2);
            vb.lerp(va, pocketK);
            leftPos.lerp(vb, reachW);
            fingerDir.set(vb.x - 0.19, vb.y - 0.38, vb.z).normalize();
            fingerDir.lerp(vc.set(0, 0, 1), pocketK).normalize();
            palmDir.set(0, -1, 0).lerp(vc.set(0, 1, 0.3), pocketK).normalize();
            handQuat(qc, fingerDir, palmDir);
            leftQuat.slerp(qc, reachW);
            packPose(reachP > 0.32 ? POSES.grab : POSES.open, poseA);
            mixNumbers(poseOut, poseOut, poseA, reachW);
        }
        if (meleeW > 0) {
            const strike = bump(clamp(meleeP / 0.9, 0, 1));
            va.set(0.2, 0.26, 0.12);
            vb.set(0.05, 0.37, 0.52);
            va.lerp(vb, strike);
            leftPos.lerp(va, meleeW);
            fingerDir.set(0, -0.1, 1).normalize();
            palmDir.set(-1, 0, 0).lerp(vc.set(0, -1, 0), strike).normalize();
            handQuat(qc, fingerDir, palmDir);
            leftQuat.slerp(qc, meleeW);
            packPose(POSES.fist, poseA);
            mixNumbers(poseOut, poseOut, poseA, meleeW);
        }
        if (deathP > 0) {
            const limp = smooth(0, 0.5, deathP);
            va.set(0.3, 0.1 - 0.4 * fall, 0.12);
            leftPos.lerp(va, limp);
            ve.set(-0.3, 0.1 - 0.4 * fall, 0.12);
            handPos[1].lerp(ve, limp);
            packPose(POSES.relaxed, poseA);
            mixNumbers(poseOut, poseOut, poseA, limp);
        }

        solveArm(0, leftPos, leftQuat);
        solveArm(1, handPos[1], handQ[1]);

        packPose(POSES[spec.right.pose], poseA);
        setHandPose(1, poseA, dt, flashT > 0 ? flashT / FLASH_TIME : 0);
        setHandPose(0, poseOut, dt, 0);

        const lootBase = reachActive && reachP > 0.28 && reachP < 0.9;
        const shrink = 1 - smooth(0.72, 0.92, reachP);
        coinProp.visible = lootBase && reachKind === 0;
        crateProp.visible = lootBase && reachKind === 1;
        for (const id of WEAPON_ORDER) gunProps[id].visible = lootBase && reachKind === 2 && reachItem === id;
        coinProp.scale.setScalar(shrink);
        crateProp.scale.setScalar(shrink * 1.1);
        coinProp.rotation.y = time * 14;
        const gun = gunProps[reachItem as WeaponId];
        if (gun) gun.scale.setScalar(0.5 * shrink);

        const idleLook = Math.sin(time * 0.6 + lookPhase) * 0.22 * (1 - moveW) * (1 - aimW);
        const headYaw = clamp(targetYaw, -1, 1) * 0.65 * aimW + idleLook - chestYaw * 0.4 + flinch * 0.25 * -flinchSide;
        const headPitch = -chestPitch * 0.7 + 0.04 + (input.hasTarget ? aimPitch * 0.4 * aimW : 0) - 0.15 * flinch;
        euler.set(headPitch, headYaw, 0, 'YXZ');
        head.quaternion.setFromEuler(euler);

        if (gender === 'female') {
            const run = smooth(0.5, 3.5, speed) * moveW;
            const tailDrive = 0.38 * run - headPitch * 0.8 + chestPitch * 0.4 + Math.sin(2 * centered) * 0.1 * run;
            const tailSide = Math.sin(centered) * 0.22 * moveW - headYaw * 0.3;
            tailA = damp(tailA, tailDrive, 11, dt);
            tailB = damp(tailB, tailA, 8, dt);
            tailC = damp(tailC, tailB, 6, dt);
            tailSideA = damp(tailSideA, tailSide, 10, dt);
            tailSideB = damp(tailSideB, tailSideA, 7, dt);
            tailSideC = damp(tailSideC, tailSideB, 5, dt);
            hairA.rotation.set(tailA * 0.5, 0, tailSideA * 0.5);
            hairB.rotation.set((tailB - tailA) * 1.1 + 0.04, 0, (tailSideB - tailSideA) * 1.1);
            hairC.rotation.set((tailC - tailB) * 1.2 + 0.05, 0, (tailSideC - tailSideB) * 1.2);
        }

        hitFlash.scale.setScalar(flinch > 0.03 ? flinch : 0);

        root.rotation.x = -fall * (Math.PI / 2 - 0.05);
        root.position.y = 0.3 + 0.13 * fall;
    }

    function muzzle(out: Vector3): Vector3 {
        models[current].muzzle.getWorldPosition(out);
        return out;
    }

    return { root, lantern, update, muzzle, facing: () => facing, reachError };
}