export type Point2 = { x: number; z: number };
export type WallSegment = { x1: number; z1: number; x2: number; z2: number };
export type ZoneRect = { minX: number; maxX: number; minZ: number; maxZ: number };
export type FootprintKind = 'rect' | 'l' | 't' | 'cross';

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

function pickFootprintKind(): FootprintKind {
    const roll = Math.random();
    if (roll < 0.32) return 'rect';
    if (roll < 0.62) return 'l';
    if (roll < 0.84) return 't';
    return 'cross';
}

export function buildRandomFootprint(mainW: number, mainD: number): FootprintResult {
    const kind = pickFootprintKind();
    const hw = mainW / 2;
    const hd = mainD / 2;
    const main: ZoneRect = { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd };

    if (kind === 'rect') {
        const polygon: Point2[] = [
            { x: -hw, z: -hd },
            { x: hw, z: -hd },
            { x: hw, z: hd },
            { x: -hw, z: hd },
        ];
        return { kind, polygon, zones: [main], necks: [], bounds: main };
    }

    if (kind === 'l') {
        const side: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
        const lobeD = mainD * (0.3 + Math.random() * 0.2);
        const lobeW = mainW * (0.2 + Math.random() * 0.2);
        const lobeZStart = hd - lobeD;
        if (side === 'right') {
            const polygon: Point2[] = [
                { x: -hw, z: -hd },
                { x: hw, z: -hd },
                { x: hw, z: lobeZStart },
                { x: hw + lobeW, z: lobeZStart },
                { x: hw + lobeW, z: hd },
                { x: -hw, z: hd },
            ];
            const lobe: ZoneRect = { minX: hw, maxX: hw + lobeW, minZ: lobeZStart, maxZ: hd };
            const neck: WallSegment = { x1: hw, z1: lobeZStart, x2: hw, z2: hd };
            return { kind, polygon, zones: [main, lobe], necks: [neck], bounds: { minX: -hw, maxX: hw + lobeW, minZ: -hd, maxZ: hd } };
        }
        const polygon: Point2[] = [
            { x: -hw, z: -hd },
            { x: hw, z: -hd },
            { x: hw, z: hd },
            { x: -hw - lobeW, z: hd },
            { x: -hw - lobeW, z: lobeZStart },
            { x: -hw, z: lobeZStart },
        ];
        const lobe: ZoneRect = { minX: -hw - lobeW, maxX: -hw, minZ: lobeZStart, maxZ: hd };
        const neck: WallSegment = { x1: -hw, z1: lobeZStart, x2: -hw, z2: hd };
        return { kind, polygon, zones: [main, lobe], necks: [neck], bounds: { minX: -hw - lobeW, maxX: hw, minZ: -hd, maxZ: hd } };
    }

    if (kind === 't') {
        const stemW = mainW * (0.26 + Math.random() * 0.18);
        const stemD = mainD * (0.22 + Math.random() * 0.2);
        const sw = stemW / 2;
        const stemBackZ = hd + stemD;
        const polygon: Point2[] = [
            { x: -hw, z: -hd },
            { x: hw, z: -hd },
            { x: hw, z: hd },
            { x: sw, z: hd },
            { x: sw, z: stemBackZ },
            { x: -sw, z: stemBackZ },
            { x: -sw, z: hd },
            { x: -hw, z: hd },
        ];
        const stem: ZoneRect = { minX: -sw, maxX: sw, minZ: hd, maxZ: stemBackZ };
        const neck: WallSegment = { x1: -sw, z1: hd, x2: sw, z2: hd };
        return { kind, polygon, zones: [main, stem], necks: [neck], bounds: { minX: -hw, maxX: hw, minZ: -hd, maxZ: stemBackZ } };
    }

    const lobeD = mainD * (0.26 + Math.random() * 0.16);
    const lobeWR = mainW * (0.16 + Math.random() * 0.14);
    const lobeWL = mainW * (0.16 + Math.random() * 0.14);
    const lobeZStart = hd - lobeD;
    const polygon: Point2[] = [
        { x: -hw, z: -hd },
        { x: hw, z: -hd },
        { x: hw, z: lobeZStart },
        { x: hw + lobeWR, z: lobeZStart },
        { x: hw + lobeWR, z: hd },
        { x: -hw - lobeWL, z: hd },
        { x: -hw - lobeWL, z: lobeZStart },
        { x: -hw, z: lobeZStart },
    ];
    const rightLobe: ZoneRect = { minX: hw, maxX: hw + lobeWR, minZ: lobeZStart, maxZ: hd };
    const leftLobe: ZoneRect = { minX: -hw - lobeWL, maxX: -hw, minZ: lobeZStart, maxZ: hd };
    const neckR: WallSegment = { x1: hw, z1: lobeZStart, x2: hw, z2: hd };
    const neckL: WallSegment = { x1: -hw, z1: lobeZStart, x2: -hw, z2: hd };
    return {
        kind,
        polygon,
        zones: [main, rightLobe, leftLobe],
        necks: [neckR, neckL],
        bounds: { minX: -hw - lobeWL, maxX: hw + lobeWR, minZ: -hd, maxZ: hd },
    };
}

export function translateFootprint(footprint: FootprintResult, cx: number, cz: number): FootprintResult {
    const tp = (p: Point2): Point2 => ({ x: p.x + cx, z: p.z + cz });
    const tz = (z: ZoneRect): ZoneRect => ({ minX: z.minX + cx, maxX: z.maxX + cx, minZ: z.minZ + cz, maxZ: z.maxZ + cz });
    const tw = (w: WallSegment): WallSegment => ({ x1: w.x1 + cx, z1: w.z1 + cz, x2: w.x2 + cx, z2: w.z2 + cz });
    return {
        kind: footprint.kind,
        polygon: footprint.polygon.map(tp),
        zones: footprint.zones.map(tz),
        necks: footprint.necks.map(tw),
        bounds: tz(footprint.bounds),
    };
}

export function polygonToWalls(polygon: Point2[], doorWidth: number): WallSegment[] {
    const segments: WallSegment[] = [];
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % n];
        if (i === 0) {
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const len = Math.hypot(dx, dz);
            const ux = dx / len;
            const uz = dz / len;
            const half = doorWidth / 2;
            const midX = (a.x + b.x) / 2;
            const midZ = (a.z + b.z) / 2;
            segments.push({ x1: a.x, z1: a.z, x2: midX - ux * half, z2: midZ - uz * half });
            segments.push({ x1: midX + ux * half, z1: midZ + uz * half, x2: b.x, z2: b.z });
        } else {
            segments.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z });
        }
    }
    return segments;
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

export type StairwellRect = ZoneRect;

export function placeStairwell(footprint: FootprintResult, width: number, depth: number): StairwellRect {
    const main = footprint.zones[0];
    const margin = 0.6;
    let onRight = true;
    if (footprint.kind === 'l') {
        const lobe = footprint.zones[1];
        onRight = !(lobe.minX >= main.maxX);
    }
    const maxX = onRight ? main.maxX - margin : main.minX + width + margin;
    const minX = maxX - width;
    let maxZ = main.maxZ - margin;
    let minZ = maxZ - depth;

    const pad = 0.5;
    for (const neck of footprint.necks) {
        const segMinX = Math.min(neck.x1, neck.x2) - pad;
        const segMaxX = Math.max(neck.x1, neck.x2) + pad;
        const segMinZ = Math.min(neck.z1, neck.z2) - pad;
        const segMaxZ = Math.max(neck.z1, neck.z2) + pad;
        const overlaps = minX < segMaxX && maxX > segMinX && minZ < segMaxZ && maxZ > segMinZ;
        if (overlaps) {
            maxZ = Math.max(main.minZ + depth + margin, segMinZ - 0.2);
            minZ = maxZ - depth;
        }
    }
    return { minX, maxX, minZ, maxZ };
}
