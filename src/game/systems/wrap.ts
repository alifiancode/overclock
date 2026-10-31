import { WORLD_SIZE, WORLD_HALF } from '../data/constants.ts';

export function wrapCoord(v: number): number {
    if (v >= -WORLD_HALF && v < WORLD_HALF) return v;
    const m = (v + WORLD_HALF) % WORLD_SIZE;
    return (m < 0 ? m + WORLD_SIZE : m) - WORLD_HALF;
}

export function wrapDelta(d: number): number {
    if (d >= -WORLD_HALF && d < WORLD_HALF) return d;
    const m = (d + WORLD_HALF) % WORLD_SIZE;
    return (m < 0 ? m + WORLD_SIZE : m) - WORLD_HALF;
}

export function wrapNear(v: number, ref: number): number {
    return ref + wrapDelta(v - ref);
}

export function wrapIndex(i: number, n: number): number {
    if (i >= 0 && i < n) return i;
    return ((i % n) + n) % n;
}

export function wrapDistance(x1: number, z1: number, x2: number, z2: number): number {
    return Math.hypot(wrapDelta(x2 - x1), wrapDelta(z2 - z1));
}
