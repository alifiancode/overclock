import { WORLD_SIZE, WORLD_HALF, WATER_LEVEL, CITY_LEVEL, ROAD_HALF_WIDTH } from '../data/constants.ts';
import { hashInts, worldSeed } from './random.ts';
import { wrapIndex } from './wrap.ts';
import { districtMask, carveLakes, streetDistance, ROAD_OUTER } from './layout.ts';

const SEED = worldSeed | 0;
const N = WORLD_SIZE;
export const MAX_WATER_DEPTH = 2.8;

export type FlattenZone = { x: number; z: number; flatRadius: number; softRadius: number; height: number };

export type Biome = {
    height: number;
    slope: number;
    city: number;
    road: number;
    sidewalk: number;
    fertility: number;
    forest: number;
    flowers: number;
    dirt: number;
    bush: number;
    overgrowth: number;
    water: number;
    shore: number;
};

export function createBiome(): Biome {
    return { height: 0, slope: 0, city: 0, road: 0, sidewalk: 0, fertility: 0, forest: 0, flowers: 0, dirt: 0, bush: 0, overgrowth: 0, water: 0, shore: 0 };
}

function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function smooth(edge0: number, edge1: number, v: number): number {
    const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lattice(ix: number, iz: number, salt: number): number {
    return hashInts(ix, iz, SEED + salt) / 2147483648 - 1;
}

function pnoise(x: number, z: number, cells: number, salt: number): number {
    const u = ((x + WORLD_HALF) / WORLD_SIZE) * cells;
    const v = ((z + WORLD_HALF) / WORLD_SIZE) * cells;
    const x0 = Math.floor(u);
    const z0 = Math.floor(v);
    const fx = fade(u - x0);
    const fz = fade(v - z0);
    const a = wrapIndex(x0, cells);
    const b = wrapIndex(x0 + 1, cells);
    const c = wrapIndex(z0, cells);
    const d = wrapIndex(z0 + 1, cells);
    const n00 = lattice(a, c, salt);
    const n10 = lattice(b, c, salt);
    const n01 = lattice(a, d, salt);
    const n11 = lattice(b, d, salt);
    const nx0 = n00 + (n10 - n00) * fx;
    const nx1 = n01 + (n11 - n01) * fx;
    return nx0 + (nx1 - nx0) * fz;
}

export function fbm(x: number, z: number, cells: number, octaves: number, salt: number): number {
    let total = 0;
    let amplitude = 1;
    let max = 0;
    let c = cells;
    for (let i = 0; i < octaves; i++) {
        total += pnoise(x, z, c, salt + i * 17) * amplitude;
        max += amplitude;
        amplitude *= 0.5;
        c *= 2;
    }
    return total / max;
}

function softMax(a: number, b: number, k: number): number {
    return (a + b + Math.sqrt((a - b) * (a - b) + k * k)) * 0.5;
}

export function getRawHeight(x: number, z: number): number {
    const n = fbm(x, z, 8, 4, 11);
    let h = softMax(1.0 + n * 3.6, WATER_LEVEL + 0.3, 0.6);
    const city = districtMask(x, z);
    if (city > 0) h += (CITY_LEVEL - h) * Math.min(1, city * 1.15);
    return carveLakes(x, z, h);
}

let grid: Float32Array | null = null;
let waterBytes: Uint8Array | null = null;

export function isTerrainBaked(): boolean {
    return grid !== null;
}

export function bakeTerrain(zones: FlattenZone[]) {
    const g = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) {
        const z = iz - WORLD_HALF;
        for (let ix = 0; ix < N; ix++) {
            g[iz * N + ix] = getRawHeight(ix - WORLD_HALF, z);
        }
    }
    const bestInfluence = new Float32Array(N * N);
    const bestHeight = new Float32Array(N * N);
    for (const zone of zones) {
        const r = Math.ceil(zone.softRadius);
        const cx = Math.round(zone.x);
        const cz = Math.round(zone.z);
        for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
                const wx = cx + dx;
                const wz = cz + dz;
                const dist = Math.hypot(wx - zone.x, wz - zone.z);
                if (dist >= zone.softRadius) continue;
                const influence = dist <= zone.flatRadius ? 1 : 1 - fade((dist - zone.flatRadius) / (zone.softRadius - zone.flatRadius));
                const index = wrapIndex(wz + WORLD_HALF, N) * N + wrapIndex(wx + WORLD_HALF, N);
                if (influence > bestInfluence[index]) {
                    bestInfluence[index] = influence;
                    bestHeight[index] = zone.height;
                }
            }
        }
    }
    for (let i = 0; i < g.length; i++) {
        const inf = bestInfluence[i];
        if (inf > 0) g[i] += (bestHeight[i] - g[i]) * inf;
    }
    const bytes = new Uint8Array(N * N);
    for (let i = 0; i < g.length; i++) {
        const depth = WATER_LEVEL - g[i];
        bytes[i] = depth <= 0 ? 0 : Math.min(255, Math.round((depth / MAX_WATER_DEPTH) * 255));
    }
    grid = g;
    waterBytes = bytes;
    bakeBiomes();
}

export function getWaterTexture(): { data: Uint8Array; size: number } {
    return { data: waterBytes ?? new Uint8Array(N * N), size: N };
}

function cellHeight(ix: number, iz: number): number {
    return grid![wrapIndex(iz, N) * N + wrapIndex(ix, N)];
}

export function getTerrainHeight(x: number, z: number): number {
    if (!grid) return getRawHeight(x, z);
    const u = x + WORLD_HALF;
    const v = z + WORLD_HALF;
    const x0 = Math.floor(u);
    const z0 = Math.floor(v);
    const fx = u - x0;
    const fz = v - z0;
    const ha = cellHeight(x0, z0);
    const hb = cellHeight(x0, z0 + 1);
    const hc = cellHeight(x0 + 1, z0 + 1);
    const hd = cellHeight(x0 + 1, z0);
    if (fx + fz <= 1) return ha + fx * (hd - ha) + fz * (hb - ha);
    return hc + (1 - fx) * (hb - hc) + (1 - fz) * (hd - hc);
}

export function getGridHeight(ix: number, iz: number): number {
    if (!grid) return getRawHeight(ix - WORLD_HALF, iz - WORLD_HALF);
    return cellHeight(ix + WORLD_HALF, iz + WORLD_HALF);
}

export function getGridNormal(ix: number, iz: number, out: { x: number; y: number; z: number }) {
    const hl = getGridHeight(ix - 1, iz);
    const hr = getGridHeight(ix + 1, iz);
    const hd = getGridHeight(ix, iz - 1);
    const hu = getGridHeight(ix, iz + 1);
    const nx = (hl - hr) * 0.5;
    const nz = (hd - hu) * 0.5;
    const len = Math.sqrt(nx * nx + 1 + nz * nz);
    out.x = nx / len;
    out.y = 1 / len;
    out.z = nz / len;
}

export function getWaterDepth(x: number, z: number): number {
    return Math.max(0, WATER_LEVEL - getTerrainHeight(x, z));
}

export function getSlope(x: number, z: number): number {
    const dx = getTerrainHeight(x + 1, z) - getTerrainHeight(x - 1, z);
    const dz = getTerrainHeight(x, z + 1) - getTerrainHeight(x, z - 1);
    return Math.hypot(dx, dz) * 0.5;
}

const BIOME_CELL = 4;
const BN = WORLD_SIZE / BIOME_CELL;
const FIELD_COUNT = 7;
let biomeMaps: Uint8Array[] | null = null;

function rawFields(x: number, z: number, h: number, out: number[]) {
    const water = Math.max(0, WATER_LEVEL - h);
    const lakeFactor = clamp01(water * 3);
    out[0] = clamp01(0.55 + fbm(x, z, 12, 3, 31) * 1.25);
    out[1] = smooth(-0.1, 0.2, fbm(x, z, 9, 3, 41));
    out[2] = smooth(0.26, 0.5, fbm(x, z, 16, 2, 51));
    out[3] = smooth(0.2, 0.46, fbm(x, z, 20, 2, 61)) * (1 - 0.55 * out[0]);
    out[4] = smooth(0.0, 0.34, fbm(x, z, 14, 2, 71));
    out[5] = clamp01(0.58 + fbm(x, z, 24, 3, 81) * 1.6);
    out[6] = districtMask(x, z) * (1 - lakeFactor);
}

function bakeBiomes() {
    const maps: Uint8Array[] = [];
    for (let f = 0; f < FIELD_COUNT; f++) maps.push(new Uint8Array(BN * BN));
    const tmp: number[] = new Array(FIELD_COUNT).fill(0);
    for (let j = 0; j < BN; j++) {
        const z = (j + 0.5) * BIOME_CELL - WORLD_HALF;
        for (let i = 0; i < BN; i++) {
            const x = (i + 0.5) * BIOME_CELL - WORLD_HALF;
            rawFields(x, z, getTerrainHeight(x, z), tmp);
            for (let f = 0; f < FIELD_COUNT; f++) maps[f][j * BN + i] = Math.round(clamp01(tmp[f]) * 255);
        }
    }
    biomeMaps = maps;
}

function lookupField(map: Uint8Array, x: number, z: number): number {
    const fu = (x + WORLD_HALF) / BIOME_CELL - 0.5;
    const fv = (z + WORLD_HALF) / BIOME_CELL - 0.5;
    const i0 = Math.floor(fu);
    const j0 = Math.floor(fv);
    const tx = fu - i0;
    const tz = fv - j0;
    const a = wrapIndex(i0, BN);
    const b = wrapIndex(i0 + 1, BN);
    const c = wrapIndex(j0, BN);
    const d = wrapIndex(j0 + 1, BN);
    const v00 = map[c * BN + a];
    const v10 = map[c * BN + b];
    const v01 = map[d * BN + a];
    const v11 = map[d * BN + b];
    const top = v00 + (v10 - v00) * tx;
    const bottom = v01 + (v11 - v01) * tx;
    return (top + (bottom - top) * tz) / 255;
}

const fieldScratch: number[] = new Array(FIELD_COUNT).fill(0);

export function trailMask(x: number, z: number): number {
    const n = Math.abs(fbm(x, z, 11, 2, 55));
    return 1 - smooth(0.016, 0.05, n);
}

export function sampleBiome(x: number, z: number, out: Biome): Biome {
    const h = getTerrainHeight(x, z);
    out.height = h;
    out.water = Math.max(0, WATER_LEVEL - h);
    out.shore = h < WATER_LEVEL + 0.1 ? 1 : 1 - smooth(0.0, 0.8, h - WATER_LEVEL - 0.1);
    out.slope = getSlope(x, z);
    if (biomeMaps) {
        out.fertility = lookupField(biomeMaps[0], x, z);
        out.forest = lookupField(biomeMaps[1], x, z);
        out.flowers = lookupField(biomeMaps[2], x, z);
        out.dirt = lookupField(biomeMaps[3], x, z);
        out.bush = lookupField(biomeMaps[4], x, z);
        out.overgrowth = lookupField(biomeMaps[5], x, z);
        out.city = lookupField(biomeMaps[6], x, z) * (out.water > 0 ? 1 - clamp01(out.water * 3) : 1);
    } else {
        rawFields(x, z, h, fieldScratch);
        out.fertility = fieldScratch[0];
        out.forest = fieldScratch[1];
        out.flowers = fieldScratch[2];
        out.dirt = fieldScratch[3];
        out.bush = fieldScratch[4];
        out.overgrowth = fieldScratch[5];
        out.city = fieldScratch[6];
    }
    const streets = streetDistance(x, z);
    const roadX = 1 - smooth(ROAD_HALF_WIDTH - 0.5, ROAD_HALF_WIDTH + 0.5, streets.dx);
    const roadZ = 1 - smooth(ROAD_HALF_WIDTH - 0.5, ROAD_HALF_WIDTH + 0.5, streets.dz);
    const sideX = 1 - smooth(ROAD_OUTER - 0.4, ROAD_OUTER + 0.4, streets.dx);
    const sideZ = 1 - smooth(ROAD_OUTER - 0.4, ROAD_OUTER + 0.4, streets.dz);
    const streetStrength = smooth(0.18, 0.5, out.city);
    out.road = Math.max(roadX, roadZ) * streetStrength;
    out.sidewalk = Math.max(0, Math.max(sideX, sideZ) - Math.max(roadX, roadZ)) * streetStrength;
    return out;
}
