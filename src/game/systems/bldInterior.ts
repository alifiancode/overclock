import type { BufferGeometry } from 'three';
import { MeshBuilder, mixRgb, rgb, type Rgb, type Vec3 } from './meshBuilder.ts';
import { localFlights, type BuildingDef, type BuildingPlan } from './buildingGen.ts';
import { pieceBounds, type FurniturePiece } from './furniture.ts';
import type { Doorway, FloorPlan, Room, RoomType } from './floorPlans.ts';
import { rectsOverlap, zoneArea, zoneDepth, zoneWidth, type WallSegment, type ZoneRect } from './buildingShapes.ts';
import { createRng, hashInts } from './random.ts';
import { roofIsGable } from './bldRoof.ts';
import { drawFurniture } from './bldFurniture.ts';
import {
    CEIL,
    DOORWAY_TOP,
    FH,
    SLAB,
    WT,
    collectOpenings,
    flatQuad,
    growth,
    hash2,
    opsOnLine,
    orientedQuad,
    orientedTriC,
    rubble,
    shade,
    slopedBeam,
    splitRun,
    subtractAll,
    tag,
    wallBox,
    wallPaint,
    wallQuad,
    type Axis,
    type BuildCtx,
    type Opening,
} from './bldCommon.ts';

export type InteriorGeometry = { solid: BufferGeometry | null; leaf: BufferGeometry | null };

type Flight = ReturnType<typeof localFlights>[number];
type Side = { axis: Axis; coord: number; lo: number; hi: number; n: number };
type Run = { s0: number; s1: number; exterior: boolean };
type FloorKind = 'wood' | 'carpet' | 'tile' | 'tileBig' | 'concrete';

const SKIES: Rgb[] = [0x8fb4d8, 0xd8a878, 0x7a96b8, 0xc8c0a0, 0x9ab8a8].map(rgb);
const HILLS: Rgb[] = [0x4f7a4a, 0x6a8a52, 0x3a5a46, 0x8a7a4a, 0x5a6a8a].map(rgb);
const GROUNDS: Rgb[] = [0x6a5236, 0x3a4a32, 0x8a7a5a, 0x2f3f2f, 0x5a4a3a].map(rgb);
const FRAMES: Rgb[] = [0x3a2a1c, 0x8a6a2a, 0x2a2a2e, 0x6a4a32, 0xb8b0a0].map(rgb);
const LEAVES: Rgb[] = [0x5a4a2a, 0x6a5a30, 0x3f6a2a, 0x4c7d30, 0x7a5a2a, 0x8a6a3a].map(rgb);
const MOSS: Rgb[] = [0x3d6b2a, 0x4c7d30, 0x2f5a26, 0x587f35].map(rgb);
const DOOR_TONES: Rgb[] = [0x8a5a34, 0x6b4428, 0x3f5f4a, 0x5a6f9a, 0xcfc8b8, 0x7a2f2f].map(rgb);

function roomAt(rooms: Room[], x: number, z: number): Room | null {
    for (const r of rooms) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return r;
    return null;
}

function roomPaint(plan: BuildingPlan, f: number, type: RoomType): Rgb {
    const wall = wallPaint(plan, f);
    switch (type) {
        case 'storage':
        case 'utility':
        case 'warehouse':
            return mixRgb(rgb(plan.style.floorStyles[f].concrete), wall, 0.25);
        case 'bathroom':
            return mixRgb(wall, rgb(0xdfe8e8), 0.3);
        default:
            return wall;
    }
}

function floorKindOf(plan: BuildingPlan, room: Room, f: number): FloorKind {
    const h = hash2(plan.seed + room.id * 31, f * 7 + 1);
    switch (room.type) {
        case 'bathroom':
        case 'entry':
            return 'tile';
        case 'kitchen':
            return h < 0.55 ? 'tile' : 'wood';
        case 'bedroom':
            return h < 0.6 ? 'carpet' : 'wood';
        case 'living':
            return h < 0.5 ? 'wood' : 'carpet';
        case 'dining':
            return 'wood';
        case 'hall':
            return h < 0.5 ? 'wood' : 'tile';
        case 'office':
            return plan.usage === 'office' || h < 0.5 ? 'carpet' : 'wood';
        case 'shop':
            return 'tileBig';
        case 'storage':
        case 'utility':
        case 'warehouse':
            return 'concrete';
    }
}

function clipQuad(ctx: BuildCtx, rect: ZoneRect, holes: ZoneRect[], y: number, color: Rgb, inset: number = 0) {
    const r: ZoneRect = { minX: rect.minX + inset, maxX: rect.maxX - inset, minZ: rect.minZ + inset, maxZ: rect.maxZ - inset };
    for (const piece of subtractAll(r, holes)) flatQuad(ctx.solid, piece.minX, piece.minZ, piece.maxX, piece.maxZ, y, color);
}

function planks(ctx: BuildCtx, r: ZoneRect, holes: ZoneRect[], y: number, a: Rgb, b: Rgb) {
    const alongX = zoneWidth(r) >= zoneDepth(r);
    const span = alongX ? zoneDepth(r) : zoneWidth(r);
    const len = alongX ? zoneWidth(r) : zoneDepth(r);
    const count = Math.max(1, Math.round(span / 0.32));
    const step = span / count;
    clipQuad(ctx, r, holes, y, shade(a, 0.42));
    for (let i = 0; i < count; i++) {
        const s0 = (alongX ? r.minZ : r.minX) + i * step;
        const s1 = s0 + step;
        let cursor = 0;
        while (cursor < len - 0.01) {
            const seg = Math.min(len - cursor, 1.2 + ctx.rng() * 1.6);
            const col = shade(mixRgb(a, b, ctx.rng()), 0.94 + ctx.rng() * 0.12);
            const l0 = (alongX ? r.minX : r.minZ) + cursor;
            const l1 = l0 + seg;
            const rect: ZoneRect = alongX ? { minX: l0, maxX: l1, minZ: s0, maxZ: s1 } : { minX: s0, maxX: s1, minZ: l0, maxZ: l1 };
            clipQuad(ctx, rect, holes, y + 0.0008, col, 0.006);
            cursor += seg;
        }
    }
}

function tiles(ctx: BuildCtx, r: ZoneRect, holes: ZoneRect[], y: number, a: Rgb, b: Rgb, size: number, grout: Rgb) {
    clipQuad(ctx, r, holes, y, grout);
    const nx = Math.max(1, Math.ceil(zoneWidth(r) / size));
    const nz = Math.max(1, Math.ceil(zoneDepth(r) / size));
    for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
            const rect: ZoneRect = {
                minX: r.minX + ix * size,
                maxX: Math.min(r.maxX, r.minX + (ix + 1) * size),
                minZ: r.minZ + iz * size,
                maxZ: Math.min(r.maxZ, r.minZ + (iz + 1) * size),
            };
            const col = shade((ix + iz) % 2 === 0 ? a : b, 0.96 + ctx.rng() * 0.08);
            clipQuad(ctx, rect, holes, y + 0.0008, col, 0.012);
        }
    }
}

function floorPatches(ctx: BuildCtx, room: Room, holes: ZoneRect[], y: number, base: Rgb, local: number, ground: boolean) {
    const area = zoneArea(room);
    const count = Math.round(area * 0.06 * local);
    let lift = 0.002;
    for (let i = 0; i < count; i++) {
        const w = 0.4 + ctx.rng() * 1.1;
        const d = 0.4 + ctx.rng() * 1.1;
        if (w + 0.3 > zoneWidth(room) || d + 0.3 > zoneDepth(room)) continue;
        const x0 = room.minX + 0.15 + ctx.rng() * (zoneWidth(room) - w - 0.3);
        const z0 = room.minZ + 0.15 + ctx.rng() * (zoneDepth(room) - d - 0.3);
        const roll = ctx.rng();
        const col = roll < 0.45 ? shade(base, 0.55 + ctx.rng() * 0.2) : roll < 0.7 ? (ground ? MOSS[Math.floor(ctx.rng() * MOSS.length)] : shade(base, 0.7)) : roll < 0.88 ? LEAVES[Math.floor(ctx.rng() * LEAVES.length)] : rgb(0x3a4a52);
        lift += 0.0004;
        clipQuad(ctx, { minX: x0, maxX: x0 + w, minZ: z0, maxZ: z0 + d }, holes, y + lift, col);
    }
}

function* floors(ctx: BuildCtx, f: number, rooms: Room[], holes: ZoneRect[], localDecay: (room: Room) => number): Generator<void> {
    const plan = ctx.plan;
    const style = plan.style.floorStyles[f];
    const y = f * FH + 0.004;
    tag(ctx.solid, 0, f);
    for (const room of rooms) {
        const kind = floorKindOf(plan, room, f);
        let base: Rgb;
        if (kind === 'wood') {
            base = rgb(style.wood);
            planks(ctx, room, holes, y, base, rgb(style.woodAlt));
        } else if (kind === 'carpet') {
            base = rgb(style.carpet);
            if (plan.usage === 'office') tiles(ctx, room, holes, y, base, shade(base, 0.9), 1.0, shade(base, 0.7));
            else {
                clipQuad(ctx, room, holes, y, base);
                clipQuad(ctx, room, holes, y + 0.0008, shade(base, 1.08), 0.35);
            }
        } else if (kind === 'tile') {
            base = rgb(style.tileA);
            tiles(ctx, room, holes, y, base, rgb(style.tileB), 0.6, shade(base, 0.45));
        } else if (kind === 'tileBig') {
            base = rgb(style.tileA);
            tiles(ctx, room, holes, y, base, shade(rgb(style.tileB), 1.2), 1.0, shade(base, 0.5));
        } else {
            base = rgb(style.concrete);
            clipQuad(ctx, room, holes, y, base);
            for (let x = room.minX + 2.5; x < room.maxX - 0.5; x += 2.5) clipQuad(ctx, { minX: x - 0.012, maxX: x + 0.012, minZ: room.minZ, maxZ: room.maxZ }, holes, y + 0.0006, shade(base, 0.6));
            for (let z = room.minZ + 2.5; z < room.maxZ - 0.5; z += 2.5) clipQuad(ctx, { minX: room.minX, maxX: room.maxX, minZ: z - 0.012, maxZ: z + 0.012 }, holes, y + 0.0006, shade(base, 0.6));
        }
        floorPatches(ctx, room, holes, y, base, localDecay(room), f === 0);
        yield;
    }
}

function ceilings(ctx: BuildCtx, f: number, rooms: Room[], holes: ZoneRect[]) {
    const mb = ctx.solid;
    const y = (f + 1) * FH - SLAB - 0.003;
    const col = mixRgb(wallPaint(ctx.plan, f), rgb(0xe8e4d8), 0.7);
    tag(mb, 0, f);
    const toward: Vec3 = [0, -1, 0];
    for (const room of rooms) {
        for (const r of subtractAll(room, holes)) {
            orientedQuad(mb, [r.minX, y, r.minZ], [r.maxX, y, r.minZ], [r.maxX, y, r.maxZ], [r.minX, y, r.maxZ], toward, col);
        }
    }
    const stains = Math.round(ctx.plan.decay * rooms.length * 0.8);
    for (let i = 0; i < stains; i++) {
        const room = rooms[Math.floor(ctx.rng() * rooms.length)];
        const w = 0.5 + ctx.rng() * 1.2;
        const d = 0.5 + ctx.rng() * 1.2;
        if (w + 0.3 > zoneWidth(room) || d + 0.3 > zoneDepth(room)) continue;
        const x0 = room.minX + 0.15 + ctx.rng() * (zoneWidth(room) - w - 0.3);
        const z0 = room.minZ + 0.15 + ctx.rng() * (zoneDepth(room) - d - 0.3);
        const rect: ZoneRect = { minX: x0, maxX: x0 + w, minZ: z0, maxZ: z0 + d };
        const stain = ctx.rng() < 0.6 ? shade(col, 0.62) : MOSS[Math.floor(ctx.rng() * MOSS.length)];
        for (const r of subtractAll(rect, holes)) orientedQuad(mb, [r.minX, y - 0.002, r.minZ], [r.maxX, y - 0.002, r.minZ], [r.maxX, y - 0.002, r.maxZ], [r.minX, y - 0.002, r.maxZ], toward, stain);
    }
}

function isDoorEnd(doorways: Doorway[], axis: Axis, coord: number, end: number): boolean {
    for (const d of doorways) {
        const dAxis: Axis = d.along === 'z' ? 'z' : 'x';
        if (dAxis !== axis) continue;
        const dCoord = axis === 'z' ? d.x : d.z;
        if (Math.abs(dCoord - coord) > 0.03) continue;
        const c = axis === 'z' ? d.z : d.x;
        if (Math.abs(c - d.width / 2 - end) < 0.03 || Math.abs(c + d.width / 2 - end) < 0.03) return true;
    }
    return false;
}

function sideRooms(rooms: Room[], axis: Axis, coord: number, mid: number): [Room | null, Room | null] {
    const off = WT / 2 + 0.3;
    if (axis === 'x') return [roomAt(rooms, mid, coord - off), roomAt(rooms, mid, coord + off)];
    return [roomAt(rooms, coord - off, mid), roomAt(rooms, coord + off, mid)];
}

function partitions(ctx: BuildCtx, f: number, fp: FloorPlan) {
    const plan = ctx.plan;
    const mb = ctx.solid;
    const y0 = f * FH;
    const y1 = (f + 1) * FH - SLAB;
    tag(mb, 2, f);
    for (const seg of fp.walls) {
        const alongX = Math.abs(seg.x2 - seg.x1) >= Math.abs(seg.z2 - seg.z1);
        const axis: Axis = alongX ? 'x' : 'z';
        const coord = alongX ? seg.z1 : seg.x1;
        let lo = alongX ? Math.min(seg.x1, seg.x2) : Math.min(seg.z1, seg.z2);
        let hi = alongX ? Math.max(seg.x1, seg.x2) : Math.max(seg.z1, seg.z2);
        if (hi - lo < 0.05) continue;
        lo -= isDoorEnd(fp.doorways, axis, coord, lo) ? 0 : WT / 2 - 0.012;
        hi += isDoorEnd(fp.doorways, axis, coord, hi) ? 0 : WT / 2 - 0.012;
        const [rLo, rHi] = sideRooms(fp.rooms, axis, coord, (lo + hi) / 2);
        const cLo = roomPaint(plan, f, rLo ? rLo.type : 'hall');
        const cHi = roomPaint(plan, f, rHi ? rHi.type : 'hall');
        const cap = shade(cLo, 0.5);
        wallBox(mb, axis, coord, lo, hi, y0, y1, WT, cLo, cHi, cap, cap, 0.9, 8);
    }
}

function doorLeaf(ctx: BuildCtx, f: number, axis: Axis, coord: number, lo: number, hi: number) {
    const mb = ctx.solid;
    const hingeLow = ctx.rng() < 0.5;
    const swing = (ctx.rng() < 0.5 ? -1 : 1) * (0.9 + ctx.rng() * 0.6);
    const len = hi - lo - 0.1;
    const hinge = hingeLow ? lo + 0.04 : hi - 0.04;
    const along = hingeLow ? 1 : -1;
    const dirAlong = Math.cos(swing) * along;
    const dirPerp = Math.sin(swing);
    const dx = axis === 'z' ? dirPerp : dirAlong;
    const dz = axis === 'z' ? dirAlong : dirPerp;
    const hx = axis === 'z' ? coord : hinge;
    const hz = axis === 'z' ? hinge : coord;
    const tone = DOOR_TONES[Math.floor(ctx.rng() * DOOR_TONES.length)];
    mb.push();
    mb.translate(hx, f * FH, hz);
    mb.rotateY(Math.atan2(dx, dz));
    mb.box(0, 1.03, len / 2, 0.045, 2.06, len, tone, [tone, shade(tone, 0.9), shade(tone, 0.8), undefined, shade(tone, 0.7), shade(tone, 0.7)], 0.9, 8);
    mb.box(0.03, 1.0, len - 0.1, 0.03, 0.04, 0.12, rgb(0xb89a4a));
    mb.box(-0.03, 1.0, len - 0.1, 0.03, 0.04, 0.12, rgb(0xb89a4a));
    mb.box(0.025, 1.55, len / 2, 0.01, 0.7, len - 0.3, shade(tone, 0.85));
    mb.box(0.025, 0.55, len / 2, 0.01, 0.7, len - 0.3, shade(tone, 0.85));
    mb.pop();
}

function doorways(ctx: BuildCtx, f: number, fp: FloorPlan) {
    const plan = ctx.plan;
    const mb = ctx.solid;
    const style = plan.style.floorStyles[f];
    const trim = mixRgb(rgb(style.baseboard), rgb(style.wood), 0.4);
    const y0 = f * FH;
    const y1 = (f + 1) * FH - SLAB;
    tag(mb, 2, f);
    for (const d of fp.doorways) {
        const axis: Axis = d.along === 'z' ? 'z' : 'x';
        const coord = axis === 'z' ? d.x : d.z;
        const c = axis === 'z' ? d.z : d.x;
        const lo = c - d.width / 2;
        const hi = c + d.width / 2;
        const [rLo, rHi] = sideRooms(fp.rooms, axis, coord, c);
        const cLo = roomPaint(plan, f, rLo ? rLo.type : 'hall');
        const cHi = roomPaint(plan, f, rHi ? rHi.type : 'hall');
        const cap = shade(cLo, 0.5);
        wallBox(mb, axis, coord, lo - 0.02, hi + 0.02, y0 + DOORWAY_TOP, y1, WT, cLo, cHi, cap, cap, 1, 8);
        const t = WT + 0.05;
        wallBox(mb, axis, coord, lo - 0.01, lo + 0.07, y0, y0 + DOORWAY_TOP + 0.06, t, trim, trim, trim, trim, 1, 8);
        wallBox(mb, axis, coord, hi - 0.07, hi + 0.01, y0, y0 + DOORWAY_TOP + 0.06, t, trim, trim, trim, trim, 1, 8);
        wallBox(mb, axis, coord, lo - 0.01, hi + 0.01, y0 + DOORWAY_TOP - 0.03, y0 + DOORWAY_TOP + 0.06, t, trim, trim, trim, trim, 1, 8);
        if (ctx.rng() < 0.4) doorLeaf(ctx, f, axis, coord, lo, hi);
    }
}

function roomSides(r: ZoneRect): Side[] {
    return [
        { axis: 'z', coord: r.minX, lo: r.minZ, hi: r.maxZ, n: 1 },
        { axis: 'z', coord: r.maxX, lo: r.minZ, hi: r.maxZ, n: -1 },
        { axis: 'x', coord: r.minZ, lo: r.minX, hi: r.maxX, n: 1 },
        { axis: 'x', coord: r.maxZ, lo: r.minX, hi: r.maxX, n: -1 },
    ];
}

function runsOn(plan: BuildingPlan, f: number, side: Side): Run[] {
    const out: Run[] = [];
    const collect = (list: WallSegment[], exterior: boolean) => {
        for (const seg of list) {
            const alongX = Math.abs(seg.x2 - seg.x1) >= Math.abs(seg.z2 - seg.z1);
            if ((side.axis === 'x') !== alongX) continue;
            const c = alongX ? seg.z1 : seg.x1;
            if (Math.abs(c - side.coord) > 0.03) continue;
            const a = alongX ? Math.min(seg.x1, seg.x2) : Math.min(seg.z1, seg.z2);
            const b = alongX ? Math.max(seg.x1, seg.x2) : Math.max(seg.z1, seg.z2);
            const s0 = Math.max(a, side.lo);
            const s1 = Math.min(b, side.hi);
            if (s1 - s0 > 0.05) out.push({ s0, s1, exterior });
        }
    };
    collect(plan.outerWalls[f], true);
    collect(plan.plans[f].walls, false);
    return out;
}

function wallStain(ctx: BuildCtx, side: Side, s: number, y: number, rw: number, rh: number, base: Rgb) {
    const mb = ctx.solid;
    const moss = MOSS[Math.floor(ctx.rng() * MOSS.length)];
    const rim = mixRgb(base, moss, 0.35);
    const centre = mixRgb(base, moss, 0.75);
    const plane = side.coord + side.n * (WT / 2 + 0.008);
    const toward: Vec3 = side.axis === 'x' ? [0, 0, side.n] : [side.n, 0, 0];
    const segs = 6;
    const pts: [number, number][] = [];
    for (let k = 0; k < segs; k++) {
        const a = (k / segs) * Math.PI * 2;
        const j = 0.75 + ctx.rng() * 0.5;
        pts.push([s + Math.cos(a) * rw * 0.5 * j, y + Math.sin(a) * rh * 0.5 * j]);
    }
    const at = (along: number, h: number): Vec3 => (side.axis === 'x' ? [along, h, plane] : [plane, h, along]);
    for (let k = 0; k < segs; k++) {
        const p0 = pts[k];
        const p1 = pts[(k + 1) % segs];
        orientedTriC(mb, at(s, y), at(p0[0], p0[1]), at(p1[0], p1[1]), toward, centre, rim, rim);
    }
}

function picture(ctx: BuildCtx, side: Side, s: number, y: number, w: number, h: number) {
    const mb = ctx.solid;
    const frame = FRAMES[Math.floor(ctx.rng() * FRAMES.length)];
    const sky = SKIES[Math.floor(ctx.rng() * SKIES.length)];
    const hill = HILLS[Math.floor(ctx.rng() * HILLS.length)];
    const ground = GROUNDS[Math.floor(ctx.rng() * GROUNDS.length)];
    wallBox(mb, side.axis, side.coord, s - w / 2, s + w / 2, y - h / 2, y + h / 2, 0.04, frame, frame, frame, frame, 1, 8, side.n * (WT / 2 + 0.02));
    const plane = side.coord + side.n * (WT / 2 + 0.042);
    const x0 = s - w / 2 + 0.05;
    const x1 = s + w / 2 - 0.05;
    const y0 = y - h / 2 + 0.05;
    const y1 = y + h / 2 - 0.05;
    const span = y1 - y0;
    wallQuad(mb, side.axis, plane, x0, x1, y0 + span * 0.6, y1, side.n, sky, 0.9, 1.1);
    wallQuad(mb, side.axis, plane, x0, x1, y0 + span * 0.25, y0 + span * 0.6, side.n, hill, 0.9, 1);
    wallQuad(mb, side.axis, plane, x0, x1, y0, y0 + span * 0.25, side.n, ground, 0.9, 1);
    if (ctx.rng() < 0.5) {
        const sx = x0 + (x1 - x0) * (0.2 + ctx.rng() * 0.6);
        wallQuad(mb, side.axis, plane + side.n * 0.002, sx - 0.05, sx + 0.05, y0 + span * 0.62, y0 + span * 0.72, side.n, rgb(0xf0e4b0));
    }
}

function clock(ctx: BuildCtx, side: Side, s: number, y: number) {
    const mb = ctx.solid;
    const frame = FRAMES[Math.floor(ctx.rng() * FRAMES.length)];
    wallBox(mb, side.axis, side.coord, s - 0.16, s + 0.16, y - 0.16, y + 0.16, 0.05, frame, frame, frame, frame, 1, 8, side.n * (WT / 2 + 0.025));
    const plane = side.coord + side.n * (WT / 2 + 0.052);
    wallQuad(mb, side.axis, plane, s - 0.13, s + 0.13, y - 0.13, y + 0.13, side.n, rgb(0xe8e2d0));
    const hands = plane + side.n * 0.003;
    wallQuad(mb, side.axis, hands, s - 0.008, s + 0.008, y, y + 0.1, side.n, rgb(0x1e1e22));
    wallQuad(mb, side.axis, hands, s, s + 0.07, y - 0.008, y + 0.008, side.n, rgb(0x1e1e22));
}

function blockedByTall(pieces: FurniturePiece[], side: Side, s: number, halfW: number): boolean {
    const depth = 0.5;
    const strip: ZoneRect =
        side.axis === 'x'
            ? { minX: s - halfW, maxX: s + halfW, minZ: Math.min(side.coord, side.coord + side.n * depth), maxZ: Math.max(side.coord, side.coord + side.n * depth) }
            : { minX: Math.min(side.coord, side.coord + side.n * depth), maxX: Math.max(side.coord, side.coord + side.n * depth), minZ: s - halfW, maxZ: s + halfW };
    for (const piece of pieces) {
        if (piece.h < 1.3) continue;
        if (rectsOverlap(strip, pieceBounds(piece.kind, piece.x, piece.z, piece.rot))) return true;
    }
    return false;
}

function dressRun(ctx: BuildCtx, f: number, room: Room, side: Side, run: Run, ops: Opening[], pieces: FurniturePiece[], local: number) {
    const plan = ctx.plan;
    const mb = ctx.solid;
    const style = plan.style.floorStyles[f];
    const base = f * FH;
    const { axis, coord, n } = side;
    const { s0, s1, exterior } = run;
    const type = room.type;
    const windows = exterior ? opsOnLine(ops, axis, coord).filter((o) => o.kind === 'window') : [];
    const plane = coord + n * (WT / 2 + 0.005);
    const trim = rgb(style.baseboard);
    const concrete = type === 'storage' || type === 'utility' || type === 'warehouse';
    const wet = type === 'bathroom' || type === 'kitchen';
    tag(mb, exterior ? 1 : 2, f);
    if (!wet && !concrete) {
        wallBox(mb, axis, coord, s0, s1, base, base + 0.11, 0.03, trim, trim, trim, trim, 1, 8, n * (WT / 2 + 0.015));
    }
    if (wet) {
        const top = type === 'bathroom' ? 1.5 : 1.05;
        const tileA = rgb(style.tileA);
        const tileB = rgb(style.tileB);
        for (const p of splitRun(s0, s1, base, base + top, base, windows)) {
            wallQuad(mb, axis, plane, p.s0, p.s1, p.y0, p.y1, n, tileA, 0.9, 1.05);
            if (p.y1 > base + top - 0.01) wallQuad(mb, axis, plane + n * 0.001, p.s0, p.s1, base + top - 0.08, base + top, n, tileB);
        }
        for (const p of splitRun(s0, s1, base, base + 0.12, base, windows)) wallQuad(mb, axis, plane + n * 0.001, p.s0, p.s1, p.y0, p.y1, n, tileB);
    } else if (concrete) {
        const cc = roomPaint(plan, f, type);
        if (exterior) {
            for (const p of splitRun(s0, s1, base, base + CEIL, base, windows)) wallQuad(mb, axis, plane, p.s0, p.s1, p.y0, p.y1, n, cc, 0.85, 1);
        }
        for (const p of splitRun(s0, s1, base, base + 0.55, base, windows)) wallQuad(mb, axis, plane + n * 0.001, p.s0, p.s1, p.y0, p.y1, n, shade(cc, 0.72), 0.8, 1);
    } else if (type === 'living' || type === 'dining' || type === 'hall' || type === 'entry' || type === 'shop') {
        const wains = rgb(style.wainscot);
        const rail = shade(wains, 0.78);
        for (const p of splitRun(s0, s1, base + 0.11, base + 1.0, base, windows)) {
            wallQuad(mb, axis, plane, p.s0, p.s1, p.y0, p.y1, n, wains, 0.9, 1);
            if (p.y1 > base + 0.99) wallBox(mb, axis, coord, p.s0, p.s1, base + 1.0, base + 1.05, 0.035, rail, rail, rail, rail, 1, 8, n * (WT / 2 + 0.0175));
        }
    }
    if (exterior) {
        for (const o of windows) {
            const c = (o.lo + o.hi) / 2;
            if (c < s0 || c > s1) continue;
            const sill = mixRgb(trim, rgb(0xd8d2c4), 0.5);
            wallBox(mb, axis, coord, o.lo - 0.06, o.hi + 0.06, base + o.y0 - 0.035, base + o.y0 + 0.01, 0.16, sill, sill, sill, sill, 1, 8, n * (WT / 2 + 0.06));
        }
    }
    const len = s1 - s0;
    if (len > 1.2 && local > 0.45 && !concrete) {
        const count = Math.round(len * 0.25 * local * ctx.rng() * 1.4);
        for (let i = 0; i < count; i++) {
            const s = s0 + 0.4 + ctx.rng() * (len - 0.8);
            if (windows.some((o) => s > o.lo - 0.5 && s < o.hi + 0.5)) continue;
            const rh = 0.5 + ctx.rng() * 1.2;
            wallStain(ctx, side, s, base + 0.2 + ctx.rng() * 1.8, 0.4 + ctx.rng() * 0.9, rh, wallPaint(plan, f));
        }
    }
    const decor = type === 'living' || type === 'dining' || type === 'bedroom' || type === 'hall' || type === 'entry' || type === 'office' || type === 'shop';
    if (decor && len > 1.8 && ctx.rng() < 0.32) {
        const w = 0.5 + ctx.rng() * 0.55;
        const s = s0 + w / 2 + 0.3 + ctx.rng() * Math.max(0, len - w - 0.6);
        const blocked = windows.some((o) => s + w / 2 > o.lo - 0.1 && s - w / 2 < o.hi + 0.1) || blockedByTall(pieces, side, s, w / 2 + 0.05);
        if (!blocked) {
            if (type === 'hall' || type === 'entry' || ctx.rng() < 0.15) clock(ctx, side, s, base + 1.9 + ctx.rng() * 0.2);
            else picture(ctx, side, s, base + 1.55 + ctx.rng() * 0.35, w, w * (0.65 + ctx.rng() * 0.25));
        }
    }
}

function* dress(ctx: BuildCtx, f: number, fp: FloorPlan, ops: Opening[], pieces: FurniturePiece[], localDecay: (room: Room) => number): Generator<void> {
    for (const room of fp.rooms) {
        const local = localDecay(room);
        for (const side of roomSides(room)) {
            for (const run of runsOn(ctx.plan, f, side)) dressRun(ctx, f, room, side, run, ops, pieces, local);
            yield;
        }
    }
}

function freeSpot(ctx: BuildCtx, room: Room, pieces: FurniturePiece[], doorways: Doorway[], stair: ZoneRect | null, radius: number): { x: number; z: number } | null {
    const m = radius + 0.5;
    if (zoneWidth(room) < m * 2 || zoneDepth(room) < m * 2) return null;
    for (let attempt = 0; attempt < 10; attempt++) {
        const x = room.minX + m + ctx.rng() * (zoneWidth(room) - m * 2);
        const z = room.minZ + m + ctx.rng() * (zoneDepth(room) - m * 2);
        if (stair && x > stair.minX - radius - 0.8 && x < stair.maxX + radius + 0.8 && z > stair.minZ - radius - 0.8 && z < stair.maxZ + radius + 0.8) continue;
        if (doorways.some((d) => Math.hypot(d.x - x, d.z - z) < radius + 1.2)) continue;
        let clash = false;
        for (const piece of pieces) {
            if (!piece.solid) continue;
            const b = pieceBounds(piece.kind, piece.x, piece.z, piece.rot);
            if (x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius) {
                clash = true;
                break;
            }
        }
        if (!clash) return { x, z };
    }
    return null;
}

function litter(ctx: BuildCtx, cx: number, cz: number, y: number, radius: number, count: number) {
    const mb = ctx.solid;
    let lift = 0.007;
    for (let i = 0; i < count; i++) {
        const a = ctx.rng() * Math.PI * 2;
        const d = Math.sqrt(ctx.rng()) * radius;
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        const size = 0.08 + ctx.rng() * 0.16;
        const rot = ctx.rng() * Math.PI;
        const c = Math.cos(rot) * size;
        const s = Math.sin(rot) * size;
        const col = LEAVES[Math.floor(ctx.rng() * LEAVES.length)];
        lift += 0.00025;
        orientedQuad(mb, [x - c, y + lift, z - s], [x + s, y + lift, z - c], [x + c, y + lift, z + s], [x - s, y + lift, z + c], [0, 1, 0], col);
    }
}

function* details(ctx: BuildCtx, f: number, fp: FloorPlan, pieces: FurniturePiece[], localDecay: (room: Room) => number): Generator<void> {
    const plan = ctx.plan;
    const stair = plan.stair ? plan.stair.rect : null;
    const y = f * FH;
    tag(ctx.solid, 0, f);
    for (const room of fp.rooms) {
        const local = localDecay(room);
        const area = zoneArea(room);
        const heaps = Math.floor((area / 20) * Math.max(0, local - 0.35) * (0.6 + ctx.rng()));
        for (let i = 0; i < heaps; i++) {
            const spot = freeSpot(ctx, room, pieces, fp.doorways, stair, 0.8);
            if (spot) rubble(ctx, spot.x, spot.z, y, 0.7, 4 + Math.floor(ctx.rng() * 3), f);
        }
        const plants = Math.floor((area / 14) * Math.max(0, local - 0.55) * (0.5 + ctx.rng()) * (f === 0 ? 1.2 : 0.6));
        for (let i = 0; i < plants; i++) {
            const spot = freeSpot(ctx, room, pieces, fp.doorways, stair, 0.5);
            if (spot) growth(ctx, spot.x, y, spot.z, f, 2 + Math.floor(ctx.rng() * 3));
        }
        const leaves = Math.floor(area * 0.35 * local);
        if (leaves > 0) {
            const spot = freeSpot(ctx, room, pieces, fp.doorways, stair, 0.4);
            if (spot) litter(ctx, spot.x, spot.z, y + 0.004, 1.4, Math.min(24, leaves));
        }
        yield;
    }
    if (f === 0) {
        for (const o of plan.openings) {
            const ix = o.x - o.nx * 0.9;
            const iz = o.z - o.nz * 0.9;
            litter(ctx, ix, iz, 0.004, 1.5, o.kind === 'breach' ? 16 : 8);
            if (o.kind === 'breach') {
                growth(ctx, o.x - o.nx * 1.1, 0, o.z - o.nz * 1.1, 0, 4);
                rubble(ctx, o.x - o.nx * 1.4, o.z - o.nz * 1.4, 0, 0.9, 5, 0);
            }
        }
    }
    if (f === plan.floors - 1 && plan.collapse && !roofIsGable(plan)) {
        const c = plan.collapse;
        const cx = (c.minX + c.maxX) / 2;
        const cz = (c.minZ + c.maxZ) / 2;
        rubble(ctx, cx, cz, y, Math.min(zoneWidth(c), zoneDepth(c)) * 0.45, 9, f);
        growth(ctx, cx, y, cz, f, 5);
        litter(ctx, cx, cz, y + 0.004, 2.4, 26);
    }
}

function* furnish(ctx: BuildCtx, f: number): Generator<void, FurniturePiece[]> {
    const pieces = ctx.plan.furniture[f];
    for (let i = 0; i < pieces.length; i++) {
        drawFurniture(ctx, pieces[i], f);
        if (i % 3 === 2) yield;
    }
    return pieces;
}

function stairs(ctx: BuildCtx, flights: Flight[]) {
    const mb = ctx.solid;
    const steps = 16;
    for (const fl of flights) {
        const style = ctx.plan.style.floorStyles[fl.from];
        const wood = mixRgb(rgb(style.wood), rgb(0x6a4a32), 0.3);
        const tread = shade(wood, 1.05);
        const riser = shade(wood, 0.72);
        const stringer = shade(wood, 0.55);
        const rail = shade(wood, 0.6);
        const baseY = fl.from * FH;
        const run = (fl.end - fl.start) / steps;
        const rise = FH / steps;
        const alongZ = fl.axis === 'z';
        const l0 = alongZ ? fl.rect.minX : fl.rect.minZ;
        const l1 = alongZ ? fl.rect.maxX : fl.rect.maxZ;
        tag(mb, 0, fl.from);
        for (let i = 0; i < steps; i++) {
            const a0 = fl.start + i * run;
            const a1 = a0 + run;
            const top = baseY + (i + 0.5) * rise;
            if (alongZ) mb.box((l0 + l1) / 2, (baseY + top) / 2, (a0 + a1) / 2, l1 - l0, top - baseY, a1 - a0, stringer, [stringer, stringer, tread, undefined, undefined, riser], 0.9, 8 | 16);
            else mb.box((a0 + a1) / 2, (baseY + top) / 2, (l0 + l1) / 2, a1 - a0, top - baseY, l1 - l0, stringer, [undefined, riser, tread, undefined, stringer, stringer], 0.9, 8 | 1);
        }
        for (const lat of [l0 + 0.05, l1 - 0.05]) {
            const yA = baseY + 0.92;
            const yB = baseY + FH + 0.92;
            if (alongZ) slopedBeam(mb, lat, yA, fl.start, lat, yB, fl.end, 0.06, 0.06, rail);
            else slopedBeam(mb, fl.start, yA, lat, fl.end, yB, lat, 0.06, 0.06, rail);
            for (let i = 0; i <= steps; i += 2) {
                const major = i % 4 === 0;
                const a = fl.start + (major ? i : i + 0.5) * run;
                const ramp = baseY + (major ? i : i + 0.5) * rise;
                const t = major ? 0.08 : 0.035;
                const lowY = major ? ramp - 0.02 : ramp;
                const hi = ramp + 0.92;
                if (alongZ) mb.box(lat, (lowY + hi) / 2, a, t, hi - lowY, t, rail, undefined, 1, 12);
                else mb.box(a, (lowY + hi) / 2, lat, t, hi - lowY, t, rail, undefined, 1, 12);
            }
        }
    }
}

export function* buildInterior(def: BuildingDef): Generator<void, InteriorGeometry> {
    const plan = def.plan;
    const rng = createRng(hashInts(def.index, plan.seed, 0x1a7e));
    const solid = new MeshBuilder(rng, 49152);
    const leaf = new MeshBuilder(rng, 8192);
    leaf.upBlend = 0.55;
    const ctx: BuildCtx = { plan, solid, leaf, sink: { solid, leaf }, rng, seed: plan.seed };
    const flights = plan.stair ? localFlights(plan.stair, plan.floors) : [];
    const breaches = plan.openings.filter((o) => o.kind === 'breach');
    const localDecay = (room: Room): number => {
        let d = plan.decay * (0.75 + hash2(plan.seed + room.id * 17, room.floor * 5 + 3) * 0.5);
        for (const b of breaches) {
            if (room.floor === 0 && b.x > room.minX - 1.5 && b.x < room.maxX + 1.5 && b.z > room.minZ - 1.5 && b.z < room.maxZ + 1.5) d += 0.45;
        }
        return Math.min(1.5, d);
    };
    for (let f = 0; f < plan.floors; f++) {
        const fp = plan.plans[f];
        const ops = collectOpenings(plan, f);
        const arrive: ZoneRect[] = f >= 1 && flights[f - 1] ? [flights[f - 1].rect] : [];
        const depart: ZoneRect[] = flights[f] ? [flights[f].rect] : [];
        if (f === plan.floors - 1 && plan.collapse && !roofIsGable(plan)) depart.push(plan.collapse);
        yield* floors(ctx, f, fp.rooms, arrive, localDecay);
        ceilings(ctx, f, fp.rooms, depart);
        yield;
        partitions(ctx, f, fp);
        doorways(ctx, f, fp);
        yield;
        const pieces = yield* furnish(ctx, f);
        yield* dress(ctx, f, fp, ops, pieces, localDecay);
        yield* details(ctx, f, fp, pieces, localDecay);
    }
    stairs(ctx, flights);
    yield;
    return {
        solid: solid.vertexCount > 0 ? solid.build() : null,
        leaf: leaf.vertexCount > 0 ? leaf.build() : null,
    };
}
