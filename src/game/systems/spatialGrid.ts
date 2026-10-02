import type { Vector3 } from 'three';
import type { Enemy } from '../data/enemies.ts';

const CELL_SIZE = 5;

function cellKey(x: number, z: number): string {
    return `${Math.floor(x / CELL_SIZE)}, ${Math.floor(z / CELL_SIZE)}`;
}

const cells = new Map<string, Enemy[]>();

export function clearGrid() {
    cells.clear();
}

export function insertIntoGrid(enemy: Enemy) {
    const key = cellKey(enemy.position.x, enemy.position.z);
    let bucket = cells.get(key);
    if (!bucket) {
        bucket = [];
        cells.set(key, bucket);
    }
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
            const bucket = cells.get(`${cx + dx}, ${cz + dz}`);
            if (!bucket) continue;

            for (const enemy of bucket) {
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

    const found: { enemy: Enemy; distSq: number }[] = [];
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
            const bucket = cells.get(`${cx + dx}, ${cz + dz}`);
            if (!bucket) continue;
            for (const enemy of bucket) {
                if (filter && !filter(enemy)) continue;
                const distSq = from.distanceToSquared(enemy.position);
                if (distSq <= maxRadiusSq) found.push({ enemy, distSq });
            }
        }
    }
    found.sort((a, b) => a.distSq - b.distSq);
    return found.slice(0, maxCount).map((f) => f.enemy);
}
