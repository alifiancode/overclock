function hash(ix: number, iz: number): number {

    let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return ((h >>> 0) / 4294967295) * 2 - 1;
}

function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function valueNoise(x: number, z: number): number {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const sx = fade(x - x0);
    const sz = fade(z - z0);
    const n00 = hash(x0, z0);
    const n10 = hash(x0 + 1, z0);
    const n01 = hash(x0, z0 + 1);
    const n11 = hash(x0 + 1, z0 + 1);
    return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sz);
}

const OCTAVES = 4;
const PERSISTENCE = 0.5;
const LACUNARITY = 2.15;

function fbm(x: number, z: number): number {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < OCTAVES; i++) {
        total += valueNoise(x * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= PERSISTENCE;
        frequency *= LACUNARITY;
    }
    return total / maxValue;
}

export const TERRAIN_WAVELENGTH = 42;
export const TERRAIN_AMPLITUDE = 3.8;

export function getRawTerrainHeight(x: number, z: number): number {
    return fbm(x / TERRAIN_WAVELENGTH, z / TERRAIN_WAVELENGTH) * TERRAIN_AMPLITUDE;
}

type FlattenZone = { x: number; z: number; flatRadius: number; softRadius: number; height: number };
const flattenZones: FlattenZone[] = [];

export function registerFlattenZone(x: number, z: number, flatRadius: number, softRadius: number, height: number) {
    flattenZones.push({ x, z, flatRadius, height, softRadius: Math.max(softRadius, flatRadius + 0.01) });
}

export function getTerrainHeight(x: number, z: number): number {
    const base = getRawTerrainHeight(x, z);
    let result = base;
    let bestInfluence = 0;
    for (const zone of flattenZones) {
        const d = Math.hypot(x - zone.x, z - zone.z);
        if (d >= zone.softRadius) continue;
        let influence: number;
        let value: number;
        if (d <= zone.flatRadius) {
            influence = 1;
            value = zone.height;
        } else {
            const t = (d - zone.flatRadius) / (zone.softRadius - zone.flatRadius);
            influence = 1 - fade(t);
            value = lerp(base, zone.height, influence);
        }
        if (influence > bestInfluence) {
            bestInfluence = influence;
            result = value;
        }
    }
    return result;
}

export function getOvergrowth(x: number, z: number): number {
    const broad = Math.sin(x * 0.048 + Math.sin(z * 0.041) * 2.2) * Math.cos(z * 0.052 + Math.sin(x * 0.036) * 2.4);
    const medium = Math.sin(x * 0.12 - z * 0.1 + Math.sin(x * 0.07 + z * 0.09) * 1.8);
    const fine = Math.sin(x * 0.42 + Math.sin(z * 0.37) * 1.7) * Math.cos(z * 0.39 + Math.sin(x * 0.33) * 1.6);
    const value = (broad * 0.55 + medium * 0.28 + fine * 0.24 + 0.24) * 1.45;
    return Math.max(0, Math.min(1, value));
}
