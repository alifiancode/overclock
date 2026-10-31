import type { BuildingDef } from './buildingGen.ts';
import { buildings } from './footprints.ts';
import { wrapDelta } from './wrap.ts';

export const OUT_NODE = 0;

type Edge = { to: number; rev: number; px: number; pz: number; bx: number; bz: number; stairs: boolean; w: number };

export type NavGraph = {
    def: BuildingDef;
    count: number;
    floorBase: number[];
    centerX: number[];
    centerZ: number[];
    edges: Edge[][];
    towardOut: Int32Array;
    towardPlayer: Int32Array;
    entranceNode: Int32Array;
    playerNode: number;
    dist: Float32Array;
};

export type Hop = { x: number; z: number; stairs: boolean; arrived: boolean };

const SIDE_PROBE = 0.4;
const TOLERANCE = 0.06;
const PORTAL_REACH = 0.55;
const STAIR_COST = 9;
const PLATEAU_CENTER = 0.25;
const OUT_PENALTY = 60;

const graphs: (NavGraph | undefined)[] = [];

function roomIndexAt(def: BuildingDef, floor: number, x: number, z: number, tolerance: number): number {
    const rooms = def.rooms[floor];
    for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i];
        if (x >= r.minX - tolerance && x <= r.maxX + tolerance && z >= r.minZ - tolerance && z <= r.maxZ + tolerance) return i;
    }
    return -1;
}

function roomIndexNear(def: BuildingDef, floor: number, x: number, z: number): number {
    const exact = roomIndexAt(def, floor, x, z, TOLERANCE);
    if (exact >= 0) return exact;
    const rooms = def.rooms[floor];
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i];
        const cx = x < r.minX ? r.minX : x > r.maxX ? r.maxX : x;
        const cz = z < r.minZ ? r.minZ : z > r.maxZ ? r.maxZ : z;
        const d = Math.hypot(x - cx, z - cz);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return best;
}

function connect(g: NavGraph, a: number, b: number, edgeAB: Omit<Edge, 'rev' | 'to'>, edgeBA: Omit<Edge, 'rev' | 'to'>) {
    const ia = g.edges[a].length;
    const ib = g.edges[b].length;
    g.edges[a].push({ ...edgeAB, to: b, rev: ib });
    g.edges[b].push({ ...edgeBA, to: a, rev: ia });
}

function buildGraph(def: BuildingDef): NavGraph {
    const floorBase: number[] = [];
    let count = 1;
    for (let f = 0; f < def.floors; f++) {
        floorBase.push(count);
        count += def.rooms[f].length;
    }
    const centerX: number[] = [def.x];
    const centerZ: number[] = [def.z];
    for (let f = 0; f < def.floors; f++) {
        for (const r of def.rooms[f]) {
            centerX.push((r.minX + r.maxX) / 2);
            centerZ.push((r.minZ + r.maxZ) / 2);
        }
    }
    const g: NavGraph = {
        def,
        count,
        floorBase,
        centerX,
        centerZ,
        edges: Array.from({ length: count }, () => []),
        towardOut: new Int32Array(count).fill(-1),
        towardPlayer: new Int32Array(count).fill(-1),
        entranceNode: new Int32Array(def.entrances.length).fill(-1),
        playerNode: -1,
        dist: new Float32Array(count),
    };

    for (let f = 0; f < def.floors; f++) {
        for (const d of def.doorways[f]) {
            const alongZ = d.along === 'z';
            const ax = alongZ ? d.x - SIDE_PROBE : d.x;
            const az = alongZ ? d.z : d.z - SIDE_PROBE;
            const bx = alongZ ? d.x + SIDE_PROBE : d.x;
            const bz = alongZ ? d.z : d.z + SIDE_PROBE;
            const ra = roomIndexAt(def, f, ax, az, 0);
            const rb = roomIndexAt(def, f, bx, bz, 0);
            if (ra < 0 || rb < 0 || ra === rb) continue;
            const na = floorBase[f] + ra;
            const nb = floorBase[f] + rb;
            const ux = alongZ ? 1 : 0;
            const uz = alongZ ? 0 : 1;
            const w = Math.hypot(centerX[na] - centerX[nb], centerZ[na] - centerZ[nb]);
            connect(
                g,
                na,
                nb,
                { px: d.x, pz: d.z, bx: d.x + ux * 0.9, bz: d.z + uz * 0.9, stairs: false, w },
                { px: d.x, pz: d.z, bx: d.x - ux * 0.9, bz: d.z - uz * 0.9, stairs: false, w }
            );
        }
    }

    for (const fl of def.flights) {
        const alongX = fl.axis === 'x';
        const cx = (fl.rect.minX + fl.rect.maxX) / 2;
        const cz = (fl.rect.minZ + fl.rect.maxZ) / 2;
        const sign = fl.end >= fl.start ? 1 : -1;
        const at = (s: number): [number, number] => (alongX ? [s, cz] : [cx, s]);
        const [sx, sz] = at(fl.start);
        const [ex, ez] = at(fl.end);
        const [bottomX, bottomZ] = at(fl.start + sign * PLATEAU_CENTER);
        const [topX, topZ] = at(fl.end - sign * PLATEAU_CENTER);
        const lower = roomIndexNear(def, fl.from, bottomX, bottomZ);
        const upper = roomIndexNear(def, fl.to, topX, topZ);
        if (lower < 0 || upper < 0) continue;
        const nl = floorBase[fl.from] + lower;
        const nu = floorBase[fl.to] + upper;
        const w = Math.hypot(sx - ex, sz - ez) + STAIR_COST;
        connect(
            g,
            nl,
            nu,
            { px: bottomX, pz: bottomZ, bx: topX, bz: topZ, stairs: true, w },
            { px: topX, pz: topZ, bx: bottomX, bz: bottomZ, stairs: true, w }
        );
    }

    for (let i = 0; i < def.entrances.length; i++) {
        const e = def.entrances[i];
        const room = roomIndexNear(def, 0, e.x - e.nx * 0.9, e.z - e.nz * 0.9);
        if (room < 0) continue;
        const node = floorBase[0] + room;
        g.entranceNode[i] = node;
        const w = Math.hypot(centerX[node] - e.x, centerZ[node] - e.z) + OUT_PENALTY;
        connect(
            g,
            OUT_NODE,
            node,
            { px: e.x + e.nx * 0.6, pz: e.z + e.nz * 0.6, bx: e.x - e.nx * 1.1, bz: e.z - e.nz * 1.1, stairs: false, w },
            { px: e.x, pz: e.z, bx: e.x + e.nx * 1.5, bz: e.z + e.nz * 1.5, stairs: false, w }
        );
    }

    solve(g, OUT_NODE, g.towardOut);
    return g;
}

function solve(g: NavGraph, target: number, table: Int32Array) {
    const dist = g.dist;
    dist.fill(Infinity);
    table.fill(-1);
    dist[target] = 0;
    const done = new Uint8Array(g.count);
    for (let step = 0; step < g.count; step++) {
        let u = -1;
        let best = Infinity;
        for (let i = 0; i < g.count; i++) {
            if (!done[i] && dist[i] < best) {
                best = dist[i];
                u = i;
            }
        }
        if (u < 0) break;
        done[u] = 1;
        const list = g.edges[u];
        for (let k = 0; k < list.length; k++) {
            const e = list[k];
            const nd = best + e.w;
            if (nd < dist[e.to]) {
                dist[e.to] = nd;
                table[e.to] = e.rev;
            }
        }
    }
}

export function graphFor(index: number): NavGraph {
    let g = graphs[index];
    if (!g) {
        g = buildGraph(buildings[index]);
        graphs[index] = g;
    }
    return g;
}

export function nodeAt(g: NavGraph, floor: number, x: number, z: number): number {
    const f = floor < 0 ? 0 : floor >= g.def.floors ? g.def.floors - 1 : floor;
    const room = roomIndexNear(g.def, f, x, z);
    return room < 0 ? -1 : g.floorBase[f] + room;
}

export function setPlayerNode(g: NavGraph, node: number) {
    if (g.playerNode === node) return;
    g.playerNode = node;
    solve(g, node, g.towardPlayer);
}

export function nodeDistance(g: NavGraph, node: number): number {
    return g.dist[node];
}

export function hopToward(g: NavGraph, node: number, target: number, x: number, z: number, out: Hop): boolean {
    if (node < 0 || node === target) return false;
    const table = target === OUT_NODE ? g.towardOut : g.towardPlayer;
    const ei = table[node];
    if (ei < 0) return false;
    const e = g.edges[node][ei];
    const d = Math.hypot(e.px - x, e.pz - z);
    if (d > PORTAL_REACH) {
        out.x = e.px;
        out.z = e.pz;
        out.arrived = false;
    } else {
        out.x = e.bx;
        out.z = e.bz;
        out.arrived = true;
    }
    out.stairs = e.stairs;
    return true;
}

export type EntranceChoice = { x: number; z: number; nx: number; nz: number; index: number };

export function nearestEntrance(g: NavGraph, x: number, z: number, maxDist: number, out: EntranceChoice): boolean {
    const def = g.def;
    let best = maxDist;
    let found = false;
    const useGraph = g.playerNode >= 0;
    for (let i = 0; i < def.entrances.length; i++) {
        const e = def.entrances[i];
        if (useGraph) {
            const node = g.entranceNode[i];
            if (node < 0 || g.dist[node] === Infinity) continue;
        }
        const dx = wrapDelta(e.x - x);
        const dz = wrapDelta(e.z - z);
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < best) {
            best = d;
            out.x = x + dx;
            out.z = z + dz;
            out.nx = e.nx;
            out.nz = e.nz;
            out.index = i;
            found = true;
        }
    }
    return found;
}
