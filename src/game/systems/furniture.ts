import { rngRange, type Rng } from './random.ts';
import { expandRect, rectsOverlap, zoneArea, zoneCenterX, zoneCenterZ, zoneDepth, zoneWidth, type ZoneRect } from './buildingShapes.ts';
import type { Room } from './floorPlans.ts';

export type FurnitureSpec = { w: number; d: number; h: number; solid: boolean };

export const FURNITURE_SPECS = {
    sofa: { w: 2.1, d: 0.95, h: 0.9, solid: true },
    armchair: { w: 0.95, d: 0.95, h: 0.95, solid: true },
    coffeeTable: { w: 1.2, d: 0.65, h: 0.45, solid: true },
    tv: { w: 1.5, d: 0.45, h: 1.25, solid: true },
    bookshelf: { w: 1.1, d: 0.38, h: 1.95, solid: true },
    rug: { w: 2.4, d: 1.7, h: 0.03, solid: false },
    bedDouble: { w: 1.7, d: 2.1, h: 0.7, solid: true },
    bedSingle: { w: 1.05, d: 2.0, h: 0.62, solid: true },
    nightstand: { w: 0.5, d: 0.45, h: 0.55, solid: true },
    wardrobe: { w: 1.4, d: 0.6, h: 2.15, solid: true },
    dresser: { w: 1.2, d: 0.5, h: 0.95, solid: true },
    desk: { w: 1.4, d: 0.72, h: 0.78, solid: true },
    chair: { w: 0.5, d: 0.5, h: 0.92, solid: false },
    officeChair: { w: 0.56, d: 0.56, h: 1.0, solid: false },
    counter: { w: 1.2, d: 0.65, h: 0.92, solid: true },
    kitchenSink: { w: 1.4, d: 0.65, h: 0.92, solid: true },
    stove: { w: 0.75, d: 0.65, h: 0.92, solid: true },
    fridge: { w: 0.8, d: 0.72, h: 1.85, solid: true },
    diningTable: { w: 1.7, d: 0.95, h: 0.76, solid: true },
    toilet: { w: 0.45, d: 0.72, h: 0.8, solid: true },
    bathSink: { w: 0.62, d: 0.45, h: 0.88, solid: true },
    bathtub: { w: 1.75, d: 0.82, h: 0.6, solid: true },
    shower: { w: 0.95, d: 0.95, h: 2.1, solid: true },
    washer: { w: 0.66, d: 0.66, h: 0.9, solid: true },
    crate: { w: 0.8, d: 0.8, h: 0.8, solid: true },
    crateStack: { w: 0.9, d: 0.9, h: 1.6, solid: true },
    barrel: { w: 0.62, d: 0.62, h: 0.95, solid: true },
    metalShelf: { w: 1.5, d: 0.5, h: 2.0, solid: true },
    cabinet: { w: 0.9, d: 0.55, h: 1.0, solid: true },
    filing: { w: 0.5, d: 0.62, h: 1.35, solid: true },
    shopCounter: { w: 2.4, d: 0.8, h: 1.05, solid: true },
    shopShelf: { w: 1.8, d: 0.55, h: 1.75, solid: true },
    freezer: { w: 1.5, d: 0.8, h: 1.0, solid: true },
    plant: { w: 0.55, d: 0.55, h: 1.3, solid: true },
    lamp: { w: 0.4, d: 0.4, h: 1.7, solid: false },
    piano: { w: 1.55, d: 0.7, h: 1.25, solid: true },
    bench: { w: 1.4, d: 0.45, h: 0.5, solid: true },
    coatRack: { w: 0.4, d: 0.4, h: 1.75, solid: false },
    debris: { w: 1.1, d: 1.1, h: 0.35, solid: false },
    pillar: { w: 0.55, d: 0.55, h: 3.0, solid: true },
    conferenceTable: { w: 3.2, d: 1.3, h: 0.78, solid: true },
    whiteboard: { w: 1.8, d: 0.08, h: 1.1, solid: false },
    boiler: { w: 0.8, d: 0.8, h: 1.6, solid: true },
} satisfies Record<string, FurnitureSpec>;

export type FurnitureKind = keyof typeof FURNITURE_SPECS;

export type FurniturePiece = {
    kind: FurnitureKind;
    x: number;
    z: number;
    rot: number;
    floor: number;
    w: number;
    d: number;
    h: number;
    solid: boolean;
    variant: number;
    room: number;
};

export function pieceBounds(kind: FurnitureKind, x: number, z: number, rot: number): ZoneRect {
    const s = FURNITURE_SPECS[kind];
    const quarter = Math.abs(Math.round(rot / (Math.PI / 2))) & 1;
    const hw = (quarter ? s.d : s.w) / 2;
    const hd = (quarter ? s.w : s.d) / 2;
    return { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd };
}

type Side = 'minX' | 'maxX' | 'minZ' | 'maxZ';
const SIDES: Side[] = ['minX', 'maxX', 'minZ', 'maxZ'];
const HALF_PI = Math.PI / 2;

type Ctx = {
    rng: Rng;
    room: Room;
    usable: ZoneRect;
    blockers: ZoneRect[];
    pieces: FurniturePiece[];
    floor: number;
};

function pick<T>(rng: Rng, items: readonly T[]): T {
    return items[Math.floor(rng() * items.length)];
}

function insideUsable(ctx: Ctx, b: ZoneRect): boolean {
    const u = ctx.usable;
    return b.minX >= u.minX - 0.001 && b.maxX <= u.maxX + 0.001 && b.minZ >= u.minZ - 0.001 && b.maxZ <= u.maxZ + 0.001;
}

function blocked(ctx: Ctx, b: ZoneRect): boolean {
    for (const bl of ctx.blockers) if (rectsOverlap(b, bl)) return true;
    return false;
}

function collides(ctx: Ctx, b: ZoneRect, solid: boolean, clearance: number): boolean {
    for (const p of ctx.pieces) {
        if (!solid && p.solid) continue;
        if (solid && !p.solid) continue;
        const pb = pieceBounds(p.kind, p.x, p.z, p.rot);
        if (rectsOverlap(b, pb, (solid ? clearance : 0) - 0.003)) return true;
    }
    return false;
}

function add(ctx: Ctx, kind: FurnitureKind, x: number, z: number, rot: number, clearance: number = 0.4, force: boolean = false): FurniturePiece | null {
    const spec = FURNITURE_SPECS[kind];
    const b = pieceBounds(kind, x, z, rot);
    if (!insideUsable(ctx, b)) return null;
    if (blocked(ctx, b)) return null;
    if (!force && collides(ctx, b, spec.solid, clearance)) return null;
    const piece: FurniturePiece = { kind, x, z, rot, floor: ctx.floor, w: spec.w, d: spec.d, h: spec.h, solid: spec.solid, variant: Math.floor(ctx.rng() * 1000), room: ctx.room.id };
    ctx.pieces.push(piece);
    return piece;
}

function opposite(side: Side): Side {
    return side === 'minX' ? 'maxX' : side === 'maxX' ? 'minX' : side === 'minZ' ? 'maxZ' : 'minZ';
}

function wallSpot(ctx: Ctx, kind: FurnitureKind, side: Side, along: number): { x: number; z: number; rot: number } | null {
    const s = FURNITURE_SPECS[kind];
    const u = ctx.usable;
    if (side === 'minZ' || side === 'maxZ') {
        const lo = u.minX + s.w / 2;
        const hi = u.maxX - s.w / 2;
        if (hi < lo) return null;
        const x = lo + (hi - lo) * along;
        return side === 'minZ' ? { x, z: u.minZ + s.d / 2, rot: 0 } : { x, z: u.maxZ - s.d / 2, rot: Math.PI };
    }
    const lo = u.minZ + s.w / 2;
    const hi = u.maxZ - s.w / 2;
    if (hi < lo) return null;
    const z = lo + (hi - lo) * along;
    return side === 'minX' ? { x: u.minX + s.d / 2, z, rot: HALF_PI } : { x: u.maxX - s.d / 2, z, rot: -HALF_PI };
}

function atWall(ctx: Ctx, kind: FurnitureKind, side: Side, along: number, clearance: number = 0.4): FurniturePiece | null {
    const spot = wallSpot(ctx, kind, side, along);
    if (!spot) return null;
    return add(ctx, kind, spot.x, spot.z, spot.rot, clearance);
}

function anyWall(ctx: Ctx, kind: FurnitureKind, tries: number = 6, clearance: number = 0.4): FurniturePiece | null {
    for (let i = 0; i < tries; i++) {
        const p = atWall(ctx, kind, pick(ctx.rng, SIDES), ctx.rng(), clearance);
        if (p) return p;
    }
    return null;
}

function cornerSpot(ctx: Ctx, kind: FurnitureKind): { x: number; z: number } | null {
    const s = FURNITURE_SPECS[kind];
    const u = ctx.usable;
    const left = ctx.rng() < 0.5;
    const top = ctx.rng() < 0.5;
    const x = left ? u.minX + s.w / 2 : u.maxX - s.w / 2;
    const z = top ? u.minZ + s.d / 2 : u.maxZ - s.d / 2;
    return { x, z };
}

function inCorner(ctx: Ctx, kind: FurnitureKind): FurniturePiece | null {
    for (let i = 0; i < 4; i++) {
        const c = cornerSpot(ctx, kind);
        if (!c) continue;
        const p = add(ctx, kind, c.x, c.z, rngRange(ctx.rng, 0, Math.PI * 2), 0.2);
        if (p) return p;
    }
    return null;
}

function frontOf(piece: FurniturePiece, distance: number): { x: number; z: number } {
    return { x: piece.x + Math.sin(piece.rot) * distance, z: piece.z + Math.cos(piece.rot) * distance };
}

function centerSpot(ctx: Ctx, spread: number): { x: number; z: number } {
    const u = ctx.usable;
    return {
        x: zoneCenterX(u) + (ctx.rng() - 0.5) * zoneWidth(u) * spread,
        z: zoneCenterZ(u) + (ctx.rng() - 0.5) * zoneDepth(u) * spread,
    };
}

function sofaSet(ctx: Ctx) {
    const side = pick(ctx.rng, SIDES);
    const along = rngRange(ctx.rng, 0.2, 0.8);
    const sofa = atWall(ctx, 'sofa', side, along);
    if (sofa) {
        const f = frontOf(sofa, FURNITURE_SPECS.sofa.d / 2 + 0.45 + FURNITURE_SPECS.coffeeTable.d / 2);
        add(ctx, 'coffeeTable', f.x, f.z, sofa.rot, 0.2);
        atWall(ctx, 'tv', opposite(side), along, 0.3);
    }
    const arm = ctx.rng() < 0.8 ? 1 + Math.floor(ctx.rng() * 2) : 0;
    for (let i = 0; i < arm; i++) anyWall(ctx, 'armchair');
}

function livingRoom(ctx: Ctx) {
    if (ctx.rng() < 0.65) {
        const c = centerSpot(ctx, 0.2);
        add(ctx, 'rug', c.x, c.z, ctx.rng() < 0.5 ? 0 : HALF_PI, 0);
    }
    sofaSet(ctx);
    const shelves = 1 + Math.floor(ctx.rng() * 2);
    for (let i = 0; i < shelves; i++) anyWall(ctx, 'bookshelf');
    if (ctx.rng() < 0.12) anyWall(ctx, 'piano');
    const plants = Math.floor(ctx.rng() * 3);
    for (let i = 0; i < plants; i++) inCorner(ctx, 'plant');
    if (ctx.rng() < 0.55) inCorner(ctx, 'lamp');
}

function kitchenRun(ctx: Ctx, side: Side, kinds: FurnitureKind[]) {
    const u = ctx.usable;
    const horizontal = side === 'minZ' || side === 'maxZ';
    const length = horizontal ? zoneWidth(u) : zoneDepth(u);
    const fromStart = ctx.rng() < 0.5;
    let cursor = 0;
    for (const kind of kinds) {
        const s = FURNITURE_SPECS[kind];
        if (cursor + s.w > length + 0.001) break;
        const centerAlong = fromStart ? cursor + s.w / 2 : length - cursor - s.w / 2;
        const along = length - s.w <= 0.001 ? 0.5 : (centerAlong - s.w / 2) / (length - s.w);
        const piece = atWall(ctx, kind, side, along, 0);
        if (!piece) {
            if (cursor > 0) break;
            return;
        }
        cursor += s.w;
    }
}

function kitchenRoom(ctx: Ctx) {
    const sides = SIDES.slice().sort(() => ctx.rng() - 0.5);
    const kinds: FurnitureKind[] = ['fridge', 'counter', 'stove', 'counter', 'kitchenSink', 'counter', 'counter'];
    if (ctx.rng() < 0.5) kinds.reverse();
    kitchenRun(ctx, sides[0], kinds);
    if (ctx.rng() < 0.55) kitchenRun(ctx, sides[1], ['counter', 'counter', 'cabinet']);
    if (zoneArea(ctx.usable) > 16 && ctx.rng() < 0.7) diningSet(ctx);
    if (ctx.rng() < 0.4) inCorner(ctx, 'plant');
    if (ctx.rng() < 0.3) anyWall(ctx, 'barrel');
}

function diningSet(ctx: Ctx) {
    const c = centerSpot(ctx, 0.25);
    const rot = ctx.rng() < 0.5 ? 0 : HALF_PI;
    const table = add(ctx, 'diningTable', c.x, c.z, rot, 0.55);
    if (!table) return;
    const quarter = Math.abs(Math.round(rot / HALF_PI)) & 1;
    const s = FURNITURE_SPECS.diningTable;
    const offs = [-0.5, 0.5];
    for (const sign of [-1, 1]) {
        for (const o of offs) {
            const localX = o;
            const localZ = sign * (s.d / 2 + 0.3);
            const wx = quarter ? localZ : localX;
            const wz = quarter ? localX : localZ;
            const faceRot = sign < 0 ? 0 : Math.PI;
            add(ctx, 'chair', table.x + wx, table.z + wz, quarter ? faceRot + HALF_PI : faceRot, 0, true);
        }
    }
}

function diningRoom(ctx: Ctx) {
    diningSet(ctx);
    anyWall(ctx, 'cabinet');
    if (ctx.rng() < 0.6) anyWall(ctx, 'cabinet');
    if (ctx.rng() < 0.5) inCorner(ctx, 'plant');
    if (ctx.rng() < 0.35) inCorner(ctx, 'lamp');
}

function bedroom(ctx: Ctx) {
    const kind: FurnitureKind = ctx.rng() < 0.62 ? 'bedDouble' : 'bedSingle';
    let bed: FurniturePiece | null = null;
    let bedSide: Side = 'minZ';
    for (let i = 0; i < 8 && !bed; i++) {
        bedSide = pick(ctx.rng, SIDES);
        bed = atWall(ctx, kind, bedSide, rngRange(ctx.rng, 0.25, 0.75), 0.5);
    }
    if (bed) {
        const s = FURNITURE_SPECS[kind];
        const right = { x: Math.cos(bed.rot), z: -Math.sin(bed.rot) };
        const back = { x: -Math.sin(bed.rot), z: -Math.cos(bed.rot) };
        for (const sign of [-1, 1]) {
            if (sign > 0 && ctx.rng() < 0.3) continue;
            const off = s.w / 2 + 0.3;
            const nx = bed.x + right.x * sign * off + back.x * (s.d / 2 - 0.3);
            const nz = bed.z + right.z * sign * off + back.z * (s.d / 2 - 0.3);
            add(ctx, 'nightstand', nx, nz, bed.rot, 0, true);
        }
        if (ctx.rng() < 0.45) {
            const c = frontOf(bed, 0.2);
            add(ctx, 'rug', c.x, c.z, bed.rot, 0, true);
        }
    }
    anyWall(ctx, 'wardrobe');
    if (ctx.rng() < 0.7) anyWall(ctx, 'dresser');
    if (ctx.rng() < 0.4) {
        const desk = anyWall(ctx, 'desk');
        if (desk) {
            const f = frontOf(desk, 0.75);
            add(ctx, 'officeChair', f.x, f.z, desk.rot + Math.PI, 0, true);
        }
    }
    if (ctx.rng() < 0.5) inCorner(ctx, 'lamp');
    if (ctx.rng() < 0.3) inCorner(ctx, 'plant');
}

function bathroom(ctx: Ctx) {
    anyWall(ctx, 'toilet');
    anyWall(ctx, 'bathSink');
    if (ctx.rng() < 0.7) anyWall(ctx, 'bathtub', 8, 0.35);
    else anyWall(ctx, 'shower', 8, 0.35);
    if (ctx.rng() < 0.35) anyWall(ctx, 'washer');
    if (ctx.rng() < 0.25) inCorner(ctx, 'plant');
}

function deskWithChair(ctx: Ctx, side: Side, along: number): FurniturePiece | null {
    const desk = atWall(ctx, 'desk', side, along, 0.5);
    if (desk) {
        const f = frontOf(desk, FURNITURE_SPECS.desk.d / 2 + 0.35);
        add(ctx, 'officeChair', f.x, f.z, desk.rot + Math.PI, 0, true);
    }
    return desk;
}

function officeRoom(ctx: Ctx) {
    const area = zoneArea(ctx.usable);
    if (area > 38 && ctx.rng() < 0.45) {
        const c = centerSpot(ctx, 0.1);
        const rot = zoneWidth(ctx.usable) >= zoneDepth(ctx.usable) ? 0 : HALF_PI;
        const table = add(ctx, 'conferenceTable', c.x, c.z, rot, 0.6);
        if (table) {
            const quarter = Math.abs(Math.round(rot / HALF_PI)) & 1;
            const s = FURNITURE_SPECS.conferenceTable;
            for (let i = 0; i < 3; i++) {
                for (const sign of [-1, 1]) {
                    const localX = (i - 1) * 1.0;
                    const localZ = sign * (s.d / 2 + 0.32);
                    const wx = quarter ? localZ : localX;
                    const wz = quarter ? localX : localZ;
                    add(ctx, 'officeChair', table.x + wx, table.z + wz, (sign < 0 ? 0 : Math.PI) + (quarter ? HALF_PI : 0), 0, true);
                }
            }
        }
        atWall(ctx, 'whiteboard', pick(ctx.rng, SIDES), ctx.rng(), 0);
    } else {
        const rows = Math.max(1, Math.min(3, Math.round(area / 16)));
        const side = pick(ctx.rng, ['minZ', 'maxZ', 'minX', 'maxX'] as Side[]);
        for (let i = 0; i < rows + 1; i++) deskWithChair(ctx, side, (i + 0.5) / (rows + 1));
        for (let i = 0; i < rows; i++) deskWithChair(ctx, opposite(side), (i + 0.5) / rows);
        const mid = centerSpot(ctx, 0.1);
        if (area > 30) {
            const d = add(ctx, 'desk', mid.x, mid.z, 0, 0.7);
            if (d) add(ctx, 'officeChair', d.x, d.z + 0.8, Math.PI, 0, true);
        }
    }
    const extras = 1 + Math.floor(ctx.rng() * 3);
    for (let i = 0; i < extras; i++) anyWall(ctx, pick(ctx.rng, ['filing', 'filing', 'bookshelf', 'cabinet'] as FurnitureKind[]));
    if (ctx.rng() < 0.5) inCorner(ctx, 'plant');
    if (ctx.rng() < 0.4) inCorner(ctx, 'lamp');
    atWall(ctx, 'whiteboard', pick(ctx.rng, SIDES), ctx.rng(), 0);
}

function storageRoom(ctx: Ctx) {
    const shelves = 1 + Math.floor(ctx.rng() * 3);
    for (let i = 0; i < shelves; i++) anyWall(ctx, 'metalShelf');
    const stacks = 1 + Math.floor(ctx.rng() * 3);
    for (let i = 0; i < stacks; i++) anyWall(ctx, 'crateStack', 6, 0.5);
    const crates = 2 + Math.floor(ctx.rng() * 5);
    for (let i = 0; i < crates; i++) {
        const c = centerSpot(ctx, 0.9);
        add(ctx, 'crate', c.x, c.z, rngRange(ctx.rng, 0, Math.PI * 2), 0.5);
    }
    const barrels = Math.floor(ctx.rng() * 4);
    for (let i = 0; i < barrels; i++) anyWall(ctx, 'barrel', 4, 0.3);
}

function entryRoom(ctx: Ctx) {
    if (ctx.rng() < 0.6) {
        const c = centerSpot(ctx, 0.2);
        add(ctx, 'rug', c.x, c.z, ctx.rng() < 0.5 ? 0 : HALF_PI, 0);
    }
    anyWall(ctx, 'bench');
    anyWall(ctx, 'coatRack', 4, 0.3);
    anyWall(ctx, 'cabinet');
    if (ctx.rng() < 0.7) anyWall(ctx, 'sofa');
    if (ctx.rng() < 0.6) inCorner(ctx, 'plant');
    if (ctx.rng() < 0.4) inCorner(ctx, 'plant');
    if (ctx.rng() < 0.4) anyWall(ctx, 'shopCounter');
}

function shopRoom(ctx: Ctx) {
    const u = ctx.usable;
    const w = zoneWidth(u);
    const d = zoneDepth(u);
    const alongX = w >= d;
    const rowSpacing = 2.5;
    const span = alongX ? d : w;
    const rows = Math.max(1, Math.floor((span - 2.4) / rowSpacing));
    const start = (alongX ? u.minZ : u.minX) + (span - (rows - 1) * rowSpacing) / 2;
    for (let r = 0; r < rows; r++) {
        const pos = start + r * rowSpacing;
        const length = alongX ? w : d;
        const count = Math.max(1, Math.floor((length - 3.2) / 2.0));
        const offset = (length - count * 1.9) / 2;
        for (let i = 0; i < count; i++) {
            const along = (alongX ? u.minX : u.minZ) + offset + 0.95 + i * 1.9;
            if (alongX) add(ctx, 'shopShelf', along, pos, r % 2 === 0 ? 0 : Math.PI, 0.3);
            else add(ctx, 'shopShelf', pos, along, r % 2 === 0 ? HALF_PI : -HALF_PI, 0.3);
        }
    }
    anyWall(ctx, 'shopCounter', 8, 0.6);
    const fr = Math.floor(ctx.rng() * 3);
    for (let i = 0; i < fr; i++) anyWall(ctx, 'freezer', 6, 0.4);
    const cr = Math.floor(ctx.rng() * 3);
    for (let i = 0; i < cr; i++) anyWall(ctx, 'crate', 4, 0.3);
}

function warehouseRoom(ctx: Ctx) {
    const u = ctx.usable;
    const w = zoneWidth(u);
    const d = zoneDepth(u);
    const alongX = w >= d;
    const spacing = 3.4;
    const span = alongX ? d : w;
    const rows = Math.max(1, Math.floor((span - 2.0) / spacing));
    const start = (alongX ? u.minZ : u.minX) + (span - (rows - 1) * spacing) / 2;
    const length = alongX ? w : d;
    for (let r = 0; r < rows; r++) {
        const pos = start + r * spacing;
        const count = Math.max(1, Math.floor((length - 2.4) / 1.6));
        const offset = (length - count * 1.6) / 2;
        for (let i = 0; i < count; i++) {
            if (ctx.rng() < 0.25) continue;
            const along = (alongX ? u.minX : u.minZ) + offset + 0.8 + i * 1.6;
            const kind: FurnitureKind = ctx.rng() < 0.7 ? 'metalShelf' : 'crateStack';
            if (alongX) add(ctx, kind, along, pos, 0, 0.3);
            else add(ctx, kind, pos, along, HALF_PI, 0.3);
        }
    }
    const barrels = 2 + Math.floor(ctx.rng() * 4);
    for (let i = 0; i < barrels; i++) anyWall(ctx, 'barrel', 4, 0.3);
    const crates = 2 + Math.floor(ctx.rng() * 4);
    for (let i = 0; i < crates; i++) {
        const c = centerSpot(ctx, 0.9);
        add(ctx, 'crate', c.x, c.z, rngRange(ctx.rng, 0, Math.PI * 2), 0.5);
    }
}

function utilityRoom(ctx: Ctx) {
    anyWall(ctx, 'boiler');
    anyWall(ctx, 'washer');
    anyWall(ctx, 'metalShelf');
    const barrels = Math.floor(ctx.rng() * 3);
    for (let i = 0; i < barrels; i++) anyWall(ctx, 'barrel', 4, 0.3);
    if (ctx.rng() < 0.6) anyWall(ctx, 'crate');
}

function hallRoom(ctx: Ctx) {
    if (ctx.rng() < 0.5) inCorner(ctx, 'plant');
    if (ctx.rng() < 0.4) anyWall(ctx, 'bench', 4, 0.9);
    if (ctx.rng() < 0.3) anyWall(ctx, 'cabinet', 4, 0.9);
    if (ctx.rng() < 0.3) inCorner(ctx, 'lamp');
}

function scatterDebris(ctx: Ctx, decay: number) {
    const count = Math.floor(ctx.rng() * (1 + decay * 3.2));
    for (let i = 0; i < count; i++) {
        const c = centerSpot(ctx, 0.95);
        add(ctx, 'debris', c.x, c.z, rngRange(ctx.rng, 0, Math.PI * 2), 0);
    }
}

export function furnishRoom(rng: Rng, room: Room, blockers: ZoneRect[], decay: number): FurniturePiece[] {
    const usable: ZoneRect = { minX: room.minX + 0.3, maxX: room.maxX - 0.3, minZ: room.minZ + 0.3, maxZ: room.maxZ - 0.3 };
    if (zoneWidth(usable) < 1.2 || zoneDepth(usable) < 1.2) return [];
    const ctx: Ctx = { rng, room, usable, blockers: blockers.map((b) => expandRect(b, 0)), pieces: [], floor: room.floor };
    switch (room.type) {
        case 'living':
            livingRoom(ctx);
            break;
        case 'kitchen':
            kitchenRoom(ctx);
            break;
        case 'dining':
            diningRoom(ctx);
            break;
        case 'bedroom':
            bedroom(ctx);
            break;
        case 'bathroom':
            bathroom(ctx);
            break;
        case 'office':
            officeRoom(ctx);
            break;
        case 'storage':
            storageRoom(ctx);
            break;
        case 'entry':
            entryRoom(ctx);
            break;
        case 'shop':
            shopRoom(ctx);
            break;
        case 'warehouse':
            warehouseRoom(ctx);
            break;
        case 'utility':
            utilityRoom(ctx);
            break;
        case 'hall':
            hallRoom(ctx);
            break;
    }
    scatterDebris(ctx, decay);
    return ctx.pieces;
}
