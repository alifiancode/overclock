import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { CHUNK_SIZE, WATER_LEVEL } from '../data/constants.ts';
import { hash01 } from './random.ts';
import { createBiome, fbm, getGridHeight, getGridNormal, sampleBiome, trailMask } from './terrain.ts';
import { chunkOrigin, getChunk, type TreeInst } from './scatter.ts';
import { wrapDelta } from './wrap.ts';
import { mixRgb, rgb, type Rgb } from './meshBuilder.ts';

const VERTS = CHUNK_SIZE + 1;
const ROWS_PER_SLICE = 3;

const GRASS_DARK = rgb(0x2c7428);
const GRASS_MID = rgb(0x3f8f2e);
const GRASS_BRIGHT = rgb(0x66b23c);
const GRASS_DRY = rgb(0x93a044);
const MEADOW = rgb(0x86bd4c);
const FOREST_FLOOR = rgb(0x1f4a1f);
const LITTER = rgb(0x5b4a2a);
const DIRT = rgb(0x84603a);
const DIRT_DARK = rgb(0x5a4128);
const MUD = rgb(0x4a3a26);
const SAND = rgb(0x9d8c5e);
const SEABED = rgb(0x44543a);
const CONCRETE = rgb(0x7b7a72);
const MOSS = rgb(0x4c8132);
const ROCK = rgb(0x706a5c);

function smooth(edge0: number, edge1: number, v: number): number {
    const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function canopyRadius(tree: TreeInst): number {
    const s = tree.scale * 0.78;
    switch (tree.kind) {
        case 'banyan':
            return 3.2 * s;
        case 'tall':
            return 3.0 * s;
        case 'palm':
            return 2.4 * s;
        case 'willow':
            return 3.0 * s;
        case 'dead':
            return 1.2 * s;
        default:
            return 2.8 * s;
    }
}

function splatCanopy(cx: number, cz: number, ox: number, oz: number, canopy: Float32Array) {
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const chunk = getChunk(cx + dx, cz + dz);
            for (let t = 0; t < chunk.trees.length; t++) {
                const tree = chunk.trees[t];
                const r = canopyRadius(tree);
                const rx = wrapDelta(tree.x - ox);
                const rz = wrapDelta(tree.z - oz);
                if (rx < -r || rx > CHUNK_SIZE + r || rz < -r || rz > CHUNK_SIZE + r) continue;
                const i0 = Math.max(0, Math.floor(rx - r));
                const i1 = Math.min(CHUNK_SIZE, Math.ceil(rx + r));
                const j0 = Math.max(0, Math.floor(rz - r));
                const j1 = Math.min(CHUNK_SIZE, Math.ceil(rz + r));
                for (let j = j0; j <= j1; j++) {
                    for (let i = i0; i <= i1; i++) {
                        const d = Math.hypot(i - rx, j - rz) / r;
                        if (d >= 1) continue;
                        const w = 1 - smooth(0.3, 1, d);
                        const k = j * VERTS + i;
                        canopy[k] = 1 - (1 - canopy[k]) * (1 - w);
                    }
                }
            }
        }
    }
}

const biome = createBiome();
const normal = { x: 0, y: 1, z: 0 };
const street = { strength: 0, moss: 0 };

function groundColor(x: number, z: number, ix: number, iz: number, canopy: number): Rgb {
    const b = sampleBiome(x, z, biome);
    const n1 = fbm(x, z, 36, 2, 91) * 0.5 + 0.5;
    const n2 = fbm(x, z, 110, 2, 92) * 0.5 + 0.5;
    const n3 = fbm(x, z, 300, 1, 93) * 0.5 + 0.5;
    const jitter = 1 + (hash01(ix, iz, 94) - 0.5) * 0.12;
    const trail = b.water > 0.02 ? 0 : trailMask(x, z) * (1 - b.city);

    let grass = mixRgb(GRASS_DARK, GRASS_MID, smooth(0.25, 0.75, n1 * 0.6 + b.fertility * 0.5 - 0.1));
    grass = mixRgb(grass, GRASS_BRIGHT, smooth(0.55, 0.9, n2 * 0.5 + b.fertility * 0.55 - 0.1) * 0.8);
    grass = mixRgb(grass, GRASS_DRY, smooth(0.5, 0.85, n3) * (1 - b.fertility) * 0.7);
    grass = mixRgb(grass, MEADOW, b.flowers * 0.75);

    let col = grass;
    const forestW = smooth(0.2, 0.8, b.forest);
    if (forestW > 0) col = mixRgb(col, mixRgb(FOREST_FLOOR, LITTER, smooth(0.35, 0.75, n2) * 0.8), forestW * 0.85);

    const dirtW = Math.min(1, smooth(0.12, 0.62, b.dirt + (n2 - 0.5) * 0.35) + trail);
    if (dirtW > 0) col = mixRgb(col, mixRgb(DIRT, DIRT_DARK, smooth(0.3, 0.8, n3)), dirtW);

    if (b.slope > 0.5) col = mixRgb(col, ROCK, smooth(0.5, 1.2, b.slope) * 0.8);

    if (b.city > 0.02) {
        const overgrown = smooth(0.05, 0.55, b.overgrowth * 0.8 + n1 * 0.5 - 0.1);
        const yard = mixRgb(CONCRETE, mixRgb(MOSS, grass, 0.55), overgrown);
        col = mixRgb(col, yard, smooth(0.05, 0.6, b.city) * (0.75 + 0.25 * (1 - overgrown)));
    }

    const lift = b.height - WATER_LEVEL;
    if (b.water > 0) {
        const seabed = mixRgb(MUD, SEABED, smooth(0, 1.4, b.water));
        col = mixRgb(col, mixRgb(seabed, SAND, smooth(0.5, 0.1, b.water) * 0.5), 1);
    } else if (lift < 0.9) {
        const wet = 1 - smooth(0.0, 0.9, lift);
        const shoreCol = mixRgb(MUD, SAND, smooth(0.35, 0.8, n3) * 0.55 + smooth(0.3, 0.9, lift) * 0.3);
        col = mixRgb(col, shoreCol, wet * 0.85 * (1 - b.road));
    }

    if (canopy > 0.01) {
        const shaded = mixRgb(col, mixRgb(FOREST_FLOOR, LITTER, 0.45), canopy * 0.4);
        const k = 1 - canopy * 0.38;
        col = [shaded[0] * k, shaded[1] * k, shaded[2] * k];
    }

    street.strength = smooth(0.18, 0.5, b.city);
    street.moss = smooth(0.15, 0.85, b.overgrowth * 0.7 + n1 * 0.5 - 0.1);
    return [col[0] * jitter, col[1] * jitter, col[2] * jitter];
}

export function* buildGround(cx: number, cz: number, done: (geometry: BufferGeometry) => void): Generator<void, void> {
    const ox = chunkOrigin(cx);
    const oz = chunkOrigin(cz);
    const count = VERTS * VERTS;
    const canopy = new Float32Array(count);
    splatCanopy(cx, cz, ox, oz, canopy);
    yield;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const streets = new Float32Array(count * 2);
    for (let j = 0; j < VERTS; j++) {
        const iz = oz + j;
        for (let i = 0; i < VERTS; i++) {
            const ix = ox + i;
            const k = j * VERTS + i;
            positions[k * 3] = i;
            positions[k * 3 + 1] = getGridHeight(ix, iz);
            positions[k * 3 + 2] = j;
            getGridNormal(ix, iz, normal);
            normals[k * 3] = normal.x;
            normals[k * 3 + 1] = normal.y;
            normals[k * 3 + 2] = normal.z;
            const c = groundColor(ix, iz, ix, iz, canopy[k]);
            colors[k * 3] = c[0];
            colors[k * 3 + 1] = c[1];
            colors[k * 3 + 2] = c[2];
            streets[k * 2] = street.strength;
            streets[k * 2 + 1] = street.moss;
        }
        if (j % ROWS_PER_SLICE === ROWS_PER_SLICE - 1) yield;
    }
    const indices = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * 6);
    let w = 0;
    for (let j = 0; j < CHUNK_SIZE; j++) {
        for (let i = 0; i < CHUNK_SIZE; i++) {
            const a = j * VERTS + i;
            const b = (j + 1) * VERTS + i;
            const c = (j + 1) * VERTS + i + 1;
            const d = j * VERTS + i + 1;
            indices[w++] = a;
            indices[w++] = b;
            indices[w++] = d;
            indices[w++] = b;
            indices[w++] = c;
            indices[w++] = d;
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('aStreet', new Float32BufferAttribute(streets, 2));
    geometry.setIndex(new Uint16BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    done(geometry);
}
