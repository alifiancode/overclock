import { buildings, buildingsNear } from './footprints.ts';
import { createRng } from './random.ts';
import { wrapCoord, wrapDelta } from './wrap.ts';

export type Door = {
    id: number;
    building: number;
    x: number;
    z: number;
    y: number;
    nx: number;
    nz: number;
    width: number;
    leaves: number;
    tone: number;
    isOpen: boolean;
    openAmount: number;
};

export const DOOR_TONES = 6;
export const DOOR_MAX_ANGLE = 1.75;

const OPEN_SPEED = 4.2;
const INTERACT_RANGE = 2.8;
const SLAB_HALF_THICKNESS = 0.07;
const PASSABLE_AT = 0.45;

export const doors: Door[] = [];
const byBuilding = new Map<number, Door[]>();
const EMPTY: Door[] = [];

function register() {
    let id = 0;
    for (const b of buildings) {
        for (const e of b.entrances) {
            if (e.kind === 'breach') continue;
            const door: Door = {
                id: id++,
                building: b.index,
                x: e.x,
                z: e.z,
                y: b.baseY,
                nx: e.nx,
                nz: e.nz,
                width: e.width,
                leaves: e.width >= 1.9 ? 2 : 1,
                tone: 0,
                isOpen: false,
                openAmount: 0,
            };
            doors.push(door);
            const list = byBuilding.get(b.index);
            if (list) list.push(door);
            else byBuilding.set(b.index, [door]);
        }
    }
}

register();

export function resetDoors(seed: number) {
    const rng = createRng(seed);
    for (const d of doors) {
        d.tone = Math.floor(rng() * DOOR_TONES);
        d.isOpen = rng() < 0.5;
        d.openAmount = d.isOpen ? 1 : 0;
    }
}

resetDoors(0x51ed);

export function doorsOfBuilding(index: number): Door[] {
    return byBuilding.get(index) ?? EMPTY;
}

export function updateDoors(delta: number) {
    const k = Math.min(1, OPEN_SPEED * delta);
    for (let i = 0; i < doors.length; i++) {
        const d = doors[i];
        const target = d.isOpen ? 1 : 0;
        if (d.openAmount === target) continue;
        const next = d.openAmount + (target - d.openAmount) * k;
        d.openAmount = Math.abs(target - next) < 0.01 ? target : next;
    }
}

export function isDoorPassable(door: Door): boolean {
    return door.openAmount >= PASSABLE_AT;
}

export function tryToggleNearestDoor(playerX: number, playerZ: number): boolean {
    let best: Door | null = null;
    let bestDist = INTERACT_RANGE;
    const list = buildingsNear(playerX, playerZ);
    for (let i = 0; i < list.length; i++) {
        const group = byBuilding.get(list[i]);
        if (!group) continue;
        for (let k = 0; k < group.length; k++) {
            const d = group[k];
            const dist = Math.hypot(wrapDelta(playerX - d.x), wrapDelta(playerZ - d.z));
            if (dist < bestDist) {
                bestDist = dist;
                best = d;
            }
        }
    }
    if (!best) return false;
    best.isOpen = !best.isOpen;
    return true;
}

export function openDoorsNear(x: number, z: number, radius: number): boolean {
    let opened = false;
    const list = buildingsNear(x, z);
    for (let i = 0; i < list.length; i++) {
        const group = byBuilding.get(list[i]);
        if (!group) continue;
        for (let k = 0; k < group.length; k++) {
            const d = group[k];
            if (d.isOpen) continue;
            const dx = wrapDelta(x - d.x);
            const dz = wrapDelta(z - d.z);
            if (dx * dx + dz * dz < radius * radius) {
                d.isOpen = true;
                opened = true;
            }
        }
    }
    return opened;
}

export function nearestDoorDistance(x: number, z: number): number {
    let best = Infinity;
    const list = buildingsNear(x, z);
    for (let i = 0; i < list.length; i++) {
        const group = byBuilding.get(list[i]);
        if (!group) continue;
        for (let k = 0; k < group.length; k++) {
            const d = group[k];
            const dist = Math.hypot(wrapDelta(x - d.x), wrapDelta(z - d.z));
            if (dist < best) best = dist;
        }
    }
    return best;
}

export function resolveDoorCollision(x: number, z: number, radius: number, out: { x: number; z: number }): { x: number; z: number } {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    const shiftX = x - wx;
    const shiftZ = z - wz;
    let sx = wx;
    let sz = wz;
    const list = buildingsNear(sx, sz);
    const minDist = SLAB_HALF_THICKNESS + radius;
    for (let i = 0; i < list.length; i++) {
        const group = byBuilding.get(list[i]);
        if (!group) continue;
        for (let k = 0; k < group.length; k++) {
            const d = group[k];
            if (d.openAmount >= PASSABLE_AT) continue;
            const tx = -d.nz;
            const tz = d.nx;
            const half = d.width / 2;
            const rx = wrapDelta(sx - d.x);
            const rz = wrapDelta(sz - d.z);
            const along = rx * tx + rz * tz;
            const across = rx * d.nx + rz * d.nz;
            if (Math.abs(across) >= minDist) continue;
            const clamped = along < -half ? -half : along > half ? half : along;
            const ox = along - clamped;
            const dist = Math.sqrt(ox * ox + across * across);
            if (dist >= minDist) continue;
            let pushAlong: number;
            let pushAcross: number;
            if (dist > 1e-6) {
                const f = (minDist - dist) / dist;
                pushAlong = ox * f;
                pushAcross = across * f;
            } else {
                pushAlong = 0;
                pushAcross = minDist;
            }
            sx += tx * pushAlong + d.nx * pushAcross;
            sz += tz * pushAlong + d.nz * pushAcross;
        }
    }
    out.x = sx + shiftX;
    out.z = sz + shiftZ;
    return out;
}
