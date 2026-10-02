import type { WallSegment } from './buildingShapes.ts';
import { buildings, resolvePropCollision, type BuildingDef, type StairFlight } from './obstacles.ts';
import { getDoorGeom } from './doors.ts';

function segmentIntersectionT(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): number | null {
    const rX = bx - ax;
    const rZ = bz - az;
    const sX = dx - cx;
    const sZ = dz - cz;
    const denom = rX * sZ - rZ * sX;
    if (Math.abs(denom) < 1e-9) return null;
    const qpX = cx - ax;
    const qpZ = cz - az;
    const t = (qpX * sZ - qpZ * sX) / denom;
    const u = (qpX * rZ - qpZ * rX) / denom;
    if (t <= 1e-3 || t > 1 || u < 0 || u > 1) return null;
    return t;
}

function findBlockingSegment(x1: number, z1: number, x2: number, z2: number, buildingIndex: number, floor: number): WallSegment | null {
    if (buildingIndex === -1) return null;
    const b: BuildingDef | undefined = buildings[buildingIndex];
    if (!b) return null;
    let bestSeg: WallSegment | null = null;
    let bestT = Infinity;
    for (const seg of b.walls) {
        const t = segmentIntersectionT(x1, z1, x2, z2, seg.x1, seg.z1, seg.x2, seg.z2);
        if (t !== null && t < bestT) {
            bestT = t;
            bestSeg = seg;
        }
    }
    for (const iw of b.interiorWalls) {
        if (iw.floor !== floor) continue;
        const t = segmentIntersectionT(x1, z1, x2, z2, iw.seg.x1, iw.seg.z1, iw.seg.x2, iw.seg.z2);
        if (t !== null && t < bestT) {
            bestT = t;
            bestSeg = iw.seg;
        }
    }
    return bestSeg;
}

export function hasLineOfSight(x1: number, z1: number, x2: number, z2: number, buildingIndex: number, floor: number): boolean {
    return findBlockingSegment(x1, z1, x2, z2, buildingIndex, floor) === null;
}

function distPointToSegment(px: number, pz: number, seg: WallSegment): number {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-9) return Math.hypot(px - seg.x1, pz - seg.z1);
    let t = ((px - seg.x1) * dx + (pz - seg.z1) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = seg.x1 + dx * t;
    const cz = seg.z1 + dz * t;
    return Math.hypot(px - cx, pz - cz);
}

function isDeadEndCorner(x: number, z: number, buildingIndex: number, floor: number, exclude: WallSegment): boolean {
    const b = buildings[buildingIndex];
    const eps = 0.05;
    for (const seg of b.walls) {
        if (seg === exclude) continue;
        if (distPointToSegment(x, z, seg) < eps) return true;
    }
    for (const iw of b.interiorWalls) {
        if (iw.floor !== floor) continue;
        if (iw.seg === exclude) continue;
        if (distPointToSegment(x, z, iw.seg) < eps) return true;
    }
    return false;
}

export function steerTarget(fromX: number, fromZ: number, toX: number, toZ: number, buildingIndex: number, floor: number): { x: number; z: number } {
    const blocker = findBlockingSegment(fromX, fromZ, toX, toZ, buildingIndex, floor);
    if (!blocker) return { x: toX, z: toZ };

    const corner1Open = !isDeadEndCorner(blocker.x1, blocker.z1, buildingIndex, floor, blocker);
    const corner2Open = !isDeadEndCorner(blocker.x2, blocker.z2, buildingIndex, floor, blocker);

    let useFirst: boolean;
    if (corner1Open !== corner2Open) {
        useFirst = corner1Open;
    } else {
        const d1 = Math.hypot(blocker.x1 - toX, blocker.z1 - toZ);
        const d2 = Math.hypot(blocker.x2 - toX, blocker.z2 - toZ);
        useFirst = d1 < d2;
    }

    const cornerX = useFirst ? blocker.x1 : blocker.x2;
    const cornerZ = useFirst ? blocker.z1 : blocker.z2;
    const otherX = useFirst ? blocker.x2 : blocker.x1;
    const otherZ = useFirst ? blocker.z2 : blocker.z1;
    const pastX = cornerX - otherX;
    const pastZ = cornerZ - otherZ;
    const pastLen = Math.hypot(pastX, pastZ) || 1;
    const nudge = 0.5;
    return { x: cornerX + (pastX / pastLen) * nudge, z: cornerZ + (pastZ / pastLen) * nudge };
}

export function stairwellStepTarget(building: BuildingDef, fromFloor: number, goingUp: boolean): { x: number; z: number } | null {
    const flight: StairFlight | undefined = goingUp
        ? building.stairs.find((s) => s.fromFloor === fromFloor)
        : building.stairs.find((s) => s.toFloor === fromFloor);
    if (!flight) return null;
    const t = goingUp ? 0.85 : 0.15;
    return { x: flight.x, z: flight.z1 + (flight.z2 - flight.z1) * t };
}

export function getGroundMoveDirection(
    enemyX: number,
    enemyZ: number,
    enemyBuilding: number,
    enemyFloor: number,
    playerX: number,
    playerZ: number,
    playerBuilding: number,
    playerFloor: number
): { x: number; z: number } | null {
    let targetX = playerX;
    let targetZ = playerZ;
    let navBuilding = enemyBuilding;
    const sameSpace = enemyBuilding === playerBuilding && enemyFloor === playerFloor;

    if (!sameSpace) {
        if (enemyBuilding !== -1 && enemyBuilding === playerBuilding) {
            const b = buildings[enemyBuilding];
            const step = stairwellStepTarget(b, enemyFloor, playerFloor > enemyFloor);
            targetX = step ? step.x : (b.stairwell.minX + b.stairwell.maxX) / 2;
            targetZ = step ? step.z : (b.stairwell.minZ + b.stairwell.maxZ) / 2;
        } else if (enemyBuilding !== -1) {
            const b = buildings[enemyBuilding];
            if (enemyFloor !== 0) {
                const step = stairwellStepTarget(b, enemyFloor, false);
                targetX = step ? step.x : (b.stairwell.minX + b.stairwell.maxX) / 2;
                targetZ = step ? step.z : (b.stairwell.minZ + b.stairwell.maxZ) / 2;
            } else {
                const door = getDoorGeom(enemyBuilding);
                targetX = door.centerX;
                targetZ = door.z - 0.5;
            }
        } else if (playerBuilding !== -1) {
            const door = getDoorGeom(playerBuilding);
            targetX = door.centerX;
            targetZ = door.z + 0.5;
            navBuilding = playerBuilding;
        }
    }

    const targetDist = Math.hypot(targetX - enemyX, targetZ - enemyZ);
    if (targetDist <= 0.05) return null;

    const steered = steerTarget(enemyX, enemyZ, targetX, targetZ, navBuilding, enemyFloor);
    let dx = steered.x - enemyX;
    let dz = steered.z - enemyZ;
    let dist = Math.hypot(dx, dz);
    if (dist < 0.01) {
        dx = targetX - enemyX;
        dz = targetZ - enemyZ;
        dist = targetDist;
    }
    return { x: dx / dist, z: dz / dist };
}

export function escapeDirection(x: number, z: number, floor: number, towardX: number, towardZ: number): { x: number; z: number } | null {
    const trialStep = 0.6;
    const candidateCount = 20;
    let bestDir: { x: number; z: number } | null = null;
    let bestScore = -Infinity;

    const preferLen = Math.hypot(towardX - x, towardZ - z) || 1;
    const pnx = (towardX - x) / preferLen;
    const pnz = (towardZ - z) / preferLen;

    for (let i = 0; i < candidateCount; i++) {
        const angle = (i / candidateCount) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);
        const resolved = resolvePropCollision(x + dx * trialStep, z + dz * trialStep, floor);
        const progress = Math.hypot(resolved.x - x, resolved.z - z);
        if (progress < 0.08) continue;
        const alignment = dx * pnx + dz * pnz;
        const score = progress * 0.35 + alignment * 0.65;
        if (score > bestScore) {
            bestScore = score;
            bestDir = { x: dx, z: dz };
        }
    }
    return bestDir;
}
