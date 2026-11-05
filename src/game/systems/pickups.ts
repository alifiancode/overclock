import { Vector3 } from 'three';
import { WEAPON_ORDER, type WeaponId } from '../data/weapons.ts';
import { wrapCoord, wrapDelta } from './wrap.ts';

export type PickupKind = 'currency' | `ammo_${WeaponId}` | `weapon_${WeaponId}`;

export type Pickup = { id: number; position: Vector3; kind: PickupKind; amount: number };

export const pickups: Pickup[] = [];
let nextPickupId = 0;

const DROP_CHANCE = 0.35;
const CURRENCY_MIN = 2;
const CURRENCY_MAX = 6;
const AMMO_DROP_MIN = 4;
const AMMO_DROP_MAX = 10;
const ENEMY_FEET_OFFSET = 0.1;
const COLLECT_RADIUS = 1.1;
const COLLECT_HEIGHT = 1.7;

export function clearPickups() {
    pickups.length = 0;
}

export function maybeDropPickup(position: Vector3) {
    if (Math.random() > DROP_CHANCE) return;
    const x = wrapCoord(position.x);
    const y = position.y - ENEMY_FEET_OFFSET;
    const z = wrapCoord(position.z);
    const roll = Math.random();
    if (roll < 0.75) {
        pickups.push({
            id: nextPickupId++,
            position: new Vector3(x, y, z),
            kind: 'currency',
            amount: CURRENCY_MIN + Math.floor(Math.random() * (CURRENCY_MAX - CURRENCY_MIN + 1)),
        });
    } else {
        const weaponId = WEAPON_ORDER[Math.floor(Math.random() * WEAPON_ORDER.length)];
        pickups.push({
            id: nextPickupId++,
            position: new Vector3(x, y, z),
            kind: `ammo_${weaponId}`,
            amount: AMMO_DROP_MIN + Math.floor(Math.random() * (AMMO_DROP_MAX - AMMO_DROP_MIN + 1)),
        });
    }
}

export function spawnStaticLoot(x: number, y: number, z: number, kind: PickupKind, amount: number) {
    pickups.push({ id: nextPickupId++, position: new Vector3(wrapCoord(x), y, wrapCoord(z)), kind, amount });
}

export function collectNearby(playerX: number, playerZ: number, feetY: number): Pickup[] {
    const collected: Pickup[] = [];
    for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        const dx = wrapDelta(playerX - p.position.x);
        const dz = wrapDelta(playerZ - p.position.z);
        if (dx * dx + dz * dz > COLLECT_RADIUS * COLLECT_RADIUS) continue;
        if (Math.abs(feetY - p.position.y) > COLLECT_HEIGHT) continue;
        collected.push(p);
        pickups.splice(i, 1);
    }
    return collected;
}

export function ammoWeaponIdFor(kind: PickupKind): WeaponId | null {
    return kind.startsWith('ammo_') ? (kind.slice(5) as WeaponId) : null;
}

export function weaponIdForPickupKind(kind: PickupKind): WeaponId | null {
    return kind.startsWith('weapon_') ? (kind.slice(7) as WeaponId) : null;
}
