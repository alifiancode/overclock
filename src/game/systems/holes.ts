import { buildings } from './footprints.ts';
import type { ZoneRect } from './buildingShapes.ts';

export const PLATEAU = 0.6;
const MARGIN = 0.24;
const CORNER_PUSH = 0.1;
const CORNER_SKIP = 0.45;
const STICKY = 1.4;
const EMPTY: readonly ZoneRect[] = [];
const cache = new Map<number, ZoneRect[][]>();

export type Blocked = (x: number, z: number) => boolean;

export function holesOn(index: number, floor: number): readonly ZoneRect[] {
    let per = cache.get(index);
    if (!per) {
        const def = buildings[index];
        per = [];
        for (let f = 0; f < def.floors; f++) {
            const list: ZoneRect[] = [];
            for (const fl of def.flights) {
                if (fl.from !== f && fl.to !== f) continue;
                const sign = fl.end >= fl.start ? 1 : -1;
                const lo = fl.from === f ? fl.start + sign * PLATEAU : fl.start;
                const hi = fl.to === f ? fl.end - sign * PLATEAU : fl.end;
                const a = Math.min(lo, hi);
                const b = Math.max(lo, hi);
                if (b - a < 0.2) continue;
                const r = fl.rect;
                list.push(fl.axis === 'x' ? { minX: a, maxX: b, minZ: r.minZ, maxZ: r.maxZ } : { minX: r.minX, maxX: r.maxX, minZ: a, maxZ: b });
            }
            per.push(list);
        }
        cache.set(index, per);
    }
    return floor >= 0 && floor < per.length ? per[floor] : EMPTY;
}

function entryT(ax: number, az: number, bx: number, bz: number, minX: number, minZ: number, maxX: number, maxZ: number): number {
    let t0 = 0;
    let t1 = 1;
    const dx = bx - ax;
    const dz = bz - az;
    if (Math.abs(dx) < 1e-9) {
        if (ax <= minX || ax >= maxX) return -1;
    } else {
        let a = (minX - ax) / dx;
        let b = (maxX - ax) / dx;
        if (a > b) {
            const s = a;
            a = b;
            b = s;
        }
        if (a > t0) t0 = a;
        if (b < t1) t1 = b;
        if (t0 >= t1) return -1;
    }
    if (Math.abs(dz) < 1e-9) {
        if (az <= minZ || az >= maxZ) return -1;
    } else {
        let a = (minZ - az) / dz;
        let b = (maxZ - az) / dz;
        if (a > b) {
            const s = a;
            a = b;
            b = s;
        }
        if (a > t0) t0 = a;
        if (b < t1) t1 = b;
        if (t0 >= t1) return -1;
    }
    return t0;
}

function exitFrom(r: ZoneRect, x: number, z: number, tx: number, tz: number, prefX: number, prefZ: number, blocked: Blocked, out: { x: number; z: number }): boolean {
    const m = MARGIN + CORNER_PUSH;
    const xs = [r.minX - m, r.maxX + m, x, x];
    const zs = [z, z, r.minZ - m, r.maxZ + m];
    let best = Infinity;
    let found = false;
    for (let i = 0; i < 4; i++) {
        const cx = xs[i];
        const cz = zs[i];
        if (blocked(cx, cz)) continue;
        if (entryT(x, z, cx, cz, r.minX, r.minZ, r.maxX, r.maxZ) >= 0) continue;
        let score = Math.hypot(cx - x, cz - z) + Math.hypot(tx - cx, tz - cz);
        if (Math.abs(cx - prefX) < 0.3 && Math.abs(cz - prefZ) < 0.3) score -= STICKY;
        if (score < best) {
            best = score;
            out.x = cx;
            out.z = cz;
            found = true;
        }
    }
    return found;
}

function aroundRect(r: ZoneRect, x: number, z: number, tx: number, tz: number, prefX: number, prefZ: number, blocked: Blocked, out: { x: number; z: number }): boolean {
    const m = MARGIN + CORNER_PUSH;
    const s = MARGIN - 0.05;
    const xs = [r.minX - m, r.maxX + m, r.minX - m, r.maxX + m];
    const zs = [r.minZ - m, r.minZ - m, r.maxZ + m, r.maxZ + m];
    let found = false;
    for (let pass = 0; pass < 2 && !found; pass++) {
        let best = Infinity;
        for (let i = 0; i < 4; i++) {
            const cx = xs[i];
            const cz = zs[i];
            if (pass === 0 && Math.hypot(cx - x, cz - z) < CORNER_SKIP) continue;
            if (blocked(cx, cz)) continue;
            if (entryT(x, z, cx, cz, r.minX - s, r.minZ - s, r.maxX + s, r.maxZ + s) >= 0) continue;
            let score = Math.hypot(cx - x, cz - z) + Math.hypot(tx - cx, tz - cz);
            if (Math.abs(cx - prefX) < 0.3 && Math.abs(cz - prefZ) < 0.3) score -= STICKY;
            if (score < best) {
                best = score;
                out.x = cx;
                out.z = cz;
                found = true;
            }
        }
    }
    return found;
}

export function holeDetour(index: number, floor: number, x: number, z: number, tx: number, tz: number, prefX: number, prefZ: number, blocked: Blocked, out: { x: number; z: number }): boolean {
    const rects = holesOn(index, floor);
    if (rects.length === 0) return false;
    let hit: ZoneRect | null = null;
    let hitT = Infinity;
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        const minX = r.minX - MARGIN;
        const maxX = r.maxX + MARGIN;
        const minZ = r.minZ - MARGIN;
        const maxZ = r.maxZ + MARGIN;
        if (tx > minX && tx < maxX && tz > minZ && tz < maxZ) continue;
        if (x > minX && x < maxX && z > minZ && z < maxZ) return exitFrom(r, x, z, tx, tz, prefX, prefZ, blocked, out);
        const t = entryT(x, z, tx, tz, minX, minZ, maxX, maxZ);
        if (t >= 0 && t < hitT) {
            hit = r;
            hitT = t;
        }
    }
    if (!hit) return false;
    return aroundRect(hit, x, z, tx, tz, prefX, prefZ, blocked, out);
}

export function pushOutOfHoles(index: number, floor: number, x: number, z: number, out: { x: number; z: number }): boolean {
    const rects = holesOn(index, floor);
    out.x = x;
    out.z = z;
    let pushed = false;
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (out.x <= r.minX || out.x >= r.maxX || out.z <= r.minZ || out.z >= r.maxZ) continue;
        const left = out.x - r.minX;
        const right = r.maxX - out.x;
        const top = out.z - r.minZ;
        const bottom = r.maxZ - out.z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) out.x = r.minX - 0.02;
        else if (m === right) out.x = r.maxX + 0.02;
        else if (m === top) out.z = r.minZ - 0.02;
        else out.z = r.maxZ + 0.02;
        pushed = true;
    }
    return pushed;
}
