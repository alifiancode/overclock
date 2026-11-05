import { Color, Euler, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshLambertMaterial, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { EnemyArchetype, ZombieVariant } from '../data/enemies.ts';
import {
    ATTACK_SCALE_PULSE,
    BRUISER_LUNGE_DISTANCE,
    ENEMY_ATTACK_ANIM_DURATION,
    EXPLODER_LUNGE_DISTANCE,
    EXPLODER_PULSE_AMOUNT,
    EXPLODER_PULSE_FREQ,
    FLYER_LUNGE_DISTANCE,
    FLYER_WING_FLAP_AMOUNT,
    FLYER_WING_FLAP_FREQ,
    RANGED_FLASH_COLOR,
    RANGED_RECOIL_DISTANCE,
    RUSHER_LUNGE_DISTANCE,
} from '../data/constants.ts';
import { HEAD_BASE, enemyGeometry } from './enemyParts.ts';
import { BODY, STAND_HIP, boneQuat, clamp, createFoot, createGait, damp, dampAngle, footPath, gaitFor, lerp, smooth, solveTwoBone, wrapAngle } from './humanoid.ts';

const TAU = Math.PI * 2;
const ENEMY_SCALE = 1.04;
const DEATH_TIME = 0.75;
const TOE_OUT = 0.1;
const HURT_RATE = 7;

export const CORPSE_LIFETIME = 2.6;
export const CORPSE_SINK_START = 1.9;

export type EnemyAnim = {
    seed: number;
    speed: number;
    phase: number;
    headYaw: number;
    headPitch: number;
    flinch: number;
    flinchSide: number;
    health: number;
    stepA: number;
    stepB: number;
    limp: number;
    armSide: number;
    skin: Color;
    cloth: Color;
    sleeve: Color;
    pants: Color;
    shoe: Color;
    glow: Color;
    trim: Color;
};

export type Body = {
    id: number;
    archetype: EnemyArchetype;
    variant: ZombieVariant;
    size: number;
    speed: number;
    x: number;
    y: number;
    z: number;
    facing: number;
    moving: boolean;
    wade: number;
    health: number;
    attack: number;
    lookYaw: number;
    distance: number;
    time: number;
    dead: number;
    fallX: number;
    fallZ: number;
    building: number;
    floor: number;
    anim: EnemyAnim;
};

export type StepHandler = (body: Body, side: number) => void;

type Style = {
    hunch: number;
    reach: number;
    swing: number;
    pump: number;
    sway: number;
    stride: number;
    spread: number;
    limp: number;
    headDrop: number;
};

const DEFAULT_STYLE: Style = { hunch: 0.25, reach: 0.7, swing: 0.5, pump: 0, sway: 1, stride: 0.85, spread: 0.1, limp: 0, headDrop: 0.15 };

const STYLES: Record<string, Style> = {
    runner: { hunch: 0.3, reach: 0.15, swing: 0.9, pump: 1, sway: 0.5, stride: 1, spread: 0, limp: 0, headDrop: 0.05 },
    skeletal: { hunch: 0.22, reach: 0.65, swing: 0.5, pump: 0.2, sway: 1, stride: 0.88, spread: 0.05, limp: 0, headDrop: 0.25 },
    screamer: { hunch: 0.1, reach: 0.35, swing: 0.7, pump: 0.6, sway: 0.8, stride: 0.95, spread: 0.1, limp: 0, headDrop: -0.15 },
    brute: { hunch: 0.28, reach: 0.2, swing: 0.6, pump: 0, sway: 1.3, stride: 0.82, spread: 0.3, limp: 0, headDrop: 0.15 },
    charred: { hunch: 0.3, reach: 0.85, swing: 0.35, pump: 0, sway: 1, stride: 0.8, spread: 0.05, limp: 0.6, headDrop: 0.3 },
    hazmat: { hunch: 0.15, reach: 0.55, swing: 0.5, pump: 0, sway: 0.8, stride: 0.85, spread: 0.08, limp: 0, headDrop: 0.1 },
    shambler: { hunch: 0.3, reach: 1, swing: 0.35, pump: 0, sway: 1.2, stride: 0.75, spread: 0.05, limp: 0.35, headDrop: 0.3 },
    bloater: { hunch: 0.1, reach: 0.25, swing: 0.4, pump: 0, sway: 1.4, stride: 0.8, spread: 0.45, limp: 0, headDrop: 0.1 },
    crawler: { hunch: 0, reach: 0, swing: 0, pump: 0, sway: 1, stride: 0.55, spread: 0, limp: 0, headDrop: 0 },
    onearmed: { hunch: 0.25, reach: 0.8, swing: 0.4, pump: 0, sway: 1.1, stride: 0.85, spread: 0.05, limp: 0.5, headDrop: 0.2 },
    gasbag: { hunch: 0.05, reach: 0.5, swing: 0.3, pump: 0, sway: 1.2, stride: 0.85, spread: 0.5, limp: 0, headDrop: 0 },
    swollen: { hunch: 0.05, reach: 0.45, swing: 0.3, pump: 0, sway: 1.2, stride: 0.85, spread: 0.5, limp: 0, headDrop: 0 },
    sprayer: { hunch: 0, reach: 0, swing: 0, pump: 0, sway: 1, stride: 0.55, spread: 0, limp: 0, headDrop: 0 },
    bilious: { hunch: 0, reach: 0, swing: 0, pump: 0, sway: 1, stride: 0.55, spread: 0, limp: 0, headDrop: 0 },
};

type Outfit = { top?: string; bottom?: string; shoe?: string; bare?: boolean; mix: number };

const TOPS = ['#5d6f82', '#7b5b49', '#4e5c46', '#8c8c84', '#74434d', '#3d4a60', '#8d7b55', '#6a6f4a'];
const BOTTOMS = ['#3a4254', '#4b4136', '#2f3529', '#56565b', '#3b3b41', '#5b4a39'];
const SHOES = ['#201c1a', '#2d241d', '#3a3a3e', '#4a2f22'];

const OUTFITS: Record<string, Outfit> = {
    hazmat: { top: '#b6a63a', bottom: '#a89a36', shoe: '#2a2a22', mix: 0.12 },
    charred: { top: '#1c1917', bottom: '#171513', shoe: '#0f0e0d', bare: true, mix: 0 },
    brute: { top: '#4b2c28', bottom: '#2e2a26', shoe: '#1a1614', mix: 0.12 },
    skeletal: { top: '#a8a08c', bottom: '#6e6858', bare: true, mix: 0.12 },
    bloater: { top: '#7a6a3a', mix: 0.2 },
    gasbag: { top: '#6e4a24', bottom: '#3a3028', mix: 0.2 },
    swollen: { top: '#6a3f22', bottom: '#352b24', mix: 0.2 },
};

const DEFAULT_OUTFIT: Outfit = { mix: 0.32 };

function rand01(n: number): number {
    const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
}

export function createAnim(variant: ZombieVariant, id: number, health: number): EnemyAnim {
    const outfit = OUTFITS[variant.id] ?? DEFAULT_OUTFIT;
    const skin = new Color(variant.skinColor);
    const cloth = new Color(outfit.top ?? TOPS[Math.floor(rand01(id + 1) * TOPS.length)]).lerp(skin, outfit.mix);
    const pants = new Color(outfit.bottom ?? BOTTOMS[Math.floor(rand01(id + 2) * BOTTOMS.length)]).lerp(skin, outfit.mix * 0.6);
    const shoe = new Color(outfit.shoe ?? SHOES[Math.floor(rand01(id + 3) * SHOES.length)]);
    const limpRoll = rand01(id + 4);
    return {
        seed: rand01(id + 5),
        speed: 0,
        phase: rand01(id + 6) * 4,
        headYaw: 0,
        headPitch: 0,
        flinch: 0,
        flinchSide: 1,
        health,
        stepA: 0,
        stepB: 0,
        limp: limpRoll < 0.34 ? 1 : limpRoll < 0.68 ? -1 : 0,
        armSide: rand01(id + 7) < 0.5 ? 1 : -1,
        skin,
        cloth,
        sleeve: outfit.bare ? skin : cloth,
        pants,
        shoe,
        glow: new Color(variant.glowColor),
        trim: new Color(variant.trimColor),
    };
}

export function createBody(variant: ZombieVariant, id: number, archetype: EnemyArchetype, size: number, speed: number, health: number, anim?: EnemyAnim): Body {
    return {
        id,
        archetype,
        variant,
        size,
        speed,
        x: 0,
        y: 0,
        z: 0,
        facing: 0,
        moving: false,
        wade: 0,
        health,
        attack: -1,
        lookYaw: 0,
        distance: 99,
        time: 0,
        dead: -1,
        fallX: 0,
        fallZ: 1,
        building: -1,
        floor: 0,
        anim: anim ?? createAnim(variant, id, health),
    };
}

export type EnemyMeshes = {
    group: Group;
    torso: InstancedMesh;
    pelvis: InstancedMesh;
    head: InstancedMesh;
    eyes: InstancedMesh;
    upperArm: InstancedMesh;
    foreArmL: InstancedMesh;
    foreArmR: InstancedMesh;
    thigh: InstancedMesh;
    shin: InstancedMesh;
    shoe: InstancedMesh;
    ribs: InstancedMesh;
    sac: InstancedMesh;
    flyerBody: InstancedMesh;
    flyerWingL: InstancedMesh;
    flyerWingR: InstancedMesh;
    flyerEyes: InstancedMesh;
    ground: number;
    air: number;
    ribCount: number;
    sacCount: number;
};

const white = new Color(1, 1, 1);

export function createEnemyMeshes(capacity: number): EnemyMeshes {
    const g = enemyGeometry();
    const body = new MeshLambertMaterial();
    const sacMaterial = new MeshLambertMaterial({ transparent: true, opacity: 0.85 });
    const eye = new MeshBasicMaterial({ toneMapped: false });
    const group = new Group();
    const make = (geometry: BufferGeometry, material: MeshLambertMaterial | MeshBasicMaterial, count: number, shadow: boolean): InstancedMesh => {
        const mesh = new InstancedMesh(geometry, material, count);
        mesh.castShadow = shadow;
        mesh.frustumCulled = false;
        mesh.setColorAt(0, white);
        mesh.count = 0;
        group.add(mesh);
        return mesh;
    };
    const meshes: EnemyMeshes = {
        group,
        torso: make(g.torso, body, capacity, true),
        pelvis: make(g.pelvis, body, capacity, false),
        head: make(g.head, body, capacity, true),
        eyes: make(g.eyes, eye, capacity, false),
        upperArm: make(g.upperArm, body, capacity * 2, false),
        foreArmL: make(g.foreArm[0], body, capacity, false),
        foreArmR: make(g.foreArm[1], body, capacity, false),
        thigh: make(g.thigh, body, capacity * 2, true),
        shin: make(g.shin, body, capacity * 2, false),
        shoe: make(g.shoe, body, capacity * 2, false),
        ribs: make(g.ribs, body, capacity, false),
        sac: make(g.sac, sacMaterial, capacity, false),
        flyerBody: make(g.flyerBody, body, capacity, true),
        flyerWingL: make(g.flyerWing[0], body, capacity, false),
        flyerWingR: make(g.flyerWing[1], body, capacity, false),
        flyerEyes: make(g.flyerEyes, eye, capacity, false),
        ground: 0,
        air: 0,
        ribCount: 0,
        sacCount: 0,
    };
    return meshes;
}

export function beginBodies(m: EnemyMeshes) {
    m.ground = 0;
    m.air = 0;
    m.ribCount = 0;
    m.sacCount = 0;
}

function finish(mesh: InstancedMesh, count: number) {
    mesh.count = count;
    if (count === 0) return;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function endBodies(m: EnemyMeshes) {
    const n = m.ground;
    finish(m.torso, n);
    finish(m.pelvis, n);
    finish(m.head, n);
    finish(m.eyes, n);
    finish(m.upperArm, n * 2);
    finish(m.foreArmL, n);
    finish(m.foreArmR, n);
    finish(m.thigh, n * 2);
    finish(m.shin, n * 2);
    finish(m.shoe, n * 2);
    finish(m.ribs, m.ribCount);
    finish(m.sac, m.sacCount);
    finish(m.flyerBody, m.air);
    finish(m.flyerWingL, m.air);
    finish(m.flyerWingR, m.air);
    finish(m.flyerEyes, m.air);
}

const ONE = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);
const vPos = new Vector3();
const vScale = new Vector3();
const vAxis = new Vector3();
const euler = new Euler();
const qA = new Quaternion();
const qB = new Quaternion();
const qC = new Quaternion();
const qRoot = new Quaternion();
const qFall = new Quaternion();
const qYaw = new Quaternion();
const qChest = new Quaternion();
const qChestInv = new Quaternion();
const mRoot = new Matrix4();
const mPelvis = new Matrix4();
const mChest = new Matrix4();
const mHead = new Matrix4();
const mBone = new Matrix4();
const mWork = new Matrix4();
const mZero = new Matrix4().makeScale(0, 0, 0);
const hip = [new Vector3(), new Vector3()];
const ankle = [new Vector3(), new Vector3()];
const shoulder = new Vector3();
const hand = [new Vector3(), new Vector3()];
const pole = new Vector3();
const mid = new Vector3();
const end = new Vector3();
const chestPos = new Vector3();
const gait = createGait();
const footState = createFoot();
const tint = new Color();
const hurtColor = new Color('#ff7a60');
const flashColor = new Color(RANGED_FLASH_COLOR);
const eyeColor = new Color();

function put(mesh: InstancedMesh, slot: number, parent: Matrix4, x: number, y: number, z: number, q: Quaternion, sx: number, sy: number, sz: number) {
    mBone.compose(vPos.set(x, y, z), q, vScale.set(sx, sy, sz));
    mWork.multiplyMatrices(parent, mBone);
    mesh.setMatrixAt(slot, mWork);
}

function putMatrix(mesh: InstancedMesh, slot: number, matrix: Matrix4, sx: number, sy: number, sz: number) {
    mWork.copy(matrix).scale(vScale.set(sx, sy, sz));
    mesh.setMatrixAt(slot, mWork);
}

function lungeFor(archetype: EnemyArchetype): number {
    switch (archetype) {
        case 'ranged':
        case 'spitter':
            return -RANGED_RECOIL_DISTANCE;
        case 'bruiser':
            return BRUISER_LUNGE_DISTANCE;
        case 'exploder':
            return EXPLODER_LUNGE_DISTANCE;
        case 'flyer':
            return FLYER_LUNGE_DISTANCE;
        default:
            return RUSHER_LUNGE_DISTANCE;
    }
}

function buildRoot(b: Body, rootX: number, rootY: number, rootZ: number, scale: number, fall: number) {
    qYaw.setFromAxisAngle(UP, b.facing);
    if (fall > 0) {
        qFall.setFromAxisAngle(vAxis.set(b.fallZ, 0, -b.fallX), fall * (Math.PI / 2 - 0.05));
        qRoot.copy(qFall).multiply(qYaw);
    } else {
        qRoot.copy(qYaw);
    }
    mRoot.compose(vPos.set(rootX, rootY, rootZ), qRoot, vScale.set(scale, scale, scale));
}

type Pose = {
    pelvisX: number;
    pelvisY: number;
    pelvisYaw: number;
    pelvisRoll: number;
    chestX: number;
    chestY: number;
    chestZ: number;
    chestPitch: number;
    chestYaw: number;
    chestRoll: number;
    headPitch: number;
    headYaw: number;
    headRoll: number;
};

const pose: Pose = {
    pelvisX: 0,
    pelvisY: 0,
    pelvisYaw: 0,
    pelvisRoll: 0,
    chestX: 0,
    chestY: 0,
    chestZ: 0,
    chestPitch: 0,
    chestYaw: 0,
    chestRoll: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
};

const footPitch = [0, 0];
const armPole = [new Vector3(), new Vector3()];
const armFront = [new Vector3(), new Vector3()];

function emit(m: EnemyMeshes, b: Body, slot: number, pulse: number, flash: number, flashTint: Color) {
    const v = b.variant;
    const a = b.anim;
    const sx = v.torsoScale[0];
    const sy = v.torsoScale[1];
    const sz = v.torsoScale[2];
    const armThick = clamp(v.armScale, 0.75, 1.35);
    const armLen = lerp(1, v.armScale, 0.25);
    const legThick = clamp(lerp(1, v.legScale, 0.5), 0.78, 1.15);
    const pelvisWide = lerp(1, sx, 0.6);
    const pelvisDeep = lerp(1, sz, 0.6);

    euler.set(0, pose.pelvisYaw, pose.pelvisRoll, 'YXZ');
    qA.setFromEuler(euler);
    mBone.compose(vPos.set(pose.pelvisX, pose.pelvisY, 0), qA, ONE);
    mPelvis.multiplyMatrices(mRoot, mBone);
    putMatrix(m.pelvis, slot, mPelvis, pelvisWide, 1, pelvisDeep);

    euler.set(pose.chestPitch, pose.chestYaw, pose.chestRoll, 'YXZ');
    qChest.setFromEuler(euler);
    chestPos.set(pose.chestX, pose.chestY, pose.chestZ);
    mBone.compose(chestPos, qChest, ONE);
    mChest.multiplyMatrices(mRoot, mBone);
    putMatrix(m.torso, slot, mChest, sx * pulse, sy * pulse, sz * pulse);

    const neck = BODY.neckY * sy + HEAD_BASE;
    euler.set(pose.headPitch, pose.headYaw, pose.headRoll, 'YXZ');
    qA.setFromEuler(euler);
    mBone.compose(vPos.set(0, neck, 0), qA, ONE);
    mHead.multiplyMatrices(mChest, mBone);
    putMatrix(m.head, slot, mHead, v.headScale[0], v.headScale[1], v.headScale[2]);
    putMatrix(m.eyes, slot, mHead, v.headScale[0], v.headScale[1], v.headScale[2]);

    const upper = BODY.upperArm * armLen;
    const lower = BODY.foreArm * armLen;
    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 1 : -1;
        if (v.hasOneArm && i === 0) {
            m.upperArm.setMatrixAt(slot * 2, mZero);
            m.foreArmL.setMatrixAt(slot, mZero);
            continue;
        }
        shoulder.set(side * BODY.shoulderX * sx, BODY.shoulderY * sy, 0);
        solveTwoBone(shoulder, hand[i], upper, lower, armPole[i], mid, end);
        boneQuat(qA, shoulder, mid, armFront[i]);
        boneQuat(qB, mid, end, armFront[i]);
        put(m.upperArm, slot * 2 + i, mChest, shoulder.x, shoulder.y, shoulder.z, qA, armThick, armLen, armThick);
        put(i === 0 ? m.foreArmL : m.foreArmR, slot, mChest, mid.x, mid.y, mid.z, qB, armThick, armLen, armThick);
    }

    for (let i = 0; i < 2; i++) {
        const s = i === 0 ? 1 : -1;
        pole.set(s * Math.sin(TOE_OUT), 0.15, Math.cos(TOE_OUT));
        solveTwoBone(hip[i], ankle[i], BODY.thigh, BODY.shin, pole, mid, end);
        boneQuat(qA, hip[i], mid, pole);
        boneQuat(qB, mid, end, pole);
        put(m.thigh, slot * 2 + i, mRoot, hip[i].x, hip[i].y, hip[i].z, qA, legThick, 1, legThick);
        put(m.shin, slot * 2 + i, mRoot, mid.x, mid.y, mid.z, qB, legThick, 1, legThick);
        euler.set(-footPitch[i], s * TOE_OUT, 0, 'YXZ');
        qC.setFromEuler(euler);
        put(m.shoe, slot * 2 + i, mRoot, end.x, end.y, end.z, qC, 1, 1, 1);
    }

    if (v.hasRibs) {
        putMatrix(m.ribs, m.ribCount, mChest, sx * pulse, sy * pulse, sz * pulse);
        m.ribs.setColorAt(m.ribCount, a.trim);
        m.ribCount++;
    }
    if (v.hasSac) {
        put(m.sac, m.sacCount, mChest, -0.08 * sx, 0.2 * sy, -0.2 * sz, qB.identity(), 0.6 * sx * pulse, 0.7 * sy * pulse, 0.55 * sz * pulse);
        m.sac.setColorAt(m.sacCount, a.trim);
        m.sacCount++;
    }

    const k = flash > 0.01 ? flash : 0;
    const pick = (color: Color): Color => (k > 0 ? tint.copy(color).lerp(flashTint, k) : color);
    m.torso.setColorAt(slot, pick(a.cloth));
    m.pelvis.setColorAt(slot, pick(a.pants));
    m.head.setColorAt(slot, pick(a.skin));
    m.foreArmL.setColorAt(slot, pick(a.skin));
    m.foreArmR.setColorAt(slot, pick(a.skin));
    const sleeve = pick(a.sleeve);
    m.upperArm.setColorAt(slot * 2, sleeve);
    m.upperArm.setColorAt(slot * 2 + 1, sleeve);
    const pants = pick(a.pants);
    m.thigh.setColorAt(slot * 2, pants);
    m.thigh.setColorAt(slot * 2 + 1, pants);
    m.shin.setColorAt(slot * 2, pants);
    m.shin.setColorAt(slot * 2 + 1, pants);
    m.shoe.setColorAt(slot * 2, a.shoe);
    m.shoe.setColorAt(slot * 2 + 1, a.shoe);
    eyeColor.copy(a.glow).lerp(white, flash > 0.01 ? Math.min(1, flash * 0.6) : 0);
    m.eyes.setColorAt(slot, eyeColor);
}

function drawWalker(m: EnemyMeshes, b: Body, dt: number, onStep: StepHandler | null) {
    const a = b.anim;
    const v = b.variant;
    const style = STYLES[v.id] ?? DEFAULT_STYLE;
    const alive = b.dead < 0;
    const time = b.time;
    const slot = m.ground;
    m.ground = slot + 1;

    if (alive && b.health < a.health - 0.001) {
        a.flinch = 1;
        a.flinchSide = a.flinchSide > 0 ? -1 : 1;
    }
    a.health = b.health;
    a.flinch *= Math.exp(-dt * HURT_RATE);

    a.speed = damp(a.speed, alive && b.moving ? b.speed : 0, 9, dt);
    const moveW = smooth(0.25, 1.1, a.speed);
    gaitFor(Math.max(a.speed, 0.45), b.wade, gait, style.stride);
    if (alive) a.phase += gait.cycleRate * dt * smooth(0.03, 0.3, a.speed);
    const ph = a.phase % 1;

    if (alive && moveW > 0.5 && onStep) {
        const indexA = Math.floor(a.phase);
        const indexB = Math.floor(a.phase + 0.5);
        if (indexA !== a.stepA) onStep(b, 0);
        if (indexB !== a.stepB) onStep(b, 1);
        a.stepA = indexA;
        a.stepB = indexB;
    } else {
        a.stepA = Math.floor(a.phase);
        a.stepB = Math.floor(a.phase + 0.5);
    }

    const attackP = alive && b.attack >= 0 ? b.attack : -1;
    const attackBump = attackP >= 0 ? Math.sin(Math.PI * attackP) : 0;
    const attackStrike = attackP >= 0 ? smooth(0.2, 0.5, attackP) * (1 - smooth(0.62, 1, attackP)) : 0;
    const attackRaise = attackP >= 0 ? smooth(0, 0.25, attackP) * (1 - smooth(0.25, 0.45, attackP)) : 0;
    const ranged = b.archetype === 'ranged' || b.archetype === 'spitter';
    const heavy = b.archetype === 'bruiser';
    const exploder = b.archetype === 'exploder';

    const deathP = alive ? 0 : clamp(b.dead / DEATH_TIME, 0, 1);
    const buckle = smooth(0, 0.45, deathP);
    const fall = smooth(0.3, 1, deathP);
    const fallForward = Math.abs(wrapAngle(Math.atan2(b.fallX, b.fallZ) - b.facing)) < Math.PI / 2 ? 1 : -1;

    const sy = v.torsoScale[1];
    const shoulderX = BODY.shoulderX * v.torsoScale[0];
    const shoulderY = BODY.shoulderY * sy;
    const centered = TAU * (ph - gait.duty * 0.5);
    const swayK = moveW * style.sway;
    const bob = lerp(1, -1, gait.run) * gait.bob * Math.cos(2 * centered);
    const breathing = Math.sin(time * 1.3 + a.seed * TAU) * 0.004;
    let hipY = STAND_HIP - 0.03 - style.hunch * 0.06 + breathing - moveW * gait.crouch + moveW * bob;
    hipY = lerp(hipY, 0.5, buckle);
    hipY = lerp(hipY, STAND_HIP - 0.01, smooth(0.5, 0.95, deathP));
    hipY -= 0.05 * attackBump;
    const sway = Math.cos(centered) * 0.03 * swayK * (1 - gait.run * 0.4);
    const pelvisYaw = Math.sin(centered) * 0.1 * swayK;
    const pelvisRoll = Math.sin(centered) * 0.035 * swayK;

    pose.pelvisX = sway;
    pose.pelvisY = hipY;
    pose.pelvisYaw = pelvisYaw;
    pose.pelvisRoll = pelvisRoll;

    const hipCos = Math.cos(pelvisYaw);
    const hipSin = Math.sin(pelvisYaw);
    const footZ = [0, 0];
    for (let i = 0; i < 2; i++) {
        const s = i === 0 ? 1 : -1;
        const p = (ph + (i === 0 ? 0 : 0.5)) % 1;
        footPath(p, gait, footState);
        const limp = a.limp === s ? style.limp : 0;
        const stanceX = lerp(0.108, lerp(0.1, 0.082, gait.run), moveW);
        const idleZ = s * 0.035;
        const z = lerp(idleZ, footState.z * (1 - 0.35 * limp), moveW);
        const y = BODY.ankle + (footState.y - BODY.ankle) * (1 - 0.7 * limp) * moveW;
        hip[i].set(sway + s * BODY.hipX * hipCos, hipY, -s * BODY.hipX * hipSin);
        ankle[i].set(s * stanceX, y, z);
        footPitch[i] = footState.pitch * moveW;
        footZ[i] = clamp((footState.z - (gait.ahead - gait.contact / 2)) / Math.max(0.05, gait.contact / 2), -1, 1) * moveW;
    }

    const engage = 1 - smooth(9, 20, b.distance);
    const reachW = clamp(style.reach * (0.35 + 0.65 * engage), 0, 1) * (1 - 0.8 * smooth(0, 0.4, deathP));
    const lean = style.hunch * (0.7 + 0.3 * moveW) + gait.run * 0.1 * moveW;
    let chestPitch = lean - 0.3 * a.flinch;
    if (ranged) chestPitch += 0.3 * attackStrike - 0.35 * smooth(0, 0.4, attackP);
    else if (exploder) chestPitch -= 0.3 * attackBump;
    else chestPitch += (heavy ? 0.5 : 0.38) * attackStrike - 0.2 * attackRaise;
    chestPitch += fallForward * (0.25 * buckle + 0.2 * fall);
    const chestYaw = -pelvisYaw * 1.3 + a.flinch * 0.25 * a.flinchSide;
    const chestRoll = Math.sin(time * 0.7 + a.seed * TAU) * 0.01 + Math.sin(centered) * 0.025 * swayK + a.flinch * 0.12 * a.flinchSide;

    pose.chestX = sway * 0.6;
    pose.chestY = hipY + BODY.waist;
    pose.chestZ = 0;
    pose.chestPitch = chestPitch;
    pose.chestYaw = chestYaw;
    pose.chestRoll = chestRoll;

    const lookRel = wrapAngle(b.lookYaw - b.facing - chestYaw);
    const idleLook = Math.sin(time * 0.5 + a.seed * 9) * 0.25 * (1 - moveW);
    const headGoal = alive ? clamp(lookRel, -1.05, 1.05) * 0.85 + idleLook : 0;
    a.headYaw = dampAngle(a.headYaw, headGoal, 9, dt);
    let headPitch = style.headDrop - chestPitch * 0.55 - 0.25 * a.flinch;
    if (ranged && attackP >= 0) headPitch += -0.5 * smooth(0, 0.35, attackP) + 0.95 * smooth(0.3, 0.6, attackP) * (1 - smooth(0.65, 1, attackP));
    if (exploder) headPitch -= 0.25 * attackBump;
    headPitch = lerp(headPitch, 0.35 * fallForward, smooth(0.2, 0.8, deathP));
    a.headPitch = damp(a.headPitch, headPitch, 14, dt);
    pose.headPitch = a.headPitch;
    pose.headYaw = a.headYaw;
    pose.headRoll = Math.sin(time * 0.9 + a.seed * 5) * 0.06 * (1 - moveW * 0.5) + a.flinch * 0.15 * -a.flinchSide;

    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 1 : -1;
        const swing = -footZ[i];
        const wobble = Math.sin(time * 1.7 + i * 2.1 + a.seed * 6) * 0.025;
        const hangX = side * (shoulderX + 0.05 + style.spread * 0.22);
        const hangY = shoulderY - 0.5;
        const hangZ = 0.03 + swing * 0.26 * style.swing;
        const reachX = side * (shoulderX * 0.78 + style.spread * 0.1);
        const reachY = shoulderY - 0.14 + wobble + (side === a.armSide ? 0.06 : 0);
        const reachZ = 0.48 + 0.05 * swing;
        const pumpX = side * 0.17;
        const pumpY = shoulderY - 0.3 + 0.05 * Math.abs(swing);
        const pumpZ = 0.06 + 0.32 * swing;
        let tx = lerp(hangX, reachX, reachW);
        let ty = lerp(hangY, reachY, reachW);
        let tz = lerp(hangZ, reachZ, reachW);
        const pumpW = style.pump * moveW;
        tx = lerp(tx, pumpX, pumpW);
        ty = lerp(ty, pumpY, pumpW);
        tz = lerp(tz, pumpZ, pumpW);
        let poleDown = reachW;
        if (attackP >= 0 && !ranged) {
            const delay = i === 0 ? 0 : 0.08;
            const strikeI = smooth(0.2 + delay, 0.5 + delay, attackP) * (1 - smooth(0.62 + delay, 1, attackP));
            const raiseI = smooth(0, 0.25, attackP) * (1 - smooth(0.25 + delay, 0.45 + delay, attackP));
            if (heavy) {
                tx = lerp(tx, side * 0.2, Math.max(strikeI, raiseI));
                ty = lerp(ty, shoulderY + 0.42, raiseI);
                tz = lerp(tz, 0.12, raiseI);
                ty = lerp(ty, shoulderY - 0.45, strikeI);
                tz = lerp(tz, 0.68, strikeI);
            } else if (exploder) {
                tx = lerp(tx, side * (shoulderX + 0.35), attackBump);
                ty = lerp(ty, shoulderY + 0.2, attackBump);
                tz = lerp(tz, 0.1, attackBump);
            } else {
                ty = lerp(ty, shoulderY + 0.14, raiseI);
                tz = lerp(tz, 0.3, raiseI);
                ty = lerp(ty, shoulderY - 0.4, strikeI);
                tz = lerp(tz, 0.72, strikeI);
                tx = lerp(tx, side * 0.1, strikeI);
            }
            poleDown = lerp(poleDown, 1, Math.max(strikeI, raiseI));
        } else if (ranged && attackP >= 0) {
            tx = lerp(tx, side * (shoulderX + 0.3), attackBump);
            ty = lerp(ty, shoulderY - 0.05, attackBump);
            tz = lerp(tz, 0.25, attackBump);
        }
        tx += side * 0.1 * a.flinch;
        ty += 0.12 * a.flinch;
        const limpW = smooth(0, 0.5, deathP);
        if (limpW > 0) {
            tx = lerp(tx, side * (shoulderX + 0.14), limpW);
            ty = lerp(ty, shoulderY - 0.45 + 0.4 * fall, limpW);
            tz = lerp(tz, 0.08, limpW);
            poleDown = lerp(poleDown, 0, limpW);
        }
        hand[i].set(tx, ty, tz);
        armPole[i].set(side * 0.45, -0.25 - 0.75 * poleDown, -1 + 0.8 * poleDown).normalize();
        armFront[i].set(-side * (1 - 0.85 * poleDown), -poleDown, 0.12);
    }

    const lunge = lungeFor(b.archetype) * attackBump;
    const lx = Math.sin(b.lookYaw);
    const lz = Math.cos(b.lookYaw);
    const stagger = -0.07 * a.flinch;
    const scale = b.size * ENEMY_SCALE;
    const rootY = b.y + 0.13 * fall * scale - (b.dead > CORPSE_SINK_START ? 0.45 * smooth(CORPSE_SINK_START, CORPSE_LIFETIME, b.dead) : 0);
    buildRoot(b, b.x + (lx * lunge + lx * stagger) * (alive ? 1 : 0), rootY, b.z + (lz * lunge + lz * stagger) * (alive ? 1 : 0), scale, fall);

    const emberPulse = exploder ? 1 + Math.sin(time * EXPLODER_PULSE_FREQ + b.id) * EXPLODER_PULSE_AMOUNT : 1;
    const pulse = (1 + attackBump * ATTACK_SCALE_PULSE) * emberPulse;
    const flashAmount = ranged ? attackBump * 0.8 : a.flinch * 0.5;
    emit(m, b, slot, pulse, flashAmount, ranged ? flashColor : hurtColor);
}

function drawCrawler(m: EnemyMeshes, b: Body, dt: number, onStep: StepHandler | null) {
    const a = b.anim;
    const v = b.variant;
    const alive = b.dead < 0;
    const time = b.time;
    const slot = m.ground;
    m.ground = slot + 1;

    if (alive && b.health < a.health - 0.001) {
        a.flinch = 1;
        a.flinchSide = a.flinchSide > 0 ? -1 : 1;
    }
    a.health = b.health;
    a.flinch *= Math.exp(-dt * HURT_RATE);

    a.speed = damp(a.speed, alive && b.moving ? b.speed : 0, 9, dt);
    const moveW = smooth(0.25, 1.1, a.speed);
    gaitFor(Math.max(a.speed, 0.45), b.wade, gait, 0.55);
    if (alive) a.phase += gait.cycleRate * dt * smooth(0.03, 0.3, a.speed);
    const ph = a.phase % 1;

    if (alive && moveW > 0.5 && onStep) {
        const indexA = Math.floor(a.phase);
        const indexB = Math.floor(a.phase + 0.5);
        if (indexA !== a.stepA) onStep(b, 0);
        if (indexB !== a.stepB) onStep(b, 1);
        a.stepA = indexA;
        a.stepB = indexB;
    } else {
        a.stepA = Math.floor(a.phase);
        a.stepB = Math.floor(a.phase + 0.5);
    }

    const attackP = alive && b.attack >= 0 ? b.attack : -1;
    const attackBump = attackP >= 0 ? Math.sin(Math.PI * attackP) : 0;
    const deathP = alive ? 0 : clamp(b.dead / DEATH_TIME, 0, 1);
    const fall = smooth(0.2, 1, deathP);
    const fallForward = Math.abs(wrapAngle(Math.atan2(b.fallX, b.fallZ) - b.facing)) < Math.PI / 2 ? 1 : -1;

    const sy = v.torsoScale[1];
    const shoulderX = BODY.shoulderX * v.torsoScale[0];
    const shoulderY = BODY.shoulderY * sy;
    const centered = TAU * (ph - gait.duty * 0.5);
    const swayK = moveW;

    const hipY = 0.21 + Math.sin(time * 1.4 + a.seed * TAU) * 0.004 - 0.03 * attackBump + 0.04 * a.flinch;
    const sway = Math.sin(centered) * 0.03 * swayK;
    const chestPitch = 1.02 + 0.18 * attackBump - 0.15 * a.flinch + fallForward * 0.1 * fall;
    const chestYaw = Math.cos(centered) * 0.12 * swayK + a.flinch * 0.2 * a.flinchSide;
    const chestRoll = Math.sin(centered) * 0.05 * swayK + a.flinch * 0.1 * a.flinchSide;

    pose.pelvisX = sway;
    pose.pelvisY = hipY;
    pose.pelvisYaw = -chestYaw * 0.8;
    pose.pelvisRoll = -chestRoll * 0.5;
    pose.chestX = sway * 0.7;
    pose.chestY = hipY + 0.09;
    pose.chestZ = 0.08;
    pose.chestPitch = chestPitch;
    pose.chestYaw = chestYaw;
    pose.chestRoll = chestRoll;

    const lookRel = wrapAngle(b.lookYaw - b.facing - chestYaw);
    const headGoal = alive ? clamp(lookRel, -0.9, 0.9) * 0.8 : 0;
    a.headYaw = dampAngle(a.headYaw, headGoal, 9, dt);
    let headPitch = -chestPitch * 0.9 + 0.12 - 0.3 * a.flinch;
    if (attackP >= 0) headPitch += -0.4 * smooth(0, 0.35, attackP) + 0.8 * smooth(0.3, 0.6, attackP) * (1 - smooth(0.65, 1, attackP));
    a.headPitch = damp(a.headPitch, headPitch, 14, dt);
    pose.headPitch = a.headPitch;
    pose.headYaw = a.headYaw;
    pose.headRoll = Math.sin(centered) * 0.08 * swayK;

    const hipCos = Math.cos(pose.pelvisYaw);
    const hipSin = Math.sin(pose.pelvisYaw);
    for (let i = 0; i < 2; i++) {
        const s = i === 0 ? 1 : -1;
        const p = (ph + (i === 0 ? 0.5 : 0)) % 1;
        footPath(p, gait, footState);
        const kick = (footState.y - BODY.ankle) * moveW;
        hip[i].set(sway + s * BODY.hipX * hipCos, hipY, -s * BODY.hipX * hipSin);
        ankle[i].set(s * 0.16, BODY.ankle - 0.01 + kick * 0.6, -0.76 + footState.z * 0.25 * moveW);
        footPitch[i] = -1.1 + kick * 1.2;
    }

    qChest.setFromEuler(euler.set(chestPitch, chestYaw, chestRoll, 'YXZ'));
    qChestInv.copy(qChest).invert();
    chestPos.set(pose.chestX, pose.chestY, pose.chestZ);
    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 1 : -1;
        const p = (ph + (i === 0 ? 0 : 0.5)) % 1;
        footPath(p, gait, footState);
        const lift = (footState.y - BODY.ankle) * 1.8 * moveW;
        const shoulderRootZ = chestPos.z + Math.sin(chestPitch) * shoulderY;
        let gx = side * (shoulderX + 0.03);
        let gy = 0.05 + lift;
        let gz = shoulderRootZ + 0.08 + footState.z * moveW + (moveW < 0.05 ? 0.12 : 0);
        if (attackP >= 0) {
            const swipe = smooth(0.2, 0.5, attackP) * (1 - smooth(0.6, 1, attackP));
            gy += 0.2 * Math.sin(Math.PI * Math.min(1, attackP * 1.6)) * (i === 0 ? 1 : 0.6);
            gz += 0.25 * swipe;
            gx = lerp(gx, side * 0.12, swipe);
        }
        const limpW = smooth(0, 0.5, deathP);
        gy = lerp(gy, 0.04, limpW);
        gx = lerp(gx, side * (shoulderX + 0.25), limpW);
        hand[i].set(gx, gy, gz).sub(chestPos).applyQuaternion(qChestInv);
        armPole[i].set(side * 1, 0.3, -0.4).normalize();
        armFront[i].set(0, -1, 0.1);
    }

    const lunge = lungeFor(b.archetype) * attackBump;
    const lx = Math.sin(b.lookYaw);
    const lz = Math.cos(b.lookYaw);
    const stagger = -0.07 * a.flinch;
    const scale = b.size * ENEMY_SCALE;
    const rootY = b.y + 0.1 * fall * scale - (b.dead > CORPSE_SINK_START ? 0.4 * smooth(CORPSE_SINK_START, CORPSE_LIFETIME, b.dead) : 0);
    buildRoot(b, b.x + (lx * lunge + lx * stagger) * (alive ? 1 : 0), rootY, b.z + (lz * lunge + lz * stagger) * (alive ? 1 : 0), scale, fall);

    const pulse = 1 + attackBump * ATTACK_SCALE_PULSE * 0.6;
    const flashAmount = attackBump * 0.7 + a.flinch * 0.5;
    emit(m, b, slot, pulse, flashAmount, attackBump > a.flinch ? flashColor : hurtColor);
}

function drawFlyer(m: EnemyMeshes, b: Body, dt: number) {
    const a = b.anim;
    const alive = b.dead < 0;
    const slot = m.air;
    m.air = slot + 1;
    const time = b.time;

    if (alive && b.health < a.health - 0.001) {
        a.flinch = 1;
        a.flinchSide = a.flinchSide > 0 ? -1 : 1;
    }
    a.health = b.health;
    a.flinch *= Math.exp(-dt * HURT_RATE);

    const attackP = alive && b.attack >= 0 ? b.attack : -1;
    const attackBump = attackP >= 0 ? Math.sin(Math.PI * attackP) : 0;
    const deathP = alive ? 0 : clamp(b.dead / DEATH_TIME, 0, 1);
    const flap = alive ? Math.sin(time * FLYER_WING_FLAP_FREQ + b.id) * FLYER_WING_FLAP_AMOUNT * (1 - 0.35 * attackBump) : 0.9 - deathP * 0.5;
    const size = b.size;
    const lunge = lungeFor('flyer') * attackBump;
    const lx = Math.sin(b.lookYaw);
    const lz = Math.cos(b.lookYaw);
    const drop = alive ? 0 : -3.1 * smooth(0, 0.9, deathP) - (b.dead > CORPSE_SINK_START ? 0.4 * smooth(CORPSE_SINK_START, CORPSE_LIFETIME, b.dead) : 0);

    qYaw.setFromAxisAngle(UP, b.facing);
    euler.set(0.18 + 0.5 * attackBump - 0.25 * a.flinch + deathP * 1.2, 0, Math.sin(time * 1.3 + b.id) * 0.07 + deathP * 1.4 * a.flinchSide, 'YXZ');
    qA.setFromEuler(euler);
    qRoot.copy(qYaw).multiply(qA);
    mRoot.compose(vPos.set(b.x + lx * lunge, b.y + drop, b.z + lz * lunge), qRoot, vScale.set(size, size, size));

    const pulse = 1 + attackBump * 0.12;
    putMatrix(m.flyerBody, slot, mRoot, pulse, pulse, pulse);
    putMatrix(m.flyerEyes, slot, mRoot, pulse, pulse, pulse);
    const sweep = Math.cos(time * FLYER_WING_FLAP_FREQ + b.id) * 0.18 * (alive ? 1 : 0);
    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 1 : -1;
        euler.set(0, -side * sweep, side * (0.32 + flap), 'YXZ');
        qB.setFromEuler(euler);
        put(i === 0 ? m.flyerWingL : m.flyerWingR, slot, mRoot, side * 0.12, 0.1, 0.06, qB, 1, 1, 1);
    }

    const k = attackBump * 0.5 + a.flinch * 0.5;
    m.flyerBody.setColorAt(slot, k > 0.01 ? tint.copy(a.skin).lerp(a.flinch > attackBump ? hurtColor : flashColor, k) : a.skin);
    m.flyerWingL.setColorAt(slot, a.trim);
    m.flyerWingR.setColorAt(slot, a.trim);
    m.flyerEyes.setColorAt(slot, a.glow);
}

export function drawBody(m: EnemyMeshes, b: Body, dt: number, onStep: StepHandler | null) {
    if (b.archetype === 'flyer') drawFlyer(m, b, dt);
    else if (b.variant.isCrawler) drawCrawler(m, b, dt, onStep);
    else drawWalker(m, b, dt, onStep);
}

export function attackProgress(timer: number): number {
    return timer > 0 ? 1 - timer / ENEMY_ATTACK_ANIM_DURATION : -1;
}