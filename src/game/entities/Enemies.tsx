import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { enemies, spawnEnemy, removeDeadEnemies, pickWeightedArchetype, damageEnemy, ARCHETYPE_STATS, ZOMBIE_VARIANTS, type Enemy, type ZombieVariant } from '../data/enemies.ts';
import { world, damagePlayer, endRun } from '../state/world.ts';
import { DESPAWN_RADIUS, RUN_DURATION_SECONDS, ENEMY_ATTACK_ANIM_DURATION, WATER_SLOW_ENEMY } from '../data/constants.ts';
import { clearGrid, insertIntoGrid } from '../systems/spatialGrid.ts';
import { getScaling } from '../systems/enemyScaling.ts';
import { beginPlanFrame, hasLineOfSight, navGoal, resetNav, updateNav } from '../systems/navigation.ts';
import { warmFlow } from '../systems/flowField.ts';
import { findSpawnPoint, hoverAerial, idleGround, normalizeFrame, settleGround, stepAerial, stepGround, stepPeriod, wantsToHold, type SpawnPoint } from '../systems/enemyBrain.ts';
import { attackProgress, beginBodies, createAnim, createBody, createEnemyMeshes, drawBody, endBodies, CORPSE_LIFETIME, type Body, type EnemyMeshes, type StepHandler } from '../systems/enemyRig.ts';
import { enemyAttack, enemyStep } from '../systems/sfx.ts';
import { surfaceAt } from '../systems/surface.ts';
import { wadeFactor } from '../systems/water.ts';
import { wrapDelta } from '../systems/wrap.ts';

const MAX_ENEMIES = 160;
const ENEMY_CAP = 140;
const MAX_CORPSES = 40;
const MAX_DELTA = 0.05;
const TURN_SPEED = 13;
const IDLE_TURN_SPEED = 8;
const TAU = Math.PI * 2;
const WARM_START_SECONDS = 4;
const WARM_BUDGET = 48;
const RENDER_RADIUS = 36;
const STEP_RADIUS = 18;
const STEP_BUDGET = 4;
const WADE_FULL_DEPTH = 1.2;

const spawnPoint: SpawnPoint = { x: 0, y: 0, z: 0, building: -1, floor: 0 };
const spawnVector = new Vector3();
const variants = new Map<string, ZombieVariant>(ZOMBIE_VARIANTS.map((v) => [v.id, v]));
const fallbackVariant = ZOMBIE_VARIANTS[0];
const liveBody: Body = createBody(fallbackVariant, 0, 'rusher', 1, 1, 1);
const corpses: Body[] = [];

let stepsLeft = 0;
let stepEnemy: Enemy | null = null;

const handleStep: StepHandler = (body) => {
    const enemy = stepEnemy;
    if (!enemy || stepsLeft <= 0 || body.distance > STEP_RADIUS) return;
    stepsLeft--;
    enemyStep(surfaceAt(enemy.position.x, enemy.position.z, enemy.currentBuildingIndex, enemy.currentFloor), enemy, body.size);
};

function turnToward(enemy: Enemy, target: number, delta: number, rate: number) {
    let diff = target - enemy.facing;
    diff -= Math.round(diff / TAU) * TAU;
    enemy.facing += diff * (1 - Math.exp(-rate * delta));
}

function captureCorpses(px: number, pz: number) {
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy.alive) continue;
        const stats = ARCHETYPE_STATS[enemy.archetype];
        if (stats.selfDestructs && enemy.attackFlashTimer > 0) continue;
        const variant = variants.get(enemy.variantId) ?? fallbackVariant;
        const source = enemy.anim ?? createAnim(variant, enemy.id, 0);
        const anim = { ...source, flinch: 1 };
        const body = createBody(variant, enemy.id, enemy.archetype, stats.size, stats.speed, 0, anim);
        const dx = enemy.position.x - px;
        const dz = enemy.position.z - pz;
        const length = Math.sqrt(dx * dx + dz * dz);
        body.x = enemy.position.x;
        body.y = enemy.position.y;
        body.z = enemy.position.z;
        body.facing = enemy.facing;
        body.wade = Math.min(1, enemy.wading / WADE_FULL_DEPTH);
        body.dead = 0;
        body.fallX = length > 0.01 ? dx / length : 0;
        body.fallZ = length > 0.01 ? dz / length : 1;
        body.lookYaw = Math.atan2(-body.fallX, -body.fallZ);
        body.building = enemy.currentBuildingIndex;
        body.floor = enemy.currentFloor;
        if (corpses.length >= MAX_CORPSES) corpses.shift();
        corpses.push(body);
    }
}

function simulate(delta: number, time: number, frame: number, spawnTimer: { value: number }) {
    captureCorpses(world.player.position.x, world.player.position.z);
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
            else enemyAttack(enemy, px, pz);
        }
    }
}

function render(m: EnemyMeshes, delta: number, time: number) {
    const player = world.player;
    const px = player.position.x;
    const pz = player.position.z;
    const hideAbove = player.buildingIndex >= 0;
    stepsLeft = STEP_BUDGET;
    beginBodies(m);

    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (hideAbove && enemy.currentBuildingIndex === player.buildingIndex && enemy.currentFloor > player.currentFloor) continue;

        const dx = px - enemy.position.x;
        const dz = pz - enemy.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance > RENDER_RADIUS) continue;

        const stats = ARCHETYPE_STATS[enemy.archetype];
        const variant = variants.get(enemy.variantId) ?? fallbackVariant;
        const lookYaw = distance > 0.01 ? Math.atan2(dx / distance, dz / distance) : enemy.facing;
        const heading = Math.atan2(enemy.headingX, enemy.headingZ);
        const moving = enemy.moving;
        turnToward(enemy, stats.isAerial || !moving ? lookYaw : heading, delta, moving ? TURN_SPEED : IDLE_TURN_SPEED);

        if (!enemy.anim) enemy.anim = createAnim(variant, enemy.id, enemy.health);
        const body = liveBody;
        body.id = enemy.id;
        body.archetype = enemy.archetype;
        body.variant = variant;
        body.size = stats.size;
        body.speed = stats.speed * wadeFactor(enemy.wading, WATER_SLOW_ENEMY);
        body.x = enemy.position.x;
        body.y = enemy.position.y;
        body.z = enemy.position.z;
        body.facing = enemy.facing;
        body.moving = moving;
        body.wade = Math.min(1, enemy.wading / WADE_FULL_DEPTH);
        body.health = enemy.health;
        body.attack = attackProgress(enemy.attackFlashTimer);
        body.lookYaw = lookYaw;
        body.distance = distance;
        body.time = time;
        body.dead = -1;
        body.anim = enemy.anim;
        stepEnemy = enemy;
        drawBody(m, body, delta, handleStep);
    }
    stepEnemy = null;

    for (let i = corpses.length - 1; i >= 0; i--) {
        const corpse = corpses[i];
        corpse.dead += delta;
        if (corpse.dead > CORPSE_LIFETIME) {
            corpses.splice(i, 1);
            continue;
        }
        corpse.x = px + wrapDelta(corpse.x - px);
        corpse.z = pz + wrapDelta(corpse.z - pz);
        if (hideAbove && corpse.building === player.buildingIndex && corpse.floor > player.currentFloor) continue;
        const dx = px - corpse.x;
        const dz = pz - corpse.z;
        corpse.distance = Math.sqrt(dx * dx + dz * dz);
        if (corpse.distance > RENDER_RADIUS) continue;
        corpse.time = time;
        drawBody(m, corpse, delta, null);
    }

    endBodies(m);
}

export function Enemies() {
    const groupRef = useRef<Group>(null!);
    const meshes = useMemo(() => createEnemyMeshes(MAX_ENEMIES + MAX_CORPSES), []);
    const ready = useRef(false);
    const animTime = useRef(0);
    const frame = useRef(0);
    const spawnTimer = useRef({ value: 0.4 });

    useLayoutEffect(() => {
        enemies.length = 0;
        corpses.length = 0;
        resetNav();
        const group = groupRef.current;
        group.add(meshes.group);
        ready.current = true;
        return () => {
            ready.current = false;
            group.remove(meshes.group);
            enemies.length = 0;
            corpses.length = 0;
        };
    }, [meshes]);

    useFrame((_, rawDelta) => {
        if (!ready.current || world.pendingUpgradeChoices > 0 || world.run.over) return;
        const delta = rawDelta > MAX_DELTA ? MAX_DELTA : rawDelta;
        animTime.current += delta;
        frame.current++;
        simulate(delta, animTime.current, frame.current, spawnTimer.current);
        render(meshes, delta, animTime.current);
    });

    return <group ref={groupRef} />;
}