import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CapsuleGeometry, Color, InstancedMesh, Object3D, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
    enemies,
    spawnEnemy,
    removeDeadEnemies,
    pickWeightedArchetype,
    damageEnemy,
    ARCHETYPE_STATS,
    ZOMBIE_VARIANTS,
} from '../data/enemies.ts';
import { world, damagePlayer, endRun } from '../state/world.ts';
import {
    ENEMY_SPAWN_RADIUS,
    RUN_DURATION_SECONDS,
    ENEMY_ATTACK_ANIM_DURATION,
    RUSHER_LUNGE_DISTANCE,
    BRUISER_LUNGE_DISTANCE,
    RANGED_RECOIL_DISTANCE,
    ATTACK_SCALE_PULSE,
    RANGED_FLASH_COLOR,
    PLAYABLE_RADIUS,
    PLAYER_Y_LERP,
    EXPLODER_LUNGE_DISTANCE,
    EXPLODER_PULSE_FREQ,
    EXPLODER_PULSE_AMOUNT,
    FLYER_LUNGE_DISTANCE,
    FLYER_HOVER_BOB_FREQ,
    FLYER_HOVER_BOB_AMPLITUDE,
    FLYER_WING_FLAP_FREQ,
    FLYER_WING_FLAP_AMOUNT,
} from '../data/constants.ts';
import { clearGrid, insertIntoGrid } from '../systems/spatialGrid.ts';
import { getScaling } from '../systems/enemyScaling.ts';
import { resolvePropCollision, resolveFloor } from '../systems/obstacles.ts';
import { resolveDoorCollision } from '../systems/doors.ts';
import { getTerrainHeight } from '../systems/terrain.ts';
import { hasLineOfSight, getGroundMoveDirection, escapeDirection } from '../systems/navigation.ts';

const MAX_ENEMIES = 200;
const STUCK_PROGRESS_THRESHOLD = 0.4;
const STUCK_TIME_THRESHOLD = 1.0;
const ESCAPE_PROGRESS_DISTANCE = 2.5;
const ESCAPE_MAX_DURATION = 8.0;
const STRIDE_FREQ = 5.5;
const STRIDE_AMPLITUDE = 0.6;
const KNEE_BEND_AMOUNT = 0.85;
const ARM_REACH_ANGLE = -1.15;
const ARM_SWAY_AMPLITUDE = 0.12;
const ELBOW_BEND = 0.5;
const CRAWLER_HEIGHT_SCALE = 0.55;
const CRAWLER_LEAN = 0.5;

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
const toPlayer = new Vector3();
const variantById = new Map(ZOMBIE_VARIANTS.map((v) => [v.id, v]));

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
    rotY: number,
    rotZ: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number
) {
    part.position.set(localX * size, localY * size * heightScale, localZ * size);
    part.rotation.set(rotX, rotY, rotZ);
    part.scale.set(size * scaleX, size * scaleY, size * scaleZ);
    part.updateMatrix();
    part.matrix.premultiply(root.matrix);
    mesh.setMatrixAt(slot, part.matrix);
}

function hidePart(mesh: InstancedMesh, slot: number) {
    part.position.set(0, -500, 0);
    part.rotation.set(0, 0, 0);
    part.scale.set(0.0001, 0.0001, 0.0001);
    part.updateMatrix();
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
    pivotZ: number,
    swingX: number,
    swingY: number,
    swingZ: number,
    upperReach: number,
    bendX: number,
    lowerReach: number,
    thickness: number
) {
    jointA.position.set(pivotX * size, pivotY * size * heightScale, pivotZ * size);
    jointA.rotation.set(swingX, swingY, swingZ);
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

    const animTime = useRef(0);
    const spawnTimer = useRef(0);
    const colorScratch = useRef(new Color());
    const trimScratch = useRef(new Color());
    const glowScratch = useRef(new Color());
    const flashScratch = useRef(new Color(RANGED_FLASH_COLOR));

    useEffect(() => {
        enemies.length = 0;
    }, []);

    useFrame((_, delta) => {
        if (world.pendingUpgradeChoices > 0 || world.run.over) return;
        removeDeadEnemies();
        clearGrid();
        animTime.current += delta;

        world.run.elapsedSeconds += delta;
        if (world.run.elapsedSeconds >= RUN_DURATION_SECONDS) {
            endRun();
            return;
        }
        const scaling = getScaling(world.run.elapsedSeconds, world.dangerDial);
        spawnTimer.current -= delta;
        if (spawnTimer.current <= 0 && enemies.length < MAX_ENEMIES) {
            const angle = Math.random() * Math.PI * 2;
            const position = new Vector3(
                world.player.position.x + Math.cos(angle) * ENEMY_SPAWN_RADIUS,
                0.1,
                world.player.position.z + Math.sin(angle) * ENEMY_SPAWN_RADIUS
            );
            spawnEnemy(pickWeightedArchetype(), position, scaling.healthMultiplier);
            spawnTimer.current = scaling.spawnInterval;
        }

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const stats = ARCHETYPE_STATS[enemy.archetype];
            const variant = variantById.get(enemy.variantId) ?? ZOMBIE_VARIANTS[0];
            let isMoving = false;
            let facingAngle = 0;

            if (world.player.alive) {
                toPlayer.copy(world.player.position).sub(enemy.position);
                toPlayer.y = 0;
                const distance = toPlayer.length();
                const sameSpace = enemy.currentBuildingIndex === world.player.buildingIndex && enemy.currentFloor === world.player.currentFloor;
                isMoving = stats.isAerial
                    ? distance > stats.preferredRange && distance > 0.01
                    : !sameSpace || (distance > stats.preferredRange && distance > 0.01);
                if (distance > 0.01) {
                    toPlayer.normalize();
                    facingAngle = Math.atan2(toPlayer.x, toPlayer.z);
                }
                if (isMoving) {
                    let moveX = toPlayer.x;
                    let moveZ = toPlayer.z;

                    if (!stats.isAerial) {
                        let resolvedByEscape = false;

                        if (enemy.escapeTimer > 0) {
                            const escapeProgress = Math.hypot(enemy.position.x - enemy.escapeAnchorX, enemy.position.z - enemy.escapeAnchorZ);
                            enemy.escapeTimer -= delta;
                            if (escapeProgress > ESCAPE_PROGRESS_DISTANCE || enemy.escapeTimer <= 0) {
                                enemy.escapeTimer = 0;
                                enemy.stuckTimer = 0;
                                enemy.stuckAnchorX = enemy.position.x;
                                enemy.stuckAnchorZ = enemy.position.z;
                            } else {
                                moveX = enemy.escapeDirX;
                                moveZ = enemy.escapeDirZ;
                                resolvedByEscape = true;
                            }
                        }

                        if (!resolvedByEscape) {
                            const progressSinceAnchor = Math.hypot(enemy.position.x - enemy.stuckAnchorX, enemy.position.z - enemy.stuckAnchorZ);
                            if (progressSinceAnchor > STUCK_PROGRESS_THRESHOLD) {
                                enemy.stuckAnchorX = enemy.position.x;
                                enemy.stuckAnchorZ = enemy.position.z;
                                enemy.stuckTimer = 0;
                            } else {
                                enemy.stuckTimer += delta;
                            }

                            if (enemy.stuckTimer > STUCK_TIME_THRESHOLD) {
                                enemy.escapeTimer = ESCAPE_MAX_DURATION;
                                enemy.escapeAnchorX = enemy.position.x;
                                enemy.escapeAnchorZ = enemy.position.z;
                                const esc = escapeDirection(enemy.position.x, enemy.position.z, enemy.currentFloor, world.player.position.x, world.player.position.z);
                                enemy.escapeDirX = esc ? esc.x : 0;
                                enemy.escapeDirZ = esc ? esc.z : 0;
                                moveX = enemy.escapeDirX;
                                moveZ = enemy.escapeDirZ;
                            } else {
                                const dir = getGroundMoveDirection(
                                    enemy.position.x,
                                    enemy.position.z,
                                    enemy.currentBuildingIndex,
                                    enemy.currentFloor,
                                    world.player.position.x,
                                    world.player.position.z,
                                    world.player.buildingIndex,
                                    world.player.currentFloor
                                );
                                if (dir) {
                                    moveX = dir.x;
                                    moveZ = dir.z;
                                }
                            }
                        }

                        facingAngle = Math.atan2(moveX, moveZ);
                    }

                    let nextX = enemy.position.x + moveX * stats.speed * delta;
                    let nextZ = enemy.position.z + moveZ * stats.speed * delta;
                    const distFromCenter = Math.hypot(nextX, nextZ);
                    if (distFromCenter > PLAYABLE_RADIUS) {
                        const scale = PLAYABLE_RADIUS / distFromCenter;
                        nextX *= scale;
                        nextZ *= scale;
                    }
                    if (stats.isAerial) {
                        enemy.position.x = nextX;
                        enemy.position.z = nextZ;
                    } else {
                        const propResolved = resolvePropCollision(nextX, nextZ, enemy.currentFloor);
                        const resolved = resolveDoorCollision(propResolved.x, propResolved.z);
                        enemy.position.x = resolved.x;
                        enemy.position.z = resolved.z;
                    }
                }

                enemy.attackCooldown -= delta;
                if (
                    distance <= stats.contactRange &&
                    enemy.attackCooldown <= 0 &&
                    sameSpace &&
                    hasLineOfSight(enemy.position.x, enemy.position.z, world.player.position.x, world.player.position.z, enemy.currentBuildingIndex, enemy.currentFloor)
                ) {
                    damagePlayer(stats.contactDamage);
                    enemy.attackCooldown = stats.contactCooldown;
                    enemy.attackFlashTimer = ENEMY_ATTACK_ANIM_DURATION;
                    if (stats.selfDestructs) damageEnemy(enemy, enemy.health);
                }
                insertIntoGrid(enemy);
            }

            if (stats.isAerial) {
                const hoverTarget =
                    getTerrainHeight(enemy.position.x, enemy.position.z) +
                    (stats.hoverHeight ?? 3) +
                    Math.sin(animTime.current * FLYER_HOVER_BOB_FREQ + enemy.id) * FLYER_HOVER_BOB_AMPLITUDE;
                enemy.position.y += (hoverTarget - enemy.position.y) * PLAYER_Y_LERP;
            } else {
                const floorResult = resolveFloor(enemy.position.x, enemy.position.z, enemy.currentFloor);
                enemy.currentFloor = floorResult.floor;
                enemy.currentBuildingIndex = floorResult.buildingIndex;
                enemy.position.y += (floorResult.y + 0.1 - enemy.position.y) * PLAYER_Y_LERP;
            }

            enemy.attackFlashTimer = Math.max(0, enemy.attackFlashTimer - delta);
            const attackProgress = enemy.attackFlashTimer > 0 ? 1 - enemy.attackFlashTimer / ENEMY_ATTACK_ANIM_DURATION : 0;
            const attackCurve = enemy.attackFlashTimer > 0 ? Math.sin(attackProgress * Math.PI) : 0;

            const lungeDist =
                enemy.archetype === 'ranged' || enemy.archetype === 'spitter'
                    ? -RANGED_RECOIL_DISTANCE
                    : enemy.archetype === 'bruiser'
                      ? BRUISER_LUNGE_DISTANCE
                      : enemy.archetype === 'exploder'
                        ? EXPLODER_LUNGE_DISTANCE
                        : enemy.archetype === 'flyer'
                          ? FLYER_LUNGE_DISTANCE
                          : RUSHER_LUNGE_DISTANCE;
            const emberPulse = enemy.archetype === 'exploder' ? 1 + Math.sin(animTime.current * EXPLODER_PULSE_FREQ + enemy.id) * EXPLODER_PULSE_AMOUNT : 1;
            const bodyScale = stats.size * (1 + attackCurve * ATTACK_SCALE_PULSE) * emberPulse;
            const pulse = bodyScale / stats.size;

            const heightScale = variant.isCrawler ? CRAWLER_HEIGHT_SCALE : 1;
            root.position.copy(enemy.position);
            if (isMoving) root.position.y += Math.sin(animTime.current * STRIDE_FREQ * 1.6 + enemy.id) * 0.04 * heightScale;
            if (attackCurve > 0) root.position.addScaledVector(toPlayer, attackCurve * lungeDist);
            root.rotation.set(variant.isCrawler ? CRAWLER_LEAN : 0, facingAngle, 0);
            root.scale.setScalar(1);
            root.updateMatrix();

            const strideT = animTime.current * STRIDE_FREQ + enemy.id;
            const swing = isMoving ? Math.sin(strideT) * STRIDE_AMPLITUDE : 0;
            const kneeL = isMoving ? Math.max(0, Math.sin(strideT)) * KNEE_BEND_AMOUNT : 0;
            const kneeR = isMoving ? Math.max(0, -Math.sin(strideT)) * KNEE_BEND_AMOUNT : 0;
            const armSway = Math.sin(strideT * 2) * ARM_SWAY_AMPLITUDE;

            if (!stats.isAerial) {
                writePart(torsoRef.current, i, stats.size, heightScale, 0, TORSO_Y, 0, variant.isCrawler ? 0.9 : 0, 0, 0,
                    variant.torsoScale[0] * pulse, variant.torsoScale[1] * pulse, variant.torsoScale[2] * pulse);
                writePart(headRef.current, i, stats.size, heightScale, 0, HEAD_Y, variant.isCrawler ? 0.15 : 0.02, variant.isCrawler ? 0.6 : 0, 0, 0,
                    variant.headScale[0], variant.headScale[1], variant.headScale[2]);
                writePart(eyeRef.current, i, stats.size, heightScale, 0, HEAD_Y + 0.03, 0.2, variant.isCrawler ? 0.6 : 0, 0, 0, 1, 1, 1);

                if (!variant.hasOneArm) {
                    writeJointedLimb(upperArmLRef.current, lowerArmLRef.current, i, stats.size, heightScale,
                        -ARM_X, ARM_PIVOT_Y, 0, ARM_REACH_ANGLE + armSway, 0, 0, ARM_UPPER_REACH, ELBOW_BEND, ARM_LOWER_REACH, variant.armScale);
                } else {
                    writeJointedLimb(upperArmLRef.current, lowerArmLRef.current, i, stats.size, heightScale,
                        -ARM_X, ARM_PIVOT_Y, 0, 0, 0, 0, ARM_UPPER_REACH, 0, ARM_LOWER_REACH, 0.001);
                }
                writeJointedLimb(upperArmRRef.current, lowerArmRRef.current, i, stats.size, heightScale,
                    ARM_X, ARM_PIVOT_Y, 0, ARM_REACH_ANGLE - armSway, 0, 0, ARM_UPPER_REACH, ELBOW_BEND, ARM_LOWER_REACH, variant.armScale);

                writeJointedLimb(upperLegLRef.current, lowerLegLRef.current, i, stats.size, heightScale,
                    -LEG_X, LEG_PIVOT_Y, 0, swing, 0, 0, LEG_UPPER_REACH, kneeL, LEG_LOWER_REACH, variant.legScale);
                writeJointedLimb(upperLegRRef.current, lowerLegRRef.current, i, stats.size, heightScale,
                    LEG_X, LEG_PIVOT_Y, 0, -swing, 0, 0, LEG_UPPER_REACH, kneeR, LEG_LOWER_REACH, variant.legScale);

                if (variant.hasRibs) {
                    writePart(ribRef.current, i, stats.size, heightScale, 0, TORSO_Y, 0.02, variant.isCrawler ? 0.9 : 0, 0, 0,
                        variant.torsoScale[0], variant.torsoScale[1], variant.torsoScale[2]);
                } else {
                    writePart(ribRef.current, i, stats.size, heightScale, 0, TORSO_Y, 0, 0, 0, 0, 0.001, 0.001, 0.001);
                }
                if (variant.hasSac) {
                    writePart(sacRef.current, i, stats.size, heightScale, -0.1, TORSO_Y + 0.1, -0.3, 0, 0, 0, 1, 1.2, 0.9);
                } else {
                    writePart(sacRef.current, i, stats.size, heightScale, 0, TORSO_Y, 0, 0, 0, 0, 0.001, 0.001, 0.001);
                }

                hidePart(flyerBodyRef.current, i);
                hidePart(flyerWingLRef.current, i);
                hidePart(flyerWingRRef.current, i);
                hidePart(flyerEyeLRef.current, i);
                hidePart(flyerEyeRRef.current, i);
            } else {
                hidePart(torsoRef.current, i);
                hidePart(headRef.current, i);
                hidePart(eyeRef.current, i);
                hidePart(upperArmLRef.current, i);
                hidePart(lowerArmLRef.current, i);
                hidePart(upperArmRRef.current, i);
                hidePart(lowerArmRRef.current, i);
                hidePart(upperLegLRef.current, i);
                hidePart(lowerLegLRef.current, i);
                hidePart(upperLegRRef.current, i);
                hidePart(lowerLegRRef.current, i);
                hidePart(ribRef.current, i);
                hidePart(sacRef.current, i);

                const flap = Math.sin(animTime.current * FLYER_WING_FLAP_FREQ + enemy.id) * FLYER_WING_FLAP_AMOUNT;
                writePart(flyerBodyRef.current, i, stats.size, 1, 0, 0.15, 0, 0, 0, 0, 0.62 * pulse, 0.58 * pulse, 1.5 * pulse);
                writePart(flyerWingLRef.current, i, stats.size, 1, -0.5, 0.16, -0.05, 0, 0, 0.32 + flap, 1.1, 0.045, 0.5);
                writePart(flyerWingRRef.current, i, stats.size, 1, 0.5, 0.16, -0.05, 0, 0, -0.32 - flap, 1.1, 0.045, 0.5);
                writePart(flyerEyeLRef.current, i, stats.size, 1, 0.09, 0.22, 0.32, 0, 0, 0, 1, 1, 1);
                writePart(flyerEyeRRef.current, i, stats.size, 1, -0.09, 0.22, 0.32, 0, 0, 0, 1, 1, 1);
            }

            colorScratch.current.set(variant.skinColor);
            if ((enemy.archetype === 'ranged' || enemy.archetype === 'spitter') && attackCurve > 0) {
                colorScratch.current.lerp(flashScratch.current, attackCurve);
            }
            torsoRef.current.setColorAt(i, colorScratch.current);
            headRef.current.setColorAt(i, colorScratch.current);
            upperArmLRef.current.setColorAt(i, colorScratch.current);
            lowerArmLRef.current.setColorAt(i, colorScratch.current);
            upperArmRRef.current.setColorAt(i, colorScratch.current);
            lowerArmRRef.current.setColorAt(i, colorScratch.current);
            upperLegLRef.current.setColorAt(i, colorScratch.current);
            lowerLegLRef.current.setColorAt(i, colorScratch.current);
            upperLegRRef.current.setColorAt(i, colorScratch.current);
            lowerLegRRef.current.setColorAt(i, colorScratch.current);
            ribRef.current.setColorAt(i, trimScratch.current.set(variant.trimColor));
            sacRef.current.setColorAt(i, trimScratch.current.set(variant.trimColor));
            eyeRef.current.setColorAt(i, glowScratch.current.set(variant.glowColor));

            flyerBodyRef.current.setColorAt(i, colorScratch.current.set(variant.skinColor));
            flyerWingLRef.current.setColorAt(i, trimScratch.current.set(variant.trimColor));
            flyerWingRRef.current.setColorAt(i, trimScratch.current.set(variant.trimColor));
            flyerEyeLRef.current.setColorAt(i, glowScratch.current.set(variant.glowColor));
            flyerEyeRRef.current.setColorAt(i, glowScratch.current.set(variant.glowColor));
        }

        [torsoRef, headRef, upperArmLRef, lowerArmLRef, upperArmRRef, lowerArmRRef, upperLegLRef, lowerLegLRef, upperLegRRef, lowerLegRRef, eyeRef, ribRef, sacRef, flyerBodyRef, flyerWingLRef, flyerWingRRef, flyerEyeLRef, flyerEyeRRef].forEach((ref) => {
            const mesh = ref.current;
            mesh.count = enemies.length;
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        });
    });

    return (
        <>
            <instancedMesh ref={torsoRef} args={[torsoGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={headRef} args={[headGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={upperArmLRef} args={[upperArmGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={lowerArmLRef} args={[lowerArmGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={upperArmRRef} args={[upperArmGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={lowerArmRRef} args={[lowerArmGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={upperLegLRef} args={[upperLegGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={lowerLegLRef} args={[lowerLegGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={upperLegRRef} args={[upperLegGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={lowerLegRRef} args={[lowerLegGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={ribRef} args={[ribGeo, undefined, MAX_ENEMIES]} frustumCulled={false}>
                <meshStandardMaterial roughness={0.9} />
            </instancedMesh>
            <instancedMesh ref={sacRef} args={[sacGeo, undefined, MAX_ENEMIES]} frustumCulled={false}>
                <meshStandardMaterial roughness={0.7} transparent opacity={0.85} />
            </instancedMesh>
            <instancedMesh ref={eyeRef} args={[eyeGeo, undefined, MAX_ENEMIES]} frustumCulled={false}>
                <meshStandardMaterial emissiveIntensity={3} toneMapped={false} />
            </instancedMesh>
            <instancedMesh ref={flyerBodyRef} args={[flyerBodyGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.6} />
            </instancedMesh>
            <instancedMesh ref={flyerWingLRef} args={[flyerWingGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.55} />
            </instancedMesh>
            <instancedMesh ref={flyerWingRRef} args={[flyerWingGeo, undefined, MAX_ENEMIES]} castShadow frustumCulled={false}>
                <meshStandardMaterial roughness={0.55} />
            </instancedMesh>
            <instancedMesh ref={flyerEyeLRef} args={[flyerEyeGeo, undefined, MAX_ENEMIES]} frustumCulled={false}>
                <meshStandardMaterial emissiveIntensity={3} toneMapped={false} />
            </instancedMesh>
            <instancedMesh ref={flyerEyeRRef} args={[flyerEyeGeo, undefined, MAX_ENEMIES]} frustumCulled={false}>
                <meshStandardMaterial emissiveIntensity={3} toneMapped={false} />
            </instancedMesh>
        </>
    );
}
