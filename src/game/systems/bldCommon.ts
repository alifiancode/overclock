import { FLOOR_HEIGHT, WALL_THICKNESS } from '../data/constants.ts';
import { MeshBuilder, mixRgb, rgb, scaleRgb, type ColorInput, type Rgb, type Vec3 } from './meshBuilder.ts';
import type { BuildingPlan } from './buildingGen.ts';
import { isPointInPolygon, type PolygonEdge, type ZoneRect } from './buildingShapes.ts';
import { addBigLeaf, addBush, addFern, addGrass, type VegSink } from './plantGeo.ts';
import type { Rng } from './random.ts';

export const FH = FLOOR_HEIGHT;
export const SLAB = 0.22;
export const WT = WALL_THICKNESS;
export const FOUND = 0.6;
export const CEIL = FH - SLAB;
export const DOOR_TOP = 2.4;
export const DOORWAY_TOP = 2.15;

export type Axis = 'x' | 'z';
export type OpeningKind = 'window' | 'door' | 'breach' | 'doorway';

export type Opening = {
    axis: Axis;
    coord: number;
    lo: number;
    hi: number;
    y0: number;
    y1: number;
    kind: OpeningKind;
    sill: number;
};

export type Panel = { s0: number; s1: number; y0: number; y1: number };

export type EdgeInfo = { index: number; axis: Axis; coord: number; lo: number; hi: number; out: number };

export const CONCRETE = rgb(0x8d8b84);
export const CONCRETE_DARK = rgb(0x6f6d68);

export type BuildCtx = {
    plan: BuildingPlan;
    solid: MeshBuilder;
    leaf: MeshBuilder;
    sink: VegSink;
    rng: Rng;
    seed: number;
};

export function tag(mb: MeshBuilder, kind: number, floor: number, emit: number = 0) {
    mb.setExtra(kind, floor, emit);
}

export function shade(c: Rgb, k: number): Rgb {
    return scaleRgb(c, k);
}

export function tint(hex: number, k: number): Rgb {
    return scaleRgb(rgb(hex), k);
}

export function mixHex(a: number, b: number, t: number): Rgb {
    return mixRgb(rgb(a), rgb(b), t);
}

export function pickFrom<T>(items: readonly T[], r: number): T {
    return items[Math.min(items.length - 1, Math.floor(r * items.length))];
}

export function hash2(a: number, b: number): number {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export function rectCenter(r: ZoneRect): { x: number; z: number } {
    return { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
}

export function insidePolygon(plan: BuildingPlan, x: number, z: number): boolean {
    return isPointInPolygon(x, z, plan.footprint.polygon);
}

export function subtractRect(r: ZoneRect, h: ZoneRect): ZoneRect[] {
    if (r.minX >= h.maxX || r.maxX <= h.minX || r.minZ >= h.maxZ || r.maxZ <= h.minZ) return [r];
    const out: ZoneRect[] = [];
    if (h.minZ > r.minZ) out.push({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: h.minZ });
    if (h.maxZ < r.maxZ) out.push({ minX: r.minX, maxX: r.maxX, minZ: h.maxZ, maxZ: r.maxZ });
    const z0 = Math.max(r.minZ, h.minZ);
    const z1 = Math.min(r.maxZ, h.maxZ);
    if (h.minX > r.minX) out.push({ minX: r.minX, maxX: h.minX, minZ: z0, maxZ: z1 });
    if (h.maxX < r.maxX) out.push({ minX: h.maxX, maxX: r.maxX, minZ: z0, maxZ: z1 });
    return out;
}

export function subtractAll(r: ZoneRect, holes: ZoneRect[]): ZoneRect[] {
    let pieces: ZoneRect[] = [r];
    for (const h of holes) {
        const next: ZoneRect[] = [];
        for (const p of pieces) for (const q of subtractRect(p, h)) next.push(q);
        pieces = next;
    }
    return pieces;
}

export function wallBox(
    mb: MeshBuilder,
    axis: Axis,
    coord: number,
    s0: number,
    s1: number,
    y0: number,
    y1: number,
    thickness: number,
    colLo: ColorInput,
    colHi: ColorInput,
    cap: ColorInput,
    top: ColorInput,
    grad: number = 1,
    skip: number = 0,
    perpOffset: number = 0
) {
    const sc = (s0 + s1) / 2;
    const sl = s1 - s0;
    const yc = (y0 + y1) / 2;
    const yl = y1 - y0;
    if (sl <= 0.001 || yl <= 0.001) return;
    const c = coord + perpOffset;
    if (axis === 'x') mb.box(sc, yc, c, sl, yl, thickness, cap, [cap, cap, top, undefined, colHi, colLo], grad, skip);
    else mb.box(c, yc, sc, thickness, yl, sl, cap, [colHi, colLo, top, undefined, cap, cap], grad, skip);
}

export function wallQuad(mb: MeshBuilder, axis: Axis, coord: number, s0: number, s1: number, y0: number, y1: number, facing: number, color: ColorInput, shadeLow: number = 1, shadeHigh: number = 1) {
    if (s1 - s0 <= 0.001 || y1 - y0 <= 0.001) return;
    if (axis === 'x') {
        if (facing > 0) mb.quad([s0, y0, coord], [s1, y0, coord], [s1, y1, coord], [s0, y1, coord], color, shadeLow, shadeHigh);
        else mb.quad([s1, y0, coord], [s0, y0, coord], [s0, y1, coord], [s1, y1, coord], color, shadeLow, shadeHigh);
    } else if (facing > 0) {
        mb.quad([coord, y0, s1], [coord, y0, s0], [coord, y1, s0], [coord, y1, s1], color, shadeLow, shadeHigh);
    } else {
        mb.quad([coord, y0, s0], [coord, y0, s1], [coord, y1, s1], [coord, y1, s0], color, shadeLow, shadeHigh);
    }
}

export function flatQuad(mb: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, color: ColorInput, shadeA: number = 1) {
    if (x1 - x0 <= 0.001 || z1 - z0 <= 0.001) return;
    mb.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color, shadeA);
}

export function flatQuadDown(mb: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, color: ColorInput) {
    if (x1 - x0 <= 0.001 || z1 - z0 <= 0.001) return;
    mb.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], color);
}

export function splitRun(lo: number, hi: number, yBottom: number, yTop: number, floorBase: number, ops: Opening[]): Panel[] {
    const sorted = ops.filter((o) => o.hi > lo && o.lo < hi).sort((a, b) => a.lo - b.lo);
    const panels: Panel[] = [];
    let cursor = lo;
    for (const o of sorted) {
        const o0 = Math.max(lo, o.lo);
        const o1 = Math.min(hi, o.hi);
        if (o1 <= cursor) continue;
        const start = Math.max(cursor, o0);
        if (start - cursor > 0.004) panels.push({ s0: cursor, s1: start, y0: yBottom, y1: yTop });
        const low = floorBase + o.y0;
        const high = floorBase + o.y1;
        if (low > yBottom + 0.004) panels.push({ s0: start, s1: o1, y0: yBottom, y1: Math.min(low, yTop) });
        if (high < yTop - 0.004) panels.push({ s0: start, s1: o1, y0: Math.max(high, yBottom), y1: yTop });
        cursor = o1;
    }
    if (hi - cursor > 0.004) panels.push({ s0: cursor, s1: hi, y0: yBottom, y1: yTop });
    return panels;
}

export function collectOpenings(plan: BuildingPlan, floor: number): Opening[] {
    const out: Opening[] = [];
    const edges = plan.edges;
    for (const w of plan.windows[floor]) {
        const e = edges[w.edge];
        const px = e.x1 + e.ux * w.center;
        const pz = e.z1 + e.uz * w.center;
        const axis: Axis = Math.abs(e.ux) > 0.5 ? 'x' : 'z';
        const c = axis === 'x' ? px : pz;
        out.push({ axis, coord: axis === 'x' ? e.z1 : e.x1, lo: c - w.width / 2, hi: c + w.width / 2, y0: w.sill, y1: w.sill + w.height, kind: 'window', sill: w.sill });
    }
    if (floor === 0) {
        for (const o of plan.openings) {
            const e = edges[o.edge];
            const axis: Axis = Math.abs(e.ux) > 0.5 ? 'x' : 'z';
            const c = axis === 'x' ? o.x : o.z;
            const top = o.kind === 'breach' ? 2.5 + ((Math.abs(Math.round(o.x * 7 + o.z * 13)) % 5) * 0.1) : DOOR_TOP;
            out.push({ axis, coord: axis === 'x' ? e.z1 : e.x1, lo: c - o.width / 2, hi: c + o.width / 2, y0: 0, y1: top, kind: o.kind === 'breach' ? 'breach' : 'door', sill: 0 });
        }
    }
    for (const d of plan.plans[floor].doorways) {
        const axis: Axis = d.along === 'z' ? 'z' : 'x';
        const c = axis === 'z' ? d.z : d.x;
        out.push({ axis, coord: axis === 'z' ? d.x : d.z, lo: c - d.width / 2, hi: c + d.width / 2, y0: 0, y1: DOORWAY_TOP, kind: 'doorway', sill: 0 });
    }
    return out;
}

export function opsOnLine(all: Opening[], axis: Axis, coord: number, tolerance: number = 0.2): Opening[] {
    return all.filter((o) => o.axis === axis && Math.abs(o.coord - coord) < tolerance);
}

export function slopedBeam(mb: MeshBuilder, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, sx: number, sy: number, color: ColorInput) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.001) return;
    mb.push();
    mb.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    mb.rotateY(Math.atan2(dx, dz));
    mb.rotateX(-Math.asin(dy / len));
    mb.box(0, 0, 0, sx, sy, len, color);
    mb.pop();
}

export function edgeInfo(e: PolygonEdge): EdgeInfo {
    const axis: Axis = Math.abs(e.ux) > 0.5 ? 'x' : 'z';
    const coord = axis === 'x' ? e.z1 : e.x1;
    const a = axis === 'x' ? e.x1 : e.z1;
    const b = axis === 'x' ? e.x2 : e.z2;
    const out = axis === 'x' ? Math.sign(e.nz) : Math.sign(e.nx);
    return { index: e.index, axis, coord, lo: Math.min(a, b), hi: Math.max(a, b), out };
}

export function hullColor(ctx: BuildCtx, f: number): Rgb {
    const s = ctx.plan.style;
    const base = rgb(s.hull);
    if (f === 0) return mixRgb(base, rgb(s.trim), 0.2);
    return scaleRgb(base, f % 2 === 1 ? 1.05 : 0.98);
}

export function trimColor(ctx: BuildCtx): Rgb {
    return rgb(ctx.plan.style.trim);
}

export function orientedQuad(mb: MeshBuilder, a: Vec3, b: Vec3, c: Vec3, d: Vec3, toward: Vec3, color: ColorInput, shadeA: number = 1, shadeB: number = shadeA) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = d[0] - a[0];
    const vy = d[1] - a[1];
    const vz = d[2] - a[2];
    const dot = (uy * vz - uz * vy) * toward[0] + (uz * vx - ux * vz) * toward[1] + (ux * vy - uy * vx) * toward[2];
    if (dot >= 0) mb.quad(a, b, c, d, color, shadeA, shadeB);
    else mb.quad(b, a, d, c, color, shadeA, shadeB);
}

export function orientedTri(mb: MeshBuilder, a: Vec3, b: Vec3, c: Vec3, toward: Vec3, color: ColorInput, shadeK: number = 1) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const dot = (uy * vz - uz * vy) * toward[0] + (uz * vx - ux * vz) * toward[1] + (ux * vy - uy * vx) * toward[2];
    if (dot >= 0) mb.tri(a, b, c, color, shadeK);
    else mb.tri(a, c, b, color, shadeK);
}

export function orientedTriC(mb: MeshBuilder, a: Vec3, b: Vec3, c: Vec3, toward: Vec3, ca: Rgb, cb: Rgb, cc: Rgb) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const dot = (uy * vz - uz * vy) * toward[0] + (uz * vx - ux * vz) * toward[1] + (ux * vy - uy * vx) * toward[2];
    if (dot >= 0) mb.triC(a, b, c, ca, cb, cc);
    else mb.triC(a, c, b, ca, cc, cb);
}

export function rubble(ctx: BuildCtx, x: number, z: number, y: number, radius: number, count: number, floor: number) {
    const mb = ctx.solid;
    tag(mb, 0, floor);
    for (let i = 0; i < count; i++) {
        const a = ctx.rng() * Math.PI * 2;
        const d = ctx.rng() * radius;
        const sx = 0.25 + ctx.rng() * 0.55;
        const sy = 0.15 + ctx.rng() * 0.4;
        const sz = 0.25 + ctx.rng() * 0.5;
        const col = ctx.rng() < 0.45 ? mixRgb(rgb(ctx.plan.style.hull), CONCRETE_DARK, 0.4) : ctx.rng() < 0.5 ? CONCRETE : rgb(0x7a5a48);
        mb.push();
        mb.translate(x + Math.cos(a) * d, y + sy * 0.35 * (1 - d / (radius + 0.01)) + sy / 2 - 0.06, z + Math.sin(a) * d);
        mb.rotateY(ctx.rng() * 3.14);
        mb.rotateX((ctx.rng() - 0.5) * 0.5);
        mb.rotateZ((ctx.rng() - 0.5) * 0.5);
        mb.box(0, 0, 0, sx, sy, sz, col);
        mb.pop();
    }
}

export function growth(ctx: BuildCtx, x: number, y: number, z: number, floor: number, amount: number) {
    const sink = ctx.sink;
    const sv = sink.solid.vertexCount;
    const lv = sink.leaf.vertexCount;
    for (let i = 0; i < amount; i++) {
        const px = x + (ctx.rng() - 0.5) * 1.6;
        const pz = z + (ctx.rng() - 0.5) * 1.6;
        const r = ctx.rng();
        if (r < 0.4) addGrass(sink, ctx.rng, px, y, pz, 0.9 + ctx.rng() * 0.6, ctx.rng());
        else if (r < 0.7) addFern(sink, ctx.rng, px, y, pz, 0.8 + ctx.rng() * 0.5);
        else if (r < 0.88) addBush(sink, ctx.rng, px, y, pz, 0.7 + ctx.rng() * 0.6, Math.floor(ctx.rng() * 5), 0);
        else addBigLeaf(sink, ctx.rng, px, y, pz, 0.7 + ctx.rng() * 0.5);
    }
    sink.solid.overrideExtras(sv, floor * 10);
    sink.leaf.overrideExtras(lv, floor * 10);
    sink.solid.upBlend = 0;
    sink.leaf.upBlend = 0.55;
}

export function wallPaint(plan: BuildingPlan, f: number): Rgb {
    const style = plan.style.floorStyles[f];
    return mixRgb(rgb(style.wall), rgb(0x5a5348), Math.min(0.5, plan.decay * 0.16));
}
