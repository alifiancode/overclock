import type { Vector3 } from 'three';
import type { Enemy } from '../data/enemies.ts';

const CELL_SIZE = 5;
const OFFSET = 8192;
const STRIDE = 16384;

const cells = new Map<number, Enemy[]>();
const used: Enemy[][] = [];
const found: { enemy: Enemy; distSq: number }[] = [];

function cellKey(cx: number, cz: number): number {
    return (cx + OFFSET) * STRIDE + (cz + OFFSET);
}

export function clearGrid() {
    for (let i = 0; i < used.length; i++) used[i].length = 0;
    used.length = 0;
}

export function insertIntoGrid(enemy: Enemy) {
    const key = cellKey(Math.floor(enemy.position.x / CELL_SIZE), Math.floor(enemy.position.z / CELL_SIZE));
    let bucket = cells.get(key);
    if (!bucket) {
        bucket = [];
        cells.set(key, bucket);
    }
    if (bucket.length === 0) used.push(bucket);
    bucket.push(enemy);
}

export function findNearestInGrid(from: Vector3, maxRadius: number, filter?: (e: Enemy) => boolean): Enemy | null {
    const cellRadius = Math.ceil(maxRadius / CELL_SIZE);
    const cx = Math.floor(from.x / CELL_SIZE);
    const cz = Math.floor(from.z / CELL_SIZE);
    let nearest: Enemy | null = null;
    let nearestDistSq = maxRadius * maxRadius;
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
            const bucket = cells.get(cellKey(cx + dx, cz + dz));
            if (!bucket) continue;
            for (let i = 0; i < bucket.length; i++) {
                const enemy = bucket[i];
                if (filter && !filter(enemy)) continue;
                const distSq = from.distanceToSquared(enemy.position);
                if (distSq < nearestDistSq) {
                    nearestDistSq = distSq;
                    nearest = enemy;
                }
            }
        }
    }
    return nearest;
}

export function findEnemiesInGrid(from: Vector3, maxRadius: number, maxCount: number = Infinity, filter?: (e: Enemy) => boolean): Enemy[] {
    const cellRadius = Math.ceil(maxRadius / CELL_SIZE);
    const cx = Math.floor(from.x / CELL_SIZE);
    const cz = Math.floor(from.z / CELL_SIZE);
    const maxRadiusSq = maxRadius * maxRadius;
    found.length = 0;
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
            const bucket = cells.get(cellKey(cx + dx, cz + dz));
            if (!bucket) continue;
            for (let i = 0; i < bucket.length; i++) {
                const enemy = bucket[i];
                if (filter && !filter(enemy)) continue;
                const distSq = from.distanceToSquared(enemy.position);
                if (distSq <= maxRadiusSq) found.push({ enemy, distSq });
            }
        }
    }
    found.sort((a, b) => a.distSq - b.distSq);
    const count = Math.min(found.length, maxCount);
    const result: Enemy[] = new Array(count);
    for (let i = 0; i < count; i++) result[i] = found[i].enemy;
    return result;
}

export function separationFor(self: Enemy, radius: number, out: { x: number; z: number }) {
    out.x = 0;
    out.z = 0;
    const cx = Math.floor(self.position.x / CELL_SIZE);
    const cz = Math.floor(self.position.z / CELL_SIZE);
    const r2 = radius * radius;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const bucket = cells.get(cellKey(cx + dx, cz + dz));
            if (!bucket) continue;
            for (let i = 0; i < bucket.length; i++) {
                const other = bucket[i];
                if (other === self) continue;
                const ox = self.position.x - other.position.x;
                const oz = self.position.z - other.position.z;
                const d2 = ox * ox + oz * oz;
                if (d2 >= r2) continue;
                if (d2 < 1e-6) {
                    const a = (self.id * 2.399) % (Math.PI * 2);
                    out.x += Math.cos(a);
                    out.z += Math.sin(a);
                    continue;
                }
                const d = Math.sqrt(d2);
                const w = (radius - d) / radius;
                out.x += (ox / d) * w;
                out.z += (oz / d) * w;
            }
        }
    }
}
