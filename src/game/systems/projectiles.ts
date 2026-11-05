import { Vector3, Color } from 'three';

export const MAX_PROJECTILES = 36;
export const TRAVEL_DURATION = 0.12;

type Projectile = { start: Vector3; end: Vector3; elapsed: number; alive: boolean; color: Color; size: number };

export const projectiles: Projectile[] = Array.from({ length: MAX_PROJECTILES }, () => ({
    start: new Vector3(),
    end: new Vector3(),
    elapsed: 0,
    alive: false,
    color: new Color('#fff2b0'),
    size: 1,
}));

let nextSlot = 0;

export function fireProjectile(
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    color: string = '#fff2b0',
    size: number = 1
) {
    const p = projectiles[nextSlot];
    nextSlot = (nextSlot + 1) % MAX_PROJECTILES;
    p.start.set(startX, startY, startZ);
    p.end.set(endX, endY, endZ);
    p.elapsed = 0;
    p.alive = true;
    p.color.set(color);
    p.size = size;
}

export function updateProjectiles(delta: number) {
    for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        if (!p.alive) continue;
        p.elapsed += delta;
        if (p.elapsed >= TRAVEL_DURATION) p.alive = false;
    }
}
