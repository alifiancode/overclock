export const PATH_MAX = 24;

export type PlanBlocked = (x: number, z: number) => boolean;

export const planResult = { complete: false, expansions: 0 };

const CELL = 0.3;
const SPAN = 60;
const CELLS = SPAN * SPAN;
const EXPANSION_LIMIT = 1500;
const GOAL_TOLERANCE = 0.45;
const MAX_REACH = 13;
const DIAGONAL = 1.4142136;
const HEURISTIC_WEIGHT = 1.12;
const HEAP_CAPACITY = CELLS * 6;

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];

const seen = new Uint32Array(CELLS);
const closed = new Uint32Array(CELLS);
const solidSeen = new Uint32Array(CELLS);
const solid = new Uint8Array(CELLS);
const cost = new Float32Array(CELLS);
const parent = new Int16Array(CELLS);
const chain = new Int16Array(CELLS);
const heapKey = new Float32Array(HEAP_CAPACITY);
const heapVal = new Int32Array(HEAP_CAPACITY);

let heapSize = 0;
let run = 0;
let originX = 0;
let originZ = 0;
let test: PlanBlocked = () => false;

function heapPush(key: number, value: number) {
    if (heapSize >= HEAP_CAPACITY) return;
    let i = heapSize++;
    while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapKey[p] <= key) break;
        heapKey[i] = heapKey[p];
        heapVal[i] = heapVal[p];
        i = p;
    }
    heapKey[i] = key;
    heapVal[i] = value;
}

function heapPop(): number {
    const top = heapVal[0];
    heapSize--;
    if (heapSize > 0) {
        const key = heapKey[heapSize];
        const value = heapVal[heapSize];
        let i = 0;
        for (;;) {
            let c = i * 2 + 1;
            if (c >= heapSize) break;
            if (c + 1 < heapSize && heapKey[c + 1] < heapKey[c]) c++;
            if (heapKey[c] >= key) break;
            heapKey[i] = heapKey[c];
            heapVal[i] = heapVal[c];
            i = c;
        }
        heapKey[i] = key;
        heapVal[i] = value;
    }
    return top;
}

function isSolid(i: number, j: number): boolean {
    const idx = j * SPAN + i;
    if (solidSeen[idx] !== run) {
        solidSeen[idx] = run;
        solid[idx] = test(originX + (i + 0.5) * CELL, originZ + (j + 0.5) * CELL) ? 1 : 0;
    }
    return solid[idx] === 1;
}

function estimate(i: number, j: number, tx: number, tz: number): number {
    const dx = Math.abs(originX + (i + 0.5) * CELL - tx) / CELL;
    const dz = Math.abs(originZ + (j + 0.5) * CELL - tz) / CELL;
    return (dx > dz ? dx + (DIAGONAL - 1) * dz : dz + (DIAGONAL - 1) * dx) * HEURISTIC_WEIGHT;
}

function clampCell(v: number): number {
    return v < 0 ? 0 : v >= SPAN ? SPAN - 1 : v;
}

export function planPath(sx: number, sz: number, gx: number, gz: number, blocked: PlanBlocked, out: Float32Array): number {
    run++;
    test = blocked;
    let tx = gx;
    let tz = gz;
    const dist = Math.hypot(gx - sx, gz - sz);
    let truncated = false;
    if (dist > MAX_REACH) {
        const k = MAX_REACH / dist;
        tx = sx + (gx - sx) * k;
        tz = sz + (gz - sz) * k;
        truncated = true;
    }
    originX = (sx + tx) / 2 - (SPAN * CELL) / 2;
    originZ = (sz + tz) / 2 - (SPAN * CELL) / 2;
    const si = clampCell(Math.floor((sx - originX) / CELL));
    const sj = clampCell(Math.floor((sz - originZ) / CELL));
    const start = sj * SPAN + si;
    solidSeen[start] = run;
    solid[start] = 0;
    seen[start] = run;
    cost[start] = 0;
    parent[start] = -1;
    heapSize = 0;
    heapPush(estimate(si, sj, tx, tz), start);

    let best = start;
    let bestDistance = Infinity;
    let reached = -1;
    let expansions = 0;

    while (heapSize > 0 && expansions < EXPANSION_LIMIT) {
        const cur = heapPop();
        if (closed[cur] === run) continue;
        closed[cur] = run;
        expansions++;
        const ci = cur % SPAN;
        const cj = (cur - ci) / SPAN;
        const remaining = Math.hypot(originX + (ci + 0.5) * CELL - tx, originZ + (cj + 0.5) * CELL - tz);
        if (remaining < bestDistance) {
            bestDistance = remaining;
            best = cur;
        }
        if (remaining <= GOAL_TOLERANCE) {
            reached = cur;
            break;
        }
        const base = cost[cur];
        for (let n = 0; n < 8; n++) {
            const ni = ci + DX[n];
            const nj = cj + DZ[n];
            if (ni < 0 || nj < 0 || ni >= SPAN || nj >= SPAN) continue;
            const idx = nj * SPAN + ni;
            if (closed[idx] === run) continue;
            if (isSolid(ni, nj)) continue;
            if (n >= 4 && (isSolid(ni, cj) || isSolid(ci, nj))) continue;
            const g = base + (n < 4 ? 1 : DIAGONAL);
            if (seen[idx] !== run || g < cost[idx]) {
                seen[idx] = run;
                cost[idx] = g;
                parent[idx] = cur;
                heapPush(g + estimate(ni, nj, tx, tz), idx);
            }
        }
    }

    planResult.expansions = expansions;
    planResult.complete = reached >= 0 && !truncated;
    const end = reached >= 0 ? reached : best;
    if (end === start) return 0;

    let length = 0;
    for (let c = end; c !== -1 && length < CELLS; c = parent[c]) chain[length++] = c;

    let count = 0;
    let prevDx = 0;
    let prevDz = 0;
    for (let k = length - 2; k >= 0; k--) {
        const c = chain[k];
        const p = chain[k + 1];
        const dx = (c % SPAN) - (p % SPAN);
        const dz = Math.floor(c / SPAN) - Math.floor(p / SPAN);
        const turning = k === length - 2 ? false : dx !== prevDx || dz !== prevDz;
        if (turning) {
            const q = chain[k + 1];
            if (count < PATH_MAX) {
                out[count * 2] = originX + ((q % SPAN) + 0.5) * CELL;
                out[count * 2 + 1] = originZ + (Math.floor(q / SPAN) + 0.5) * CELL;
                count++;
            }
        }
        prevDx = dx;
        prevDz = dz;
    }
    const last = chain[0];
    if (count >= PATH_MAX) count = PATH_MAX - 1;
    out[count * 2] = originX + ((last % SPAN) + 0.5) * CELL;
    out[count * 2 + 1] = originZ + (Math.floor(last / SPAN) + 0.5) * CELL;
    return count + 1;
}
