import { FLOOR_HEIGHT, WALL_THICKNESS, STREET_PITCH, WORLD_SIZE, WATER_LEVEL } from '../data/constants.ts';
import { createRng, hash01, hashInts, worldSeed, type Rng } from './random.ts';
import { wrapCoord, wrapDelta } from './wrap.ts';
import { districts, districtMask, lotCenter, LOT_SIZE } from './layout.ts';
import { bakeTerrain, getRawHeight, getSlope, getTerrainHeight, type FlattenZone } from './terrain.ts';
import { generatePlan, placeBuilding, type BuildingDef } from './buildingGen.ts';
import { buildings, buildingsNear, registerBuilding, insideFootprint } from './footprints.ts';
import { collideCircles, circleBlocked } from './scatter.ts';
import { isPointInPolygon, type WallSegment } from './buildingShapes.ts';

export type { BuildingDef, Flight, Entrance, WorldRoom, WorldDoorway, FurnitureBox } from './buildingGen.ts';
export type { WallSegment, ZoneRect } from './buildingShapes.ts';
export { buildings } from './footprints.ts';

export type LightSource = { position: [number, number, number]; color: string; kind: 'torch' | 'lamp' | 'barrel'; seed: number };

const LOTS_PER_AXIS = WORLD_SIZE / STREET_PITCH;
const LOT_HALF = LOTS_PER_AXIS / 2;
const flattenZones: FlattenZone[] = [];
export const lightSources: LightSource[] = [];

function generateCity() {
    for (let lotZ = -LOT_HALF; lotZ < LOT_HALF; lotZ++) {
        for (let lotX = -LOT_HALF; lotX < LOT_HALF; lotX++) {
            const c = lotCenter(lotX, lotZ);
            const mask = districtMask(c.x, c.z);
            if (mask < 0.5) continue;
            const reach = LOT_SIZE / 2 - 2;
            let lowest = Infinity;
            let sum = 0;
            const probes: [number, number][] = [[0, 0], [-reach, -reach], [reach, -reach], [-reach, reach], [reach, reach]];
            for (const [ox, oz] of probes) {
                const h = getRawHeight(c.x + ox, c.z + oz);
                lowest = Math.min(lowest, h);
                sum += h;
            }
            if (lowest < WATER_LEVEL + 0.4) continue;
            const chance = 0.56 + 0.42 * Math.min(1, (mask - 0.5) * 2);
            if (hash01(lotX, lotZ, worldSeed + 77) > chance) continue;
            const plan = generatePlan({ seed: hashInts(lotX, lotZ, worldSeed), maxW: LOT_SIZE - 2.6, maxD: LOT_SIZE - 2.6, centerFactor: mask });
            const rng = createRng(hashInts(lotX, lotZ, worldSeed ^ 0x9e37));
            const rot = Math.floor(rng() * 4);
            const b = plan.footprint.bounds;
            const extX = (rot & 1 ? b.maxZ - b.minZ : b.maxX - b.minX) / 2;
            const extZ = (rot & 1 ? b.maxX - b.minX : b.maxZ - b.minZ) / 2;
            const slackX = Math.max(0, LOT_SIZE / 2 - 0.6 - extX);
            const slackZ = Math.max(0, LOT_SIZE / 2 - 0.6 - extZ);
            const x = c.x + (rng() - 0.5) * 2 * Math.min(slackX, 2);
            const z = c.z + (rng() - 0.5) * 2 * Math.min(slackZ, 2);
            const baseY = Math.round((sum / probes.length) * 20) / 20 + 0.06;
            const def = placeBuilding(plan, { index: buildings.length, lotX, lotZ, x, z, rot, baseY });
            registerBuilding(def);
            flattenZones.push({ x, z, flatRadius: def.radius - 0.5, softRadius: def.radius + 5, height: baseY - 0.12 });
        }
    }
}

generateCity();
bakeTerrain(flattenZones);

function addLights() {
    const rng = createRng(worldSeed ^ 0x7a11);
    for (const b of buildings) {
        const door = b.entrances[0];
        if (!door || rng() > 0.7) continue;
        const tx = -door.nz;
        const tz = door.nx;
        for (const side of [-1, 1]) {
            const x = door.x + door.nx * 0.45 + tx * side * (door.width / 2 + 0.55);
            const z = door.z + door.nz * 0.45 + tz * side * (door.width / 2 + 0.55);
            lightSources.push({ position: [x, getTerrainHeight(x, z), z], color: '#ff9a45', kind: 'torch', seed: rng() * 100 });
            if (rng() < 0.5) break;
        }
    }
    for (let lotZ = -LOT_HALF; lotZ < LOT_HALF; lotZ++) {
        for (let lotX = -LOT_HALF; lotX < LOT_HALF; lotX++) {
            if (hash01(lotX, lotZ, worldSeed + 991) > 0.12) continue;
            const c = lotCenter(lotX, lotZ);
            if (districtMask(c.x, c.z) < 0.6) continue;
            const x = c.x + (hash01(lotX, lotZ, worldSeed + 992) < 0.5 ? -1 : 1) * (LOT_SIZE / 2 + 1.2);
            const z = c.z + (hash01(lotX, lotZ, worldSeed + 993) - 0.5) * 8;
            if (insideFootprint(x, z, 1) || getTerrainHeight(x, z) < WATER_LEVEL + 0.2) continue;
            lightSources.push({ position: [x, getTerrainHeight(x, z), z], color: '#ff9a45', kind: 'barrel', seed: rng() * 100 });
        }
    }
}

addLights();

const startCandidates: { x: number; z: number }[] = [];

function collectStarts() {
    for (const d of districts) {
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = wrapCoord(Math.round(d.x / STREET_PITCH) * STREET_PITCH + dx * STREET_PITCH);
                const z = wrapCoord(Math.round(d.z / STREET_PITCH) * STREET_PITCH + dz * STREET_PITCH);
                if (districtMask(x, z) < 0.7) continue;
                if (getTerrainHeight(x, z) < WATER_LEVEL + 0.4) continue;
                if (insideFootprint(x, z, 3)) continue;
                startCandidates.push({ x, z });
            }
        }
    }
    if (startCandidates.length === 0) startCandidates.push({ x: 0, z: 0 });
}

collectStarts();

export function randomStart(rng: Rng): { x: number; z: number } {
    return startCandidates[Math.floor(rng() * startCandidates.length)];
}

export const startPosition = startCandidates[0];

export type FloorInfo = { y: number; floor: number; buildingIndex: number };

export function resolveFloor(x: number, z: number, currentFloor: number, out: FloorInfo = { y: 0, floor: 0, buildingIndex: -1 }): FloorInfo {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    const list = buildingsNear(wx, wz);
    for (let i = 0; i < list.length; i++) {
        const b = buildings[list[i]];
        if (wx < b.bounds.minX || wx > b.bounds.maxX || wz < b.bounds.minZ || wz > b.bounds.maxZ) continue;
        if (!isPointInPolygon(wx, wz, b.polygon)) continue;
        const floor = currentFloor < 0 ? 0 : currentFloor >= b.floors ? b.floors - 1 : currentFloor;
        for (let k = 0; k < b.flights.length; k++) {
            const fl = b.flights[k];
            if (fl.from !== floor && fl.to !== floor) continue;
            if (wx < fl.rect.minX || wx > fl.rect.maxX || wz < fl.rect.minZ || wz > fl.rect.maxZ) continue;
            const pos = fl.axis === 'x' ? wx : wz;
            let t = (pos - fl.start) / (fl.end - fl.start);
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            out.y = b.baseY + (fl.from + (fl.to - fl.from) * t) * FLOOR_HEIGHT;
            out.floor = t > 0.5 ? fl.to : fl.from;
            out.buildingIndex = b.index;
            return out;
        }
        out.y = b.baseY + floor * FLOOR_HEIGHT;
        out.floor = floor;
        out.buildingIndex = b.index;
        return out;
    }
    out.y = getTerrainHeight(x, z);
    out.floor = 0;
    out.buildingIndex = -1;
    return out;
}

export function isInStairZone(x: number, z: number): boolean {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    const list = buildingsNear(wx, wz);
    for (let i = 0; i < list.length; i++) {
        const b = buildings[list[i]];
        for (let k = 0; k < b.flights.length; k++) {
            const r = b.flights[k].rect;
            if (wx >= r.minX && wx <= r.maxX && wz >= r.minZ && wz <= r.maxZ) return true;
        }
    }
    return false;
}

let sx = 0;
let sz = 0;

function pushFromSegment(seg: WallSegment, minDist: number) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const lenSq = dx * dx + dz * dz;
    let t = lenSq < 1e-6 ? 0 : ((sx - seg.x1) * dx + (sz - seg.z1) * dz) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ox = sx - (seg.x1 + dx * t);
    const oz = sz - (seg.z1 + dz * t);
    const distSq = ox * ox + oz * oz;
    if (distSq < minDist * minDist && distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        const push = (minDist - dist) / dist;
        sx += ox * push;
        sz += oz * push;
    }
}

function pushFromBox(minX: number, maxX: number, minZ: number, maxZ: number, radius: number) {
    const cx = sx < minX ? minX : sx > maxX ? maxX : sx;
    const cz = sz < minZ ? minZ : sz > maxZ ? maxZ : sz;
    const dx = sx - cx;
    const dz = sz - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) return;
    if (distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        const push = (radius - dist) / dist;
        sx += dx * push;
        sz += dz * push;
        return;
    }
    const left = sx - minX;
    const right = maxX - sx;
    const top = sz - minZ;
    const bottom = maxZ - sz;
    const m = Math.min(left, right, top, bottom);
    if (m === left) sx = minX - radius;
    else if (m === right) sx = maxX + radius;
    else if (m === top) sz = minZ - radius;
    else sz = maxZ + radius;
}

const circleOut = { x: 0, z: 0 };

export function resolveCollision(x: number, z: number, floor: number, radius: number, out: { x: number; z: number }): { x: number; z: number } {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    const shiftX = x - wx;
    const shiftZ = z - wz;
    sx = wx;
    sz = wz;
    const wallDist = WALL_THICKNESS / 2 + radius;
    for (let pass = 0; pass < 2; pass++) {
        if (collideCircles(sx, sz, radius, circleOut)) {
            sx = circleOut.x;
            sz = circleOut.z;
        }
        const list = buildingsNear(sx, sz);
        for (let i = 0; i < list.length; i++) {
            const b = buildings[list[i]];
            const m = radius + 1.5;
            if (sx < b.bounds.minX - m || sx > b.bounds.maxX + m || sz < b.bounds.minZ - m || sz > b.bounds.maxZ + m) continue;
            const inside = isPointInPolygon(sx, sz, b.polygon);
            const f = inside ? (floor < 0 ? 0 : floor >= b.floors ? b.floors - 1 : floor) : 0;
            const segs = b.walls[f];
            for (let k = 0; k < segs.length; k++) pushFromSegment(segs[k], wallDist);
            if (inside) {
                const boxes = b.boxes[f];
                for (let k = 0; k < boxes.length; k++) {
                    const bx = boxes[k];
                    pushFromBox(bx.minX, bx.maxX, bx.minZ, bx.maxZ, radius);
                }
            }
        }
    }
    out.x = sx + shiftX;
    out.z = sz + shiftZ;
    return out;
}

const resolveScratch = { x: 0, z: 0 };

export function resolvePropCollision(x: number, z: number, floor: number, radius: number = 0.3): { x: number; z: number } {
    return resolveCollision(x, z, floor, radius, { x: resolveScratch.x, z: resolveScratch.z });
}

export function isPositionBlocked(x: number, z: number, floor: number, radius: number): boolean {
    resolveCollision(x, z, floor, radius, resolveScratch);
    const dx = wrapDelta(resolveScratch.x - x);
    const dz = wrapDelta(resolveScratch.z - z);
    return dx * dx + dz * dz > 0.0004;
}

export function findOpenGround(rng: Rng, minClearance: number = 1.0, avoidX?: number, avoidZ?: number, avoidRadius: number = 0): { x: number; z: number } | null {
    for (let attempt = 0; attempt < 60; attempt++) {
        const x = (rng() - 0.5) * WORLD_SIZE;
        const z = (rng() - 0.5) * WORLD_SIZE;
        if (avoidX !== undefined && avoidZ !== undefined) {
            const dx = wrapDelta(x - avoidX);
            const dz = wrapDelta(z - avoidZ);
            if (dx * dx + dz * dz < avoidRadius * avoidRadius) continue;
        }
        const h = getTerrainHeight(x, z);
        if (h < WATER_LEVEL + 0.25) continue;
        if (getSlope(x, z) > 0.7) continue;
        if (insideFootprint(x, z, 1.2)) continue;
        if (circleBlocked(x, z, minClearance)) continue;
        return { x, z };
    }
    return null;
}

export function buildingByIndex(index: number): BuildingDef | undefined {
    return buildings[index];
}
