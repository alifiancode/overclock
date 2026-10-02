import { buildings } from './obstacles.ts';

type DoorGeom = { centerX: number; z: number; halfWidth: number };
type DoorState = { isOpen: boolean; openAmount: number };

const doorGeoms: DoorGeom[] = buildings.map((b) => {
    const gapX1 = b.walls[0].x2;
    const gapX2 = b.walls[1].x1;
    return { centerX: (gapX1 + gapX2) / 2, z: b.walls[0].z1, halfWidth: (gapX2 - gapX1) / 2 + 0.15 };
});

export const doorStates: DoorState[] = buildings.map(() => ({ isOpen: false, openAmount: 0 }));

const OPEN_SPEED = 5;
const INTERACT_RANGE = 2.4;
const PLAYER_RADIUS = 0.3;
const DOOR_DEPTH = 0.3;

export function updateDoors(delta: number) {
    for (const d of doorStates) {
        const target = d.isOpen ? 1 : 0;
        d.openAmount += (target - d.openAmount) * Math.min(1, OPEN_SPEED * delta);
    }
}

export function tryToggleNearestDoor(playerX: number, playerZ: number): boolean {
    let bestIndex = -1;
    let bestDist = INTERACT_RANGE;
    for (let i = 0; i < doorGeoms.length; i++) {
        const g = doorGeoms[i];
        const dist = Math.hypot(playerX - g.centerX, playerZ - g.z);
        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
        }
    }
    if (bestIndex === -1) return false;
    doorStates[bestIndex].isOpen = !doorStates[bestIndex].isOpen;
    return true;
}

export function resolveDoorCollision(x: number, z: number): { x: number; z: number } {
    let resolvedX = x;
    let resolvedZ = z;
    for (let i = 0; i < doorGeoms.length; i++) {
        if (doorStates[i].openAmount > 0.5) continue;
        const g = doorGeoms[i];
        if (Math.abs(resolvedX - g.centerX) > g.halfWidth + PLAYER_RADIUS) continue;
        const halfDepth = DOOR_DEPTH / 2 + PLAYER_RADIUS;
        const dz = resolvedZ - g.z;
        if (Math.abs(dz) < halfDepth) {
            resolvedZ = g.z + Math.sign(dz || 1) * halfDepth;
        }
    }
    return { x: resolvedX, z: resolvedZ };
}

export function getDoorGeom(index: number): DoorGeom {
    return doorGeoms[index];
}

export const doorCount = doorGeoms.length;
