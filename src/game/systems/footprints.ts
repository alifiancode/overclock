import { WORLD_SIZE, WORLD_HALF } from '../data/constants.ts';
import { wrapCoord } from './wrap.ts';
import { isPointInPolygon } from './buildingShapes.ts';
import type { BuildingDef } from './buildingGen.ts';

const CELL = 16;
const GN = WORLD_SIZE / CELL;

export const buildings: BuildingDef[] = [];
const grid: number[][] = Array.from({ length: GN * GN }, () => []);
const EMPTY: number[] = [];

function cellIndex(x: number, z: number): number {
    const cx = Math.floor((x + WORLD_HALF) / CELL);
    const cz = Math.floor((z + WORLD_HALF) / CELL);
    return ((cz % GN) + GN) % GN * GN + (((cx % GN) + GN) % GN);
}

export function registerBuilding(b: BuildingDef) {
    buildings.push(b);
    const pad = 1.5;
    const x0 = Math.floor((b.bounds.minX - pad + WORLD_HALF) / CELL);
    const x1 = Math.floor((b.bounds.maxX + pad + WORLD_HALF) / CELL);
    const z0 = Math.floor((b.bounds.minZ - pad + WORLD_HALF) / CELL);
    const z1 = Math.floor((b.bounds.maxZ + pad + WORLD_HALF) / CELL);
    for (let cz = z0; cz <= z1; cz++) {
        for (let cx = x0; cx <= x1; cx++) {
            const idx = (((cz % GN) + GN) % GN) * GN + (((cx % GN) + GN) % GN);
            if (!grid[idx].includes(b.index)) grid[idx].push(b.index);
        }
    }
}

export function buildingsNear(x: number, z: number): number[] {
    const list = grid[cellIndex(wrapCoord(x), wrapCoord(z))];
    return list.length === 0 ? EMPTY : list;
}

function distToSegmentSq(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    let t = lenSq < 1e-9 ? 0 : ((px - x1) * dx + (pz - z1) * dz) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = x1 + dx * t - px;
    const cz = z1 + dz * t - pz;
    return cx * cx + cz * cz;
}

export function insideFootprint(x: number, z: number, margin: number): boolean {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    const list = grid[cellIndex(wx, wz)];
    for (let i = 0; i < list.length; i++) {
        const b = buildings[list[i]];
        if (wx < b.bounds.minX - margin || wx > b.bounds.maxX + margin || wz < b.bounds.minZ - margin || wz > b.bounds.maxZ + margin) continue;
        if (isPointInPolygon(wx, wz, b.polygon)) return true;
        if (margin <= 0) continue;
        const poly = b.polygon;
        const m2 = margin * margin;
        for (let k = 0; k < poly.length; k++) {
            const a = poly[k];
            const c = poly[(k + 1) % poly.length];
            if (distToSegmentSq(wx, wz, a.x, a.z, c.x, c.z) < m2) return true;
        }
    }
    return false;
}

export function buildingIndexAt(x: number, z: number): number {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    const list = grid[cellIndex(wx, wz)];
    for (let i = 0; i < list.length; i++) {
        const b = buildings[list[i]];
        if (wx < b.bounds.minX || wx > b.bounds.maxX || wz < b.bounds.minZ || wz > b.bounds.maxZ) continue;
        if (isPointInPolygon(wx, wz, b.polygon)) return b.index;
    }
    return -1;
}
