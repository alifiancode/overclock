import { WATER_LEVEL } from '../data/constants.ts';
import { getTerrainHeight } from './terrain.ts';

const SHALLOW_SHARE = 0.35;
const FULL_DEPTH = 1.4;

export function waterDepthAt(x: number, z: number): number {
    const depth = WATER_LEVEL - getTerrainHeight(x, z);
    return depth > 0 ? depth : 0;
}

export function wadeFactor(depth: number, deepFactor: number): number {
    if (depth <= 0.02) return 1;
    const k = Math.min(1, depth / FULL_DEPTH);
    return 1 + (deepFactor - 1) * (SHALLOW_SHARE + (1 - SHALLOW_SHARE) * k);
}

export function wadeLift(depth: number, sink: number): number {
    return depth > sink ? depth - sink : 0;
}
