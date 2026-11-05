import type { Enemy } from '../data/enemies.ts';
import type { WallSegment } from './buildingShapes.ts';
import { buildings, buildingsNear } from './footprints.ts';
import { isPositionBlocked } from './obstacles.ts';
import { FLOW_CELL, buildFlow, flowDirection, invalidateFlow } from './flowField.ts';
import { holeDetour, holesOn, pushOutOfHoles } from './holes.ts';
import { planPath } from './localPath.ts';
import { OUT_NODE, graphFor, hopToward, nearestEntrance, nodeAt, nodeDistance, setPlayerNode, type EntranceChoice, type Hop } from './indoorNav.ts';
import { openDoorsNear, resolveDoorCollision } from './doors.ts';
import { wrapCoord, wrapDelta } from './wrap.ts';

const LOCK_SECONDS = 3.5;
const LOCK_REACH = 0.4;
const ENTRANCE_REACH = 3.6;
const DIRECT_RANGE = 9;
const DOOR_REACH = 1.9;
const WAY_SECONDS = 3;
const PATH_SECONDS = 4;
const PLAN_COOLDOWN = 1.4;
const PLAN_MARGIN = 0.07;
const HOLE_MARGIN = 0.15;
const PATH_GOAL_DRIFT = 3;

const hop: Hop = { x: 0, z: 0, stairs: false, arrived: false };
const entrance: EntranceChoice = { x: 0, z: 0, nx: 0, nz: 0, index: -1 };
const detour = { x: 0, z: 0 };
const holeOut = { x: 0, z: 0 };
let probeFloor = 0;
const flowOut = { x: 0, z: 0 };
const doorScratch = { x: 0, z: 0 };
const seedBuffer: number[] = [];

export const navGoal = { x: 0, y: 0, z: 0, floor: 0, building: -1, node: -1 };
export const navAim = { x: 0, z: 0, valid: false };

let planBudget = 1;
let planFloor = 0;
let planBuilding = -1;
let planRadius = 0.3;
let planOx = 0;
let planOz = 0;

function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
    const rX = bx - ax;
    const rZ = bz - az;
    const sX = dx - cx;
    const sZ = dz - cz;
    const denom = rX * sZ - rZ * sX;
    if (Math.abs(denom) < 1e-9) return false;
    const qpX = cx - ax;
    const qpZ = cz - az;
    const t = (qpX * sZ - qpZ * sX) / denom;
    const u = (qpX * rZ - qpZ * rX) / denom;
    return t > 1e-3 && t < 1 && u >= 0 && u <= 1;
}

function crossesAny(list: readonly WallSegment[], x1: number, z1: number, x2: number, z2: number): boolean {
    for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (segmentsCross(x1, z1, x2, z2, s.x1, s.z1, s.x2, s.z2)) return true;
    }
    return false;
}

function crossesFootprint(index: number, x1: number, z1: number, x2: number, z2: number): boolean {
    const poly = buildings[index].polygon;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        if (segmentsCross(x1, z1, x2, z2, a.x, a.z, b.x, b.z)) return true;
    }
    return false;
}

export function hasLineOfSight(x1: number, z1: number, x2: number, z2: number, buildingIndex: number, floor: number): boolean {
    const ox = x1 - wrapCoord(x1);
    const oz = z1 - wrapCoord(z1);
    const ax = x1 - ox;
    const az = z1 - oz;
    const bx = x2 - ox;
    const bz = z2 - oz;
    if (buildingIndex >= 0) {
        const b = buildings[buildingIndex];
        const f = floor < 0 ? 0 : floor >= b.floors ? b.floors - 1 : floor;
        return !crossesAny(b.walls[f], ax, az, bx, bz);
    }
    const near = buildingsNear((ax + bx) / 2, (az + bz) / 2);
    for (let i = 0; i < near.length; i++) {
        if (crossesFootprint(near[i], ax, az, bx, bz)) return false;
    }
    const start = buildingsNear(ax, az);
    for (let i = 0; i < start.length; i++) {
        if (crossesFootprint(start[i], ax, az, bx, bz)) return false;
    }
    return true;
}

export function blockedAt(x: number, z: number, floor: number, radius: number): boolean {
    if (isPositionBlocked(x, z, floor, radius)) return true;
    resolveDoorCollision(x, z, radius, doorScratch);
    const dx = wrapDelta(doorScratch.x - x);
    const dz = wrapDelta(doorScratch.z - z);
    return dx * dx + dz * dz > 0.0004;
}

const WHISKERS = [0.5, -0.5, 1.0, -1.0, 1.55, -1.55];

export function steerAround(x: number, z: number, dirX: number, dirZ: number, floor: number, radius: number, probe: number, out: { x: number; z: number }): number {
    if (!blockedAt(x + dirX * probe, z + dirZ * probe, floor, radius)) {
        out.x = dirX;
        out.z = dirZ;
        return 0;
    }
    for (let i = 0; i < WHISKERS.length; i++) {
        const a = WHISKERS[i];
        const c = Math.cos(a);
        const s = Math.sin(a);
        const rx = dirX * c - dirZ * s;
        const rz = dirX * s + dirZ * c;
        if (!blockedAt(x + rx * probe, z + rz * probe, floor, radius)) {
            out.x = rx;
            out.z = rz;
            return 1;
        }
    }
    out.x = dirX;
    out.z = dirZ;
    return 2;
}

export function escapeDirection(x: number, z: number, floor: number, towardX: number, towardZ: number): { x: number; z: number } | null {
    const trialStep = 0.7;
    const candidates = 16;
    let best: { x: number; z: number } | null = null;
    let bestScore = -Infinity;
    const len = Math.hypot(towardX - x, towardZ - z) || 1;
    const px = (towardX - x) / len;
    const pz = (towardZ - z) / len;
    for (let i = 0; i < candidates; i++) {
        const a = (i / candidates) * Math.PI * 2;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        if (blockedAt(x + dx * trialStep, z + dz * trialStep, floor, 0.32)) continue;
        const far = blockedAt(x + dx * trialStep * 2.2, z + dz * trialStep * 2.2, floor, 0.32) ? 0 : 0.5;
        const score = far + (dx * px + dz * pz) * 0.5 + Math.random() * 0.15;
        if (score > bestScore) {
            bestScore = score;
            best = { x: dx, z: dz };
        }
    }
    return best;
}

export function updateNav(px: number, pz: number, floor: number, building: number) {
    navGoal.x = px;
    navGoal.z = pz;
    navGoal.floor = floor;
    navGoal.building = building;
    if (building >= 0) {
        const g = graphFor(building);
        const cx = wrapCoord(px);
        const cz = wrapCoord(pz);
        const ox = px - cx;
        const oz = pz - cz;
        navGoal.node = nodeAt(g, floor, cx, cz);
        setPlayerNode(g, navGoal.node);
        seedBuffer.length = 0;
        const entrances = buildings[building].entrances;
        for (let i = 0; i < entrances.length; i++) {
            const e = entrances[i];
            const inner = navGoal.node >= 0 && g.entranceNode[i] >= 0 ? nodeDistance(g, g.entranceNode[i]) : 0;
            if (inner === Infinity) continue;
            seedBuffer.push(e.x + e.nx * 1.8 + ox, e.z + e.nz * 1.8 + oz, inner / FLOW_CELL);
        }
        if (seedBuffer.length === 0) for (const e of entrances) seedBuffer.push(e.x + e.nx * 1.8 + ox, e.z + e.nz * 1.8 + oz, 0);
        buildFlow(px, pz, seedBuffer, `b${building}n${navGoal.node}`);
    } else {
        navGoal.node = -1;
        seedBuffer.length = 0;
        seedBuffer.push(px, pz, 0);
        buildFlow(px, pz, seedBuffer, 'p');
    }
}

export function resetNav() {
    invalidateFlow();
    navGoal.building = -1;
    navGoal.node = -1;
}

function aim(enemy: Enemy, tx: number, tz: number, out: { x: number; z: number }): boolean {
    const dx = tx - enemy.position.x;
    const dz = tz - enemy.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1e-4) return false;
    navAim.x = tx;
    navAim.z = tz;
    navAim.valid = true;
    out.x = dx / len;
    out.z = dz / len;
    return true;
}

function lockStairs(enemy: Enemy, ox: number, oz: number) {
    if (hop.stairs && hop.arrived) {
        enemy.lockX = hop.x + ox;
        enemy.lockZ = hop.z + oz;
        enemy.lockTimer = LOCK_SECONDS;
        enemy.wayTimer = 0;
    }
}

function probeBlocked(x: number, z: number): boolean {
    return blockedAt(x, z, probeFloor, 0.22);
}

function aimIndoor(enemy: Enemy, tx: number, tz: number, ox: number, oz: number, delta: number, out: { x: number; z: number }): boolean {
    probeFloor = enemy.currentFloor;
    const prefer = enemy.wayTimer > 0;
    if (prefer) enemy.wayTimer -= delta;
    const px = prefer ? enemy.wayX - ox : Infinity;
    const pz = prefer ? enemy.wayZ - oz : Infinity;
    if (holeDetour(enemy.currentBuildingIndex, enemy.currentFloor, enemy.position.x - ox, enemy.position.z - oz, tx, tz, px, pz, probeBlocked, detour)) {
        enemy.wayX = detour.x + ox;
        enemy.wayZ = detour.z + oz;
        enemy.wayTimer = WAY_SECONDS;
        return aim(enemy, enemy.wayX, enemy.wayZ, out);
    }
    return aim(enemy, tx + ox, tz + oz, out);
}

export function keepOutOfHoles(enemy: Enemy) {
    const b = enemy.currentBuildingIndex;
    if (b < 0 || enemy.lockTimer > 0) return;
    const cx = wrapCoord(enemy.position.x);
    const cz = wrapCoord(enemy.position.z);
    if (pushOutOfHoles(b, enemy.currentFloor, cx, cz, holeOut)) {
        enemy.position.x += holeOut.x - cx;
        enemy.position.z += holeOut.z - cz;
    }
}

export function chaseDirection(enemy: Enemy, delta: number, out: { x: number; z: number }): boolean {
    const x = enemy.position.x;
    const z = enemy.position.z;
    navAim.valid = false;

    if (enemy.lockTimer > 0) {
        enemy.lockTimer -= delta;
        if (Math.hypot(enemy.lockX - x, enemy.lockZ - z) > LOCK_REACH && aim(enemy, enemy.lockX, enemy.lockZ, out)) return true;
        enemy.lockTimer = 0;
    }

    const eb = enemy.currentBuildingIndex;
    if (eb >= 0) {
        openDoorsNear(x, z, DOOR_REACH);
        const g = graphFor(eb);
        const cx = wrapCoord(x);
        const cz = wrapCoord(z);
        const ox = x - cx;
        const oz = z - cz;
        const node = nodeAt(g, enemy.currentFloor, cx, cz);
        const gx = cx + wrapDelta(navGoal.x - x);
        const gz = cz + wrapDelta(navGoal.z - z);
        if (navGoal.building === eb) {
            if (enemy.currentFloor === navGoal.floor && hasLineOfSight(x, z, navGoal.x, navGoal.z, eb, enemy.currentFloor)) return aimIndoor(enemy, gx, gz, ox, oz, delta, out);
            if (hopToward(g, node, navGoal.node, cx, cz, hop)) {
                lockStairs(enemy, ox, oz);
                return aimIndoor(enemy, hop.x, hop.z, ox, oz, delta, out);
            }
            return aimIndoor(enemy, gx, gz, ox, oz, delta, out);
        }
        if (hopToward(g, node, OUT_NODE, cx, cz, hop)) {
            lockStairs(enemy, ox, oz);
            return aimIndoor(enemy, hop.x, hop.z, ox, oz, delta, out);
        }
        if (flowDirection(x, z, flowOut)) {
            out.x = flowOut.x;
            out.z = flowOut.z;
            return true;
        }
        return aim(enemy, navGoal.x, navGoal.z, out);
    }

    openDoorsNear(x, z, DOOR_REACH);
    if (navGoal.building >= 0) {
        if (nearestEntrance(graphFor(navGoal.building), x, z, ENTRANCE_REACH, entrance)) {
            const d = Math.hypot(entrance.x - x, entrance.z - z);
            const inward = d < 1.1;
            return aim(enemy, inward ? entrance.x - entrance.nx * 1.5 : entrance.x + entrance.nx * 0.5, inward ? entrance.z - entrance.nz * 1.5 : entrance.z + entrance.nz * 0.5, out);
        }
        if (flowDirection(x, z, flowOut)) {
            out.x = flowOut.x;
            out.z = flowOut.z;
            return true;
        }
        return aim(enemy, navGoal.x, navGoal.z, out);
    }

    const dx = navGoal.x - x;
    const dz = navGoal.z - z;
    if (dx * dx + dz * dz < DIRECT_RANGE * DIRECT_RANGE && hasLineOfSight(x, z, navGoal.x, navGoal.z, -1, 0)) return aim(enemy, navGoal.x, navGoal.z, out);
    if (flowDirection(x, z, flowOut)) {
        out.x = flowOut.x;
        out.z = flowOut.z;
        return true;
    }
    return aim(enemy, navGoal.x, navGoal.z, out);
}

export function beginPlanFrame() {
    planBudget = 1;
}

function planBlocked(x: number, z: number): boolean {
    if (isPositionBlocked(x, z, planFloor, planRadius)) return true;
    if (planBuilding < 0) return false;
    const rects = holesOn(planBuilding, planFloor);
    const cx = x - planOx;
    const cz = z - planOz;
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (cx > r.minX - HOLE_MARGIN && cx < r.maxX + HOLE_MARGIN && cz > r.minZ - HOLE_MARGIN && cz < r.maxZ + HOLE_MARGIN) return true;
    }
    return false;
}

export function canPlan(enemy: Enemy): boolean {
    return planBudget > 0 && enemy.planTimer <= 0 && enemy.lockTimer <= 0 && navAim.valid;
}

export function planRoute(enemy: Enemy, radius: number): boolean {
    planBudget--;
    enemy.planTimer = PLAN_COOLDOWN;
    planFloor = enemy.currentFloor;
    planBuilding = enemy.currentBuildingIndex;
    planRadius = radius + PLAN_MARGIN;
    planOx = enemy.position.x - wrapCoord(enemy.position.x);
    planOz = enemy.position.z - wrapCoord(enemy.position.z);
    const count = planPath(enemy.position.x, enemy.position.z, navAim.x, navAim.z, planBlocked, enemy.path);
    if (count === 0) {
        enemy.pathLen = 0;
        return false;
    }
    enemy.pathLen = count;
    enemy.pathIdx = 0;
    enemy.pathTimer = PATH_SECONDS;
    enemy.pathGoalX = navAim.x;
    enemy.pathGoalZ = navAim.z;
    enemy.pathFloor = enemy.currentFloor;
    enemy.pathBuilding = enemy.currentBuildingIndex;
    return true;
}

export function routeDirection(enemy: Enemy, delta: number, out: { x: number; z: number }): boolean {
    if (enemy.pathLen === 0) return false;
    enemy.pathTimer -= delta;
    const stale = enemy.pathTimer <= 0 || enemy.pathFloor !== enemy.currentFloor || enemy.pathBuilding !== enemy.currentBuildingIndex || enemy.lockTimer > 0;
    const drifted = navAim.valid && Math.hypot(navAim.x - enemy.pathGoalX, navAim.z - enemy.pathGoalZ) > PATH_GOAL_DRIFT;
    if (stale || drifted) {
        enemy.pathLen = 0;
        return false;
    }
    const p = enemy.path;
    while (enemy.pathIdx < enemy.pathLen) {
        const wx = p[enemy.pathIdx * 2];
        const wz = p[enemy.pathIdx * 2 + 1];
        const dx = wx - enemy.position.x;
        const dz = wz - enemy.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > (enemy.pathIdx === enemy.pathLen - 1 ? 0.35 : 0.5)) {
            out.x = dx / d;
            out.z = dz / d;
            return true;
        }
        enemy.pathIdx++;
    }
    enemy.pathLen = 0;
    return false;
}
