import { rngRange, type Rng } from './random.ts';

export type Point2 = { x: number; z: number };
export type WallSegment = { x1: number; z1: number; x2: number; z2: number };
export type ZoneRect = { minX: number; maxX: number; minZ: number; maxZ: number };
export type FootprintKind = 'rect' | 'l' | 't' | 'u' | 'cross';

export type FootprintResult = {
    kind: FootprintKind;
    polygon: Point2[];
    zones: ZoneRect[];
    necks: WallSegment[];
    bounds: ZoneRect;
};

export function zoneWidth(z: ZoneRect): number {
    return z.maxX - z.minX;
}

export function zoneDepth(z: ZoneRect): number {
    return z.maxZ - z.minZ;
}

export function zoneArea(z: ZoneRect): number {
    return zoneWidth(z) * zoneDepth(z);
}

export function zoneCenterX(z: ZoneRect): number {
    return (z.minX + z.maxX) / 2;
}

export function zoneCenterZ(z: ZoneRect): number {
    return (z.minZ + z.maxZ) / 2;
}

export function rotX(x: number, z: number, rot: number): number {
    switch (rot & 3) {
        case 0:
            return x;
        case 1:
            return z;
        case 2:
            return -x;
        default:
            return -z;
    }
}

export function rotZ(x: number, z: number, rot: number): number {
    switch (rot & 3) {
        case 0:
            return z;
        case 1:
            return -x;
        case 2:
            return -z;
        default:
            return x;
    }
}

export function rotateRect(r: ZoneRect, rot: number, ox: number, oz: number): ZoneRect {
    const ax = rotX(r.minX, r.minZ, rot);
    const az = rotZ(r.minX, r.minZ, rot);
    const bx = rotX(r.maxX, r.maxZ, rot);
    const bz = rotZ(r.maxX, r.maxZ, rot);
    return { minX: Math.min(ax, bx) + ox, maxX: Math.max(ax, bx) + ox, minZ: Math.min(az, bz) + oz, maxZ: Math.max(az, bz) + oz };
}

export function rotateSegment(s: WallSegment, rot: number, ox: number, oz: number): WallSegment {
    return {
        x1: rotX(s.x1, s.z1, rot) + ox,
        z1: rotZ(s.x1, s.z1, rot) + oz,
        x2: rotX(s.x2, s.z2, rot) + ox,
        z2: rotZ(s.x2, s.z2, rot) + oz,
    };
}

export function rectsOverlap(a: ZoneRect, b: ZoneRect, margin: number = 0): boolean {
    return a.minX < b.maxX + margin && a.maxX > b.minX - margin && a.minZ < b.maxZ + margin && a.maxZ > b.minZ - margin;
}

export function expandRect(r: ZoneRect, m: number): ZoneRect {
    return { minX: r.minX - m, maxX: r.maxX + m, minZ: r.minZ - m, maxZ: r.maxZ + m };
}

function mirrorPolygonX(polygon: Point2[]): Point2[] {
    const m = polygon.map((p) => ({ x: -p.x, z: p.z }));
    const n = m.length;
    const out: Point2[] = [m[1], m[0]];
    for (let i = n - 1; i >= 2; i--) out.push(m[i]);
    return out;
}

function mirrorRectX(r: ZoneRect): ZoneRect {
    return { minX: -r.maxX, maxX: -r.minX, minZ: r.minZ, maxZ: r.maxZ };
}

function mirrorSegmentX(s: WallSegment): WallSegment {
    return { x1: -s.x1, z1: s.z1, x2: -s.x2, z2: s.z2 };
}

function mirrorFootprint(f: FootprintResult): FootprintResult {
    return {
        kind: f.kind,
        polygon: mirrorPolygonX(f.polygon),
        zones: f.zones.map(mirrorRectX),
        necks: f.necks.map(mirrorSegmentX),
        bounds: mirrorRectX(f.bounds),
    };
}

function unionBounds(zones: ZoneRect[]): ZoneRect {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const z of zones) {
        minX = Math.min(minX, z.minX);
        maxX = Math.max(maxX, z.maxX);
        minZ = Math.min(minZ, z.minZ);
        maxZ = Math.max(maxZ, z.maxZ);
    }
    return { minX, maxX, minZ, maxZ };
}

function recenter(f: FootprintResult): FootprintResult {
    const b = unionBounds(f.zones);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const tz = (z: ZoneRect): ZoneRect => ({ minX: z.minX - cx, maxX: z.maxX - cx, minZ: z.minZ - cz, maxZ: z.maxZ - cz });
    return {
        kind: f.kind,
        polygon: f.polygon.map((p) => ({ x: p.x - cx, z: p.z - cz })),
        zones: f.zones.map(tz),
        necks: f.necks.map((s) => ({ x1: s.x1 - cx, z1: s.z1 - cz, x2: s.x2 - cx, z2: s.z2 - cz })),
        bounds: tz(b),
    };
}

function pickKind(rng: Rng): FootprintKind {
    const roll = rng();
    if (roll < 0.3) return 'rect';
    if (roll < 0.58) return 'l';
    if (roll < 0.74) return 't';
    if (roll < 0.88) return 'u';
    return 'cross';
}

export function buildFootprint(rng: Rng, maxW: number, maxD: number, forcedKind?: FootprintKind): FootprintResult {
    const kind = forcedKind ?? pickKind(rng);
    const W = rngRange(rng, Math.min(15.5, maxW), maxW);
    const D = rngRange(rng, Math.min(14.5, maxD), maxD);
    let result: FootprintResult;

    if (kind === 'rect') {
        const w = rngRange(rng, Math.min(11, maxW), maxW);
        const d = rngRange(rng, Math.min(11, maxD), maxD);
        const main: ZoneRect = { minX: 0, maxX: w, minZ: 0, maxZ: d };
        result = {
            kind,
            polygon: [
                { x: 0, z: 0 },
                { x: w, z: 0 },
                { x: w, z: d },
                { x: 0, z: d },
            ],
            zones: [main],
            necks: [],
            bounds: main,
        };
    } else if (kind === 'l') {
        const wm = W * rngRange(rng, 0.55, 0.68);
        const ld = D * rngRange(rng, 0.42, 0.56);
        const main: ZoneRect = { minX: 0, maxX: wm, minZ: 0, maxZ: D };
        const lobe: ZoneRect = { minX: wm, maxX: W, minZ: D - ld, maxZ: D };
        result = {
            kind,
            polygon: [
                { x: 0, z: 0 },
                { x: wm, z: 0 },
                { x: wm, z: D - ld },
                { x: W, z: D - ld },
                { x: W, z: D },
                { x: 0, z: D },
            ],
            zones: [main, lobe],
            necks: [{ x1: wm, z1: D - ld, x2: wm, z2: D }],
            bounds: { minX: 0, maxX: W, minZ: 0, maxZ: D },
        };
        if (rng() < 0.5) result = mirrorFootprint(result);
    } else if (kind === 't') {
        const sw = W * rngRange(rng, 0.34, 0.46);
        const sd = D * rngRange(rng, 0.26, 0.36);
        const dm = D - sd;
        const slack = W - sw;
        const sx0 = slack * rngRange(rng, 0.3, 0.7);
        const sx1 = sx0 + sw;
        const main: ZoneRect = { minX: 0, maxX: W, minZ: 0, maxZ: dm };
        const stem: ZoneRect = { minX: sx0, maxX: sx1, minZ: dm, maxZ: D };
        result = {
            kind,
            polygon: [
                { x: 0, z: 0 },
                { x: W, z: 0 },
                { x: W, z: dm },
                { x: sx1, z: dm },
                { x: sx1, z: D },
                { x: sx0, z: D },
                { x: sx0, z: dm },
                { x: 0, z: dm },
            ],
            zones: [main, stem],
            necks: [{ x1: sx0, z1: dm, x2: sx1, z2: dm }],
            bounds: { minX: 0, maxX: W, minZ: 0, maxZ: D },
        };
    } else if (kind === 'u') {
        const wl = W * rngRange(rng, 0.28, 0.35);
        const wr = W * rngRange(rng, 0.28, 0.35);
        const dm = D * rngRange(rng, 0.38, 0.46);
        const main: ZoneRect = { minX: 0, maxX: W, minZ: 0, maxZ: dm };
        const left: ZoneRect = { minX: 0, maxX: wl, minZ: dm, maxZ: D };
        const right: ZoneRect = { minX: W - wr, maxX: W, minZ: dm, maxZ: D };
        result = {
            kind,
            polygon: [
                { x: 0, z: 0 },
                { x: W, z: 0 },
                { x: W, z: D },
                { x: W - wr, z: D },
                { x: W - wr, z: dm },
                { x: wl, z: dm },
                { x: wl, z: D },
                { x: 0, z: D },
            ],
            zones: [main, left, right],
            necks: [
                { x1: 0, z1: dm, x2: wl, z2: dm },
                { x1: W - wr, z1: dm, x2: W, z2: dm },
            ],
            bounds: { minX: 0, maxX: W, minZ: 0, maxZ: D },
        };
    } else {
        const wm = W * rngRange(rng, 0.44, 0.54);
        const side = W - wm;
        const wl = side * rngRange(rng, 0.42, 0.58);
        const wr = side - wl;
        const ld = D * rngRange(rng, 0.4, 0.52);
        const main: ZoneRect = { minX: 0, maxX: wm, minZ: 0, maxZ: D };
        const right: ZoneRect = { minX: wm, maxX: wm + wr, minZ: D - ld, maxZ: D };
        const left: ZoneRect = { minX: -wl, maxX: 0, minZ: D - ld, maxZ: D };
        result = {
            kind,
            polygon: [
                { x: 0, z: 0 },
                { x: wm, z: 0 },
                { x: wm, z: D - ld },
                { x: wm + wr, z: D - ld },
                { x: wm + wr, z: D },
                { x: -wl, z: D },
                { x: -wl, z: D - ld },
                { x: 0, z: D - ld },
            ],
            zones: [main, right, left],
            necks: [
                { x1: wm, z1: D - ld, x2: wm, z2: D },
                { x1: 0, z1: D - ld, x2: 0, z2: D },
            ],
            bounds: { minX: -wl, maxX: wm + wr, minZ: 0, maxZ: D },
        };
    }
    return recenter(result);
}

export function isPointInPolygon(x: number, z: number, polygon: Point2[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const zi = polygon[i].z;
        const xj = polygon[j].x;
        const zj = polygon[j].z;
        const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

export type PolygonEdge = { x1: number; z1: number; x2: number; z2: number; length: number; ux: number; uz: number; nx: number; nz: number; index: number };

export function polygonEdges(polygon: Point2[]): PolygonEdge[] {
    const edges: PolygonEdge[] = [];
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % n];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = Math.hypot(dx, dz);
        const ux = dx / length;
        const uz = dz / length;
        edges.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, length, ux, uz, nx: uz, nz: -ux, index: i });
    }
    return edges;
}

export type Opening = { edge: number; center: number; width: number; kind: 'door' | 'breach' };

export function cutSegment(seg: WallSegment, gaps: { lo: number; hi: number }[]): WallSegment[] {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) return [];
    const ux = dx / length;
    const uz = dz / length;
    const sorted = gaps.filter((g) => g.hi > 0 && g.lo < length).sort((a, b) => a.lo - b.lo);
    const out: WallSegment[] = [];
    let cursor = 0;
    for (const g of sorted) {
        const lo = Math.max(0, g.lo);
        const hi = Math.min(length, g.hi);
        if (lo - cursor > 0.05) out.push({ x1: seg.x1 + ux * cursor, z1: seg.z1 + uz * cursor, x2: seg.x1 + ux * lo, z2: seg.z1 + uz * lo });
        cursor = Math.max(cursor, hi);
    }
    if (length - cursor > 0.05) out.push({ x1: seg.x1 + ux * cursor, z1: seg.z1 + uz * cursor, x2: seg.x2, z2: seg.z2 });
    return out;
}
