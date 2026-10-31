import { WORLD_HALF, STREET_PITCH, ROAD_HALF_WIDTH, SIDEWALK_WIDTH, WATER_LEVEL } from '../data/constants.ts';
import { createRng, rngRange, worldSeed } from './random.ts';
import { wrapDelta, wrapDistance } from './wrap.ts';

export type District = { x: number; z: number; radius: number; phase1: number; phase2: number };
export type Lake = { x: number; z: number; radius: number; depth: number; phase1: number; phase2: number };

const DISTRICT_COUNT = 7;
const LAKE_COUNT = 12;

export const districts: District[] = [];
export const lakes: Lake[] = [];

function generateLayout() {
    const rng = createRng(worldSeed ^ 0x2f6b1d);
    let attempts = 0;
    while (districts.length < DISTRICT_COUNT && attempts < 600) {
        attempts++;
        const x = rngRange(rng, -WORLD_HALF, WORLD_HALF);
        const z = rngRange(rng, -WORLD_HALF, WORLD_HALF);
        if (districts.some((d) => wrapDistance(x, z, d.x, d.z) < 165)) continue;
        districts.push({ x, z, radius: rngRange(rng, 66, 100), phase1: rng() * 6.283, phase2: rng() * 6.283 });
    }
    attempts = 0;
    while (lakes.length < LAKE_COUNT && attempts < 800) {
        attempts++;
        const x = rngRange(rng, -WORLD_HALF, WORLD_HALF);
        const z = rngRange(rng, -WORLD_HALF, WORLD_HALF);
        const radius = rngRange(rng, 24, 50);
        if (districts.some((d) => wrapDistance(x, z, d.x, d.z) < d.radius * 0.72 + radius * 0.5)) continue;
        if (lakes.some((l) => wrapDistance(x, z, l.x, l.z) < l.radius + radius + 30)) continue;
        lakes.push({ x, z, radius, depth: rngRange(rng, 1.8, 2.7), phase1: rng() * 6.283, phase2: rng() * 6.283 });
    }
}

generateLayout();

function smooth(edge0: number, edge1: number, v: number): number {
    const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function districtMask(x: number, z: number): number {
    let best = 0;
    for (let i = 0; i < districts.length; i++) {
        const d = districts[i];
        const dx = wrapDelta(x - d.x);
        const dz = wrapDelta(z - d.z);
        const limit = d.radius * 1.35;
        const distSq = dx * dx + dz * dz;
        if (distSq > limit * limit) continue;
        const dist = Math.sqrt(distSq);
        const angle = Math.atan2(dz, dx);
        const effective = d.radius * (1 + 0.16 * Math.sin(angle * 2 + d.phase1) + 0.09 * Math.sin(angle * 5 + d.phase2));
        const mask = 1 - smooth(0.6, 1.0, dist / effective);
        if (mask > best) best = mask;
    }
    return best;
}

export function carveLakes(x: number, z: number, height: number): number {
    let bestBowl = 0;
    let bestDepth = 0;
    for (let i = 0; i < lakes.length; i++) {
        const l = lakes[i];
        const dx = wrapDelta(x - l.x);
        const dz = wrapDelta(z - l.z);
        const limit = l.radius * 1.5;
        const distSq = dx * dx + dz * dz;
        if (distSq > limit * limit) continue;
        const dist = Math.sqrt(distSq);
        const angle = Math.atan2(dz, dx);
        const effective = l.radius * (1 + 0.26 * Math.sin(angle * 3 + l.phase1) + 0.13 * Math.sin(angle * 5 + l.phase2));
        const bowl = 1 - smooth(0.18, 1.0, dist / effective);
        if (bowl > bestBowl) {
            bestBowl = bowl;
            bestDepth = l.depth;
        }
    }
    if (bestBowl <= 0) return height;
    return height + (WATER_LEVEL - bestDepth - height) * bestBowl;
}

function lineDistance(v: number): number {
    const m = ((v % STREET_PITCH) + STREET_PITCH) % STREET_PITCH;
    return Math.min(m, STREET_PITCH - m);
}

export const ROAD_OUTER = ROAD_HALF_WIDTH + SIDEWALK_WIDTH;
export const LOT_SIZE = STREET_PITCH - ROAD_OUTER * 2;

export function streetDistance(x: number, z: number): { dx: number; dz: number } {
    return { dx: lineDistance(x), dz: lineDistance(z) };
}

export function lotCenter(lotX: number, lotZ: number): { x: number; z: number } {
    return { x: lotX * STREET_PITCH + STREET_PITCH / 2, z: lotZ * STREET_PITCH + STREET_PITCH / 2 };
}
