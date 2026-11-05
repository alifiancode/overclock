import { FLOOR_HEIGHT, DOOR_WIDTH } from '../data/constants.ts';
import { createRng, rngChance, rngInt, rngPick, rngRange, type Rng } from './random.ts';
import {
    buildFootprint,
    cutSegment,
    expandRect,
    polygonEdges,
    rectsOverlap,
    rotateRect,
    rotateSegment,
    rotX,
    rotZ,
    zoneDepth,
    zoneWidth,
    type FootprintResult,
    type Point2,
    type PolygonEdge,
    type WallSegment,
    type ZoneRect,
} from './buildingShapes.ts';
import { buildFloorPlan, type FloorPlan, type Room, type RoomType, type Usage } from './floorPlans.ts';
import { furnishRoom, pieceBounds, type FurnitureKind, type FurniturePiece } from './furniture.ts';

export const STAIR_WIDTH = 2.5;
export const FLIGHT_LENGTH = 3.6;
export const LANDING_LENGTH = 0.8;
export const STAIR_DEPTH = FLIGHT_LENGTH * 2 + LANDING_LENGTH;

export type FloorStyle = {
    wall: number;
    wainscot: number;
    baseboard: number;
    wood: number;
    woodAlt: number;
    carpet: number;
    tileA: number;
    tileB: number;
    concrete: number;
};

export type BuildingStyle = {
    hull: number;
    hullShade: number;
    trim: number;
    roof: number;
    glass: number;
    frame: number;
    floorStyles: FloorStyle[];
};

export type LocalOpening = { edge: number; center: number; width: number; kind: 'door' | 'back' | 'breach'; x: number; z: number; nx: number; nz: number };
export type WindowSpec = { edge: number; center: number; width: number; sill: number; height: number };
export type StairPlan = { rect: ZoneRect; axis: 'x' | 'z' };

export type BuildingPlan = {
    seed: number;
    usage: Usage;
    floors: number;
    decay: number;
    footprint: FootprintResult;
    edges: PolygonEdge[];
    stair: StairPlan | null;
    plans: FloorPlan[];
    furniture: FurniturePiece[][];
    openings: LocalOpening[];
    outerWalls: WallSegment[][];
    windows: WindowSpec[][];
    style: BuildingStyle;
    collapse: ZoneRect | null;
};

const HULL_COLORS = [0x94604a, 0xb8a98c, 0x8d9291, 0xc4b57f, 0x8199a8, 0x829783, 0xcfc8b8, 0x7a6350, 0xa7725e, 0x9d9f88];
const TRIM_COLORS = [0x4b3a30, 0x56606a, 0x6a4a40, 0xded6c6, 0x39463e, 0x2f3338];
const PAINTS = [0xdccfae, 0xbccbb4, 0xadc3d4, 0xddbbb1, 0xd2c48f, 0xbdaacd, 0xe4dacc, 0xa3bbb7, 0xcd9f80, 0xacbc9e, 0xc8aa93, 0x93a8bc];
const WAINSCOTS = [0x6b5846, 0x4d5f55, 0x4a5568, 0x6e4a4a, 0x5b5a46, 0x514560, 0x6a6258, 0x40585a, 0x754d37, 0x4f5c45, 0x5f4a3b, 0x3e4c60];
const WOODS: [number, number][] = [
    [0x9c6b3f, 0x8a5c34],
    [0x7a4e2c, 0x6a4325],
    [0xb08850, 0x9d7743],
    [0x5f4029, 0x523622],
    [0xa67c52, 0x946d45],
    [0x8d6e4d, 0x7b5e40],
];
const CARPETS = [0x7a4a56, 0x4a5f7a, 0x566b4b, 0x80694a, 0x5e4a6a, 0x4b525c, 0x6b3f3f, 0x3f6368];
const TILES: [number, number][] = [
    [0xded8ca, 0x7f858a],
    [0xd3dcdd, 0x6b99a4],
    [0xe6dfd1, 0x93624a],
    [0xc4cec4, 0x55735f],
];
const CONCRETES = [0x8e8e89, 0x7f8083, 0x9a968c];

function buildFloorStyle(rng: Rng, avoid: FloorStyle | null): FloorStyle {
    let pi = Math.floor(rng() * PAINTS.length);
    if (avoid && PAINTS[pi] === avoid.wall) pi = (pi + 3) % PAINTS.length;
    const wood = rngPick(rng, WOODS);
    const tile = rngPick(rng, TILES);
    return {
        wall: PAINTS[pi],
        wainscot: WAINSCOTS[pi],
        baseboard: 0x3d3128,
        wood: wood[0],
        woodAlt: wood[1],
        carpet: rngPick(rng, CARPETS),
        tileA: tile[0],
        tileB: tile[1],
        concrete: rngPick(rng, CONCRETES),
    };
}

function buildStyle(rng: Rng, floors: number): BuildingStyle {
    const floorStyles: FloorStyle[] = [];
    for (let i = 0; i < floors; i++) floorStyles.push(buildFloorStyle(rng, i > 0 ? floorStyles[i - 1] : null));
    const hull = rngPick(rng, HULL_COLORS);
    return {
        hull,
        hullShade: hull,
        trim: rngPick(rng, TRIM_COLORS),
        roof: rngPick(rng, [0x4f4a46, 0x5a5550, 0x44484c, 0x5c4a40]),
        glass: rngPick(rng, [0x1c2b33, 0x233038, 0x1a2630, 0x2a3a40]),
        frame: rngPick(rng, [0xd8d2c4, 0x3b3b3b, 0x6b4a32, 0xa8a69c]),
        floorStyles,
    };
}

function placeStair(rng: Rng, footprint: FootprintResult, frontDoorX: number): StairPlan | null {
    const main = footprint.zones[0];
    const m = 0.5;
    const candidates: StairPlan[] = [];
    const wide = zoneWidth(main) >= zoneDepth(main);
    const dims: { axis: 'x' | 'z'; w: number; d: number }[] = [
        { axis: 'z', w: STAIR_WIDTH, d: STAIR_DEPTH },
        { axis: 'x', w: STAIR_DEPTH, d: STAIR_WIDTH },
    ];
    if (wide) dims.reverse();
    for (const dim of dims) {
        if (zoneWidth(main) < dim.w + m * 2 + 2 || zoneDepth(main) < dim.d + m * 2 + 1) continue;
        const xs = [main.minX + m, main.maxX - m - dim.w];
        const zs = [main.minZ + m, main.maxZ - m - dim.d];
        for (const x of xs) {
            for (const z of zs) candidates.push({ axis: dim.axis, rect: { minX: x, maxX: x + dim.w, minZ: z, maxZ: z + dim.d } });
        }
        const midX = main.minX + m + (zoneWidth(main) - m * 2 - dim.w) * rngRange(rng, 0.3, 0.7);
        const midZ = main.minZ + m + (zoneDepth(main) - m * 2 - dim.d) * rngRange(rng, 0.3, 0.7);
        candidates.push({ axis: dim.axis, rect: { minX: main.minX + m, maxX: main.minX + m + dim.w, minZ: midZ, maxZ: midZ + dim.d } });
        candidates.push({ axis: dim.axis, rect: { minX: main.maxX - m - dim.w, maxX: main.maxX - m, minZ: midZ, maxZ: midZ + dim.d } });
        candidates.push({ axis: dim.axis, rect: { minX: midX, maxX: midX + dim.w, minZ: main.maxZ - m - dim.d, maxZ: main.maxZ - m } });
    }
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = candidates[i];
        candidates[i] = candidates[j];
        candidates[j] = t;
    }
    for (const c of candidates) {
        let ok = true;
        const padded = expandRect(c.rect, 0.9);
        for (const n of footprint.necks) {
            const nr: ZoneRect = { minX: Math.min(n.x1, n.x2) - 0.1, maxX: Math.max(n.x1, n.x2) + 0.1, minZ: Math.min(n.z1, n.z2) - 0.1, maxZ: Math.max(n.z1, n.z2) + 0.1 };
            if (rectsOverlap(padded, nr)) ok = false;
        }
        const frontPoint: ZoneRect = { minX: frontDoorX - 1.6, maxX: frontDoorX + 1.6, minZ: main.minZ - 0.1, maxZ: main.minZ + 2.6 };
        if (rectsOverlap(c.rect, frontPoint)) ok = false;
        if (ok) return c;
    }
    return null;
}

type FlightLocal = { rect: ZoneRect; axis: 'x' | 'z'; start: number; end: number; from: number; to: number };

export function localFlights(stair: StairPlan, floors: number): FlightLocal[] {
    const flights: FlightLocal[] = [];
    const r = stair.rect;
    const inset = 0.15;
    for (let k = 0; k < floors - 1; k++) {
        const startOffset = k % 2 === 0 ? 0 : FLIGHT_LENGTH + LANDING_LENGTH;
        if (stair.axis === 'z') {
            const s = r.minZ + startOffset;
            flights.push({ rect: { minX: r.minX + inset, maxX: r.maxX - inset, minZ: s, maxZ: s + FLIGHT_LENGTH }, axis: 'z', start: s, end: s + FLIGHT_LENGTH, from: k, to: k + 1 });
        } else {
            const s = r.minX + startOffset;
            flights.push({ rect: { minX: s, maxX: s + FLIGHT_LENGTH, minZ: r.minZ + inset, maxZ: r.maxZ - inset }, axis: 'x', start: s, end: s + FLIGHT_LENGTH, from: k, to: k + 1 });
        }
    }
    return flights;
}

function pickUsage(rng: Rng, area: number, floors: number): Usage {
    const roll = rng();
    if (floors === 1 && area > 150 && roll < 0.3) return 'warehouse';
    if (roll < 0.52) return 'residential';
    if (roll < 0.74) return 'office';
    if (roll < 0.9) return 'shop';
    return floors === 1 ? 'warehouse' : 'residential';
}

function makeOpenings(rng: Rng, footprint: FootprintResult, edges: PolygonEdge[], stair: StairPlan | null, decay: number): LocalOpening[] {
    const openings: LocalOpening[] = [];
    const front = edges[0];
    openings.push({ edge: 0, center: front.length / 2, width: DOOR_WIDTH, kind: 'door', x: front.x1 + front.ux * (front.length / 2), z: front.z1 + front.uz * (front.length / 2), nx: front.nx, nz: front.nz });
    const stairBox = stair ? expandRect(stair.rect, 1.1) : null;
    const tryAdd = (edge: PolygonEdge, kind: 'back' | 'breach', width: number) => {
        const lo = width / 2 + 1.0;
        const hi = edge.length - width / 2 - 1.0;
        if (hi <= lo) return;
        for (let attempt = 0; attempt < 8; attempt++) {
            const c = rngRange(rng, lo, hi);
            const ox = edge.x1 + edge.ux * c;
            const oz = edge.z1 + edge.uz * c;
            const box: ZoneRect = { minX: ox - Math.abs(edge.ux) * width / 2 - Math.abs(edge.nx) * 0.5, maxX: ox + Math.abs(edge.ux) * width / 2 + Math.abs(edge.nx) * 0.5, minZ: oz - Math.abs(edge.uz) * width / 2 - Math.abs(edge.nz) * 0.5, maxZ: oz + Math.abs(edge.uz) * width / 2 + Math.abs(edge.nz) * 0.5 };
            if (stairBox && rectsOverlap(box, stairBox)) continue;
            let clash = false;
            for (const o of openings) {
                if (o.edge !== edge.index) continue;
                if (Math.abs(o.center - c) < (o.width + width) / 2 + 1.4) clash = true;
            }
            if (clash) continue;
            openings.push({ edge: edge.index, center: c, width, kind, x: ox, z: oz, nx: edge.nx, nz: edge.nz });
            return;
        }
    };
    const others = edges.filter((e) => e.index !== 0 && e.length >= 4.5);
    if (others.length > 0 && rngChance(rng, 0.5)) {
        const farFirst = others.slice().sort((a, b) => b.z1 + b.z2 - (a.z1 + a.z2));
        tryAdd(rngChance(rng, 0.6) ? farFirst[0] : rngPick(rng, others), 'back', DOOR_WIDTH);
    }
    const breaches = Math.floor(decay * 2.4 * rng() * 1.2);
    const eligible = edges.filter((e) => e.length >= 3.6);
    for (let i = 0; i < breaches; i++) tryAdd(rngPick(rng, eligible), 'breach', rngRange(rng, 2.0, 3.0));
    void footprint;
    return openings;
}

function makeWindows(rng: Rng, edges: PolygonEdge[], openings: LocalOpening[], plans: FloorPlan[], floors: number, usage: Usage, decay: number): WindowSpec[][] {
    const result: WindowSpec[][] = [];
    for (let f = 0; f < floors; f++) {
        const list: WindowSpec[] = [];
        const blockedByWall: { edge: number; pos: number }[] = [];
        for (const w of plans[f].walls) {
            for (const edge of edges) {
                for (const pt of [{ x: w.x1, z: w.z1 }, { x: w.x2, z: w.z2 }]) {
                    const rel = (pt.x - edge.x1) * edge.ux + (pt.z - edge.z1) * edge.uz;
                    const off = Math.abs((pt.x - edge.x1) * edge.nx + (pt.z - edge.z1) * edge.nz);
                    if (off < 0.25 && rel > -0.1 && rel < edge.length + 0.1) blockedByWall.push({ edge: edge.index, pos: rel });
                }
            }
        }
        for (const edge of edges) {
            if (edge.length < 3.2) continue;
            const shop = usage === 'shop' && f === 0;
            const width = shop ? 2.4 : 1.25;
            const spacing = shop ? 3.4 : 3.1;
            const usable = edge.length - 2.2;
            const count = Math.max(1, Math.floor(usable / spacing));
            const gap = usable / count;
            for (let i = 0; i < count; i++) {
                const center = 1.1 + gap * (i + 0.5);
                let skip = false;
                if (f === 0) {
                    for (const o of openings) if (o.edge === edge.index && Math.abs(o.center - center) < (o.width + width) / 2 + 0.55) skip = true;
                }
                for (const b of blockedByWall) if (b.edge === edge.index && Math.abs(b.pos - center) < width / 2 + 0.3) skip = true;
                if (skip) continue;
                if (rngChance(rng, decay * 0.12)) continue;
                list.push({ edge: edge.index, center, width, sill: shop ? 0.5 : 0.95, height: shop ? 1.9 : 1.35 });
            }
        }
        result.push(list);
    }
    return result;
}

function decayFor(room: Room, openings: LocalOpening[], decay: number): number {
    let d = decay * 0.6;
    for (const o of openings) {
        if (o.kind === 'breach' && o.x > room.minX - 0.5 && o.x < room.maxX + 0.5 && o.z > room.minZ - 0.5 && o.z < room.maxZ + 0.5) d += 0.6;
    }
    return Math.min(1.4, d);
}

export type PlanParams = { seed: number; maxW: number; maxD: number; centerFactor: number; forceFloors?: number };

export function generatePlan(params: PlanParams): BuildingPlan {
    const rng = createRng(params.seed);
    const footprint = buildFootprint(rng, params.maxW, params.maxD);
    const edges = polygonEdges(footprint.polygon);
    const main = footprint.zones[0];
    const frontDoorX = (main.minX + main.maxX) / 2;
    const stair = placeStair(rng, footprint, frontDoorX);

    const roll = rng() + params.centerFactor * 0.25;
    let floors = roll < 0.32 ? 1 : roll < 0.72 ? 2 : 3;
    if (params.forceFloors) floors = params.forceFloors;
    if (!stair) floors = 1;
    const decay = rngRange(rng, 0.25, 1.0) * (1.15 - params.centerFactor * 0.45);
    const area = footprint.zones.reduce((a, z) => a + zoneWidth(z) * zoneDepth(z), 0);
    const usage = pickUsage(rng, area, floors);
    if (usage === 'warehouse') floors = 1;

    const openings = makeOpenings(rng, footprint, edges, stair, decay);
    const anchors = openings.map((o) => ({ x: o.x, z: o.z }));
    const frontDoor = { x: openings[0].x, z: openings[0].z };
    const stairBox = stair ? expandRect(stair.rect, 0) : null;
    const flights = stair ? localFlights(stair, floors) : [];

    const plans: FloorPlan[] = [];
    const furniture: FurniturePiece[][] = [];
    for (let f = 0; f < floors; f++) {
        const plan = buildFloorPlan(rng, footprint, { floor: f, floors, usage, stair: stairBox, anchors, frontDoor });
        plans.push(plan);
        const blockers: ZoneRect[] = [];
        if (stairBox) blockers.push(expandRect(stairBox, 0.45));
        for (const d of plan.doorways) {
            const h = d.width / 2 + 0.55;
            blockers.push(d.along === 'z' ? { minX: d.x - 1.0, maxX: d.x + 1.0, minZ: d.z - h, maxZ: d.z + h } : { minX: d.x - h, maxX: d.x + h, minZ: d.z - 1.0, maxZ: d.z + 1.0 });
        }
        if (f === 0) {
            for (const o of openings) {
                const half = o.width / 2 + 0.4;
                blockers.push({ minX: o.x - Math.abs(o.nz) * half - Math.abs(o.nx) * 1.5, maxX: o.x + Math.abs(o.nz) * half + Math.abs(o.nx) * 1.5, minZ: o.z - Math.abs(o.nx) * half - Math.abs(o.nz) * 1.5, maxZ: o.z + Math.abs(o.nx) * half + Math.abs(o.nz) * 1.5 });
            }
        }
        for (const fl of flights) {
            if (fl.from === f || fl.to === f) blockers.push(expandRect(fl.rect, 0.5));
        }
        const pieces: FurniturePiece[] = [];
        for (const room of plan.rooms) {
            const local = furnishRoom(rng, room, blockers, decayFor(room, openings, decay));
            for (const p of local) pieces.push(p);
        }
        furniture.push(pieces);
    }

    const outerWalls: WallSegment[][] = [];
    for (let f = 0; f < floors; f++) {
        const list: WallSegment[] = [];
        for (const edge of edges) {
            const seg: WallSegment = { x1: edge.x1, z1: edge.z1, x2: edge.x2, z2: edge.z2 };
            const gaps = f === 0 ? openings.filter((o) => o.edge === edge.index).map((o) => ({ lo: o.center - o.width / 2, hi: o.center + o.width / 2 })) : [];
            for (const piece of cutSegment(seg, gaps)) list.push(piece);
        }
        outerWalls.push(list);
    }

    const windows = makeWindows(rng, edges, openings, plans, floors, usage, decay);
    const style = buildStyle(rng, floors);

    let collapse: ZoneRect | null = null;
    if (decay > 0.7 && rngChance(rng, 0.55)) {
        const z = rngPick(rng, footprint.zones);
        const w = Math.min(zoneWidth(z) - 2, rngRange(rng, 3, 5.5));
        const d = Math.min(zoneDepth(z) - 2, rngRange(rng, 3, 5.5));
        if (w > 1.5 && d > 1.5) {
            const x0 = z.minX + 1 + (zoneWidth(z) - 2 - w) * rng();
            const z0 = z.minZ + 1 + (zoneDepth(z) - 2 - d) * rng();
            collapse = { minX: x0, maxX: x0 + w, minZ: z0, maxZ: z0 + d };
            if (stair && rectsOverlap(collapse, expandRect(stair.rect, 1.5))) collapse = null;
        }
    }

    return { seed: params.seed, usage, floors, decay, footprint, edges, stair, plans, furniture, openings, outerWalls, windows, style, collapse };
}

export type WorldRoom = ZoneRect & { id: number; type: RoomType; floor: number };
export type WorldDoorway = { x: number; z: number; along: 'x' | 'z'; width: number; floor: number };
export type FurnitureBox = ZoneRect & { floor: number; kind: FurnitureKind };
export type Flight = { rect: ZoneRect; axis: 'x' | 'z'; start: number; end: number; from: number; to: number };
export type Entrance = { x: number; z: number; nx: number; nz: number; width: number; kind: 'door' | 'back' | 'breach' };

export type BuildingDef = {
    index: number;
    lotX: number;
    lotZ: number;
    x: number;
    z: number;
    rot: number;
    angle: number;
    baseY: number;
    floors: number;
    usage: Usage;
    decay: number;
    bounds: ZoneRect;
    radius: number;
    polygon: Point2[];
    plan: BuildingPlan;
    rooms: WorldRoom[][];
    walls: WallSegment[][];
    doorways: WorldDoorway[][];
    boxes: FurnitureBox[][];
    flights: Flight[];
    stairRect: ZoneRect | null;
    entrances: Entrance[];
};

export type PlaceParams = { index: number; lotX: number; lotZ: number; x: number; z: number; rot: number; baseY: number };

export function placeBuilding(plan: BuildingPlan, p: PlaceParams): BuildingDef {
    const rot = p.rot;
    const tx = (x: number, z: number) => rotX(x, z, rot) + p.x;
    const tz = (x: number, z: number) => rotZ(x, z, rot) + p.z;
    const rect = (r: ZoneRect) => rotateRect(r, rot, p.x, p.z);
    const seg = (s: WallSegment) => rotateSegment(s, rot, p.x, p.z);
    const swap = rot & 1;

    const polygon: Point2[] = plan.footprint.polygon.map((pt) => ({ x: tx(pt.x, pt.z), z: tz(pt.x, pt.z) }));
    const bounds = rect(plan.footprint.bounds);
    let radius = 0;
    for (const pt of plan.footprint.polygon) radius = Math.max(radius, Math.hypot(pt.x, pt.z));

    const rooms: WorldRoom[][] = plan.plans.map((fp) => fp.rooms.map((r) => ({ ...rect(r), id: r.id, type: r.type, floor: r.floor })));
    const walls: WallSegment[][] = [];
    const doorways: WorldDoorway[][] = [];
    const boxes: FurnitureBox[][] = [];
    for (let f = 0; f < plan.floors; f++) {
        const list: WallSegment[] = [];
        for (const w of plan.outerWalls[f]) list.push(seg(w));
        for (const w of plan.plans[f].walls) list.push(seg(w));
        walls.push(list);
        doorways.push(
            plan.plans[f].doorways.map((d) => ({ x: tx(d.x, d.z), z: tz(d.x, d.z), along: swap ? (d.along === 'x' ? 'z' : 'x') : d.along, width: d.width, floor: f }))
        );
        const fb: FurnitureBox[] = [];
        for (const piece of plan.furniture[f]) {
            if (!piece.solid) continue;
            fb.push({ ...rotateRect(pieceBounds(piece.kind, piece.x, piece.z, piece.rot), rot, p.x, p.z), floor: f, kind: piece.kind });
        }
        boxes.push(fb);
    }

    const flights: Flight[] = [];
    let stairRect: ZoneRect | null = null;
    if (plan.stair) {
        stairRect = rect(plan.stair.rect);
        for (const fl of localFlights(plan.stair, plan.floors)) {
            const cx = (fl.rect.minX + fl.rect.maxX) / 2;
            const cz = (fl.rect.minZ + fl.rect.maxZ) / 2;
            const sx = fl.axis === 'x' ? fl.start : cx;
            const sz = fl.axis === 'z' ? fl.start : cz;
            const ex = fl.axis === 'x' ? fl.end : cx;
            const ez = fl.axis === 'z' ? fl.end : cz;
            const wsx = tx(sx, sz);
            const wsz = tz(sx, sz);
            const wex = tx(ex, ez);
            const wez = tz(ex, ez);
            const axis: 'x' | 'z' = swap ? (fl.axis === 'x' ? 'z' : 'x') : fl.axis;
            flights.push({ rect: rect(fl.rect), axis, start: axis === 'x' ? wsx : wsz, end: axis === 'x' ? wex : wez, from: fl.from, to: fl.to });
        }
    }

    const entrances: Entrance[] = plan.openings.map((o) => ({
        x: tx(o.x, o.z),
        z: tz(o.x, o.z),
        nx: rotX(o.nx, o.nz, rot),
        nz: rotZ(o.nx, o.nz, rot),
        width: o.width,
        kind: o.kind,
    }));

    return {
        index: p.index,
        lotX: p.lotX,
        lotZ: p.lotZ,
        x: p.x,
        z: p.z,
        rot,
        angle: (rot * Math.PI) / 2,
        baseY: p.baseY,
        floors: plan.floors,
        usage: plan.usage,
        decay: plan.decay,
        bounds,
        radius: radius + 1,
        polygon,
        plan,
        rooms,
        walls,
        doorways,
        boxes,
        flights,
        stairRect,
        entrances,
    };
}

export function floorTopY(def: BuildingDef, floor: number): number {
    return def.baseY + floor * FLOOR_HEIGHT;
}

export function randomLootPoints(def: BuildingDef, rng: Rng, floor: number, count: number): { x: number; z: number; floor: number }[] {
    const out: { x: number; z: number; floor: number }[] = [];
    const rooms = def.rooms[floor].filter((r) => zoneWidth(r) > 2 && zoneDepth(r) > 2);
    if (rooms.length === 0) return out;
    let attempts = 0;
    while (out.length < count && attempts < count * 24) {
        attempts++;
        const r = rngPick(rng, rooms);
        const x = r.minX + 0.7 + rng() * (zoneWidth(r) - 1.4);
        const z = r.minZ + 0.7 + rng() * (zoneDepth(r) - 1.4);
        let ok = true;
        for (const b of def.boxes[floor]) {
            if (x > b.minX - 0.45 && x < b.maxX + 0.45 && z > b.minZ - 0.45 && z < b.maxZ + 0.45) {
                ok = false;
                break;
            }
        }
        if (def.stairRect && x > def.stairRect.minX - 0.5 && x < def.stairRect.maxX + 0.5 && z > def.stairRect.minZ - 0.5 && z < def.stairRect.maxZ + 0.5) ok = false;
        if (ok) out.push({ x, z, floor });
    }
    return out;
}

export function planRoomCount(plan: BuildingPlan): number {
    return plan.plans.reduce((a, p) => a + p.rooms.length, 0);
}

export function randomFloorSeed(rng: Rng): number {
    return rngInt(rng, 1, 2147483000);
}
