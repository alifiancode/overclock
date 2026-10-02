import type { WallSegment, ZoneRect, FootprintResult, StairwellRect } from './buildingShapes.ts';
import { zoneWidth, zoneDepth } from './buildingShapes.ts';

export type RoomType = 'living' | 'kitchen' | 'bedroom' | 'bathroom' | 'storage' | 'entry' | 'office';
export type Room = ZoneRect & { type: RoomType };
export type FurniturePiece = {
    kind: 'table' | 'shelf' | 'crate' | 'bed' | 'couch' | 'cratestack' | 'counter' | 'stove' | 'sink' | 'desk';
    x: number;
    z: number;
    rotationY: number;
    floor: number;
};

export type FloorPlan = {
    interiorWalls: WallSegment[];
    rooms: Room[];
};

const DOORWAY_WIDTH = 1.4;
const PARTITION_MARGIN = 0.5;
const ENTRY_CLEARANCE = 1.9;
const GRID_MIN_WIDTH = 11.5;
const GRID_MIN_DEPTH = 13;

function wallWithDoorAlongX(z: number, xMin: number, xMax: number): WallSegment[] {
    const mid = (xMin + xMax) / 2;
    const half = DOORWAY_WIDTH / 2;
    const segs: WallSegment[] = [];
    if (mid - half > xMin) segs.push({ x1: xMin, z1: z, x2: mid - half, z2: z });
    if (xMax > mid + half) segs.push({ x1: mid + half, z1: z, x2: xMax, z2: z });
    return segs;
}

function wallWithDoorAlongZ(x: number, zMin: number, zMax: number): WallSegment[] {
    const mid = (zMin + zMax) / 2;
    const half = DOORWAY_WIDTH / 2;
    const segs: WallSegment[] = [];
    if (mid - half > zMin) segs.push({ x1: x, z1: zMin, x2: x, z2: mid - half });
    if (zMax > mid + half) segs.push({ x1: x, z1: mid + half, x2: x, z2: zMax });
    return segs;
}

function neckToWall(neck: WallSegment): WallSegment[] {
    if (neck.x1 === neck.x2) return wallWithDoorAlongZ(neck.x1, Math.min(neck.z1, neck.z2), Math.max(neck.z1, neck.z2));
    return wallWithDoorAlongX(neck.z1, Math.min(neck.x1, neck.x2), Math.max(neck.x1, neck.x2));
}

function pickCut(lo: number, hi: number, stairLo: number, stairHi: number): number | null {
    const stairAtHighEnd = (stairLo + stairHi) / 2 > (lo + hi) / 2;
    const safeLo = stairAtHighEnd ? lo : stairHi + PARTITION_MARGIN;
    const safeHi = stairAtHighEnd ? stairLo - PARTITION_MARGIN : hi;
    const span = safeHi - safeLo;
    if (span < 1.8) return null;
    const t = 0.35 + Math.random() * 0.3;
    return safeLo + span * t;
}

function gridPartition(main: ZoneRect, stair: StairwellRect): { walls: WallSegment[]; rooms: ZoneRect[] } | null {
    if (zoneWidth(main) < GRID_MIN_WIDTH || zoneDepth(main) < GRID_MIN_DEPTH) return null;
    const xCut = pickCut(main.minX, main.maxX, stair.minX, stair.maxX);
    const zCut = pickCut(main.minZ, main.maxZ, stair.minZ, stair.maxZ);
    if (xCut === null || zCut === null) return null;
    if (zCut - main.minZ < ENTRY_CLEARANCE + 1.5) return null;

    const rooms: ZoneRect[] = [
        { minX: main.minX, maxX: xCut, minZ: main.minZ, maxZ: zCut },
        { minX: xCut, maxX: main.maxX, minZ: main.minZ, maxZ: zCut },
        { minX: main.minX, maxX: xCut, minZ: zCut, maxZ: main.maxZ },
        { minX: xCut, maxX: main.maxX, minZ: zCut, maxZ: main.maxZ },
    ];

    const walls: WallSegment[] = [
        ...wallWithDoorAlongZ(xCut, main.minZ + ENTRY_CLEARANCE, zCut),
        ...wallWithDoorAlongZ(xCut, zCut, main.maxZ),
        ...wallWithDoorAlongX(zCut, main.minX, xCut),
        ...wallWithDoorAlongX(zCut, xCut, main.maxX),
    ];
    return { walls, rooms };
}

type PlanTemplate = 'open' | 'split' | 'stripes';

function pickStripeTemplate(): PlanTemplate {
    const roll = Math.random();
    if (roll < 0.12) return 'open';
    if (roll < 0.55) return 'split';
    return 'stripes';
}

function pickStripeCuts(lo: number, hi: number, stairLo: number, stairHi: number, template: PlanTemplate): number[] {
    const stairAtHighEnd = (stairLo + stairHi) / 2 > (lo + hi) / 2;
    const safeLo = stairAtHighEnd ? lo : stairHi + PARTITION_MARGIN;
    const safeHi = stairAtHighEnd ? stairLo - PARTITION_MARGIN : hi;
    const span = safeHi - safeLo;

    if (template === 'stripes' && span >= 6) {
        const t1 = 0.3 + Math.random() * 0.1;
        const t2 = 0.62 + Math.random() * 0.12;
        return [safeLo + span * t1, safeLo + span * t2];
    }
    if (span < 1.6) return [];
    const t = 0.35 + Math.random() * 0.3;
    return [safeLo + span * t];
}

function slicesFromCuts(lo: number, hi: number, cuts: number[]): [number, number][] {
    const bounds = [lo, ...cuts, hi];
    const slices: [number, number][] = [];
    for (let i = 0; i < bounds.length - 1; i++) slices.push([bounds[i], bounds[i + 1]]);
    return slices;
}

function stripePartition(main: ZoneRect, stair: StairwellRect): { walls: WallSegment[]; rooms: ZoneRect[] } {
    const elongatedInZ = zoneDepth(main) >= zoneWidth(main);
    const longSpan = elongatedInZ ? zoneDepth(main) : zoneWidth(main);
    const template: PlanTemplate = longSpan > 13 ? pickStripeTemplate() : Math.random() < 0.4 ? 'open' : 'split';
    if (template === 'open') return { walls: [], rooms: [main] };

    if (elongatedInZ) {
        const cuts = pickStripeCuts(main.minZ, main.maxZ, stair.minZ, stair.maxZ, template);
        if (cuts.length === 0) return { walls: [], rooms: [main] };
        const rooms = slicesFromCuts(main.minZ, main.maxZ, cuts).map(([z0, z1]) => ({ minX: main.minX, maxX: main.maxX, minZ: z0, maxZ: z1 }));
        const walls = cuts.flatMap((z) => wallWithDoorAlongX(z, main.minX, main.maxX));
        return { walls, rooms };
    }
    const cuts = pickStripeCuts(main.minX, main.maxX, stair.minX, stair.maxX, template);
    if (cuts.length === 0) return { walls: [], rooms: [main] };
    const rooms = slicesFromCuts(main.minX, main.maxX, cuts).map(([x0, x1]) => ({ minX: x0, maxX: x1, minZ: main.minZ, maxZ: main.maxZ }));
    const frontClearZ = Math.min(main.maxZ - 0.5, main.minZ + ENTRY_CLEARANCE);
    const walls = cuts.flatMap((x) => wallWithDoorAlongZ(x, frontClearZ, main.maxZ));
    return { walls, rooms };
}

function partitionMainZone(main: ZoneRect, stair: StairwellRect): { walls: WallSegment[]; rooms: ZoneRect[] } {
    if (Math.random() < 0.7) {
        const grid = gridPartition(main, stair);
        if (grid) return grid;
    }
    return stripePartition(main, stair);
}

function assignRoomTypes(rects: ZoneRect[], floor: number): Room[] {
    const withArea = rects.map((rect) => ({ rect, area: zoneWidth(rect) * zoneDepth(rect) }));
    withArea.sort((a, b) => b.area - a.area);

    const largestArea = withArea[0]?.area ?? 0;
    return withArea.map(({ rect, area }, i) => {
        let type: RoomType;
        if (floor === 0) {
            const pool: RoomType[] = ['living', 'kitchen', 'entry', 'storage'];
            type = pool[Math.min(i, pool.length - 1)];
        } else if (floor === 1) {
            if (i === 0) type = 'bedroom';
            else if (i > 0 && area < largestArea * 0.5) type = i === withArea.length - 1 ? 'bathroom' : 'office';
            else type = 'bedroom';
        } else {
            type = 'storage';
        }
        return { ...rect, type };
    });
}

export function buildFloorPlan(footprint: FootprintResult, stair: StairwellRect, floor: number): FloorPlan {
    const main = footprint.zones[0];
    const { walls: mainWalls, rooms: mainRects } = partitionMainZone(main, stair);
    const interiorWalls: WallSegment[] = [...mainWalls];
    const rects: ZoneRect[] = [...mainRects];

    for (let i = 1; i < footprint.zones.length; i++) {
        if (Math.random() < 0.75) interiorWalls.push(...neckToWall(footprint.necks[i - 1]));
        rects.push(footprint.zones[i]);
    }
    return { interiorWalls, rooms: assignRoomTypes(rects, floor) };
}

function insetRoom(room: ZoneRect, inset: number, frontClearance: number, frontZ: number): ZoneRect {
    const touchesFront = Math.abs(room.minZ - frontZ) < 0.01;
    return {
        minX: room.minX + inset,
        maxX: room.maxX - inset,
        minZ: room.minZ + (touchesFront ? frontClearance : inset),
        maxZ: room.maxZ - inset,
    };
}

const ROOM_THEMES: Record<RoomType, FurniturePiece['kind'][]> = {
    living: ['couch', 'table', 'shelf'],
    kitchen: ['counter', 'counter', 'stove', 'crate'],
    bedroom: ['bed', 'shelf', 'crate'],
    bathroom: ['sink'],
    storage: ['crate', 'cratestack', 'shelf'],
    entry: ['shelf', 'crate'],
    office: ['desk', 'shelf'],
};

const ROOM_MAX_PIECES: Record<RoomType, number> = {
    living: 5,
    kitchen: 4,
    bedroom: 4,
    bathroom: 1,
    storage: 5,
    entry: 3,
    office: 3,
};

export function furnishRoom(room: Room, floor: number, stair: StairwellRect | null, frontZ: number): FurniturePiece[] {
    const usable = insetRoom(room, 0.8, 1.6, frontZ);
    const w = usable.maxX - usable.minX;
    const d = usable.maxZ - usable.minZ;
    if (w <= 0.6 || d <= 0.6) return [];

    const maxForType = ROOM_MAX_PIECES[room.type];
    const count = Math.max(1, Math.min(maxForType, Math.round((w * d) / 11)));
    const kinds = ROOM_THEMES[room.type];
    const pieces: FurniturePiece[] = [];
    let attempts = 0;
    while (pieces.length < count && attempts < count * 6) {
        attempts++;
        const x = usable.minX + Math.random() * w;
        const z = usable.minZ + Math.random() * d;
        if (stair && x > stair.minX - 0.5 && x < stair.maxX + 0.5 && z > stair.minZ - 0.5 && z < stair.maxZ + 0.5) continue;
        pieces.push({ kind: kinds[Math.floor(Math.random() * kinds.length)], x, z, rotationY: Math.random() * Math.PI * 2, floor });
    }
    return pieces;
}
