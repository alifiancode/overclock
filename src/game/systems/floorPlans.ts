import { rngChance, rngRange, type Rng } from './random.ts';
import { cutSegment, expandRect, rectsOverlap, zoneArea, zoneDepth, zoneWidth, type FootprintResult, type WallSegment, type ZoneRect } from './buildingShapes.ts';

export type RoomType =
    | 'living'
    | 'kitchen'
    | 'dining'
    | 'bedroom'
    | 'bathroom'
    | 'storage'
    | 'entry'
    | 'office'
    | 'hall'
    | 'shop'
    | 'utility'
    | 'warehouse';

export type Usage = 'residential' | 'office' | 'shop' | 'warehouse';
export type PlanTemplate = 'open' | 'bsp' | 'corridor' | 'suite';

export type Room = ZoneRect & { id: number; type: RoomType; floor: number; zone: number; fixed: boolean };
export type Doorway = { x: number; z: number; along: 'x' | 'z'; width: number; roomA: number; roomB: number; floor: number };
export type FloorPlan = { floor: number; template: PlanTemplate; rooms: Room[]; walls: WallSegment[]; doorways: Doorway[] };

type Cut = { along: 'x' | 'z'; coord: number; lo: number; hi: number };
type Anchor = { x: number; z: number };
type Edge = { a: number; b: number; along: 'x' | 'z'; coord: number; lo: number; hi: number; weight: number };

export const DOORWAY_WIDTH = 1.3;
const MIN_ROOM = 3.1;
const STAIR_MARGIN = 0.75;
const ANCHOR_CLEARANCE = 1.7;

type Context = { rng: Rng; stair: ZoneRect | null; anchors: Anchor[]; cuts: Cut[]; ignore: Anchor | null };

function distPointToCut(px: number, pz: number, cut: Cut): number {
    if (cut.along === 'z') {
        const z = Math.max(cut.lo, Math.min(cut.hi, pz));
        return Math.hypot(px - cut.coord, pz - z);
    }
    const x = Math.max(cut.lo, Math.min(cut.hi, px));
    return Math.hypot(px - x, pz - cut.coord);
}

function cutConflicts(ctx: Context, cut: Cut): boolean {
    const s = ctx.stair;
    if (s) {
        if (cut.along === 'z') {
            if (cut.coord > s.minX - STAIR_MARGIN && cut.coord < s.maxX + STAIR_MARGIN && cut.hi > s.minZ - STAIR_MARGIN && cut.lo < s.maxZ + STAIR_MARGIN) return true;
        } else if (cut.coord > s.minZ - STAIR_MARGIN && cut.coord < s.maxZ + STAIR_MARGIN && cut.hi > s.minX - STAIR_MARGIN && cut.lo < s.maxX + STAIR_MARGIN) {
            return true;
        }
    }
    for (const a of ctx.anchors) {
        if (a === ctx.ignore) continue;
        if (distPointToCut(a.x, a.z, cut) < ANCHOR_CLEARANCE) return true;
    }
    return false;
}

function bsp(ctx: Context, rect: ZoneRect, target: number, leaves: ZoneRect[], depth: number) {
    const w = zoneWidth(rect);
    const d = zoneDepth(rect);
    const canX = w >= MIN_ROOM * 2;
    const canZ = d >= MIN_ROOM * 2;
    if ((!canX && !canZ) || w * d <= target || depth > 5 || (depth > 0 && ctx.rng() < 0.07)) {
        leaves.push(rect);
        return;
    }
    let first: 'x' | 'z' = w > d * 1.15 ? 'x' : d > w * 1.15 ? 'z' : ctx.rng() < 0.5 ? 'x' : 'z';
    if (first === 'x' && !canX) first = 'z';
    if (first === 'z' && !canZ) first = 'x';
    const order: ('x' | 'z')[] = first === 'x' ? ['x', 'z'] : ['z', 'x'];
    for (const axis of order) {
        if (axis === 'x' && !canX) continue;
        if (axis === 'z' && !canZ) continue;
        for (let attempt = 0; attempt < 7; attempt++) {
            const t = rngRange(ctx.rng, 0.28, 0.72);
            if (axis === 'x') {
                const c = rect.minX + MIN_ROOM + (w - MIN_ROOM * 2) * t;
                const cut: Cut = { along: 'z', coord: c, lo: rect.minZ, hi: rect.maxZ };
                if (cutConflicts(ctx, cut)) continue;
                ctx.cuts.push(cut);
                bsp(ctx, { minX: rect.minX, maxX: c, minZ: rect.minZ, maxZ: rect.maxZ }, target, leaves, depth + 1);
                bsp(ctx, { minX: c, maxX: rect.maxX, minZ: rect.minZ, maxZ: rect.maxZ }, target, leaves, depth + 1);
                return;
            }
            const c = rect.minZ + MIN_ROOM + (d - MIN_ROOM * 2) * t;
            const cut: Cut = { along: 'x', coord: c, lo: rect.minX, hi: rect.maxX };
            if (cutConflicts(ctx, cut)) continue;
            ctx.cuts.push(cut);
            bsp(ctx, { minX: rect.minX, maxX: rect.maxX, minZ: rect.minZ, maxZ: c }, target, leaves, depth + 1);
            bsp(ctx, { minX: rect.minX, maxX: rect.maxX, minZ: c, maxZ: rect.maxZ }, target, leaves, depth + 1);
            return;
        }
    }
    leaves.push(rect);
}

function corridorSplit(ctx: Context, zone: ZoneRect, hallWidth: number, centerOn: number | null): { hall: ZoneRect; sides: ZoneRect[] } | null {
    const w = zoneWidth(zone);
    const d = zoneDepth(zone);
    const alongZ = d >= w;
    const span = alongZ ? w : d;
    if (span < MIN_ROOM * 2 + hallWidth) return null;
    const lo = alongZ ? zone.minX : zone.minZ;
    for (let attempt = 0; attempt < 10; attempt++) {
        let c0: number;
        if (attempt === 0 && centerOn !== null && alongZ) {
            c0 = Math.max(lo + MIN_ROOM, Math.min(lo + span - MIN_ROOM - hallWidth, centerOn - hallWidth / 2));
        } else {
            c0 = lo + MIN_ROOM + (span - MIN_ROOM * 2 - hallWidth) * rngRange(ctx.rng, 0.25, 0.75);
        }
        const c1 = c0 + hallWidth;
        const cutA: Cut = alongZ ? { along: 'z', coord: c0, lo: zone.minZ, hi: zone.maxZ } : { along: 'x', coord: c0, lo: zone.minX, hi: zone.maxX };
        const cutB: Cut = alongZ ? { along: 'z', coord: c1, lo: zone.minZ, hi: zone.maxZ } : { along: 'x', coord: c1, lo: zone.minX, hi: zone.maxX };
        const saved = ctx.ignore;
        if (attempt === 0 && centerOn !== null && alongZ) ctx.ignore = ctx.anchors.find((a) => Math.abs(a.x - centerOn) < 0.01) ?? null;
        const bad = cutConflicts(ctx, cutA) || cutConflicts(ctx, cutB);
        ctx.ignore = saved;
        if (bad) continue;
        ctx.cuts.push(cutA, cutB);
        if (alongZ) {
            return {
                hall: { minX: c0, maxX: c1, minZ: zone.minZ, maxZ: zone.maxZ },
                sides: [
                    { minX: zone.minX, maxX: c0, minZ: zone.minZ, maxZ: zone.maxZ },
                    { minX: c1, maxX: zone.maxX, minZ: zone.minZ, maxZ: zone.maxZ },
                ],
            };
        }
        return {
            hall: { minX: zone.minX, maxX: zone.maxX, minZ: c0, maxZ: c1 },
            sides: [
                { minX: zone.minX, maxX: zone.maxX, minZ: zone.minZ, maxZ: c0 },
                { minX: zone.minX, maxX: zone.maxX, minZ: c1, maxZ: zone.maxZ },
            ],
        };
    }
    return null;
}

function findEdges(rooms: Room[], minOverlap: number): Edge[] {
    const edges: Edge[] = [];
    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const a = rooms[i];
            const b = rooms[j];
            const zlo = Math.max(a.minZ, b.minZ);
            const zhi = Math.min(a.maxZ, b.maxZ);
            const xlo = Math.max(a.minX, b.minX);
            const xhi = Math.min(a.maxX, b.maxX);
            if (zhi - zlo >= minOverlap) {
                if (Math.abs(a.maxX - b.minX) < 0.01) edges.push({ a: i, b: j, along: 'z', coord: a.maxX, lo: zlo, hi: zhi, weight: 0 });
                else if (Math.abs(b.maxX - a.minX) < 0.01) edges.push({ a: i, b: j, along: 'z', coord: a.minX, lo: zlo, hi: zhi, weight: 0 });
            }
            if (xhi - xlo >= minOverlap) {
                if (Math.abs(a.maxZ - b.minZ) < 0.01) edges.push({ a: i, b: j, along: 'x', coord: a.maxZ, lo: xlo, hi: xhi, weight: 0 });
                else if (Math.abs(b.maxZ - a.minZ) < 0.01) edges.push({ a: i, b: j, along: 'x', coord: a.minZ, lo: xlo, hi: xhi, weight: 0 });
            }
        }
    }
    return edges;
}

function find(parent: number[], i: number): number {
    while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
    }
    return i;
}

function doorRect(along: 'x' | 'z', coord: number, center: number, width: number): ZoneRect {
    const h = width / 2 + 0.2;
    return along === 'z' ? { minX: coord - 0.9, maxX: coord + 0.9, minZ: center - h, maxZ: center + h } : { minX: center - h, maxX: center + h, minZ: coord - 0.9, maxZ: coord + 0.9 };
}

function placeDoor(rng: Rng, edge: Edge, stair: ZoneRect | null, taken: Doorway[], mustPlace: boolean): { center: number; width: number } | null {
    const overlap = edge.hi - edge.lo;
    const width = Math.min(DOORWAY_WIDTH, overlap - 0.4);
    if (width < 0.9) return null;
    const lo = edge.lo + width / 2 + 0.2;
    const hi = edge.hi - width / 2 - 0.2;
    const stairBox = stair ? expandRect(stair, 0.35) : null;
    let fallback: number | null = null;
    for (let attempt = 0; attempt < 12; attempt++) {
        const center = hi - lo < 0.1 ? (edge.lo + edge.hi) / 2 : rngRange(rng, lo, hi);
        fallback = center;
        const box = doorRect(edge.along, edge.coord, center, width);
        if (stairBox && rectsOverlap(box, stairBox)) continue;
        let clash = false;
        for (const t of taken) {
            if (rectsOverlap(box, doorRect(t.along, t.along === 'z' ? t.x : t.z, t.along === 'z' ? t.z : t.x, t.width), -0.1)) {
                clash = true;
                break;
            }
        }
        if (clash) continue;
        return { center, width };
    }
    return mustPlace && fallback !== null ? { center: fallback, width } : null;
}

function typeBucket(usage: Usage, floor: number): RoomType[] {
    if (usage === 'office') {
        return floor === 0 ? ['entry', 'office', 'office', 'kitchen', 'storage', 'office'] : ['office', 'office', 'office', 'kitchen', 'office', 'storage'];
    }
    if (usage === 'shop') {
        return floor === 0 ? ['shop', 'storage', 'office', 'utility', 'shop'] : ['bedroom', 'living', 'kitchen', 'bedroom', 'office', 'storage'];
    }
    if (usage === 'warehouse') return ['warehouse', 'office', 'storage', 'utility', 'warehouse'];
    return floor === 0 ? ['living', 'kitchen', 'dining', 'bedroom', 'office', 'storage'] : ['bedroom', 'living', 'bedroom', 'kitchen', 'office', 'bedroom', 'storage'];
}

function assignTypes(rng: Rng, rooms: Room[], floor: number, usage: Usage, frontRoom: number) {
    const free = rooms.filter((r) => !r.fixed).sort((a, b) => zoneArea(b) - zoneArea(a));
    if (free.length === 0) return;
    if (free.length === 1) {
        free[0].type = typeBucket(usage, floor)[0];
        return;
    }
    const bucket = typeBucket(usage, floor);
    let bath: Room | null = null;
    if (free.length >= 3 && usage !== 'warehouse') {
        bath = free[free.length - 1];
        bath.type = 'bathroom';
        free.pop();
    }
    if (free.length >= 5 && usage !== 'warehouse' && rngChance(rng, 0.65)) {
        const second = free[free.length - 1];
        second.type = rngChance(rng, 0.5) ? 'bathroom' : 'storage';
        free.pop();
    }
    for (let i = 0; i < free.length; i++) free[i].type = i < bucket.length ? bucket[i] : bucket[1 + Math.floor(rng() * (bucket.length - 1))];
    if (free.length > 2 && rngChance(rng, 0.3)) {
        const a = 1 + Math.floor(rng() * (free.length - 1));
        const b = 1 + Math.floor(rng() * (free.length - 1));
        const tmp = free[a].type;
        free[a].type = free[b].type;
        free[b].type = tmp;
    }
    if (floor === 0 && frontRoom >= 0) {
        const fr = rooms[frontRoom];
        if (!fr.fixed && usage === 'residential' && fr.type !== 'living' && zoneArea(fr) < 24) fr.type = 'entry';
        if (!fr.fixed && usage === 'residential' && fr.type === 'bathroom') fr.type = 'entry';
    }
}

export type FloorPlanOptions = {
    floor: number;
    floors: number;
    usage: Usage;
    stair: ZoneRect | null;
    anchors: Anchor[];
    frontDoor: Anchor | null;
};

function chooseTemplate(rng: Rng, floor: number, usage: Usage, mainArea: number): PlanTemplate {
    const roll = rng();
    if (usage === 'warehouse') return roll < 0.8 ? 'open' : 'bsp';
    if (usage === 'shop' && floor === 0) return roll < 0.45 ? 'open' : roll < 0.8 ? 'bsp' : 'corridor';
    if (mainArea < 110) return roll < 0.18 ? 'open' : 'bsp';
    if (floor === 0) return roll < 0.14 ? 'open' : roll < 0.58 ? 'bsp' : roll < 0.9 ? 'corridor' : 'suite';
    return roll < 0.1 ? 'open' : roll < 0.4 ? 'bsp' : roll < 0.85 ? 'corridor' : 'suite';
}

export function buildFloorPlan(rng: Rng, footprint: FootprintResult, opts: FloorPlanOptions): FloorPlan {
    const ctx: Context = { rng, stair: opts.stair, anchors: opts.floor === 0 ? opts.anchors : [], cuts: [], ignore: null };
    const main = footprint.zones[0];
    const template = chooseTemplate(rng, opts.floor, opts.usage, zoneArea(main));
    const rooms: Room[] = [];
    let nextId = 0;
    const addRoom = (rect: ZoneRect, zone: number, type: RoomType, fixed: boolean) => {
        rooms.push({ ...rect, id: nextId++, type, floor: opts.floor, zone, fixed });
    };

    const mainLeaves: ZoneRect[] = [];
    let hallRect: ZoneRect | null = null;
    let used: PlanTemplate = template;
    if (template === 'open') {
        mainLeaves.push(main);
    } else if (template === 'corridor') {
        const front = opts.floor === 0 ? opts.frontDoor : null;
        const split = corridorSplit(ctx, main, rngRange(rng, 1.8, 2.3), front ? front.x : null);
        if (split) {
            hallRect = split.hall;
            const target = rngRange(rng, 24, 40);
            for (const side of split.sides) bsp(ctx, side, target, mainLeaves, 1);
        } else {
            used = 'bsp';
            bsp(ctx, main, rngRange(rng, 22, 40), mainLeaves, 0);
        }
    } else if (template === 'suite') {
        bsp(ctx, main, rngRange(rng, 55, 85), mainLeaves, 0);
    } else {
        bsp(ctx, main, rngRange(rng, 20, 38), mainLeaves, 0);
    }
    if (hallRect) addRoom(hallRect, 0, 'hall', true);
    for (const leaf of mainLeaves) addRoom(leaf, 0, 'living', false);

    for (let i = 1; i < footprint.zones.length; i++) {
        const zone = footprint.zones[i];
        const area = zoneArea(zone);
        if (area <= 52 || used === 'open') {
            addRoom(zone, i, 'living', false);
        } else {
            const leaves: ZoneRect[] = [];
            bsp(ctx, zone, rngRange(rng, 30, 48), leaves, 0);
            for (const leaf of leaves) addRoom(leaf, i, 'living', false);
        }
    }

    const neckCuts: Cut[] = footprint.necks.map((n) => (n.x1 === n.x2 ? { along: 'z', coord: n.x1, lo: Math.min(n.z1, n.z2), hi: Math.max(n.z1, n.z2) } : { along: 'x', coord: n.z1, lo: Math.min(n.x1, n.x2), hi: Math.max(n.x1, n.x2) }));
    const allCuts = [...ctx.cuts, ...neckCuts];

    let edges = findEdges(rooms, 1.7);
    const parentCheck = (list: Edge[]): boolean => {
        const parent = rooms.map((_, i) => i);
        for (const e of list) parent[find(parent, e.a)] = find(parent, e.b);
        const root = find(parent, 0);
        return rooms.every((_, i) => find(parent, i) === root);
    };
    if (!parentCheck(edges)) edges = findEdges(rooms, 1.25);

    for (const e of edges) {
        const ra = rooms[e.a];
        const rb = rooms[e.b];
        let w = rng();
        if (ra.type === 'hall' || rb.type === 'hall') w -= 0.7;
        if (ra.zone !== rb.zone) w -= 0.25;
        e.weight = w;
    }
    edges.sort((x, y) => x.weight - y.weight);

    const parent = rooms.map((_, i) => i);
    const chosen: Edge[] = [];
    const spare: Edge[] = [];
    for (const e of edges) {
        const ra = find(parent, e.a);
        const rb = find(parent, e.b);
        if (ra !== rb) {
            parent[ra] = rb;
            chosen.push(e);
        } else {
            spare.push(e);
        }
    }
    const treeCount = chosen.length;
    for (const e of spare) {
        if (rooms[e.a].type === 'hall' && rooms[e.b].type === 'hall') continue;
        if (rngChance(rng, used === 'open' ? 0.5 : 0.24)) chosen.push(e);
    }

    const doorways: Doorway[] = [];
    for (let ci = 0; ci < chosen.length; ci++) {
        const e = chosen[ci];
        const placed = placeDoor(rng, e, opts.stair, doorways, ci < treeCount);
        if (!placed) continue;
        doorways.push({
            x: e.along === 'z' ? e.coord : placed.center,
            z: e.along === 'z' ? placed.center : e.coord,
            along: e.along,
            width: placed.width,
            roomA: e.a,
            roomB: e.b,
            floor: opts.floor,
        });
    }

    const walls: WallSegment[] = [];
    for (const cut of allCuts) {
        const seg: WallSegment = cut.along === 'z' ? { x1: cut.coord, z1: cut.lo, x2: cut.coord, z2: cut.hi } : { x1: cut.lo, z1: cut.coord, x2: cut.hi, z2: cut.coord };
        const gaps: { lo: number; hi: number }[] = [];
        for (const d of doorways) {
            if (d.along !== cut.along) continue;
            const coord = d.along === 'z' ? d.x : d.z;
            const center = d.along === 'z' ? d.z : d.x;
            if (Math.abs(coord - cut.coord) > 0.01) continue;
            if (center < cut.lo - 0.01 || center > cut.hi + 0.01) continue;
            gaps.push({ lo: center - d.width / 2 - cut.lo, hi: center + d.width / 2 - cut.lo });
        }
        for (const piece of cutSegment(seg, gaps)) walls.push(piece);
    }

    let frontRoom = -1;
    if (opts.frontDoor && opts.floor === 0) {
        const p = opts.frontDoor;
        frontRoom = rooms.findIndex((r) => p.x > r.minX - 0.01 && p.x < r.maxX + 0.01 && p.z > r.minZ - 0.01 && p.z < r.maxZ + 0.01 && !r.fixed);
        if (frontRoom < 0) frontRoom = rooms.findIndex((r) => p.x > r.minX - 0.01 && p.x < r.maxX + 0.01 && p.z > r.minZ - 0.01 && p.z < r.maxZ + 0.01);
    }
    assignTypes(rng, rooms, opts.floor, opts.usage, frontRoom);
    return { floor: opts.floor, template: used, rooms, walls, doorways };
}
