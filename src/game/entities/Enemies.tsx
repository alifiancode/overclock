import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CapsuleGeometry, Color, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { enemies, spawnEnemy, removeDeadEnemies, pickWeightedArchetype, damageEnemy, ARCHETYPE_STATS, ZOMBIE_VARIANTS, type Enemy, type ZombieVariant } from '../data/enemies.ts';
import { world, damagePlayer, endRun } from '../state/world.ts';
import {
    DESPAWN_RADIUS,
    RUN_DURATION_SECONDS,
    ENEMY_ATTACK_ANIM_DURATION,
    RUSHER_LUNGE_DISTANCE,
    BRUISER_LUNGE_DISTANCE,
    RANGED_RECOIL_DISTANCE,
    ATTACK_SCALE_PULSE,
    RANGED_FLASH_COLOR,
    EXPLODER_LUNGE_DISTANCE,
    EXPLODER_PULSE_FREQ,
    EXPLODER_PULSE_AMOUNT,
    FLYER_LUNGE_DISTANCE,
    FLYER_WING_FLAP_FREQ,
    FLYER_WING_FLAP_AMOUNT,
} from '../data/constants.ts';
import { clearGrid, insertIntoGrid } from '../systems/spatialGrid.ts';
import { getScaling } from '../systems/enemyScaling.ts';
import { beginPlanFrame, hasLineOfSight, navGoal, resetNav, updateNav } from '../systems/navigation.ts';
import { warmFlow } from '../systems/flowField.ts';
import { findSpawnPoint, hoverAerial, idleGround, normalizeFrame, settleGround, stepAerial, stepGround, stepPeriod, wantsToHold, type SpawnPoint } from '../systems/enemyBrain.ts';

const MAX_ENEMIES = 160;
const ENEMY_CAP = 140;
const MAX_DELTA = 0.05;
const STRIDE_FREQ = 5.5;
const STRIDE_AMPLITUDE = 0.6;
const KNEE_BEND_AMOUNT = 0.85;
const ARM_REACH_ANGLE = -1.15;
const ARM_SWAY_AMPLITUDE = 0.12;
const ELBOW_BEND = 0.5;
const CRAWLER_HEIGHT_SCALE = 0.55;
const CRAWLER_LEAN = 0.5;
const TURN_SPEED = 13;
const WADE_STRIDE = 0.55;
const TAU = Math.PI * 2;
const WARM_START_SECONDS = 4;
const WARM_BUDGET = 48;

const LEG_PIVOT_Y = 0.78;
const LEG_UPPER_REACH = 0.4;
const LEG_LOWER_REACH = 0.38;
const TORSO_Y = 1.1;
const HEAD_Y = 1.58;
const ARM_PIVOT_Y = 1.35;
const ARM_UPPER_REACH = 0.32;
const ARM_LOWER_REACH = 0.3;
const ARM_X = 0.28;
const LEG_X = 0.13;

const root = new Object3D();
const part = new Object3D();
const jointA = new Object3D();
const jointB = new Object3D();
const spawnPoint: SpawnPoint = { x: 0, y: 0, z: 0, building: -1, floor: 0 };
const spawnVector = new Vector3();
const flashColor = new Color(RANGED_FLASH_COLOR);
const tint = new Color();
const white = new Color(1, 1, 1);

type VariantPalette = { variant: ZombieVariant; skin: Color; trim: Color; glow: Color };

const palettes = new Map<string, VariantPalette>(
    ZOMBIE_VARIANTS.map((v) => [v.id, { variant: v, skin: new Color(v.skinColor), trim: new Color(v.trimColor), glow: new Color(v.glowColor) }])
);
const fallbackPalette = palettes.get(ZOMBIE_VARIANTS[0].id)!;

type MeshSet = {
    torso: InstancedMesh;
    head: InstancedMesh;
    eye: InstancedMesh;
    upperArmL: InstancedMesh;
    lowerArmL: InstancedMesh;
    upperArmR: InstancedMesh;
    lowerArmR: InstancedMesh;
    upperLegL: InstancedMesh;
    lowerLegL: InstancedMesh;
    upperLegR: InstancedMesh;
    lowerLegR: InstancedMesh;
    rib: InstancedMesh;
    sac: InstancedMesh;
    flyerBody: InstancedMesh;
    flyerWingL: InstancedMesh;
    flyerWingR: InstancedMesh;
    flyerEyeL: InstancedMesh;
    flyerEyeR: InstancedMesh;
};

function buildRibGeometry() {
    const slats = [0, 1, 2].map((i) => {
        const box = new BoxGeometry(0.32, 0.05, 0.05);
        box.translate(0, 0.15 - i * 0.13, 0.14);
        return box;
    });
    return mergeGeometries(slats);
}

function writePart(
    mesh: InstancedMesh,
    slot: number,
    size: number,
    heightScale: number,
    localX: number,
    localY: number,
    localZ: number,
    rotX: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number
) {
    part.position.set(localX * size, localY * size * heightScale, localZ * size);
    part.rotation.set(rotX, 0, 0);
    part.scale.set(size * scaleX, size * scaleY, size * scaleZ);
    part.updateMatrix();
    part.matrix.premultiply(root.matrix);
    mesh.setMatrixAt(slot, part.matrix);
}

function writeWing(mesh: InstancedMesh, slot: number, size: number, localX: number, roll: number) {
    part.position.set(localX * size, 0.16 * size, -0.05 * size);
    part.rotation.set(0, 0, roll);
    part.scale.set(size * 1.1, size, size * 0.6);
    part.updateMatrix();
    part.matrix.premultiply(root.matrix);
    mesh.setMatrixAt(slot, part.matrix);
}

function writeJointedLimb(
    upperMesh: InstancedMesh,
    lowerMesh: InstancedMesh,
    slot: number,
    size: number,
    heightScale: number,
    pivotX: number,
    pivotY: number,
    swingX: number,
    upperReach: number,
    bendX: number,
    lowerReach: number,
    thickness: number
) {
    jointA.position.set(pivotX * size, pivotY * size * heightScale, 0);
    jointA.rotation.set(swingX, 0, 0);
    jointA.scale.setScalar(1);
    jointA.updateMatrix();
    jointA.matrix.premultiply(root.matrix);

    part.position.set(0, -upperReach * size * 0.5, 0);
    part.rotation.set(0, 0, 0);
    part.scale.setScalar(size * thickness);
    part.updateMatrix();
    part.matrix.premultiply(jointA.matrix);
    upperMesh.setMatrixAt(slot, part.matrix);

    jointB.position.set(0, -upperReach * size, 0);
    jointB.rotation.set(bendX, 0, 0);
    jointB.scale.setScalar(1);
    jointB.updateMatrix();
    jointB.matrix.premultiply(jointA.matrix);

    part.position.set(0, -lowerReach * size * 0.5, 0);
    part.rotation.set(0, 0, 0);
    part.scale.setScalar(size * thickness);
    part.updateMatrix();
    part.matrix.premultiply(jointB.matrix);
    lowerMesh.setMatrixAt(slot, part.matrix);
}

function lungeFor(enemy: Enemy): number {
    switch (enemy.archetype) {
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

function turnToward(enemy: Enemy, target: number, delta: number) {
    let diff = target - enemy.facing;
    diff -= Math.round(diff / TAU) * TAU;
    enemy.facing += diff * (1 - Math.exp(-TURN_SPEED * delta));
}

function simulate(delta: number, time: number, frame: number, spawnTimer: { value: number }) {
    removeDeadEnemies();
    clearGrid();

    world.run.elapsedSeconds += delta;
    if (world.run.elapsedSeconds >= RUN_DURATION_SECONDS) {
        endRun();
        return;
    }

    const player = world.player;
    const px = player.position.x;
    const pz = player.position.z;
    const playerBuilding = player.buildingIndex;
    const playerFloor = player.currentFloor;

    spawnTimer.value -= delta;
    if (spawnTimer.value <= 0 && enemies.length < ENEMY_CAP) {
        const scaling = getScaling(world.run.elapsedSeconds, world.dangerDial);
        const archetype = pickWeightedArchetype();
        if (findSpawnPoint(px, pz, playerBuilding, archetype === 'flyer', spawnPoint)) {
            spawnVector.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);
            const created = spawnEnemy(archetype, spawnVector, scaling.healthMultiplier);
            created.currentBuildingIndex = spawnPoint.building;
            created.currentFloor = spawnPoint.floor;
        }
        spawnTimer.value = scaling.spawnInterval;
    }

    beginPlanFrame();
    navGoal.y = player.position.y + 0.3;
    if (enemies.length > 0) updateNav(px, pz, playerFloor, playerBuilding);
    if (enemies.length > 0 || world.run.elapsedSeconds < WARM_START_SECONDS) warmFlow(px, pz, WARM_BUDGET);

    for (let i = 0; i < enemies.length; i++) {
        normalizeFrame(enemies[i], px, pz);
        insertIntoGrid(enemies[i]);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const stats = ARCHETYPE_STATS[enemy.archetype];
        const dx = px - enemy.position.x;
        const dz = pz - enemy.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > DESPAWN_RADIUS) {
            enemies[i] = enemies[enemies.length - 1];
            enemies.pop();
            continue;
        }

        enemy.attackFlashTimer = enemy.attackFlashTimer > delta ? enemy.attackFlashTimer - delta : 0;
        if (enemy.attackCooldown > 0) enemy.attackCooldown -= delta;

        if (!player.alive) {
            enemy.moving = false;
            continue;
        }

        enemy.stepTime += delta;
        const period = stepPeriod(distance);
        if (period === 1 || (frame + enemy.id) % period === 0) {
            const step = enemy.stepTime;
            enemy.stepTime = 0;
            if (stats.isAerial) {
                if (distance > 0.6) stepAerial(enemy, step, time);
                else enemy.moving = false;
                hoverAerial(enemy, step, time);
            } else {
                if (wantsToHold(enemy, distance)) idleGround(enemy);
                else stepGround(enemy, step);
                settleGround(enemy, step);
            }
        }

        if (
            distance <= stats.contactRange &&
            enemy.attackCooldown <= 0 &&
            enemy.currentBuildingIndex === playerBuilding &&
            enemy.currentFloor === playerFloor &&
            hasLineOfSight(enemy.position.x, enemy.position.z, px, pz, enemy.currentBuildingIndex, enemy.currentFloor)
        ) {
            damagePlayer(stats.contactDamage);
            enemy.attackCooldown = stats.contactCooldown;
            enemy.attackFlashTimer = ENEMY_ATTACK_ANIM_DURATION;
            if (stats.selfDestructs) damageEnemy(enemy, enemy.health);
        }
    }
}

function render(m: MeshSet, delta: number, time: number) {
    const player = world.player;
    const px = player.position.x;
    const pz = player.position.z;
    const hideAbove = player.buildingIndex >= 0;
    let ground = 0;
    let air = 0;
    let ribs = 0;
    let sacs = 0;

    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (hideAbove && enemy.currentBuildingIndex === player.buildingIndex && enemy.currentFloor > player.currentFloor) continue;

        const stats = ARCHETYPE_STATS[enemy.archetype];
        const palette = palettes.get(enemy.variantId) ?? fallbackPalette;
        const variant = palette.variant;
        const dx = px - enemy.position.x;
        const dz = pz - enemy.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const lungeX = distance > 0.01 ? dx / distance : 0;
        const lungeZ = distance > 0.01 ? dz / distance : 0;

        const towardPlayer = Math.atan2(lungeX, lungeZ);
        const heading = Math.atan2(enemy.headingX, enemy.headingZ);
        const facingTarget = stats.isAerial || !enemy.moving ? towardPlayer : heading;
        turnToward(enemy, facingTarget, delta);

        const attackProgress = enemy.attackFlashTimer > 0 ? 1 - enemy.attackFlashTimer / ENEMY_ATTACK_ANIM_DURATION : 0;
        const attackCurve = enemy.attackFlashTimer > 0 ? Math.sin(attackProgress * Math.PI) : 0;
        const lungeDist = lungeFor(enemy);
        const emberPulse = enemy.archetype === 'exploder' ? 1 + Math.sin(time * EXPLODER_PULSE_FREQ + enemy.id) * EXPLODER_PULSE_AMOUNT : 1;
        const bodyScale = stats.size * (1 + attackCurve * ATTACK_SCALE_PULSE) * emberPulse;
        const pulse = bodyScale / stats.size;
        const moving = enemy.moving;
        if (moving) enemy.phase += delta * STRIDE_FREQ * (enemy.wading > 0.05 ? WADE_STRIDE : 1);
        const heightScale = variant.isCrawler ? CRAWLER_HEIGHT_SCALE : 1;

        root.position.set(enemy.position.x + lungeX * attackCurve * lungeDist, enemy.position.y, enemy.position.z + lungeZ * attackCurve * lungeDist);
        if (moving) root.position.y += Math.sin(enemy.phase * 1.6 + enemy.id) * 0.04 * heightScale;
        root.rotation.set(variant.isCrawler ? CRAWLER_LEAN : 0, enemy.facing, 0);
        root.scale.setScalar(1);
        root.updateMatrix();

        if (stats.isAerial) {
            const flap = Math.sin(time * FLYER_WING_FLAP_FREQ + enemy.id) * FLYER_WING_FLAP_AMOUNT;
            const size = stats.size;
            writePart(m.flyerBody, air, size, 1, 0, 0.15, 0, 0, 0.62 * pulse, 0.58 * pulse, 1.5 * pulse);
            writeWing(m.flyerWingL, air, size, -0.5, 0.32 + flap);
            writeWing(m.flyerWingR, air, size, 0.5, -0.32 - flap);
            writePart(m.flyerEyeL, air, size, 1, 0.09, 0.22, 0.32, 0, 1, 1, 1);
            writePart(m.flyerEyeR, air, size, 1, -0.09, 0.22, 0.32, 0, 1, 1, 1);
            tint.copy(palette.skin);
            if (attackCurve > 0) tint.lerp(flashColor, attackCurve * 0.5);
            m.flyerBody.setColorAt(air, tint);
            m.flyerWingL.setColorAt(air, palette.trim);
            m.flyerWingR.setColorAt(air, palette.trim);
            m.flyerEyeL.setColorAt(air, palette.glow);
            m.flyerEyeR.setColorAt(air, palette.glow);
            air++;
            continue;
        }

        const strideT = enemy.phase + enemy.id;
        const swing = moving ? Math.sin(strideT) * STRIDE_AMPLITUDE : 0;
        const kneeL = moving ? Math.max(0, Math.sin(strideT)) * KNEE_BEND_AMOUNT : 0;
        const kneeR = moving ? Math.max(0, -Math.sin(strideT)) * KNEE_BEND_AMOUNT : 0;
        const armSway = Math.sin(strideT * 2) * ARM_SWAY_AMPLITUDE;
        const size = stats.size;
        const crawler = variant.isCrawler;

        writePart(m.torso, ground, size, heightScale, 0, TORSO_Y, 0, crawler ? 0.9 : 0, variant.torsoScale[0] * pulse, variant.torsoScale[1] * pulse, variant.torsoScale[2] * pulse);
        writePart(m.head, ground, size, heightScale, 0, HEAD_Y, crawler ? 0.15 : 0.02, crawler ? 0.6 : 0, variant.headScale[0], variant.headScale[1], variant.headScale[2]);
        writePart(m.eye, ground, size, heightScale, 0, HEAD_Y + 0.03, 0.2, crawler ? 0.6 : 0, 1, 1, 1);

        if (!variant.hasOneArm) {
            writeJointedLimb(m.upperArmL, m.lowerArmL, ground, size, heightScale, -ARM_X, ARM_PIVOT_Y, ARM_REACH_ANGLE + armSway, ARM_UPPER_REACH, ELBOW_BEND, ARM_LOWER_REACH, variant.armScale);
        } else {
            writeJointedLimb(m.upperArmL, m.lowerArmL, ground, size, heightScale, -ARM_X, ARM_PIVOT_Y, 0, ARM_UPPER_REACH, 0, ARM_LOWER_REACH, 0.001);
        }
        writeJointedLimb(m.upperArmR, m.lowerArmR, ground, size, heightScale, ARM_X, ARM_PIVOT_Y, ARM_REACH_ANGLE - armSway, ARM_UPPER_REACH, ELBOW_BEND, ARM_LOWER_REACH, variant.armScale);
        writeJointedLimb(m.upperLegL, m.lowerLegL, ground, size, heightScale, -LEG_X, LEG_PIVOT_Y, swing, LEG_UPPER_REACH, kneeL, LEG_LOWER_REACH, variant.legScale);
        writeJointedLimb(m.upperLegR, m.lowerLegR, ground, size, heightScale, LEG_X, LEG_PIVOT_Y, -swing, LEG_UPPER_REACH, kneeR, LEG_LOWER_REACH, variant.legScale);

        if (variant.hasRibs) {
            writePart(m.rib, ribs, size, heightScale, 0, TORSO_Y, 0.02, crawler ? 0.9 : 0, variant.torsoScale[0], variant.torsoScale[1], variant.torsoScale[2]);
            m.rib.setColorAt(ribs, palette.trim);
            ribs++;
        }
        if (variant.hasSac) {
            writePart(m.sac, sacs, size, heightScale, -0.1, TORSO_Y + 0.1, -0.3, 0, 1, 1.2, 0.9);
            m.sac.setColorAt(sacs, palette.trim);
            sacs++;
        }

        tint.copy(palette.skin);
        if ((enemy.archetype === 'ranged' || enemy.archetype === 'spitter') && attackCurve > 0) tint.lerp(flashColor, attackCurve);
        m.torso.setColorAt(ground, tint);
        m.head.setColorAt(ground, tint);
        m.upperArmL.setColorAt(ground, tint);
        m.lowerArmL.setColorAt(ground, tint);
        m.upperArmR.setColorAt(ground, tint);
        m.lowerArmR.setColorAt(ground, tint);
        m.upperLegL.setColorAt(ground, tint);
        m.lowerLegL.setColorAt(ground, tint);
        m.upperLegR.setColorAt(ground, tint);
        m.lowerLegR.setColorAt(ground, tint);
        m.eye.setColorAt(ground, palette.glow);
        ground++;
    }

    const groundMeshes = [m.torso, m.head, m.eye, m.upperArmL, m.lowerArmL, m.upperArmR, m.lowerArmR, m.upperLegL, m.lowerLegL, m.upperLegR, m.lowerLegR];
    for (let i = 0; i < groundMeshes.length; i++) finish(groundMeshes[i], ground);
    finish(m.rib, ribs);
    finish(m.sac, sacs);
    finish(m.flyerBody, air);
    finish(m.flyerWingL, air);
    finish(m.flyerWingR, air);
    finish(m.flyerEyeL, air);
    finish(m.flyerEyeR, air);
}

function finish(mesh: InstancedMesh, count: number) {
    mesh.count = count;
    if (count === 0) return;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function Enemies() {
    const torsoRef = useRef<InstancedMesh>(null!);
    const headRef = useRef<InstancedMesh>(null!);
    const upperArmLRef = useRef<InstancedMesh>(null!);
    const lowerArmLRef = useRef<InstancedMesh>(null!);
    const upperArmRRef = useRef<InstancedMesh>(null!);
    const lowerArmRRef = useRef<InstancedMesh>(null!);
    const upperLegLRef = useRef<InstancedMesh>(null!);
    const lowerLegLRef = useRef<InstancedMesh>(null!);
    const upperLegRRef = useRef<InstancedMesh>(null!);
    const lowerLegRRef = useRef<InstancedMesh>(null!);
    const eyeRef = useRef<InstancedMesh>(null!);
    const ribRef = useRef<InstancedMesh>(null!);
    const sacRef = useRef<InstancedMesh>(null!);
    const flyerBodyRef = useRef<InstancedMesh>(null!);
    const flyerWingLRef = useRef<InstancedMesh>(null!);
    const flyerWingRRef = useRef<InstancedMesh>(null!);
    const flyerEyeLRef = useRef<InstancedMesh>(null!);
    const flyerEyeRRef = useRef<InstancedMesh>(null!);
    const meshSet = useRef<MeshSet | null>(null);

    const torsoGeo = useMemo(() => new CapsuleGeometry(0.26, 0.46, 4, 8), []);
    const headGeo = useMemo(() => new SphereGeometry(0.22, 8, 8), []);
    const upperArmGeo = useMemo(() => new CapsuleGeometry(0.075, 0.2, 3, 6), []);
    const lowerArmGeo = useMemo(() => new CapsuleGeometry(0.065, 0.18, 3, 6), []);
    const upperLegGeo = useMemo(() => new CapsuleGeometry(0.1, 0.24, 3, 6), []);
    const lowerLegGeo = useMemo(() => new CapsuleGeometry(0.085, 0.22, 3, 6), []);
    const eyeGeo = useMemo(() => new SphereGeometry(0.06, 6, 6), []);
    const ribGeo = useMemo(buildRibGeometry, []);
    const sacGeo = useMemo(() => new SphereGeometry(0.3, 8, 6), []);
    const flyerBodyGeo = useMemo(() => new SphereGeometry(0.26, 8, 6), []);
    const flyerWingGeo = useMemo(() => new BoxGeometry(1, 0.04, 0.5), []);
    const flyerEyeGeo = useMemo(() => new SphereGeometry(0.045, 6, 6), []);
    const bodyMaterial = useMemo(() => new MeshLambertMaterial(), []);
    const sacMaterial = useMemo(() => new MeshLambertMaterial({ transparent: true, opacity: 0.85 }), []);
    const eyeMaterial = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);

    const animTime = useRef(0);
    const frame = useRef(0);
    const spawnTimer = useRef({ value: 0.4 });

    useLayoutEffect(() => {
        enemies.length = 0;
        resetNav();
        const set: MeshSet = {
            torso: torsoRef.current,
            head: headRef.current,
            eye: eyeRef.current,
            upperArmL: upperArmLRef.current,
            lowerArmL: lowerArmLRef.current,
            upperArmR: upperArmRRef.current,
            lowerArmR: lowerArmRRef.current,
            upperLegL: upperLegLRef.current,
            lowerLegL: lowerLegLRef.current,
            upperLegR: upperLegRRef.current,
            lowerLegR: lowerLegRRef.current,
            rib: ribRef.current,
            sac: sacRef.current,
            flyerBody: flyerBodyRef.current,
            flyerWingL: flyerWingLRef.current,
            flyerWingR: flyerWingRRef.current,
            flyerEyeL: flyerEyeLRef.current,
            flyerEyeR: flyerEyeRRef.current,
        };
        for (const mesh of Object.values(set)) {
            mesh.setColorAt(0, white);
            mesh.count = 0;
        }
        meshSet.current = set;
        return () => {
            enemies.length = 0;
            meshSet.current = null;
        };
    }, []);

    useFrame((_, rawDelta) => {
        const set = meshSet.current;
        if (!set || world.pendingUpgradeChoices > 0 || world.run.over) return;
        const delta = rawDelta > MAX_DELTA ? MAX_DELTA : rawDelta;
        animTime.current += delta;
        frame.current++;
        simulate(delta, animTime.current, frame.current, spawnTimer.current);
        render(set, delta, animTime.current);
    });

    return (
        <>
            <instancedMesh ref={torsoRef} args={[torsoGeo, bodyMaterial, MAX_ENEMIES]} castShadow frustumCulled={false} />
            <instancedMesh ref={headRef} args={[headGeo, bodyMaterial, MAX_ENEMIES]} castShadow frustumCulled={false} />
            <instancedMesh ref={upperArmLRef} args={[upperArmGeo, bodyMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={lowerArmLRef} args={[lowerArmGeo, bodyMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={upperArmRRef} args={[upperArmGeo, bodyMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={lowerArmRRef} args={[lowerArmGeo, bodyMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={upperLegLRef} args={[upperLegGeo, bodyMaterial, MAX_ENEMIES]} castShadow frustumCulled={false} />
            <instancedMesh ref={lowerLegLRef} args={[lowerLegGeo, bodyMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={upperLegRRef} args={[upperLegGeo, bodyMaterial, MAX_ENEMIES]} castShadow frustumCulled={false} />
            <instancedMesh ref={lowerLegRRef} args={[lowerLegGeo, bodyMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={ribRef} args={[ribGeo, bodyMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={sacRef} args={[sacGeo, sacMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={eyeRef} args={[eyeGeo, eyeMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={flyerBodyRef} args={[flyerBodyGeo, bodyMaterial, MAX_ENEMIES]} castShadow frustumCulled={false} />
            <instancedMesh ref={flyerWingLRef} args={[flyerWingGeo, bodyMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={flyerWingRRef} args={[flyerWingGeo, bodyMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={flyerEyeLRef} args={[flyerEyeGeo, eyeMaterial, MAX_ENEMIES]} frustumCulled={false} />
            <instancedMesh ref={flyerEyeRRef} args={[flyerEyeGeo, eyeMaterial, MAX_ENEMIES]} frustumCulled={false} />
        </>
    );
}