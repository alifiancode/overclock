import { Vector3 } from 'three';
import { WEAPON_ORDER, type WeaponId } from '../data/weapons.ts';

export type PickupKind = 'currency' | `ammo_${WeaponId}` | `weapon_${WeaponId}`;

export type Pickup = { id: number; position: Vector3; kind: PickupKind; amount: number };

export const pickups: Pickup[] = [];
let nextPickupId = 0;

const DROP_CHANCE = 0.35;
const CURRENCY_MIN = 2;
const CURRENCY_MAX = 6;
const AMMO_DROP_MIN = 4;
const AMMO_DROP_MAX = 10;

export function maybeDropPickup(position: Vector3) {
    if (Math.random() > DROP_CHANCE) return;
    const roll = Math.random();
    if (roll < 0.75) {
        pickups.push({
            id: nextPickupId++,
            position: position.clone(),
            kind: 'currency',
            amount: CURRENCY_MIN + Math.floor(Math.random() * (CURRENCY_MAX - CURRENCY_MIN + 1)),
        });
    } else {
        const weaponId = WEAPON_ORDER[Math.floor(Math.random() * WEAPON_ORDER.length)];
        pickups.push({
            id: nextPickupId++,
            position: position.clone(),
            kind: `ammo_${weaponId}`,
            amount: AMMO_DROP_MIN + Math.floor(Math.random() * (AMMO_DROP_MAX - AMMO_DROP_MIN + 1)),
        });
    }
}

export function spawnStaticLoot(x: number, z: number, kind: PickupKind, amount: number) {
    pickups.push({ id: nextPickupId++, position: new Vector3(x, 0, z), kind, amount });
}

const COLLECT_RADIUS = 1.1;

export function collectNearby(playerX: number, playerZ: number): Pickup[] {
    const collected: Pickup[] = [];
    for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        const dx = playerX - p.position.x;
        const dz = playerZ - p.position.z;
        if (dx * dx + dz * dz <= COLLECT_RADIUS * COLLECT_RADIUS) {
            collected.push(p);
            pickups.splice(i, 1);
        }
    }
    return collected;
}

export function ammoWeaponIdFor(kind: PickupKind): WeaponId | null {
    return kind.startsWith('ammo_') ? (kind.slice(5) as WeaponId) : null;
}

export function weaponIdForPickupKind(kind: PickupKind): WeaponId | null {
    return kind.startsWith('weapon_') ? (kind.slice(7) as WeaponId) : null;
}
