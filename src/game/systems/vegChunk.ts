import type { BufferGeometry } from 'three';
import { CHUNK_SIZE, WATER_LEVEL } from '../data/constants.ts';
import { createRng, hash01, hashInts, worldSeed } from './random.ts';
import { MeshBuilder } from './meshBuilder.ts';
import { createBiome, sampleBiome, trailMask } from './terrain.ts';
import { chunkOrigin, getChunk } from './scatter.ts';
import { buildings, insideFootprint } from './footprints.ts';
import { isPointInPolygon } from './buildingShapes.ts';
import { wrapDelta } from './wrap.ts';
import { addBigLeaf, addBush, addFern, addFlowers, addGrass, addLilyPads, addMushrooms, addReeds, type VegSink } from './plantGeo.ts';
import { addTree } from './treeGeo.ts';
import { addProp, addRock } from './propGeo.ts';

export type VegGeometry = { solid: BufferGeometry | null; leaf: BufferGeometry | null };

const SEED = worldSeed | 0;
const CELL = 2;
const CELLS = CHUNK_SIZE / CELL;
const CELLS_PER_SLICE = 6;
const SOLID_CAPACITY = 98304;
const LEAF_CAPACITY = 49152;
const biome = createBiome();

function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

function plantCell(sink: VegSink, gx: number, gz: number, ox: number, oz: number, i: number, j: number) {
    const r = (k: number) => hash01(gx, gz, SEED + 700 + k);
    const lx = (i + 0.1 + r(1) * 0.8) * CELL;
    const lz = (j + 0.1 + r(2) * 0.8) * CELL;
    const x = ox + lx;
    const z = oz + lz;
    const b = sampleBiome(x, z, biome);
    const rng = createRng(hashInts(gx, gz, SEED + 777));
    sink.leaf.jitter = 0.07;

    if (b.water > 0.02) {
        if (b.water < 1.2 && r(3) < 0.13) addLilyPads(sink, rng, lx, WATER_LEVEL + 0.03, lz, 0.8 + r(4) * 0.6);
        else if (b.water < 0.3 && r(5) < 0.3) addReeds(sink, rng, lx, b.height, lz, 0.8 + r(6) * 0.5);
        sink.leaf.jitter = 0;
        return;
    }
    if (insideFootprint(x, z, 0.5)) {
        sink.leaf.jitter = 0;
        return;
    }

    const trail = trailMask(x, z) * (1 - b.city);
    const veg = clamp01((0.3 + 0.7 * b.fertility) * (1 - 0.85 * b.dirt) * (1 - 0.92 * trail));
    const cover = 1 - b.city + b.city * (0.45 + 0.55 * b.overgrowth);
    const surface = 1 - 0.93 * b.road - 0.62 * b.sidewalk;
    const base = veg * cover * Math.max(0, surface);
    const y = b.height;
    const forest = b.forest;

    if (b.shore > 0.55 && b.height - WATER_LEVEL < 0.55 && r(7) < 0.4 * (0.4 + b.fertility)) {
        addReeds(sink, rng, lx, y, lz, 0.8 + r(8) * 0.6);
    }

    const grassP = 0.66 * base * (1 - 0.4 * forest);
    if (r(9) < grassP) {
        const tone = clamp01(0.2 + b.fertility * 0.55 + b.flowers * 0.3 - forest * 0.2 + (r(10) - 0.5) * 0.4);
        addGrass(sink, rng, lx, y, lz, 0.8 + r(11) * 0.7, tone);
        if (r(12) < grassP * 0.7) addGrass(sink, rng, lx + (r(13) - 0.5) * 1.4, b.height, lz + (r(14) - 0.5) * 1.4, 0.7 + r(15) * 0.6, tone);
    }
    if (b.road > 0.3 && b.road < 0.99) {
        if (r(16) < 0.05 * b.overgrowth) addGrass(sink, rng, lx, y, lz, 0.7 + r(17) * 0.5, 0.4);
    }
    if (r(18) < (0.06 + 0.52 * forest) * base) {
        addFern(sink, rng, lx, y, lz, 0.75 + r(19) * 0.6);
    }
    if (r(20) < (0.02 + 0.13 * forest + 0.05 * b.shore) * base) {
        addBigLeaf(sink, rng, lx, y, lz, 0.8 + r(21) * 0.6);
    }
    const bushP = (0.05 + 0.34 * b.bush + 0.09 * forest) * base + 0.1 * b.city * b.overgrowth * (1 - b.road) * (1 - b.sidewalk);
    if (r(22) < bushP) {
        addBush(sink, rng, lx, y, lz, 0.85 + r(23) * 0.75, Math.floor(r(24) * 5), r(25) < 0.12 ? r(26) : 0);
    }
    const flowerP = (0.03 + 0.58 * b.flowers) * base;
    if (r(27) < flowerP) {
        const patch = hashInts(Math.floor(x / 11), Math.floor(z / 11), SEED + 710);
        addFlowers(sink, rng, lx, y, lz, 0.9 + r(28) * 0.5, r(29) < 0.7 ? patch % 7 : Math.floor(r(30) * 7));
    }
    if (r(31) < 0.045 * forest * veg) addMushrooms(sink, rng, lx, y, lz, 0.9 + r(32) * 0.6);
    sink.leaf.jitter = 0;
}

function* overgrowBuildings(sink: VegSink, ox: number, oz: number): Generator<void, void> {
    const centerX = ox + CHUNK_SIZE / 2;
    const centerZ = oz + CHUNK_SIZE / 2;
    for (let n = 0; n < buildings.length; n++) {
        const b = buildings[n];
        const reach = CHUNK_SIZE / 2 + b.radius + 2;
        if (Math.abs(wrapDelta(b.x - centerX)) > reach || Math.abs(wrapDelta(b.z - centerZ)) > reach) continue;
        const poly = b.polygon;
        for (let e = 0; e < poly.length; e++) {
            if (e % 3 === 2) yield;
            const p0 = poly[e];
            const p1 = poly[(e + 1) % poly.length];
            const dx = p1.x - p0.x;
            const dz = p1.z - p0.z;
            const len = Math.hypot(dx, dz);
            if (len < 1.2) continue;
            let nx = -dz / len;
            let nz = dx / len;
            const midX = (p0.x + p1.x) / 2;
            const midZ = (p0.z + p1.z) / 2;
            if (isPointInPolygon(midX + nx * 0.5, midZ + nz * 0.5, poly)) {
                nx = -nx;
                nz = -nz;
            }
            const slots = Math.max(1, Math.floor(len / 2.6));
            for (let k = 0; k < slots; k++) {
                const h = hashInts(b.index * 131 + e, k, SEED + 880);
                const roll = (h & 1023) / 1024;
                if (roll > 0.62) continue;
                const t = (k + 0.2 + ((h >> 10) & 255) / 255 * 0.6) / slots;
                const off = 0.55 + (((h >> 18) & 127) / 127) * 0.8;
                const wx = p0.x + dx * t + nx * off;
                const wz = p0.z + dz * t + nz * off;
                const lx = wrapDelta(wx - ox);
                const lz = wrapDelta(wz - oz);
                if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
                let blocked = false;
                for (const en of b.entrances) {
                    if (Math.hypot(wx - en.x, wz - en.z) < en.width / 2 + 1.5) blocked = true;
                }
                if (blocked) continue;
                const rng = createRng(h);
                const y = sampleBiome(wx, wz, biome).height;
                if (biome.water > 0.02) continue;
                const kind = rng();
                if (kind < 0.55) addBush(sink, rng, lx, y, lz, 0.9 + rng() * 0.8, Math.floor(rng() * 5), rng() < 0.25 ? rng() : 0);
                else if (kind < 0.8) addBigLeaf(sink, rng, lx, y, lz, 0.9 + rng() * 0.6);
                else addFern(sink, rng, lx, y, lz, 1 + rng() * 0.6);
            }
        }
    }
}

export function* buildVegetation(cx: number, cz: number, done: (geometry: VegGeometry) => void): Generator<void, void> {
    const ox = chunkOrigin(cx);
    const oz = chunkOrigin(cz);
    const chunk = getChunk(cx, cz);
    const rng = createRng(hashInts(cx, cz, SEED + 600));
    const solid = new MeshBuilder(rng, SOLID_CAPACITY);
    const leaf = new MeshBuilder(rng, LEAF_CAPACITY);
    leaf.upBlend = 0.55;
    const sink: VegSink = { solid, leaf };

    for (let i = 0; i < chunk.trees.length; i++) {
        const t = chunk.trees[i];
        addTree(sink, t, t.x - ox, t.z - oz);
        yield;
    }
    for (let i = 0; i < chunk.rocks.length; i++) {
        const r = chunk.rocks[i];
        addRock(sink, r, r.x - ox, r.z - oz);
        if (i % 2 === 1) yield;
    }
    yield;
    for (let i = 0; i < chunk.props.length; i++) {
        const p = chunk.props[i];
        addProp(sink, p, p.x - ox, p.z - oz);
        yield;
    }
    yield* overgrowBuildings(sink, ox, oz);
    yield;
    const gx0 = Math.floor(ox / CELL);
    const gz0 = Math.floor(oz / CELL);
    for (let j = 0; j < CELLS; j++) {
        for (let i = 0; i < CELLS; i++) {
            plantCell(sink, gx0 + i, gz0 + j, ox, oz, i, j);
            if (i % CELLS_PER_SLICE === CELLS_PER_SLICE - 1) yield;
        }
    }
    const solidGeometry = solid.vertexCount > 0 ? yield* solid.buildGradual() : null;
    const leafGeometry = leaf.vertexCount > 0 ? yield* leaf.buildGradual() : null;
    done({ solid: solidGeometry, leaf: leafGeometry });
}
