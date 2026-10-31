import { WORLD_SIZE } from '../data/constants.ts';
import { insideFootprint } from './footprints.ts';
import { circleBlocked } from './scatter.ts';
import { getWaterDepth } from './terrain.ts';
import { wrapIndex } from './wrap.ts';

export const FLOW_CELL = 2;
export const FLOW_RADIUS = 34;

const N = WORLD_SIZE / FLOW_CELL;
const SIZE = FLOW_RADIUS * 2 + 1;
const WARM_SIZE = SIZE + 6;
const WARM_TOTAL = WARM_SIZE * WARM_SIZE;
const REBUILD_MOVE = 2;
const REBUILD_AGE = 18;
const FREE = 1;
const WET = 2;
const BLOCKED = 3;
const WET_COST = 3;
const DEEP_WATER = 1.9;
const DIAGONAL = Math.SQRT2;
const NEIGHBORS: readonly (readonly [number, number])[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
];

const BUILD_MS = 0.6;
const CHECK_EVERY = 8;

const classCache = new Uint8Array(N * N);
const localClass = new Uint8Array(SIZE * SIZE);
let cost = new Float32Array(SIZE * SIZE);
let nextCost = new Float32Array(SIZE * SIZE);
const heapKeys = new Float32Array(SIZE * SIZE * 9);
const heapVals = new Int32Array(SIZE * SIZE * 9);
let heapSize = 0;
let originX = 0;
let originZ = 0;
let nextOriginX = 0;
let nextOriginZ = 0;
let building = false;
let valid = false;
let lastTag = '';
let lastCx = 0;
let lastCz = 0;
let age = 0;
let warmX = 1e9;
let warmZ = 1e9;
let warmCursor = WARM_TOTAL;

function classify(ix: number, iz: number): number {
    const slot = wrapIndex(iz, N) * N + wrapIndex(ix, N);
    const known = classCache[slot];
    if (known !== 0) return known;
    const x = (ix + 0.5) * FLOW_CELL;
    const z = (iz + 0.5) * FLOW_CELL;
    let result = FREE;
    if (insideFootprint(x, z, 0.9)) result = BLOCKED;
    else if (circleBlocked(x, z, 0.62)) result = BLOCKED;
    else {
        const depth = getWaterDepth(x, z);
        if (depth > DEEP_WATER) result = BLOCKED;
        else if (depth > 0.05) result = WET;
    }
    classCache[slot] = result;
    return result;
}

export function isWalkable(x: number, z: number): boolean {
    return classify(Math.floor(x / FLOW_CELL), Math.floor(z / FLOW_CELL)) !== BLOCKED;
}

function heapPush(key: number, value: number) {
    let i = heapSize++;
    while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heapKeys[parent] <= key) break;
        heapKeys[i] = heapKeys[parent];
        heapVals[i] = heapVals[parent];
        i = parent;
    }
    heapKeys[i] = key;
    heapVals[i] = value;
}

let poppedKey = 0;
let poppedVal = 0;

function heapPop() {
    poppedKey = heapKeys[0];
    poppedVal = heapVals[0];
    heapSize--;
    if (heapSize === 0) return;
    const key = heapKeys[heapSize];
    const value = heapVals[heapSize];
    let i = 0;
    for (;;) {
        let child = i * 2 + 1;
        if (child >= heapSize) break;
        if (child + 1 < heapSize && heapKeys[child + 1] < heapKeys[child]) child++;
        if (heapKeys[child] >= key) break;
        heapKeys[i] = heapKeys[child];
        heapVals[i] = heapVals[child];
        i = child;
    }
    heapKeys[i] = key;
    heapVals[i] = value;
}

function localCell(lx: number, lz: number): number {
    const idx = lz * SIZE + lx;
    let cls = localClass[idx];
    if (cls === 0) {
        cls = classify(nextOriginX + lx, nextOriginZ + lz);
        localClass[idx] = cls;
    }
    return cls;
}

function startBuild(cx: number, cz: number, seeds: readonly number[], tag: string) {
    lastTag = tag;
    lastCx = cx;
    lastCz = cz;
    age = 0;
    nextOriginX = cx - FLOW_RADIUS;
    nextOriginZ = cz - FLOW_RADIUS;
    nextCost.fill(Infinity);
    localClass.fill(0);
    heapSize = 0;
    for (let i = 0; i + 2 < seeds.length; i += 3) {
        const lx = Math.floor(seeds[i] / FLOW_CELL) - nextOriginX;
        const lz = Math.floor(seeds[i + 1] / FLOW_CELL) - nextOriginZ;
        if (lx < 0 || lz < 0 || lx >= SIZE || lz >= SIZE) continue;
        const idx = lz * SIZE + lx;
        const offset = seeds[i + 2];
        if (nextCost[idx] <= offset) continue;
        nextCost[idx] = offset;
        heapPush(offset, idx);
    }
    building = true;
}

function stepBuild() {
    const start = performance.now();
    let counter = 0;
    while (heapSize > 0) {
        if (++counter % CHECK_EVERY === 0 && performance.now() - start > BUILD_MS) return;
        heapPop();
        const d = poppedKey;
        const idx = poppedVal;
        if (d > nextCost[idx]) continue;
        const lx = idx % SIZE;
        const lz = (idx - lx) / SIZE;
        for (let n = 0; n < 8; n++) {
            const dx = NEIGHBORS[n][0];
            const dz = NEIGHBORS[n][1];
            const nx = lx + dx;
            const nz = lz + dz;
            if (nx < 0 || nz < 0 || nx >= SIZE || nz >= SIZE) continue;
            const cls = localCell(nx, nz);
            if (cls === BLOCKED) continue;
            let step = cls === WET ? WET_COST : 1;
            if (dx !== 0 && dz !== 0) {
                if (localCell(nx, lz) === BLOCKED || localCell(lx, nz) === BLOCKED) continue;
                step *= DIAGONAL;
            }
            const nd = d + step;
            const nidx = nz * SIZE + nx;
            if (nd < nextCost[nidx]) {
                nextCost[nidx] = nd;
                heapPush(nd, nidx);
            }
        }
    }
    const swap = cost;
    cost = nextCost;
    nextCost = swap;
    originX = nextOriginX;
    originZ = nextOriginZ;
    valid = true;
    building = false;
}

export function buildFlow(centerX: number, centerZ: number, seeds: readonly number[], tag: string) {
    if (building) {
        stepBuild();
        return;
    }
    const cx = Math.floor(centerX / FLOW_CELL);
    const cz = Math.floor(centerZ / FLOW_CELL);
    if (valid && tag === lastTag) {
        const moved = Math.max(Math.abs(cx - lastCx), Math.abs(cz - lastCz));
        age++;
        if (moved === 0 || (moved < REBUILD_MOVE && age < REBUILD_AGE)) return;
    }
    startBuild(cx, cz, seeds, tag);
    stepBuild();
}

export function invalidateFlow() {
    valid = false;
    building = false;
    heapSize = 0;
    lastTag = '';
}

export function warmFlow(centerX: number, centerZ: number, budget: number) {
    const cx = Math.floor(centerX / FLOW_CELL);
    const cz = Math.floor(centerZ / FLOW_CELL);
    if (Math.abs(cx - warmX) > 5 || Math.abs(cz - warmZ) > 5) {
        warmX = cx;
        warmZ = cz;
        warmCursor = 0;
    }
    const base = FLOW_RADIUS + 3;
    while (warmCursor < WARM_TOTAL && budget > 0) {
        const i = warmCursor % WARM_SIZE;
        const j = (warmCursor - i) / WARM_SIZE;
        const ix = warmX - base + i;
        const iz = warmZ - base + j;
        if (classCache[wrapIndex(iz, N) * N + wrapIndex(ix, N)] === 0) {
            classify(ix, iz);
            budget--;
        }
        warmCursor++;
    }
}

export function flowCostAt(x: number, z: number): number {
    if (!valid) return Infinity;
    const lx = Math.floor(x / FLOW_CELL) - originX;
    const lz = Math.floor(z / FLOW_CELL) - originZ;
    if (lx < 0 || lz < 0 || lx >= SIZE || lz >= SIZE) return Infinity;
    return cost[lz * SIZE + lx];
}

export function flowDirection(x: number, z: number, out: { x: number; z: number }): boolean {
    if (!valid) return false;
    const lx = Math.floor(x / FLOW_CELL) - originX;
    const lz = Math.floor(z / FLOW_CELL) - originZ;
    if (lx < 1 || lz < 1 || lx >= SIZE - 1 || lz >= SIZE - 1) return false;
    let best = cost[lz * SIZE + lx];
    let bx = 0;
    let bz = 0;
    let found = false;
    for (let n = 0; n < 8; n++) {
        const dx = NEIGHBORS[n][0];
        const dz = NEIGHBORS[n][1];
        const c = cost[(lz + dz) * SIZE + lx + dx];
        if (c >= best) continue;
        if (dx !== 0 && dz !== 0 && (cost[lz * SIZE + lx + dx] === Infinity || cost[(lz + dz) * SIZE + lx] === Infinity)) continue;
        best = c;
        bx = dx;
        bz = dz;
        found = true;
    }
    if (!found) return false;
    const tx = (originX + lx + bx + 0.5) * FLOW_CELL - x;
    const tz = (originZ + lz + bz + 0.5) * FLOW_CELL - z;
    const len = Math.sqrt(tx * tx + tz * tz) || 1;
    out.x = tx / len;
    out.z = tz / len;
    return true;
}
