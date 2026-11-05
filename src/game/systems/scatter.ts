import { CHUNK_SIZE, CHUNKS_PER_AXIS, STREET_PITCH, ROAD_HALF_WIDTH, SIDEWALK_WIDTH, WORLD_HALF, WORLD_SIZE } from '../data/constants.ts';
import { hash01, hashInts, worldSeed } from './random.ts';
import { createBiome, getTerrainHeight, sampleBiome, trailMask } from './terrain.ts';
import { wrapDelta, wrapIndex } from './wrap.ts';
import { insideFootprint } from './footprints.ts';

export type TreeKind = 'jungle' | 'tall' | 'palm' | 'dead' | 'banyan' | 'willow';
export type PropKind = 'car' | 'lamp' | 'lampFallen' | 'barrier' | 'dumpster' | 'bench' | 'rubble' | 'fountain' | 'bus' | 'hydrant' | 'log' | 'stump' | 'sign';

export type TreeInst = { kind: TreeKind; x: number; z: number; y: number; scale: number; rot: number; seed: number };
export type RockInst = { x: number; z: number; y: number; scale: number; rot: number; seed: number };
export type PropInst = { kind: PropKind; x: number; z: number; y: number; rot: number; scale: number; variant: number };

export type ScatterChunk = {
    cx: number;
    cz: number;
    centerX: number;
    centerZ: number;
    trees: TreeInst[];
    rocks: RockInst[];
    props: PropInst[];
};

const SEED = worldSeed | 0;
const STREETS_PER_AXIS = WORLD_SIZE / STREET_PITCH;
const STREETS_HALF = STREETS_PER_AXIS / 2;
const CELL = 8;
const HASH_N = WORLD_SIZE / CELL;
const circleCells: number[][] = Array.from({ length: HASH_N * HASH_N }, () => []);
const chunks: (ScatterChunk | undefined)[] = new Array(CHUNKS_PER_AXIS * CHUNKS_PER_AXIS);
const biomeScratch = createBiome();

function addCircle(x: number, z: number, r: number) {
    const cx = Math.floor((x + WORLD_HALF) / CELL);
    const cz = Math.floor((z + WORLD_HALF) / CELL);
    const reach = Math.ceil(r / CELL);
    for (let dz = -reach; dz <= reach; dz++) {
        for (let dx = -reach; dx <= reach; dx++) {
            circleCells[wrapIndex(cz + dz, HASH_N) * HASH_N + wrapIndex(cx + dx, HASH_N)].push(x, z, r);
        }
    }
}

export function collideCircles(x: number, z: number, radius: number, out: { x: number; z: number }): boolean {
    ensureAround(x, z);
    const cx = Math.floor((x + WORLD_HALF) / CELL);
    const cz = Math.floor((z + WORLD_HALF) / CELL);
    let rx = x;
    let rz = z;
    let hit = false;
    const cell = circleCells[wrapIndex(cz, HASH_N) * HASH_N + wrapIndex(cx, HASH_N)];
    for (let i = 0; i < cell.length; i += 3) {
        const dx = wrapDelta(rx - cell[i]);
        const dz = wrapDelta(rz - cell[i + 1]);
        const minDist = cell[i + 2] + radius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist) {
            hit = true;
            if (distSq > 1e-8) {
                const dist = Math.sqrt(distSq);
                const push = (minDist - dist) / dist;
                rx += dx * push;
                rz += dz * push;
            } else {
                rx += minDist;
            }
        }
    }
    out.x = rx;
    out.z = rz;
    return hit;
}

export function circleBlocked(x: number, z: number, radius: number): boolean {
    ensureAround(x, z);
    const cx = Math.floor((x + WORLD_HALF) / CELL);
    const cz = Math.floor((z + WORLD_HALF) / CELL);
    const cell = circleCells[wrapIndex(cz, HASH_N) * HASH_N + wrapIndex(cx, HASH_N)];
    for (let i = 0; i < cell.length; i += 3) {
        const dx = wrapDelta(x - cell[i]);
        const dz = wrapDelta(z - cell[i + 1]);
        const minDist = cell[i + 2] + radius;
        if (dx * dx + dz * dz < minDist * minDist) return true;
    }
    return false;
}

function ensureAround(x: number, z: number) {
    const wx = x + WORLD_HALF;
    const wz = z + WORLD_HALF;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    getChunk(cx, cz);
    const fx = wx - cx * CHUNK_SIZE;
    const fz = wz - cz * CHUNK_SIZE;
    const nearX = fx < 6 ? -1 : fx > CHUNK_SIZE - 6 ? 1 : 0;
    const nearZ = fz < 6 ? -1 : fz > CHUNK_SIZE - 6 ? 1 : 0;
    if (nearX !== 0) getChunk(cx + nearX, cz);
    if (nearZ !== 0) getChunk(cx, cz + nearZ);
    if (nearX !== 0 && nearZ !== 0) getChunk(cx + nearX, cz + nearZ);
}

export function getChunk(cxRaw: number, czRaw: number): ScatterChunk {
    const cx = wrapIndex(cxRaw, CHUNKS_PER_AXIS);
    const cz = wrapIndex(czRaw, CHUNKS_PER_AXIS);
    const index = cz * CHUNKS_PER_AXIS + cx;
    let chunk = chunks[index];
    if (!chunk) {
        chunk = generateChunk(cx, cz);
        chunks[index] = chunk;
    }
    return chunk;
}

export function chunkOrigin(c: number): number {
    return c * CHUNK_SIZE - WORLD_HALF;
}

function canonical(v: number): number {
    return v >= -WORLD_HALF && v < WORLD_HALF ? v : wrapDelta(v);
}

function pickTreeKind(r: number, forest: number, shore: number, city: number, fertility: number): TreeKind {
    if (city > 0.5) return r < 0.4 ? 'dead' : r < 0.8 ? 'jungle' : 'tall';
    if (shore > 0.6 && fertility > 0.4) return r < 0.5 ? 'willow' : r < 0.85 ? 'palm' : 'jungle';
    if (forest > 0.55) return r < 0.5 ? 'jungle' : r < 0.78 ? 'tall' : r < 0.9 ? 'palm' : r < 0.96 ? 'banyan' : 'dead';
    return r < 0.55 ? 'jungle' : r < 0.75 ? 'palm' : r < 0.9 ? 'tall' : 'dead';
}

function treeRadius(kind: TreeKind, scale: number): number {
    switch (kind) {
        case 'banyan':
            return 0.95 * scale;
        case 'tall':
            return 0.38 * scale;
        case 'palm':
            return 0.28 * scale;
        case 'willow':
            return 0.45 * scale;
        case 'dead':
            return 0.32 * scale;
        default:
            return 0.42 * scale;
    }
}

function scatterTrees(chunk: ScatterChunk, ox: number, oz: number) {
    const cell = 4;
    const n = CHUNK_SIZE / cell;
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const gx = Math.floor(ox / cell) + i;
            const gz = Math.floor(oz / cell) + j;
            const h0 = hash01(gx, gz, SEED + 101);
            const x = ox + (i + 0.15 + hash01(gx, gz, SEED + 102) * 0.7) * cell;
            const z = oz + (j + 0.15 + hash01(gx, gz, SEED + 103) * 0.7) * cell;
            const b = sampleBiome(x, z, biomeScratch);
            if (b.water > 0.02) continue;
            let p = (0.04 + 0.78 * b.forest) * (0.4 + 0.6 * b.fertility);
            p *= 1 - 0.8 * b.dirt;
            p *= 1 - 0.55 * b.city * (1 - 0.6 * b.overgrowth);
            p *= 1 - 0.97 * b.road;
            p *= 1 - 0.8 * b.sidewalk;
            if (p > 0.02) p *= 1 - 0.92 * trailMask(x, z) * (1 - b.city);
            if (b.slope > 0.9) p *= 0.4;
            if (b.shore > 0.9 && b.water <= 0.02) p *= 0.5;
            if (h0 > Math.min(p, 0.42)) continue;
            if (insideFootprint(x, z, 1.4)) continue;
            const kind = pickTreeKind(hash01(gx, gz, SEED + 104), b.forest, b.shore, b.city, b.fertility);
            const s0 = 0.75 + hash01(gx, gz, SEED + 105) * 0.7;
            const scale = kind === 'banyan' ? s0 * 1.7 : kind === 'tall' ? s0 * 1.25 : s0;
            const tree: TreeInst = { kind, x, z, y: b.height, scale, rot: hash01(gx, gz, SEED + 106) * Math.PI * 2, seed: hashInts(gx, gz, SEED + 107) };
            chunk.trees.push(tree);
            addCircle(x, z, treeRadius(kind, scale));
        }
    }
}

function scatterRocks(chunk: ScatterChunk, ox: number, oz: number) {
    const cell = 8;
    const n = CHUNK_SIZE / cell;
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const gx = Math.floor(ox / cell) + i;
            const gz = Math.floor(oz / cell) + j;
            const x = ox + (i + 0.1 + hash01(gx, gz, SEED + 201) * 0.8) * cell;
            const z = oz + (j + 0.1 + hash01(gx, gz, SEED + 202) * 0.8) * cell;
            const b = sampleBiome(x, z, biomeScratch);
            if (b.water > 0.3 || b.road > 0.2) continue;
            const base = 0.035 + b.dirt * 0.22 + Math.min(1, b.slope) * 0.2 + b.shore * 0.05;
            if (hash01(gx, gz, SEED + 203) > base * (1 - 0.6 * b.city)) continue;
            if (insideFootprint(x, z, 1.8)) continue;
            const scale = 0.6 + Math.pow(hash01(gx, gz, SEED + 204), 2) * 1.8;
            chunk.rocks.push({ x, z, y: b.height, scale, rot: hash01(gx, gz, SEED + 205) * Math.PI * 2, seed: hashInts(gx, gz, SEED + 206) });
            addCircle(x, z, 0.62 * scale);
        }
    }
}

function pushProp(chunk: ScatterChunk, kind: PropKind, x: number, z: number, rot: number, scale: number, variant: number) {
    const y = getTerrainHeight(x, z);
    chunk.props.push({ kind, x, z, y, rot, scale, variant });
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    switch (kind) {
        case 'car':
            addCircle(x + s * 1.3, z + c * 1.3, 0.95);
            addCircle(x, z, 0.95);
            addCircle(x - s * 1.3, z - c * 1.3, 0.95);
            break;
        case 'bus':
            for (let k = -2; k <= 2; k++) addCircle(x + s * k * 1.5, z + c * k * 1.5, 1.35);
            break;
        case 'barrier':
            addCircle(x + c * 0.9, z - s * 0.9, 0.55);
            addCircle(x - c * 0.9, z + s * 0.9, 0.55);
            break;
        case 'dumpster':
            addCircle(x + c * 0.6, z - s * 0.6, 0.8);
            addCircle(x - c * 0.6, z + s * 0.6, 0.8);
            break;
        case 'lamp':
            addCircle(x, z, 0.22);
            break;
        case 'hydrant':
            addCircle(x, z, 0.25);
            break;
        case 'sign':
            addCircle(x, z, 0.2);
            break;
        case 'bench':
            addCircle(x + c * 0.7, z - s * 0.7, 0.4);
            addCircle(x - c * 0.7, z + s * 0.7, 0.4);
            break;
        case 'fountain':
            addCircle(x, z, 3.0 * scale);
            break;
        case 'log':
            addCircle(x + s * 0.9, z + c * 0.9, 0.5 * scale);
            addCircle(x - s * 0.9, z - c * 0.9, 0.5 * scale);
            break;
        case 'stump':
            addCircle(x, z, 0.55 * scale);
            break;
        default:
            break;
    }
}

function scatterStreetProps(chunk: ScatterChunk, ox: number, oz: number) {
    const x0 = Math.floor(ox / STREET_PITCH);
    const x1 = Math.floor((ox + CHUNK_SIZE - 0.001) / STREET_PITCH);
    const z0 = Math.floor(oz / STREET_PITCH);
    const z1 = Math.floor((oz + CHUNK_SIZE - 0.001) / STREET_PITCH);
    const inChunk = (x: number, z: number) => x >= ox && x < ox + CHUNK_SIZE && z >= oz && z < oz + CHUNK_SIZE;
    for (let sz = z0; sz <= z1 + 1; sz++) {
        for (let sx = x0; sx <= x1 + 1; sx++) {
            const ix = sx * STREET_PITCH;
            const iz = sz * STREET_PITCH;
            const kx = wrapIndex(sx + STREETS_HALF, STREETS_PER_AXIS) - STREETS_HALF;
            const kz = wrapIndex(sz + STREETS_HALF, STREETS_PER_AXIS) - STREETS_HALF;
            for (const axis of [0, 1]) {
                const key = hashInts(kx, kz, SEED + 300 + axis);
                const along = (t: number) => ({ x: axis === 0 ? ix + t : ix, z: axis === 0 ? iz : iz + t });
                const sample = (t: number) => {
                    const p = along(t);
                    return sampleBiome(p.x, p.z, biomeScratch);
                };
                if (sample(STREET_PITCH / 2).road < 0.5) continue;
                const carCount = (key & 3) === 0 ? 0 : (key & 3) === 1 ? 1 : (key & 3) === 2 ? 2 : 1;
                for (let k = 0; k < carCount; k++) {
                    const t = 8 + hash01(key, k, 1) * (STREET_PITCH - 16);
                    const lane = hash01(key, k, 2) < 0.5 ? -2.4 : 2.4;
                    const p = along(t);
                    const x = axis === 0 ? p.x : p.x + lane;
                    const z = axis === 0 ? p.z + lane : p.z;
                    if (!inChunk(x, z)) continue;
                    const rot = (axis === 0 ? Math.PI / 2 : 0) + (hash01(key, k, 3) < 0.5 ? 0 : Math.PI) + (hash01(key, k, 4) - 0.5) * 0.25;
                    const isBus = hash01(key, k, 5) < 0.1;
                    pushProp(chunk, isBus ? 'bus' : 'car', canonical(x), canonical(z), rot, 1, hashInts(key, k, 6));
                }
                for (let k = 0; k < 2; k++) {
                    const t = STREET_PITCH * (0.3 + 0.4 * k) + (hash01(key, k, 7) - 0.5) * 3;
                    const side = k === 0 ? 1 : -1;
                    const off = (ROAD_HALF_WIDTH + SIDEWALK_WIDTH * 0.5) * side;
                    const p = along(t);
                    const x = axis === 0 ? p.x : p.x + off;
                    const z = axis === 0 ? p.z + off : p.z;
                    if (!inChunk(x, z)) continue;
                    const roll = hash01(key, k, 8);
                    const cx = canonical(x);
                    const cz = canonical(z);
                    if (roll < 0.4) pushProp(chunk, 'lamp', cx, cz, 0, 1, hashInts(key, k, 9));
                    else if (roll < 0.55) pushProp(chunk, 'lampFallen', cx, cz, hash01(key, k, 10) * Math.PI * 2, 1, 0);
                    else if (roll < 0.68) pushProp(chunk, 'hydrant', cx, cz, 0, 1, 0);
                    else if (roll < 0.8) pushProp(chunk, 'bench', cx, cz, axis === 0 ? 0 : Math.PI / 2, 1, 0);
                    else if (roll < 0.88) pushProp(chunk, 'sign', cx, cz, hash01(key, k, 11) * Math.PI * 2, 1, 0);
                }
                if (hash01(key, 0, 12) < 0.16) {
                    const t = 9 + hash01(key, 0, 13) * (STREET_PITCH - 18);
                    const p = along(t);
                    if (inChunk(p.x, p.z)) pushProp(chunk, 'barrier', canonical(p.x), canonical(p.z), axis === 0 ? Math.PI / 2 : 0, 1, 0);
                }
                if (hash01(key, 0, 14) < 0.5) {
                    const t = 4 + hash01(key, 0, 15) * (STREET_PITCH - 8);
                    const lane = (hash01(key, 0, 16) < 0.5 ? -1 : 1) * (ROAD_HALF_WIDTH - 1.2);
                    const p = along(t);
                    const x = axis === 0 ? p.x : p.x + lane;
                    const z = axis === 0 ? p.z + lane : p.z;
                    if (inChunk(x, z)) pushProp(chunk, 'rubble', canonical(x), canonical(z), hash01(key, 0, 17) * 6.28, 0.7 + hash01(key, 0, 18), 0);
                }
            }
        }
    }
}

function scatterWildProps(chunk: ScatterChunk, ox: number, oz: number) {
    const cell = 16;
    const n = CHUNK_SIZE / cell;
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const gx = Math.floor(ox / cell) + i;
            const gz = Math.floor(oz / cell) + j;
            const x = ox + (i + 0.15 + hash01(gx, gz, SEED + 401) * 0.7) * cell;
            const z = oz + (j + 0.15 + hash01(gx, gz, SEED + 402) * 0.7) * cell;
            const b = sampleBiome(x, z, biomeScratch);
            if (b.water > 0.05 || b.road > 0.1 || b.sidewalk > 0.1) continue;
            if (insideFootprint(x, z, 2.2)) continue;
            const roll = hash01(gx, gz, SEED + 403);
            if (b.forest > 0.4 && roll < 0.22) {
                pushProp(chunk, 'log', x, z, hash01(gx, gz, SEED + 404) * Math.PI * 2, 0.8 + hash01(gx, gz, SEED + 405) * 0.6, 0);
            } else if (b.forest > 0.3 && roll < 0.34) {
                pushProp(chunk, 'stump', x, z, hash01(gx, gz, SEED + 406) * Math.PI * 2, 0.8 + hash01(gx, gz, SEED + 407) * 0.6, 0);
            } else if (b.city > 0.5 && roll < 0.2) {
                pushProp(chunk, 'rubble', x, z, hash01(gx, gz, SEED + 408) * 6.28, 0.8 + hash01(gx, gz, SEED + 409) * 0.9, 0);
            } else if (b.city > 0.5 && roll < 0.27) {
                pushProp(chunk, 'dumpster', x, z, hash01(gx, gz, SEED + 410) * 6.28, 1, hashInts(gx, gz, 411));
            }
        }
    }
}

function scatterFountains(chunk: ScatterChunk, ox: number, oz: number) {
    const x0 = Math.floor(ox / STREET_PITCH);
    const z0 = Math.floor(oz / STREET_PITCH);
    const lots = Math.ceil(CHUNK_SIZE / STREET_PITCH) + 1;
    for (let dz = 0; dz <= lots; dz++) {
        for (let dx = 0; dx <= lots; dx++) {
            const lx = x0 + dx;
            const lz = z0 + dz;
            const cx = lx * STREET_PITCH + STREET_PITCH / 2;
            const cz = lz * STREET_PITCH + STREET_PITCH / 2;
            if (cx < ox || cx >= ox + CHUNK_SIZE || cz < oz || cz >= oz + CHUNK_SIZE) continue;
            if (cx >= WORLD_HALF || cz >= WORLD_HALF) continue;
            if (insideFootprint(cx, cz, 4)) continue;
            const b = sampleBiome(cx, cz, biomeScratch);
            if (b.city < 0.55 || b.water > 0.02) continue;
            if (hash01(lx, lz, SEED + 501) < 0.38) pushProp(chunk, 'fountain', cx, cz, 0, 1, 0);
        }
    }
}

function generateChunk(cx: number, cz: number): ScatterChunk {
    const ox = chunkOrigin(cx);
    const oz = chunkOrigin(cz);
    const chunk: ScatterChunk = { cx, cz, centerX: ox + CHUNK_SIZE / 2, centerZ: oz + CHUNK_SIZE / 2, trees: [], rocks: [], props: [] };
    scatterStreetProps(chunk, ox, oz);
    scatterFountains(chunk, ox, oz);
    scatterWildProps(chunk, ox, oz);
    scatterRocks(chunk, ox, oz);
    scatterTrees(chunk, ox, oz);
    return chunk;
}
