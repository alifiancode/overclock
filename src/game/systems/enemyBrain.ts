import { FLYER_HOVER_BOB_AMPLITUDE, FLYER_HOVER_BOB_FREQ, PLAYER_Y_LERP, WATER_LEVEL, WATER_SLOW_ENEMY } from '../data/constants.ts';
import { ARCHETYPE_STATS, type Enemy, type EnemyArchetype } from '../data/enemies.ts';
import { floorTopY, randomLootPoints } from './buildingGen.ts';
import { resolveDoorCollision } from './doors.ts';
import { buildingIndexAt, buildings, insideFootprint } from './footprints.ts';
import { canPlan, chaseDirection, escapeDirection, hasLineOfSight, keepOutOfHoles, navGoal, planRoute, routeDirection, steerAround } from './navigation.ts';
import { resolveCollision, resolveFloor, type FloorInfo } from './obstacles.ts';
import { circleBlocked } from './scatter.ts';
import { separationFor } from './spatialGrid.ts';
import { getTerrainHeight } from './terrain.ts';
import { wadeFactor, waterDepthAt } from './water.ts';
import { wrapDelta, wrapNear } from './wrap.ts';

const STUCK_WINDOW = 0.9;
const STUCK_PROGRESS = 0.3;
const ESCAPE_SECONDS = 1.6;
const ESCAPE_DISTANCE = 1.5;
const PROBE_SECONDS = 0.1;
const PROBE_DISTANCE = 0.95;
const TURN_RATE = 10;
const SEPARATION_RADIUS = 1.2;
const SEPARATION_WEIGHT = 0.85;
const AIR_SEPARATION_RADIUS = 1.7;
const WADE_SINK = 0.75;
const MAX_SUBSTEP = 0.35;
const INDOOR_SHARE = 0.2;
const RING_MIN = 40;
const RING_MAX = 62;

const desired = { x: 0, z: 0 };
const steer = { x: 0, z: 0 };
const push = { x: 0, z: 0 };
const route = { x: 0, z: 0 };
const moved = { x: 0, z: 0 };
const slid = { x: 0, z: 0 };
const floorInfo: FloorInfo = { y: 0, floor: 0, buildingIndex: -1 };

export type SpawnPoint = { x: number; y: number; z: number; building: number; floor: number };

export function enemyRadius(size: number): number {
    const r = 0.26 + (size - 1) * 0.12;
    return r < 0.24 ? 0.24 : r > 0.4 ? 0.4 : r;
}

export function holdDistance(archetype: EnemyArchetype): number {
    const stats = ARCHETYPE_STATS[archetype];
    return stats.preferredRange > 0 ? stats.preferredRange : stats.contactRange * 0.6;
}

export function stepPeriod(distance: number): number {
    return distance < 18 ? 1 : distance < 38 ? 2 : 3;
}

export function normalizeFrame(enemy: Enemy, px: number, pz: number) {
    const nx = px + wrapDelta(enemy.position.x - px);
    const nz = pz + wrapDelta(enemy.position.z - pz);
    const sx = nx - enemy.position.x;
    const sz = nz - enemy.position.z;
    if (Math.abs(sx) < 1 && Math.abs(sz) < 1) return;
    enemy.position.x = nx;
    enemy.position.z = nz;
    enemy.lockX += sx;
    enemy.lockZ += sz;
    enemy.wayX += sx;
    enemy.wayZ += sz;
    enemy.pathGoalX += sx;
    enemy.pathGoalZ += sz;
    for (let i = 0; i < enemy.pathLen; i++) {
        enemy.path[i * 2] += sx;
        enemy.path[i * 2 + 1] += sz;
    }
    enemy.stuckAnchorX += sx;
    enemy.stuckAnchorZ += sz;
    enemy.escapeAnchorX += sx;
    enemy.escapeAnchorZ += sz;
}

export function wantsToHold(enemy: Enemy, distance: number): boolean {
    if (distance > holdDistance(enemy.archetype)) return false;
    if (enemy.currentBuildingIndex !== navGoal.building || enemy.currentFloor !== navGoal.floor) return false;
    if (distance < 2.4) return true;
    return hasLineOfSight(enemy.position.x, enemy.position.z, navGoal.x, navGoal.z, enemy.currentBuildingIndex, enemy.currentFloor);
}

export function idleGround(enemy: Enemy) {
    enemy.stuckTimer = 0;
    enemy.stuckAnchorX = enemy.position.x;
    enemy.stuckAnchorZ = enemy.position.z;
    enemy.escapeTimer = 0;
    enemy.avoidX = 0;
    enemy.avoidZ = 0;
    enemy.pathLen = 0;
    enemy.moving = false;
}

export function stepGround(enemy: Enemy, delta: number) {
    const stats = ARCHETYPE_STATS[enemy.archetype];
    const x = enemy.position.x;
    const z = enemy.position.z;
    const radius = enemyRadius(stats.size);
    let dirX = 0;
    let dirZ = 0;
    let escaping = false;
    let routed = false;
    if (enemy.planTimer > 0) enemy.planTimer -= delta;

    if (enemy.escapeTimer > 0) {
        enemy.escapeTimer -= delta;
        const away = Math.hypot(x - enemy.escapeAnchorX, z - enemy.escapeAnchorZ);
        if (away > ESCAPE_DISTANCE || enemy.escapeTimer <= 0) {
            enemy.escapeTimer = 0;
            enemy.stuckTimer = 0;
            enemy.stuckAnchorX = x;
            enemy.stuckAnchorZ = z;
        } else {
            dirX = enemy.escapeDirX;
            dirZ = enemy.escapeDirZ;
            escaping = true;
        }
    }

    if (!escaping) {
        if (!chaseDirection(enemy, delta, desired)) {
            desired.x = navGoal.x - x;
            desired.z = navGoal.z - z;
            const len = Math.hypot(desired.x, desired.z) || 1;
            desired.x /= len;
            desired.z /= len;
        }
        dirX = desired.x;
        dirZ = desired.z;
        if (enemy.pathLen > 0 && routeDirection(enemy, delta, route)) {
            dirX = route.x;
            dirZ = route.z;
            routed = true;
        }

        enemy.stuckTimer += delta;
        if (enemy.stuckTimer >= STUCK_WINDOW) {
            const progress = Math.hypot(x - enemy.stuckAnchorX, z - enemy.stuckAnchorZ);
            enemy.stuckTimer = 0;
            enemy.stuckAnchorX = x;
            enemy.stuckAnchorZ = z;
            if (progress < STUCK_PROGRESS) {
                if (canPlan(enemy) && planRoute(enemy, radius) && routeDirection(enemy, 0, route)) {
                    dirX = route.x;
                    dirZ = route.z;
                    routed = true;
                } else {
                    const esc = escapeDirection(x, z, enemy.currentFloor, navGoal.x, navGoal.z);
                    if (esc) {
                        enemy.escapeTimer = ESCAPE_SECONDS;
                        enemy.escapeAnchorX = x;
                        enemy.escapeAnchorZ = z;
                        enemy.escapeDirX = esc.x;
                        enemy.escapeDirZ = esc.z;
                        enemy.pathLen = 0;
                        dirX = esc.x;
                        dirZ = esc.z;
                        escaping = true;
                    }
                }
            }
        }
    }

    if (!escaping) {
        enemy.probeTimer -= delta;
        if (enemy.probeTimer <= 0) {
            enemy.probeTimer = PROBE_SECONDS * (0.8 + Math.random() * 0.5);
            const verdict = steerAround(x, z, dirX, dirZ, enemy.currentFloor, radius + 0.04, PROBE_DISTANCE, steer);
            if (verdict === 1) {
                enemy.avoidX = steer.x;
                enemy.avoidZ = steer.z;
            } else {
                enemy.avoidX = 0;
                enemy.avoidZ = 0;
            }
            if (verdict === 2 && !routed && canPlan(enemy) && planRoute(enemy, radius) && routeDirection(enemy, 0, route)) {
                dirX = route.x;
                dirZ = route.z;
                routed = true;
            }
        }
        if (!routed && (enemy.avoidX !== 0 || enemy.avoidZ !== 0) && dirX * enemy.avoidX + dirZ * enemy.avoidZ > 0.15) {
            dirX = enemy.avoidX;
            dirZ = enemy.avoidZ;
        }
    }

    separationFor(enemy, SEPARATION_RADIUS, push);
    dirX += push.x * SEPARATION_WEIGHT;
    dirZ += push.z * SEPARATION_WEIGHT;
    const mag = Math.hypot(dirX, dirZ);
    if (mag > 1) {
        dirX /= mag;
        dirZ /= mag;
    } else if (mag < 0.2) {
        dirX = escaping ? enemy.escapeDirX : desired.x;
        dirZ = escaping ? enemy.escapeDirZ : desired.z;
    }

    const k = 1 - Math.exp(-TURN_RATE * delta);
    enemy.headingX += (dirX - enemy.headingX) * k;
    enemy.headingZ += (dirZ - enemy.headingZ) * k;
    const hl = Math.hypot(enemy.headingX, enemy.headingZ);
    const hx = hl > 1e-3 ? enemy.headingX / hl : dirX;
    const hz = hl > 1e-3 ? enemy.headingZ / hl : dirZ;

    const depth = waterDepthAt(x, z);
    enemy.wading = depth;
    let remaining = stats.speed * wadeFactor(depth, WATER_SLOW_ENEMY) * delta;
    let cx = x;
    let cz = z;
    while (remaining > 1e-4) {
        const step = remaining > MAX_SUBSTEP ? MAX_SUBSTEP : remaining;
        remaining -= step;
        resolveCollision(cx + hx * step, cz + hz * step, enemy.currentFloor, radius, moved);
        resolveDoorCollision(moved.x, moved.z, radius, slid);
        cx = slid.x;
        cz = slid.z;
    }
    enemy.position.x = cx;
    enemy.position.z = cz;
    keepOutOfHoles(enemy);
    enemy.moving = true;
}

export function settleGround(enemy: Enemy, delta: number) {
    resolveFloor(enemy.position.x, enemy.position.z, enemy.currentFloor, floorInfo);
    enemy.currentFloor = floorInfo.floor;
    enemy.currentBuildingIndex = floorInfo.buildingIndex;
    let target = floorInfo.y + 0.1;
    if (floorInfo.buildingIndex < 0) {
        const lowest = WATER_LEVEL - WADE_SINK + 0.1;
        if (target < lowest) target = lowest;
    }
    const k = 1 - Math.pow(1 - PLAYER_Y_LERP, delta * 60);
    enemy.position.y += (target - enemy.position.y) * k;
}

export function stepAerial(enemy: Enemy, delta: number, time: number) {
    const stats = ARCHETYPE_STATS[enemy.archetype];
    const x = enemy.position.x;
    const z = enemy.position.z;
    let tx = navGoal.x - x;
    let tz = navGoal.z - z;
    const d = Math.sqrt(tx * tx + tz * tz);
    if (d < 1e-3) {
        enemy.moving = false;
        return;
    }
    tx /= d;
    tz /= d;
    const weave = Math.sin(time * 2.1 + enemy.id * 1.37) * 0.5 * (d > 5 ? 1 : d / 5);
    let dirX = tx - tz * weave;
    let dirZ = tz + tx * weave;
    separationFor(enemy, AIR_SEPARATION_RADIUS, push);
    dirX += push.x * SEPARATION_WEIGHT;
    dirZ += push.z * SEPARATION_WEIGHT;
    const mag = Math.hypot(dirX, dirZ) || 1;
    dirX /= mag;
    dirZ /= mag;
    const k = 1 - Math.exp(-TURN_RATE * delta);
    enemy.headingX += (dirX - enemy.headingX) * k;
    enemy.headingZ += (dirZ - enemy.headingZ) * k;
    const hl = Math.hypot(enemy.headingX, enemy.headingZ);
    const hx = hl > 1e-3 ? enemy.headingX / hl : dirX;
    const hz = hl > 1e-3 ? enemy.headingZ / hl : dirZ;
    enemy.position.x = x + hx * stats.speed * delta;
    enemy.position.z = z + hz * stats.speed * delta;
    enemy.moving = true;
}

export function hoverAerial(enemy: Enemy, delta: number, time: number) {
    const stats = ARCHETYPE_STATS[enemy.archetype];
    const x = enemy.position.x;
    const z = enemy.position.z;
    resolveFloor(x, z, enemy.currentFloor, floorInfo);
    const near = Math.hypot(navGoal.x - x, navGoal.z - z) < 12;
    const withPlayerIndoors = near && navGoal.building >= 0;
    enemy.currentBuildingIndex = floorInfo.buildingIndex;
    enemy.currentFloor = withPlayerIndoors && floorInfo.buildingIndex === navGoal.building ? navGoal.floor : floorInfo.floor;
    const ground = withPlayerIndoors ? navGoal.y : Math.max(getTerrainHeight(x, z), WATER_LEVEL);
    const hover = (stats.hoverHeight ?? 3) * (withPlayerIndoors ? 0.62 : 1);
    const target = ground + hover + Math.sin(time * FLYER_HOVER_BOB_FREQ + enemy.id) * FLYER_HOVER_BOB_AMPLITUDE;
    const k = 1 - Math.pow(1 - PLAYER_Y_LERP, delta * 60);
    enemy.position.y += (target - enemy.position.y) * k;
}

export function findSpawnPoint(px: number, pz: number, playerBuilding: number, aerial: boolean, out: SpawnPoint): boolean {
    if (!aerial && Math.random() < INDOOR_SHARE) {
        for (let attempt = 0; attempt < 6; attempt++) {
            const a = Math.random() * Math.PI * 2;
            const r = 26 + Math.random() * 40;
            const index = buildingIndexAt(px + Math.cos(a) * r, pz + Math.sin(a) * r);
            if (index < 0 || index === playerBuilding) continue;
            const def = buildings[index];
            const floor = Math.floor(Math.random() * def.floors);
            const points = randomLootPoints(def, Math.random, floor, 1);
            if (points.length === 0) continue;
            out.x = wrapNear(points[0].x, px);
            out.z = wrapNear(points[0].z, pz);
            out.y = floorTopY(def, floor) + 0.1;
            out.building = index;
            out.floor = floor;
            return true;
        }
    }
    for (let attempt = 0; attempt < 14; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const r = RING_MIN + Math.random() * (RING_MAX - RING_MIN);
        const x = px + Math.cos(a) * r;
        const z = pz + Math.sin(a) * r;
        const h = getTerrainHeight(x, z);
        if (!aerial) {
            if (h < WATER_LEVEL + 0.2) continue;
            if (insideFootprint(x, z, 1.4)) continue;
            if (circleBlocked(x, z, 0.7)) continue;
        }
        out.x = x;
        out.z = z;
        out.y = aerial ? Math.max(h, WATER_LEVEL) + (ARCHETYPE_STATS.flyer.hoverHeight ?? 3) : h + 0.1;
        out.building = -1;
        out.floor = 0;
        return true;
    }
    return false;
}
