export type Rng = () => number;

export const worldSeed = Math.floor(Math.random() * 2147483647);

export function createRng(seed: number): Rng {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashInts(a: number, b: number, c: number = 0): number {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483629);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return h >>> 0;
}

export function hash01(a: number, b: number, c: number = 0): number {
    return hashInts(a, b, c) / 4294967296;
}

export function rngRange(rng: Rng, min: number, max: number): number {
    return min + rng() * (max - min);
}

export function rngInt(rng: Rng, min: number, maxInclusive: number): number {
    return min + Math.floor(rng() * (maxInclusive - min + 1));
}

export function rngPick<T>(rng: Rng, items: readonly T[]): T {
    return items[Math.floor(rng() * items.length)];
}

export function rngChance(rng: Rng, p: number): boolean {
    return rng() < p;
}
