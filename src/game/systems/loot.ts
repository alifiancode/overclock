import { WATER_LEVEL } from '../data/constants.ts';
import { WEAPONS, WEAPON_ORDER, STARTING_WEAPON, type WeaponId } from '../data/weapons.ts';
import { floorTopY, randomLootPoints } from './buildingGen.ts';
import { buildings, insideFootprint } from './footprints.ts';
import { findOpenGround } from './obstacles.ts';
import { clearPickups, spawnStaticLoot, type PickupKind } from './pickups.ts';
import type { Rng } from './random.ts';
import { circleBlocked } from './scatter.ts';
import { getTerrainHeight } from './terrain.ts';
import { wrapDelta } from './wrap.ts';

type Spot = { x: number; y: number; z: number };

const WORLD_WEAPONS: Partial<Record<WeaponId, number>> = { rifle: 5, smg: 5, shotgun: 4, sniper: 3, launcher: 3 };
const AMMO_PER_WEAPON = 8;
const COIN_COUNT = 90;
const NEAR_START_POOL: WeaponId[] = ['rifle', 'smg', 'shotgun'];

function distanceTo(ax: number, az: number, bx: number, bz: number): number {
    return Math.hypot(wrapDelta(ax - bx), wrapDelta(az - bz));
}

function indoorSpot(rng: Rng, nearX?: number, nearZ?: number, minDist: number = 0, maxDist: number = Infinity): Spot | null {
    for (let attempt = 0; attempt < 60; attempt++) {
        const def = buildings[Math.floor(rng() * buildings.length)];
        if (!def) return null;
        if (nearX !== undefined && nearZ !== undefined) {
            const d = distanceTo(def.x, def.z, nearX, nearZ);
            if (d < minDist || d > maxDist) continue;
        }
        const floor = Math.floor(rng() * def.floors);
        const points = randomLootPoints(def, rng, floor, 1);
        if (points.length === 0) continue;
        return { x: points[0].x, y: floorTopY(def, floor), z: points[0].z };
    }
    return null;
}

function outdoorSpot(rng: Rng, nearX?: number, nearZ?: number, minDist: number = 0, maxDist: number = Infinity): Spot | null {
    if (nearX === undefined || nearZ === undefined) {
        const p = findOpenGround(rng, 1.1);
        return p ? { x: p.x, y: getTerrainHeight(p.x, p.z), z: p.z } : null;
    }
    for (let attempt = 0; attempt < 80; attempt++) {
        const a = rng() * Math.PI * 2;
        const r = minDist + rng() * (maxDist - minDist);
        const x = nearX + Math.cos(a) * r;
        const z = nearZ + Math.sin(a) * r;
        const h = getTerrainHeight(x, z);
        if (h < WATER_LEVEL + 0.25) continue;
        if (insideFootprint(x, z, 1.4)) continue;
        if (circleBlocked(x, z, 1.0)) continue;
        return { x, y: h, z };
    }
    return null;
}

function place(spot: Spot | null, kind: PickupKind, amount: number) {
    if (spot) spawnStaticLoot(spot.x, spot.y, spot.z, kind, amount);
}

export function regenerateLoot(startX: number, startZ: number, rng: Rng) {
    clearPickups();

    const firstKind = NEAR_START_POOL[Math.floor(rng() * NEAR_START_POOL.length)];
    const secondKind = NEAR_START_POOL.filter((id) => id !== firstKind)[Math.floor(rng() * (NEAR_START_POOL.length - 1))];
    place(indoorSpot(rng, startX, startZ, 10, 60) ?? indoorSpot(rng), `weapon_${firstKind}`, 1);
    place(outdoorSpot(rng, startX, startZ, 18, 55), `weapon_${secondKind}`, 1);

    for (const id of WEAPON_ORDER) {
        const count = WORLD_WEAPONS[id] ?? 0;
        for (let i = 0; i < count; i++) {
            const spot = i % 2 === 0 ? (indoorSpot(rng) ?? outdoorSpot(rng)) : (outdoorSpot(rng) ?? indoorSpot(rng));
            place(spot, `weapon_${id}`, 1);
        }
    }

    for (const id of WEAPON_ORDER) {
        const mag = WEAPONS[id].magazineSize;
        const count = id === STARTING_WEAPON ? AMMO_PER_WEAPON + 4 : AMMO_PER_WEAPON;
        for (let i = 0; i < count; i++) {
            const spot = i % 2 === 0 ? (indoorSpot(rng) ?? outdoorSpot(rng)) : (outdoorSpot(rng) ?? indoorSpot(rng));
            place(spot, `ammo_${id}`, Math.max(4, Math.round(mag * (0.6 + rng() * 0.8))));
        }
    }

    for (let i = 0; i < COIN_COUNT; i++) {
        const spot = rng() < 0.4 ? (indoorSpot(rng) ?? outdoorSpot(rng)) : (outdoorSpot(rng) ?? indoorSpot(rng));
        place(spot, 'currency', 3 + Math.floor(rng() * 6));
    }
}
