import { mixRgb, rgb, type Rgb, type Vec3 } from './meshBuilder.ts';
import type { BuildingPlan } from './buildingGen.ts';
import { localFlights } from './buildingGen.ts';
import { zoneArea, zoneDepth, zoneWidth, type ZoneRect } from './buildingShapes.ts';
import { FH, FOUND, SLAB, WT, flatQuad, growth, hash2, hullColor, orientedQuad, orientedTri, orientedTriC, rubble, shade, subtractAll, tag, trimColor, wallBox, type BuildCtx, type EdgeInfo } from './bldCommon.ts';

const BRICK = rgb(0x8a4a3a);
const CHIMNEY_CAP = rgb(0x4a4642);
const METAL = rgb(0xa5a8a8);
const METAL_DARK = rgb(0x55585b);
const RUST = rgb(0x8a5436);
const TANK = rgb(0x7a6a58);
const SKYLIGHT = rgb(0x2a3a44);
const PUDDLE = rgb(0x39464c);
const ATTIC = rgb(0x2a2420);
const WOOD_BEAM = rgb(0x5a4430);
const MOSS_ROOF: Rgb[] = [rgb(0x3d6b2a), rgb(0x4c7d30), rgb(0x587f35)];
const UP: Vec3 = [0, 1, 0];

export function roofIsGable(plan: BuildingPlan): boolean {
    return plan.usage === 'residential' && plan.footprint.kind === 'rect' && hash2(plan.seed, 3) < 0.7;
}

function slabs(ctx: BuildCtx) {
    const plan = ctx.plan;
    const mb = ctx.solid;
    const flights = plan.stair ? localFlights(plan.stair, plan.floors) : [];
    for (let f = 0; f < plan.floors; f++) {
        const top = rgb(plan.style.floorStyles[f].concrete);
        const side = shade(top, 0.8);
        const holes: ZoneRect[] = f >= 1 && flights[f - 1] ? [flights[f - 1].rect] : [];
        const y0 = f === 0 ? -FOUND : f * FH - SLAB;
        const y1 = f * FH;
        tag(mb, 0, f);
        for (const zone of plan.footprint.zones) {
            for (const r of subtractAll(zone, holes)) {
                mb.box((r.minX + r.maxX) / 2, (y0 + y1) / 2, (r.minZ + r.maxZ) / 2, r.maxX - r.minX, y1 - y0, r.maxZ - r.minZ, side, [side, side, top, undefined, side, side], 1, 8);
            }
        }
    }
}

function roofPatches(ctx: BuildCtx, y: number, floor: number, holes: ZoneRect[]) {
    const mb = ctx.solid;
    const rng = ctx.rng;
    const base = rgb(ctx.plan.style.roof);
    const decay = ctx.plan.decay;
    let lift = 0.004;
    tag(mb, 0, floor);
    for (const zone of ctx.plan.footprint.zones) {
        const area = zoneArea(zone);
        const patchCount = Math.round(area * 0.05);
        for (let i = 0; i < patchCount; i++) {
            const w = 0.8 + rng() * 2.2;
            const d = 0.8 + rng() * 2.2;
            if (w + 0.6 > zoneWidth(zone) || d + 0.6 > zoneDepth(zone)) continue;
            const x0 = zone.minX + 0.3 + rng() * (zoneWidth(zone) - w - 0.6);
            const z0 = zone.minZ + 0.3 + rng() * (zoneDepth(zone) - d - 0.6);
            const roll = rng();
            const col = roll < 0.45 ? shade(base, 0.8 + rng() * 0.12) : roll < 0.8 ? shade(base, 1.1 + rng() * 0.15) : PUDDLE;
            lift += 0.0006;
            for (const piece of subtractAll({ minX: x0, maxX: x0 + w, minZ: z0, maxZ: z0 + d }, holes)) flatQuad(mb, piece.minX, piece.minZ, piece.maxX, piece.maxZ, y + lift, col);
        }
        const mossCount = Math.round(area * 0.05 * decay);
        for (let i = 0; i < mossCount; i++) {
            const cx = zone.minX + 0.5 + rng() * Math.max(0.01, zoneWidth(zone) - 1);
            const cz = zone.minZ + 0.5 + rng() * Math.max(0.01, zoneDepth(zone) - 1);
            const rad = 0.5 + rng() * 1.2;
            if (holes.some((h) => cx > h.minX - rad && cx < h.maxX + rad && cz > h.minZ - rad && cz < h.maxZ + rad)) continue;
            const moss = MOSS_ROOF[Math.floor(rng() * MOSS_ROOF.length)];
            const rim = mixRgb(base, moss, 0.3);
            const segs = 7;
            lift += 0.0006;
            for (let k = 0; k < segs; k++) {
                const a0 = (k / segs) * Math.PI * 2;
                const a1 = ((k + 1) / segs) * Math.PI * 2;
                const j0 = 0.7 + rng() * 0.5;
                const j1 = 0.7 + rng() * 0.5;
                orientedTriC(mb, [cx, y + lift, cz], [cx + Math.cos(a1) * rad * j1, y + lift, cz + Math.sin(a1) * rad * j1], [cx + Math.cos(a0) * rad * j0, y + lift, cz + Math.sin(a0) * rad * j0], UP, moss, rim, rim);
            }
        }
    }
}

type Placed = { x: number; z: number; r: number };

function pickSpot(ctx: BuildCtx, zones: ZoneRect[], placed: Placed[], radius: number, avoid: ZoneRect[]): { x: number; z: number } | null {
    const total = zones.reduce((a, z) => a + zoneArea(z), 0);
    const m = radius + 0.9;
    for (let attempt = 0; attempt < 14; attempt++) {
        let pick = ctx.rng() * total;
        let zone = zones[0];
        for (const z of zones) {
            pick -= zoneArea(z);
            if (pick <= 0) {
                zone = z;
                break;
            }
        }
        if (zoneWidth(zone) < m * 2 || zoneDepth(zone) < m * 2) continue;
        const x = zone.minX + m + ctx.rng() * (zoneWidth(zone) - m * 2);
        const z = zone.minZ + m + ctx.rng() * (zoneDepth(zone) - m * 2);
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + radius + 0.3)) continue;
        if (avoid.some((a) => x > a.minX - radius && x < a.maxX + radius && z > a.minZ - radius && z < a.maxZ + radius)) continue;
        placed.push({ x, z, r: radius });
        return { x, z };
    }
    return null;
}

function clutter(ctx: BuildCtx, y: number, floor: number, avoid: ZoneRect[]) {
    const mb = ctx.solid;
    const rng = ctx.rng;
    const zones = ctx.plan.footprint.zones;
    const placed: Placed[] = [];
    const count = 2 + Math.floor(rng() * 4);
    tag(mb, 0, floor);
    for (let i = 0; i < count; i++) {
        const kind = rng();
        if (kind < 0.3) {
            const spot = pickSpot(ctx, zones, placed, 0.8, avoid);
            if (!spot) continue;
            const col = rng() < 0.5 ? rgb(0xb8b6ae) : rgb(0x9a9c9a);
            mb.push();
            mb.translate(spot.x, y, spot.z);
            mb.rotateY(Math.floor(rng() * 4) * (Math.PI / 2));
            mb.box(0, 0.35, 0, 1.2, 0.7, 0.85, col);
            mb.box(0.2, 0.71, 0, 0.6, 0.02, 0.6, METAL_DARK);
            mb.cylinder(0.2, 0.72, 0, 0.26, 0.26, 0.04, 10, METAL_DARK);
            mb.box(-0.45, 0.2, 0.43, 0.2, 0.3, 0.02, METAL_DARK);
            mb.pop();
        } else if (kind < 0.5) {
            const spot = pickSpot(ctx, zones, placed, 0.4, avoid);
            if (!spot) continue;
            mb.cylinder(spot.x, y, spot.z, 0.12, 0.12, 0.7, 7, METAL, shade(METAL, 1.2));
            mb.cylinder(spot.x, y + 0.7, spot.z, 0.2, 0.2, 0.1, 7, METAL_DARK, METAL_DARK);
        } else if (kind < 0.62 && ctx.plan.floors >= 2) {
            const spot = pickSpot(ctx, zones, placed, 1.3, avoid);
            if (!spot) continue;
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.box(spot.x + sx * 0.7, y + 0.6, spot.z + sz * 0.7, 0.14, 1.2, 0.14, RUST);
            mb.cylinder(spot.x, y + 1.2, spot.z, 1.0, 1.0, 1.5, 12, TANK, shade(TANK, 1.1));
            mb.cylinder(spot.x, y + 2.7, spot.z, 1.0, 0.15, 0.55, 12, shade(TANK, 0.8), shade(TANK, 0.9));
            for (let b = 0; b < 3; b++) mb.cylinder(spot.x, y + 1.6 + b * 0.5, spot.z, 1.03, 1.03, 0.05, 12, RUST, RUST, false);
        } else if (kind < 0.74) {
            const spot = pickSpot(ctx, zones, placed, 0.4, avoid);
            if (!spot) continue;
            const h = 2.2 + rng() * 2.4;
            mb.cylinder(spot.x, y, spot.z, 0.03, 0.03, h, 5, METAL, METAL);
            for (let k = 0; k < 3; k++) mb.box(spot.x, y + h - 0.2 - k * 0.5, spot.z, 0.9 - k * 0.2, 0.02, 0.02, METAL);
        } else if (kind < 0.86) {
            const spot = pickSpot(ctx, zones, placed, 1.0, avoid);
            if (!spot) continue;
            mb.push();
            mb.translate(spot.x, y, spot.z);
            mb.rotateY(rng() * 6.28);
            mb.box(0, 0.12, 0, 1.5, 0.24, 1.0, shade(rgb(ctx.plan.style.roof), 1.3));
            mb.box(0, 0.26, 0, 1.3, 0.04, 0.8, SKYLIGHT);
            mb.pop();
        } else {
            const spot = pickSpot(ctx, zones, placed, 0.7, avoid);
            if (!spot) continue;
            mb.push();
            mb.translate(spot.x, y, spot.z);
            mb.rotateY(rng() * 6.28);
            mb.cylinder(0, 0, 0, 0.05, 0.05, 1.1, 6, METAL, METAL);
            mb.translate(0, 1.1, 0);
            mb.rotateX(-0.9);
            mb.cylinder(0, 0, 0, 0.12, 0.5, 0.18, 12, rgb(0xd0ccc4), rgb(0xe4e0d8));
            mb.pop();
        }
    }
}

function parapet(ctx: BuildCtx, infos: EdgeInfo[], y: number, floor: number) {
    const mb = ctx.solid;
    const plan = ctx.plan;
    const trim = trimColor(ctx);
    const roof = rgb(plan.style.roof);
    const hull = hullColor(ctx, plan.floors - 1);
    const cap = shade(hull, 0.8);
    for (const info of infos) {
        const lo = info.lo - WT / 2;
        const hi = info.hi + WT / 2;
        const height = 0.5 + hash2(plan.seed, info.index) * 0.12;
        const [colLo, colHi] = info.out > 0 ? [roof, hull] : [hull, roof];
        const pieces: [number, number][] = [];
        let cursor = lo;
        while (cursor < hi - 0.01) {
            if (hi - cursor > 4 && ctx.rng() < plan.decay * 0.12) {
                const end = Math.min(hi, cursor + 1.5 + ctx.rng() * 3);
                const next = Math.min(hi, end + 1 + ctx.rng() * 2.2);
                const mid = (end + next) / 2;
                pieces.push([cursor, end]);
                rubble(ctx, info.axis === 'x' ? mid : info.coord, info.axis === 'x' ? info.coord : mid, y, 0.9, 3, floor);
                cursor = next;
            } else {
                pieces.push([cursor, hi]);
                cursor = hi;
            }
        }
        tag(mb, 0, floor);
        for (const [a, b] of pieces) wallBox(mb, info.axis, info.coord, a, b, y - SLAB, y + height, WT, colLo, colHi, cap, shade(hull, 1.1), 0.85);
        wallBox(mb, info.axis, info.coord, lo, hi, y - SLAB - 0.05, y, WT + 0.32, trim, trim, trim, shade(trim, 1.15), 1, 0, info.out * 0.08);
    }
}

function bulkhead(ctx: BuildCtx, y: number, floor: number): ZoneRect | null {
    const plan = ctx.plan;
    if (!plan.stair || plan.floors < 2) return null;
    const mb = ctx.solid;
    const r = plan.stair.rect;
    const w = Math.min(zoneWidth(r), 3);
    const d = Math.min(zoneDepth(r), 3);
    const bx = plan.stair.axis === 'x' ? r.maxX - w / 2 : (r.minX + r.maxX) / 2;
    const bz = plan.stair.axis === 'z' ? r.maxZ - d / 2 : (r.minZ + r.maxZ) / 2;
    const hull = hullColor(ctx, plan.floors - 1);
    const roof = rgb(plan.style.roof);
    tag(mb, 0, floor);
    mb.box(bx, y + 1.25, bz, w, 2.5, d, hull, [hull, hull, roof, undefined, hull, hull], 0.85);
    mb.box(bx, y + 2.55, bz, w + 0.2, 0.12, d + 0.2, trimColor(ctx));
    mb.box(bx, y + 1.0, bz + d / 2 + 0.015, 1.0, 2.0, 0.04, rgb(0x4a3a2c));
    return { minX: bx - w / 2 - 0.5, maxX: bx + w / 2 + 0.5, minZ: bz - d / 2 - 0.5, maxZ: bz + d / 2 + 0.5 };
}

function collapseDebris(ctx: BuildCtx, y: number, floor: number, c: ZoneRect) {
    const mb = ctx.solid;
    const rng = ctx.rng;
    tag(mb, 0, floor);
    for (let i = 0; i < 5; i++) {
        const alongEdge = rng() < 0.5;
        const x0 = alongEdge ? c.minX - 0.3 : c.minX + rng() * (c.maxX - c.minX);
        const z0 = alongEdge ? c.minZ + rng() * (c.maxZ - c.minZ) : c.minZ - 0.3;
        const x1 = alongEdge ? c.minX + (c.maxX - c.minX) * (0.3 + rng() * 0.5) : x0 + (rng() - 0.5) * 0.8;
        const z1 = alongEdge ? z0 + (rng() - 0.5) * 0.8 : c.minZ + (c.maxZ - c.minZ) * (0.3 + rng() * 0.5);
        const dx = x1 - x0;
        const dz = z1 - z0;
        const len = Math.hypot(dx, dz) + 0.2;
        mb.push();
        mb.translate(x0, y - 0.05, z0);
        mb.rotateY(Math.atan2(dx, dz));
        mb.rotateX(0.35 + rng() * 0.3);
        mb.box(0, 0, len / 2, 0.14, 0.14, len, WOOD_BEAM);
        mb.pop();
    }
    growth(ctx, (c.minX + c.maxX) / 2, y, c.minZ - 0.4, floor, 3);
}

function flatRoof(ctx: BuildCtx, infos: EdgeInfo[]) {
    const plan = ctx.plan;
    const mb = ctx.solid;
    const y = plan.floors * FH;
    const roof = rgb(plan.style.roof);
    const side = shade(roof, 0.8);
    const holes: ZoneRect[] = plan.collapse ? [plan.collapse] : [];
    tag(mb, 0, plan.floors);
    for (const zone of plan.footprint.zones) {
        for (const r of subtractAll(zone, holes)) {
            mb.box((r.minX + r.maxX) / 2, y - SLAB / 2, (r.minZ + r.maxZ) / 2, r.maxX - r.minX, SLAB, r.maxZ - r.minZ, side, [side, side, roof, undefined, side, side], 1, 8);
        }
    }
    parapet(ctx, infos, y, plan.floors);
    roofPatches(ctx, y, plan.floors, holes);
    const avoid: ZoneRect[] = [...holes];
    const head = bulkhead(ctx, y, plan.floors);
    if (head) avoid.push(head);
    clutter(ctx, y, plan.floors, avoid);
    const plants = Math.round(zoneArea(plan.footprint.bounds) * 0.04 * plan.decay);
    for (let i = 0; i < plants; i++) {
        const zone = plan.footprint.zones[Math.floor(ctx.rng() * plan.footprint.zones.length)];
        const x = zone.minX + 0.5 + ctx.rng() * Math.max(0.01, zoneWidth(zone) - 1);
        const z = zone.minZ + 0.5 + ctx.rng() * Math.max(0.01, zoneDepth(zone) - 1);
        if (avoid.some((a) => x > a.minX && x < a.maxX && z > a.minZ && z < a.maxZ)) continue;
        growth(ctx, x, y, z, plan.floors, 1);
    }
    if (plan.collapse) collapseDebris(ctx, y, plan.floors, plan.collapse);
}

function gableRoof(ctx: BuildCtx) {
    const plan = ctx.plan;
    const mb = ctx.solid;
    const rng = ctx.rng;
    const zone = plan.footprint.zones[0];
    const y = plan.floors * FH;
    const roof = rgb(plan.style.roof);
    const hull = hullColor(ctx, plan.floors - 1);
    const trim = trimColor(ctx);
    const side = shade(roof, 0.8);
    tag(mb, 0, plan.floors);
    mb.box((zone.minX + zone.maxX) / 2, y - SLAB / 2, (zone.minZ + zone.maxZ) / 2, zoneWidth(zone) + WT, SLAB, zoneDepth(zone) + WT, side, [side, side, shade(roof, 1.1), undefined, side, side], 1, 8);

    const alongX = zoneWidth(zone) >= zoneDepth(zone);
    const span = alongX ? zoneDepth(zone) : zoneWidth(zone);
    const overhang = 0.5;
    const rakeOut = 0.45;
    const half = span / 2 + overhang;
    const eaveY = y - 0.12;
    const ridgeY = y + (span / 2) * (0.5 + hash2(plan.seed, 5) * 0.2);
    const rise = ridgeY - eaveY;
    const thick = 0.07;
    const c = alongX ? (zone.minZ + zone.maxZ) / 2 : (zone.minX + zone.maxX) / 2;
    const l0 = (alongX ? zone.minX : zone.minZ) - rakeOut;
    const l1 = (alongX ? zone.maxX : zone.maxZ) + rakeOut;
    const P = (along: number, across: number, h: number): Vec3 => (alongX ? [along, h, c + across] : [c + across, h, along]);
    const surface = (across: number) => ridgeY - rise * (Math.abs(across) / half);
    const strips = Math.max(6, Math.round((l1 - l0) / 0.9));

    for (const sign of [-1, 1]) {
        const normalTop: Vec3 = alongX ? [0, half, sign * rise] : [sign * rise, half, 0];
        const normalBottom: Vec3 = [-normalTop[0], -normalTop[1], -normalTop[2]];
        for (let i = 0; i < strips; i++) {
            const a0 = l0 + ((l1 - l0) * i) / strips;
            const a1 = l0 + ((l1 - l0) * (i + 1)) / strips;
            const col = shade(roof, 0.88 + hash2(plan.seed + i, sign + 3) * 0.2);
            orientedQuad(mb, P(a0, sign * half, eaveY), P(a1, sign * half, eaveY), P(a1, 0, ridgeY), P(a0, 0, ridgeY), normalTop, col, 0.85, 1.1);
        }
        orientedQuad(mb, P(l0, sign * half, eaveY - thick), P(l1, sign * half, eaveY - thick), P(l1, 0, ridgeY - thick), P(l0, 0, ridgeY - thick), normalBottom, ATTIC, 0.8, 0.8);
        const fasciaCoord = c + sign * half;
        wallBox(mb, alongX ? 'x' : 'z', fasciaCoord, l0, l1, eaveY - 0.2, eaveY + 0.02, 0.05, trim, trim, trim, trim);
    }

    for (const end of [0, 1]) {
        const dir = end === 0 ? -1 : 1;
        const edge = end === 0 ? (alongX ? zone.minX : zone.minZ) : alongX ? zone.maxX : zone.maxZ;
        const along = edge + dir * (WT / 2 + 0.012);
        const toward: Vec3 = alongX ? [dir, 0, 0] : [0, 0, dir];
        const inward: Vec3 = alongX ? [-dir, 0, 0] : [0, 0, -dir];
        const a = P(along, -half, eaveY);
        const b = P(along, half, eaveY);
        const t = P(along, 0, ridgeY);
        orientedTri(mb, a, b, t, toward, hull, 1);
        orientedTri(mb, a, b, t, inward, ATTIC, 1);
        if (span >= 5) {
            const ventY = eaveY + rise * 0.28;
            wallBox(mb, alongX ? 'z' : 'x', along, c - 0.32, c + 0.32, ventY - 0.3, ventY + 0.3, 0.06, ATTIC, ATTIC, trim, trim, 1, 0, dir * 0.03);
            wallBox(mb, alongX ? 'z' : 'x', along, c - 0.4, c + 0.4, ventY + 0.3, ventY + 0.36, 0.08, trim, trim, trim, trim, 1, 0, dir * 0.03);
            wallBox(mb, alongX ? 'z' : 'x', along, c - 0.4, c + 0.4, ventY - 0.36, ventY - 0.3, 0.08, trim, trim, trim, trim, 1, 0, dir * 0.03);
        }
    }

    const mossCount = Math.round((l1 - l0) * span * 0.035 * plan.decay);
    for (let i = 0; i < mossCount; i++) {
        const sign = rng() < 0.5 ? -1 : 1;
        const alongPos = l0 + 0.6 + rng() * Math.max(0.01, l1 - l0 - 1.2);
        const acrossPos = 0.8 + rng() * Math.max(0.01, half - 1.4);
        const rad = Math.min(0.9, 0.35 + rng() * 0.6);
        const moss = MOSS_ROOF[Math.floor(rng() * MOSS_ROOF.length)];
        const rim = mixRgb(roof, moss, 0.3);
        const toward: Vec3 = alongX ? [0, half, sign * rise] : [sign * rise, half, 0];
        const segs = 6;
        const centre = P(alongPos, sign * acrossPos, surface(acrossPos) + 0.03);
        for (let k = 0; k < segs; k++) {
            const a0 = (k / segs) * Math.PI * 2;
            const a1 = ((k + 1) / segs) * Math.PI * 2;
            const ra = alongPos + Math.cos(a0) * rad * (0.7 + rng() * 0.5);
            const rb = alongPos + Math.cos(a1) * rad * (0.7 + rng() * 0.5);
            const ca = Math.min(half - 0.1, Math.max(0.1, acrossPos + Math.sin(a0) * rad * 0.9));
            const cb = Math.min(half - 0.1, Math.max(0.1, acrossPos + Math.sin(a1) * rad * 0.9));
            orientedTriC(mb, centre, P(ra, sign * ca, surface(ca) + 0.03), P(rb, sign * cb, surface(cb) + 0.03), toward, moss, rim, rim);
        }
    }

    if (rng() < 0.75) {
        const along = l0 + 0.8 + (l1 - l0 - 1.6) * (0.15 + rng() * 0.7);
        const across = (rng() < 0.5 ? -1 : 1) * span * 0.17;
        const base = surface(Math.abs(across)) - 0.2;
        const p = P(along, across, base);
        mb.box(p[0], base + 0.95, p[2], 0.7, 1.9, 0.7, BRICK);
        mb.box(p[0], base + 1.92, p[2], 0.86, 0.1, 0.86, CHIMNEY_CAP);
    }
}

export function* buildSlabsAndRoof(ctx: BuildCtx, infos: EdgeInfo[]): Generator<void, void> {
    slabs(ctx);
    yield;
    if (roofIsGable(ctx.plan)) gableRoof(ctx);
    else flatRoof(ctx, infos);
    yield;
}
