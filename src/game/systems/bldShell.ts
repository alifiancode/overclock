import type { BufferGeometry } from 'three';
import { MeshBuilder, mixRgb, rgb, type Rgb } from './meshBuilder.ts';
import type { BuildingDef } from './buildingGen.ts';
import { createRng, hashInts } from './random.ts';
import { addBush } from './plantGeo.ts';
import { buildSlabsAndRoof } from './bldRoof.ts';
import {
    CEIL,
    CONCRETE,
    CONCRETE_DARK,
    DOOR_TOP,
    FH,
    FOUND,
    SLAB,
    WT,
    collectOpenings,
    edgeInfo,
    growth,
    hash2,
    hullColor,
    opsOnLine,
    rubble,
    shade,
    splitRun,
    tag,
    trimColor,
    wallBox,
    wallPaint,
    wallQuad,
    type BuildCtx,
    type EdgeInfo,
    type Opening,
} from './bldCommon.ts';

export type ShellGeometry = { solid: BufferGeometry | null; leaf: BufferGeometry | null };

const PLASTER = rgb(0xcfc9bb);
const MOSS: Rgb[] = [rgb(0x3d6b2a), rgb(0x4c7d30), rgb(0x2f5a26), rgb(0x587f35)];
const VINE: Rgb[] = [rgb(0x2a6a2a), rgb(0x3a8434), rgb(0x4d9a3c), rgb(0x216028), rgb(0x5ba644)];
const PIPE = [rgb(0x6b6e70), rgb(0x7a4a2c), rgb(0x4d5256)];
const CURTAINS: Rgb[] = [rgb(0xb8745c), rgb(0xc9b878), rgb(0x7a98b0), rgb(0x9a7ab0), rgb(0xd8d0c0), rgb(0x6f9a76)];
const SHUTTERS: Rgb[] = [rgb(0x3f6b4f), rgb(0x5a6f9a), rgb(0x8a4a3c), rgb(0x6a5a44), rgb(0xb09a58)];
const AWNING_A: Rgb[] = [rgb(0xb8433a), rgb(0x3f7a52), rgb(0x3f5f9a), rgb(0xc9972f), rgb(0x7a4a8a)];
const WOOD_OLD = rgb(0x6a5236);

function point(info: EdgeInfo, s: number, perp: number): [number, number] {
    return info.axis === 'x' ? [s, info.coord + perp] : [info.coord + perp, s];
}

function sidedColors(info: EdgeInfo, outside: Rgb, inside: Rgb): [Rgb, Rgb] {
    return info.out > 0 ? [inside, outside] : [outside, inside];
}

function skirtBox(ctx: BuildCtx, info: EdgeInfo, s0: number, s1: number, y0: number, y1: number, protrude: number, color: Rgb, topColor: Rgb) {
    const t = protrude;
    wallBox(ctx.solid, info.axis, info.coord, s0, s1, y0, y1, t, color, color, color, topColor, 1, 0, info.out * (WT / 2 + t / 2 - 0.01));
}

function exteriorWalls(ctx: BuildCtx, info: EdgeInfo, f: number, ops: Opening[]) {
    const mb = ctx.solid;
    const yBottom = f === 0 ? -FOUND : f * FH - SLAB;
    const yTop = (f + 1) * FH - SLAB;
    const run = opsOnLine(ops, info.axis, info.coord).filter((o) => o.kind !== 'doorway');
    const panels = splitRun(info.lo, info.hi, yBottom, yTop, f * FH, run);
    const hull = hullColor(ctx, f);
    const trim = trimColor(ctx);
    const cap = shade(hull, 0.78);
    tag(mb, 1, f);
    for (const p of panels) {
        const s0 = Math.abs(p.s0 - info.lo) < 0.01 ? p.s0 - WT / 2 : p.s0;
        const s1 = Math.abs(p.s1 - info.hi) < 0.01 ? p.s1 + WT / 2 : p.s1;
        const tone = 1 + (hash2(Math.round(p.s0 * 10) + info.index * 97, f * 31 + Math.round(p.y0 * 10)) - 0.5) * 0.1;
        const outside = shade(hull, tone);
        const [lo, hi] = sidedColors(info, outside, wallPaint(ctx.plan, f));
        wallBox(mb, info.axis, info.coord, s0, s1, p.y0, p.y1, WT, lo, hi, cap, trim, f === 0 ? 0.74 : 0.9);
    }
}

function beltCourses(ctx: BuildCtx, info: EdgeInfo, f: number) {
    const trim = trimColor(ctx);
    const light = mixRgb(trim, rgb(0xd8d2c4), 0.5);
    tag(ctx.solid, 1, f);
    skirtBox(ctx, info, info.lo - WT / 2, info.hi + WT / 2, f * FH - SLAB - 0.08, f * FH + 0.07, 0.1, light, shade(light, 1.1));
}

function plinth(ctx: BuildCtx, info: EdgeInfo, ops: Opening[]) {
    const run = opsOnLine(ops, info.axis, info.coord).filter((o) => o.kind === 'door' || o.kind === 'breach');
    const panels = splitRun(info.lo, info.hi, -FOUND, 0.52, 0, run);
    tag(ctx.solid, 1, 0);
    for (const p of panels) {
        const s0 = Math.abs(p.s0 - info.lo) < 0.01 ? p.s0 - WT / 2 : p.s0;
        const s1 = Math.abs(p.s1 - info.hi) < 0.01 ? p.s1 + WT / 2 : p.s1;
        const col = mixRgb(CONCRETE, rgb(ctx.plan.style.hull), 0.25);
        skirtBox(ctx, info, s0, s1, p.y0, p.y1, 0.12, col, shade(col, 1.15));
    }
}

function windowPane(ctx: BuildCtx, info: EdgeInfo, f: number, o: Opening, state: number) {
    const mb = ctx.solid;
    const style = ctx.plan.style;
    const frame = rgb(style.frame);
    const glass = rgb(style.glass);
    const sky = rgb(0x7c9aa8);
    const y0 = f * FH + o.y0;
    const y1 = f * FH + o.y1;
    const w = o.hi - o.lo;
    const h = y1 - y0;
    const bar = 0.07;
    const depth = WT + 0.06;
    tag(mb, 1, f);
    wallBox(mb, info.axis, info.coord, o.lo, o.lo + bar, y0, y1, depth, frame, frame, frame, frame);
    wallBox(mb, info.axis, info.coord, o.hi - bar, o.hi, y0, y1, depth, frame, frame, frame, frame);
    wallBox(mb, info.axis, info.coord, o.lo, o.hi, y1 - bar, y1, depth, frame, frame, frame, frame);
    wallBox(mb, info.axis, info.coord, o.lo, o.hi, y0, y0 + bar, depth, frame, frame, frame, frame);
    if (w > 1.6) wallBox(mb, info.axis, info.coord, (o.lo + o.hi) / 2 - 0.03, (o.lo + o.hi) / 2 + 0.03, y0, y1, depth - 0.04, frame, frame, frame, frame);
    const transom = h > 1.5 ? y0 + h * 0.62 : -1;
    if (transom > 0) wallBox(mb, info.axis, info.coord, o.lo, o.hi, transom - 0.025, transom + 0.025, depth - 0.04, frame, frame, frame, frame);
    const trim = trimColor(ctx);
    skirtBox(ctx, info, o.lo - 0.1, o.hi + 0.1, y0 - 0.08, y0 + 0.0, 0.24, mixRgb(trim, rgb(0xd0c8b8), 0.5), rgb(0xd8d2c4));
    skirtBox(ctx, info, o.lo - 0.08, o.hi + 0.08, y1, y1 + 0.12, 0.1, mixRgb(trim, rgb(0xd0c8b8), 0.3), shade(trim, 1.1));
    if (state === 2) {
        const planks = 3;
        for (let i = 0; i < planks; i++) {
            const py = y0 + 0.1 + (h - 0.3) * ((i + 0.5) / planks) + (ctx.rng() - 0.5) * 0.06;
            const ext = 0.12 + ctx.rng() * 0.2;
            wallBox(mb, info.axis, info.coord, o.lo - ext, o.hi + ext * 0.4, py - 0.09, py + 0.09, 0.06, WOOD_OLD, WOOD_OLD, shade(WOOD_OLD, 0.8), shade(WOOD_OLD, 1.2), 1, 0, info.out * (WT / 2 + 0.05));
        }
        return;
    }
    const gx0 = o.lo + bar;
    const gx1 = o.hi - bar;
    const gy0 = y0 + bar;
    const gy1 = y1 - bar;
    const [coordOut, coordIn] = [info.coord + info.out * 0.01, info.coord - info.out * 0.01];
    const paneTop = state === 3 ? gy0 + (gy1 - gy0) * 0.45 : gy1;
    if (state === 0 || state === 3) {
        const shadeLow = 0.75;
        const shadeHigh = 1.25;
        const g = mixRgb(glass, sky, 0.12);
        const pane = (s0: number, s1: number, yA: number, yB: number) => {
            wallQuad(mb, info.axis, coordOut, s0, s1, yA, yB, info.out, g, shadeLow, shadeHigh);
            wallQuad(mb, info.axis, coordIn, s0, s1, yA, yB, -info.out, g, shadeLow, shadeHigh);
        };
        if (state === 3) pane(gx0, gx1, gy0, paneTop);
        else pane(gx0, gx1, gy0, gy1);
        const streak = mixRgb(glass, sky, 0.5);
        wallQuad(mb, info.axis, info.coord + info.out * 0.015, gx0 + w * 0.18, gx0 + w * 0.3, gy0 + 0.05, Math.min(paneTop, gy0 + (gy1 - gy0) * 0.8), info.out, streak, 0.9, 1.1);
    } else {
        const shard = mixRgb(glass, sky, 0.3);
        const px = (ctx.rng() < 0.5 ? gx0 : gx1 - 0.35);
        const py = gy0;
        const [ax, az] = point(info, px, info.out * 0.012);
        const [bx, bz] = point(info, px + 0.35, info.out * 0.012);
        const [cx, cz] = point(info, px + (ctx.rng() < 0.5 ? 0.04 : 0.28), info.out * 0.012);
        if (info.out > 0 === (info.axis === 'x')) mb.tri([ax, py, az], [bx, py, bz], [cx, py + 0.28 + ctx.rng() * 0.2, cz], shard);
        else mb.tri([bx, py, bz], [ax, py, az], [cx, py + 0.28 + ctx.rng() * 0.2, cz], shard);
    }
}

function windowExtras(ctx: BuildCtx, info: EdgeInfo, f: number, o: Opening, state: number) {
    const plan = ctx.plan;
    const y0 = f * FH + o.y0;
    const y1 = f * FH + o.y1;
    const w = o.hi - o.lo;
    const leaf = ctx.leaf;
    if (plan.usage === 'residential' && state !== 2 && ctx.rng() < 0.42) {
        const col = CURTAINS[Math.floor(ctx.rng() * CURTAINS.length)];
        const drop = (y1 - y0) * (0.45 + ctx.rng() * 0.4);
        tag(leaf, 1, f);
        const s0 = o.lo + 0.1;
        const s1 = o.hi - 0.1;
        const c = info.coord - info.out * 0.1;
        wallQuad(leaf, info.axis, c, s0, s1, y1 - 0.12 - drop, y1 - 0.12, info.out, col, 0.8, 1);
        wallQuad(leaf, info.axis, c, s0, s1, y1 - 0.12 - drop, y1 - 0.12, -info.out, col, 0.8, 1);
    }
    if (plan.usage === 'residential' && state < 2 && w < 1.8 && ctx.rng() < 0.3) {
        const col = SHUTTERS[Math.floor(ctx.rng() * SHUTTERS.length)];
        tag(ctx.solid, 1, f);
        const missing = ctx.rng() < plan.decay * 0.35 ? (ctx.rng() < 0.5 ? 0 : 1) : -1;
        for (let side = 0; side < 2; side++) {
            if (side === missing) continue;
            const s0 = side === 0 ? o.lo - 0.42 : o.hi + 0.02;
            const s1 = side === 0 ? o.lo - 0.02 : o.hi + 0.42;
            wallBox(ctx.solid, info.axis, info.coord, s0, s1, y0, y1, 0.05, col, col, shade(col, 0.8), shade(col, 1.15), 1, 0, info.out * (WT / 2 + 0.04));
        }
    }
}

function windows(ctx: BuildCtx, info: EdgeInfo, f: number, ops: Opening[]) {
    const run = opsOnLine(ops, info.axis, info.coord).filter((o) => o.kind === 'window' && o.lo >= info.lo - 0.01 && o.hi <= info.hi + 0.01);
    const decay = ctx.plan.decay;
    for (const o of run) {
        const r = ctx.rng();
        let state = 0;
        if (r < decay * 0.08) state = 2;
        else if (r < decay * 0.08 + 0.08 + decay * 0.38) state = 1;
        else if (r < decay * 0.08 + 0.08 + decay * 0.38 + 0.08) state = 3;
        windowPane(ctx, info, f, o, state);
        windowExtras(ctx, info, f, o, state);
    }
}

function awning(ctx: BuildCtx, info: EdgeInfo, color: Rgb) {
    const leaf = ctx.leaf;
    tag(leaf, 1, 0);
    const stripe = 0.45;
    const s0 = info.lo + 0.5;
    const s1 = info.hi - 0.5;
    const count = Math.max(1, Math.floor((s1 - s0) / stripe));
    const step = (s1 - s0) / count;
    const wall = WT / 2 + 0.02;
    const reach = wall + 1.35;
    const decay = ctx.plan.decay;
    for (let i = 0; i < count; i++) {
        const a = s0 + i * step;
        const b = a + step;
        const col = i % 2 === 0 ? color : rgb(0xe8e0d0);
        const sag = 0.04 * Math.sin(i * 1.7);
        const [ax, az] = point(info, a, info.out * wall);
        const [bx, bz] = point(info, b, info.out * wall);
        const [cx, cz] = point(info, b, info.out * reach);
        const [dx, dz] = point(info, a, info.out * reach);
        const torn = ctx.rng() < decay * 0.3 ? 0.25 : 0;
        leaf.quad([ax, 2.62, az], [bx, 2.62, bz], [cx, 2.22 + sag - torn, cz], [dx, 2.22 + sag - torn, dz], col, 1.05, 0.9);
        const hang = 0.14 + ctx.rng() * 0.1;
        const midS = (a + b) / 2;
        const [mx, mz] = point(info, midS, info.out * reach);
        leaf.tri([cx, 2.22 + sag - torn, cz], [dx, 2.22 + sag - torn, dz], [mx, 2.22 + sag - torn - hang, mz], shade(col, 0.9));
        leaf.tri([dx, 2.22 + sag - torn, dz], [cx, 2.22 + sag - torn, cz], [mx, 2.22 + sag - torn - hang, mz], shade(col, 0.9));
    }
}

function entrances(ctx: BuildCtx, infos: EdgeInfo[], ops: Opening[]) {
    const plan = ctx.plan;
    const mb = ctx.solid;
    const trim = trimColor(ctx);
    const frame = rgb(plan.style.frame);
    for (const o of ops) {
        if (o.kind !== 'door' && o.kind !== 'breach') continue;
        const info = infos.find((e) => e.axis === o.axis && Math.abs(e.coord - o.coord) < 0.05 && o.lo >= e.lo - 0.05 && o.hi <= e.hi + 0.05);
        if (!info) continue;
        const w = o.hi - o.lo;
        const mid = (o.lo + o.hi) / 2;
        tag(mb, 1, 0);
        if (o.kind === 'door') {
            const jamb = 0.12;
            wallBox(mb, info.axis, info.coord, o.lo - 0.02, o.lo + jamb, 0, DOOR_TOP, WT + 0.1, frame, frame, frame, frame);
            wallBox(mb, info.axis, info.coord, o.hi - jamb, o.hi + 0.02, 0, DOOR_TOP, WT + 0.1, frame, frame, frame, frame);
            wallBox(mb, info.axis, info.coord, o.lo - 0.02, o.hi + 0.02, DOOR_TOP - 0.12, DOOR_TOP, WT + 0.1, frame, frame, frame, frame);
            skirtBox(ctx, info, o.lo - 0.5, o.hi + 0.5, -0.32, -0.04, 0.9, CONCRETE, shade(CONCRETE, 1.15));
            if (info.index === 0) {
                if (plan.usage === 'shop') {
                    const col = AWNING_A[Math.floor(hash2(plan.seed, 7) * AWNING_A.length)];
                    const board = mixRgb(col, rgb(0x2a2622), 0.4);
                    wallBox(mb, info.axis, info.coord, info.lo + 0.4, info.hi - 0.4, 2.74, 2.98, 0.14, board, board, board, shade(board, 1.2), 1, 0, info.out * (WT / 2 + 0.1));
                    awning(ctx, info, col);
                } else if (hash2(plan.seed, 11) < 0.55) {
                    const cw = w + 1.4;
                    const col = mixRgb(trim, rgb(0xd8d2c4), 0.35);
                    skirtBox(ctx, info, mid - cw / 2, mid + cw / 2, 2.62, 2.76, 1.1, col, shade(col, 1.15));
                    skirtBox(ctx, info, mid - cw / 2, mid + cw / 2, 2.42, 2.62, 0.14, shade(col, 0.8), shade(col, 0.9));
                }
            }
        } else {
            const out = info.out;
            const [px, pz] = point(info, mid, out * 0.9);
            rubble(ctx, px, pz, -0.1, 1.3, 7, 0);
            const [ix, iz] = point(info, mid, -out * 0.8);
            rubble(ctx, ix, iz, 0, 1.0, 4, 0);
            const teeth = 4;
            const wallCol = shade(hullColor(ctx, 0), 0.85);
            for (let i = 0; i < teeth; i++) {
                const s = o.lo + (w * (i + ctx.rng() * 0.6)) / teeth;
                const tw = w / teeth * (0.4 + ctx.rng() * 0.4);
                wallBox(mb, info.axis, info.coord, s, Math.min(o.hi, s + tw), o.y1 - 0.05, o.y1 + 0.1 + ctx.rng() * 0.35, WT, wallCol, PLASTER, wallCol, shade(wallCol, 1.2), 1, 0);
            }
            growth(ctx, px, -0.1, pz, 0, 3);
        }
    }
}

function balconies(ctx: BuildCtx, info: EdgeInfo, f: number, ops: Opening[]) {
    if (ctx.plan.usage !== 'residential' || f === 0) return;
    const run = opsOnLine(ops, info.axis, info.coord).filter((o) => o.kind === 'window' && o.hi - o.lo < 1.8);
    const mb = ctx.solid;
    const trim = trimColor(ctx);
    const rail = mixRgb(trim, rgb(0x1e1e22), 0.5);
    for (const o of run) {
        if (hash2(ctx.plan.seed + f * 13, Math.round(o.lo * 10) + info.index * 5) > 0.2) continue;
        const w = o.hi - o.lo + 0.9;
        const mid = (o.lo + o.hi) / 2;
        const slabY = f * FH;
        tag(mb, 1, f);
        const depth = 1.15;
        wallBox(mb, info.axis, info.coord, mid - w / 2, mid + w / 2, slabY - 0.2, slabY + 0.02, depth, CONCRETE, CONCRETE, CONCRETE_DARK, shade(CONCRETE, 1.1), 0.8, 0, info.out * (WT / 2 + depth / 2));
        const rh = 1.0;
        const rd = WT / 2 + depth - 0.04;
        wallBox(mb, info.axis, info.coord, mid - w / 2, mid + w / 2, slabY + rh - 0.04, slabY + rh, 0.05, rail, rail, rail, rail, 1, 0, info.out * rd);
        wallBox(mb, info.axis, info.coord, mid - w / 2, mid + w / 2, slabY + 0.35, slabY + 0.39, 0.04, rail, rail, rail, rail, 1, 0, info.out * rd);
        const posts = Math.max(3, Math.round(w / 0.55));
        for (let i = 0; i <= posts; i++) {
            const s = mid - w / 2 + 0.02 + ((w - 0.04) * i) / posts;
            wallBox(mb, info.axis, info.coord, s - 0.02, s + 0.02, slabY + 0.02, slabY + rh, 0.04, rail, rail, rail, rail, 1, 0, info.out * rd);
        }
        for (const side of [-1, 1]) {
            const s = mid + side * (w / 2 - 0.02);
            wallBox(mb, info.axis, info.coord, s - 0.02, s + 0.02, slabY + 0.02, slabY + rh, depth - 0.1, rail, rail, rail, rail, 1, 0, info.out * (WT / 2 + depth / 2));
        }
        if (ctx.rng() < 0.6) {
            const [bx, bz] = point(info, mid + (ctx.rng() - 0.5) * (w - 0.5), info.out * (WT / 2 + depth * 0.5));
            tag(mb, 1, f);
            mb.cylinder(bx, slabY + 0.02, bz, 0.17, 0.2, 0.3, 8, rgb(0x9a5a3c), rgb(0x2a1f18));
            const sv = mb.vertexCount;
            const lv = ctx.leaf.vertexCount;
            addBush(ctx.sink, ctx.rng, bx, slabY + 0.28, bz, 0.4 + ctx.rng() * 0.3, Math.floor(ctx.rng() * 5), ctx.rng() < 0.5 ? ctx.rng() : 0);
            mb.overrideExtras(sv, 1 + f * 10);
            ctx.leaf.overrideExtras(lv, 1 + f * 10);
            mb.upBlend = 0;
            ctx.leaf.upBlend = 0.55;
        }
    }
}

function facadeProps(ctx: BuildCtx, infos: EdgeInfo[], f: number, ops: Opening[]) {
    const mb = ctx.solid;
    const count = f === 0 ? 1 + Math.floor(ctx.rng() * 2) : Math.floor(ctx.rng() * 2.2);
    for (let i = 0; i < count; i++) {
        const info = infos[Math.floor(ctx.rng() * infos.length)];
        if (info.hi - info.lo < 3) continue;
        const s = info.lo + 1 + ctx.rng() * (info.hi - info.lo - 2);
        const run = opsOnLine(ops, info.axis, info.coord).filter((o) => o.kind !== 'doorway');
        if (run.some((o) => s > o.lo - 0.7 && s < o.hi + 0.7)) continue;
        tag(mb, 1, f);
        const y = f * FH + 0.5 + ctx.rng() * 1.2;
        const unit = rgb(0xb8b6ae);
        const grill = rgb(0x3a3b3d);
        skirtBox(ctx, info, s - 0.38, s + 0.38, y - 0.25, y + 0.25, 0.34, unit, shade(unit, 1.1));
        const [gx, gz] = point(info, s, info.out * (WT / 2 + 0.34));
        const dir = info.out;
        if (info.axis === 'x') wallQuad(mb, 'x', gz + dir * 0.004, s - 0.26, s + 0.26, y - 0.18, y + 0.18, dir, grill);
        else wallQuad(mb, 'z', gx + dir * 0.004, s - 0.26, s + 0.26, y - 0.18, y + 0.18, dir, grill);
    }
    if (f === 0 && ctx.rng() < 0.7) {
        const info = infos[Math.floor(ctx.rng() * infos.length)];
        const s = info.lo + 0.5 + ctx.rng() * Math.max(0.1, info.hi - info.lo - 1);
        const run = opsOnLine(ops, info.axis, info.coord).filter((o) => o.kind !== 'doorway');
        if (!run.some((o) => s > o.lo - 0.6 && s < o.hi + 0.6)) {
            const col = PIPE[Math.floor(ctx.rng() * PIPE.length)];
            const [px, pz] = point(info, s, info.out * (WT / 2 + 0.07));
            tag(mb, 1, 0);
            const total = ctx.plan.floors * FH - 0.4;
            for (let k = 0; k < ctx.plan.floors; k++) {
                tag(mb, 1, k);
                mb.cylinder(px, k * FH + 0.1, pz, 0.05, 0.05, Math.min(FH, total - k * FH + 0.1), 6, col, shade(col, 1.2));
            }
        }
    }
}

function stains(ctx: BuildCtx, info: EdgeInfo, f: number, ops: Opening[]) {
    const decay = ctx.plan.decay;
    const length = info.hi - info.lo;
    const count = Math.round(length * decay * (f === 0 ? 0.55 : 0.28) * (0.5 + ctx.rng()));
    const mb = ctx.solid;
    const hull = hullColor(ctx, f);
    const run = opsOnLine(ops, info.axis, info.coord).filter((o) => o.kind !== 'doorway');
    for (let i = 0; i < count; i++) {
        const s = info.lo + 0.5 + ctx.rng() * Math.max(0.1, length - 1);
        const rw = 0.5 + ctx.rng() * 1.1;
        const rh = f === 0 ? 0.5 + ctx.rng() * 1.4 : 0.4 + ctx.rng() * 1.2;
        const yb = f === 0 ? 0.05 + ctx.rng() * 0.3 : f * FH + ctx.rng() * (CEIL - rh);
        if (run.some((o) => s + rw > o.lo && s - rw < o.hi && yb + rh > f * FH + o.y0 - 0.2 && yb < f * FH + o.y1 + 0.2)) continue;
        const moss = MOSS[Math.floor(ctx.rng() * MOSS.length)];
        const rim = mixRgb(hull, moss, 0.35);
        const centre = mixRgb(hull, moss, 0.78);
        const perp = info.out * (WT / 2 + (f === 0 ? 0.125 : 0.004) + 0.006);
        const segs = 6;
        tag(mb, 1, f);
        const cx = s;
        const cy = yb + rh * 0.45;
        const pts: [number, number][] = [];
        for (let k = 0; k < segs; k++) {
            const a = (k / segs) * Math.PI * 2;
            const jr = 0.75 + ctx.rng() * 0.5;
            pts.push([cx + Math.cos(a) * rw * 0.5 * jr, cy + Math.sin(a) * rh * 0.5 * jr]);
        }
        for (let k = 0; k < segs; k++) {
            const p0 = pts[k];
            const p1 = pts[(k + 1) % segs];
            const [ax, az] = point(info, cx, perp);
            const [bx, bz] = point(info, p0[0], perp);
            const [dx, dz] = point(info, p1[0], perp);
            const flip = (info.axis === 'x') === info.out > 0;
            if (flip) mb.triC([ax, cy, az], [bx, p0[1], bz], [dx, p1[1], dz], centre, rim, rim);
            else mb.triC([ax, cy, az], [dx, p1[1], dz], [bx, p0[1], bz], centre, rim, rim);
        }
    }
}

function vines(ctx: BuildCtx, info: EdgeInfo, ops: Opening[]) {
    const decay = ctx.plan.decay;
    const length = info.hi - info.lo;
    const count = Math.floor(length * 0.5 * decay * (0.4 + ctx.rng() * 0.9));
    const leaf = ctx.leaf;
    const mb = ctx.solid;
    const maxH = ctx.plan.floors * FH + 0.4;
    const run = opsOnLine(ops, info.axis, info.coord).filter((o) => o.kind === 'door' || o.kind === 'breach');
    for (let i = 0; i < count; i++) {
        const s0 = info.lo + 0.4 + ctx.rng() * Math.max(0.1, length - 0.8);
        if (run.some((o) => s0 > o.lo - 0.5 && s0 < o.hi + 0.5)) continue;
        const reach = (0.25 + ctx.rng() * 0.75) * maxH;
        const perp = info.out * (WT / 2 + 0.06);
        const base = ctx.rng() < 0.35 ? 0.3 : 0.05;
        let s = s0;
        let sway = 0;
        const stemCol = rgb(0x3a2f1e);
        let prev: [number, number] = point(info, s, perp);
        let prevY = base;
        for (let y = base; y < reach; y += 0.42) {
            sway += (ctx.rng() - 0.5) * 0.25;
            sway *= 0.85;
            s = s0 + sway;
            const [px, pz] = point(info, s, perp);
            const f = Math.min(ctx.plan.floors - 1, Math.max(0, Math.floor((y + 0.3) / FH)));
            tag(mb, 1, f);
            mb.box((px + prev[0]) / 2, (y + prevY) / 2, (pz + prev[1]) / 2, Math.abs(px - prev[0]) + 0.04, Math.abs(y - prevY) + 0.04, Math.abs(pz - prev[1]) + 0.04, stemCol, undefined, 1, 8);
            tag(leaf, 1, f);
            for (let k = 0; k < 2; k++) {
                const col = VINE[Math.floor(ctx.rng() * VINE.length)];
                const size = 0.24 + ctx.rng() * 0.2;
                const ox = (k === 0 ? -1 : 1) * (0.08 + ctx.rng() * 0.16);
                const oy = (ctx.rng() - 0.3) * 0.28;
                const lift = 0.05 + ctx.rng() * 0.08;
                const [lx, lz] = point(info, s + ox, perp + info.out * lift);
                const ly = y + oy;
                const rot = ctx.rng() * Math.PI;
                const ca = Math.cos(rot) * size;
                const sa = Math.sin(rot) * size;
                const a: [number, number, number] = info.axis === 'x' ? [lx - ca, ly - sa, lz] : [lx, ly - sa, lz - ca];
                const b: [number, number, number] = info.axis === 'x' ? [lx + sa * 0.7, ly - ca * 0.7, lz] : [lx, ly - ca * 0.7, lz + sa * 0.7];
                const c: [number, number, number] = info.axis === 'x' ? [lx + ca, ly + sa, lz] : [lx, ly + sa, lz + ca];
                const d: [number, number, number] = info.axis === 'x' ? [lx - sa * 0.7, ly + ca * 0.7, lz] : [lx, ly + ca * 0.7, lz - sa * 0.7];
                leaf.quad(a, b, c, d, col, 0.85, 1.1);
            }
            prev = [px, pz];
            prevY = y;
        }
    }
}

export function* buildShell(def: BuildingDef): Generator<void, ShellGeometry> {
    const plan = def.plan;
    const rng = createRng(hashInts(def.index, plan.seed, 0x5e11));
    const solid = new MeshBuilder(rng, 24576);
    const leaf = new MeshBuilder(rng, 12288);
    leaf.upBlend = 0.55;
    const ctx: BuildCtx = { plan, solid, leaf, sink: { solid, leaf }, rng, seed: plan.seed };
    const ops: Opening[][] = [];
    for (let f = 0; f < plan.floors; f++) ops.push(collectOpenings(plan, f));
    const infos = plan.edges.map(edgeInfo);

    yield* buildSlabsAndRoof(ctx, infos);

    for (let f = 0; f < plan.floors; f++) {
        for (const info of infos) {
            exteriorWalls(ctx, info, f, ops[f]);
            if (f > 0) beltCourses(ctx, info, f);
        }
        yield;
        for (const info of infos) {
            if (f === 0) plinth(ctx, info, ops[0]);
            windows(ctx, info, f, ops[f]);
        }
        yield;
        for (const info of infos) balconies(ctx, info, f, ops[f]);
        facadeProps(ctx, infos, f, ops[f]);
        yield;
    }
    entrances(ctx, infos, ops[0]);
    for (const info of infos) {
        for (let f = 0; f < plan.floors; f++) stains(ctx, info, f, ops[f]);
        vines(ctx, info, ops[0]);
    }
    yield;
    return {
        solid: solid.vertexCount > 0 ? solid.build() : null,
        leaf: leaf.vertexCount > 0 ? leaf.build() : null,
    };
}
