import { Vector3, type PerspectiveCamera } from 'three';
import { FLOOR_HEIGHT } from '../data/constants.ts';
import { enemies } from '../data/enemies.ts';
import { world } from '../state/world.ts';
import { SEE_COUNT, fx } from './shaderFx.ts';
import { buildings } from './footprints.ts';
import { wrapNear } from './wrap.ts';

const FEET_OFFSET = 0.3;
const SEE_RANGE = 30;
const SEE_ENEMIES = SEE_COUNT - 1;

const projected = new Vector3();
const candidates = Array.from({ length: SEE_ENEMIES }, () => ({ x: 0, y: 0, z: 0, d: Infinity }));

let indoor = 0;
let lastBuilding = -1;

export function resetFx() {
    indoor = 0;
    lastBuilding = -1;
    fx.uIndoor.value = 0;
    fx.uCut.value.set(1, 1, -1, -1);
    fx.uCutY.value.set(500, 500, 500);
    for (const s of fx.uSee.value) s.set(0, 0, 1, 0);
}

function writeSee(slot: number, camera: PerspectiveCamera, width: number, height: number, x: number, y: number, z: number) {
    projected.set(x, y, z);
    const cd = camera.position.distanceTo(projected);
    projected.project(camera);
    if (projected.z > 1) {
        fx.uSee.value[slot].set(0, 0, 1, 0);
        return;
    }
    const scale = Math.max(0.55, Math.min(1.5, 14.1 / Math.max(4, cd)));
    fx.uSee.value[slot].set((projected.x * 0.5 + 0.5) * width, (projected.y * 0.5 + 0.5) * height, height * 0.1 * scale, cd);
}

export function updateFx(camera: PerspectiveCamera, width: number, height: number, time: number, delta: number) {
    const p = world.player.position;
    const feetY = p.y + FEET_OFFSET;
    fx.uTime.value = time;
    fx.uPlayer.value.set(p.x, feetY, p.z);
    const cx = camera.position.x - p.x;
    const cz = camera.position.z - p.z;
    const cl = Math.hypot(cx, cz);
    if (cl > 1e-4) fx.uCamDir.value.set(cx / cl, cz / cl);

    const inside = world.player.buildingIndex >= 0;
    if (inside) lastBuilding = world.player.buildingIndex;
    const target = inside ? 1 : 0;
    indoor += (target - indoor) * Math.min(1, delta * 6);
    if (Math.abs(target - indoor) < 0.003) indoor = target;
    fx.uIndoor.value = indoor;

    if (indoor > 0 && lastBuilding >= 0) {
        const b = buildings[lastBuilding];
        const sx = wrapNear(b.x, p.x) - b.x;
        const sz = wrapNear(b.z, p.z) - b.z;
        fx.uCut.value.set(b.bounds.minX + sx - 0.3, b.bounds.minZ + sz - 0.3, b.bounds.maxX + sx + 0.3, b.bounds.maxZ + sz + 0.3);
        const floorY = b.baseY + world.player.currentFloor * FLOOR_HEIGHT;
        const ease = (1 - indoor) * (1 - indoor);
        fx.uCutY.value.set(floorY + FLOOR_HEIGHT + 0.3 + ease * 40, floorY + 1.15 + ease * 40, floorY + 1.6 + ease * 60);
    } else {
        fx.uCut.value.set(1, 1, -1, -1);
        fx.uCutY.value.set(500, 500, 500);
    }

    for (let i = 0; i < SEE_ENEMIES; i++) candidates[i].d = Infinity;
    const limit = SEE_RANGE * SEE_RANGE;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive) continue;
        const dx = e.position.x - p.x;
        const dz = e.position.z - p.z;
        const d = dx * dx + dz * dz;
        if (d > limit) continue;
        let slot = SEE_ENEMIES - 1;
        if (d >= candidates[slot].d) continue;
        while (slot > 0 && candidates[slot - 1].d > d) {
            const from = candidates[slot - 1];
            const to = candidates[slot];
            to.x = from.x;
            to.y = from.y;
            to.z = from.z;
            to.d = from.d;
            slot--;
        }
        const c = candidates[slot];
        c.x = e.position.x;
        c.y = e.position.y + 0.9;
        c.z = e.position.z;
        c.d = d;
    }

    writeSee(0, camera, width, height, p.x, feetY + 0.9, p.z);
    for (let i = 0; i < SEE_ENEMIES; i++) {
        const c = candidates[i];
        if (c.d === Infinity) fx.uSee.value[i + 1].set(0, 0, 1, 0);
        else writeSee(i + 1, camera, width, height, c.x, c.y, c.z);
    }
}
