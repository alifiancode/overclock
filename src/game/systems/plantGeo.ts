import { MeshBuilder, mixRgb, rgb, type Rgb } from './meshBuilder.ts';
import type { Rng } from './random.ts';

export type VegSink = { solid: MeshBuilder; leaf: MeshBuilder };

const GRASS_BASE: Rgb[] = [rgb(0x245f22), rgb(0x34782a), rgb(0x4a9430), rgb(0x66a436)];
const GRASS_TIP: Rgb[] = [rgb(0x4f9a38), rgb(0x6cb83e), rgb(0x92cc48), rgb(0xb4cc52)];
const FERN_BASE = rgb(0x2b7a30);
const FERN_TIP = rgb(0x62bb46);
const BIGLEAF_BASE = rgb(0x1f7a30);
const BIGLEAF_TIP = rgb(0x4fb04a);
const BUSH_COLORS: Rgb[] = [rgb(0x2f7a2c), rgb(0x3d9a34), rgb(0x52b040), rgb(0x78a838), rgb(0x3a8c4c)];
const PETALS: Rgb[] = [rgb(0xf6f1e2), rgb(0xf8d52c), rgb(0xf26aa8), rgb(0xb472e8), rgb(0xf48a28), rgb(0xe83c3c), rgb(0x6c8cf2)];
const STEM = rgb(0x3d8a2e);
const REED_BASE = rgb(0x6a8a34);
const REED_TIP = rgb(0xa8b050);
const CATTAIL = rgb(0x5a3a22);
const LILY = rgb(0x2f8a3c);
const LILY_ALT = rgb(0x3f9a46);
const LILY_FLOWER: Rgb[] = [rgb(0xf48ac0), rgb(0xf6f1e2), rgb(0xf8d52c)];

function pickTone(list: Rgb[], t: number): Rgb {
    const f = Math.max(0, Math.min(0.999, t)) * (list.length - 1);
    const i = Math.floor(f);
    return mixRgb(list[i], list[i + 1], f - i);
}

export type LeafShape = 'blade' | 'frond';

export function bentLeaf(mb: MeshBuilder, len: number, wid: number, rise: number, droop: number, segs: number, base: Rgb, tip: Rgb, shape: LeafShape) {
    const ds = len / segs;
    const width = (t: number) => (shape === 'blade' ? wid * (1 - t * 0.92) : wid * Math.min(1, 0.4 + t * 2.4) * (1 - t * t));
    let y = 0;
    let z = 0;
    for (let k = 0; k < segs; k++) {
        const t0 = k / segs;
        const t1 = (k + 1) / segs;
        const theta = rise - droop * (t0 + t1) * 0.5;
        const y1 = y + Math.sin(theta) * ds;
        const z1 = z + Math.cos(theta) * ds;
        const w0 = width(t0) / 2;
        const w1 = width(t1) / 2;
        const col = mixRgb(base, tip, (t0 + t1) * 0.5);
        if (k === segs - 1) {
            mb.tri([w0, y, z], [-w0, y, z], [0, y1, z1], col, 1.05);
        } else {
            mb.quad([w0, y, z], [-w0, y, z], [-w1, y1, z1], [w1, y1, z1], col, 0.85 + 0.2 * t0, 0.85 + 0.2 * t1);
        }
        y = y1;
        z = z1;
    }
}

export function addGrass(sink: VegSink, rng: Rng, x: number, y: number, z: number, scale: number, tone: number) {
    const mb = sink.leaf;
    const count = 5 + Math.floor(rng() * 3);
    const base = pickTone(GRASS_BASE, tone);
    const tip = pickTone(GRASS_TIP, tone);
    mb.push();
    mb.translate(x, y, z);
    mb.rotateY(rng() * 6.283);
    mb.scale(scale, scale, scale);
    mb.extraMode = 'height';
    mb.extraBase = y;
    mb.extraScale = 1.6 / scale;
    for (let i = 0; i < count; i++) {
        mb.push();
        mb.rotateY((i / count) * 6.283 + rng() * 0.9);
        mb.translate(0, 0, 0.03 + rng() * 0.1);
        bentLeaf(mb, 0.4 + rng() * 0.45, 0.07 + rng() * 0.04, 1.1 + rng() * 0.35, 0.5 + rng() * 0.6, 2, base, tip, 'blade');
        mb.pop();
    }
    mb.pop();
}

export function addFern(sink: VegSink, rng: Rng, x: number, y: number, z: number, scale: number) {
    const mb = sink.leaf;
    const count = 7 + Math.floor(rng() * 3);
    mb.push();
    mb.translate(x, y, z);
    mb.rotateY(rng() * 6.283);
    mb.scale(scale, scale, scale);
    mb.extraMode = 'height';
    mb.extraBase = y;
    mb.extraScale = 0.9 / scale;
    mb.jitter = 0.08;
    for (let i = 0; i < count; i++) {
        mb.push();
        mb.rotateY((i / count) * 6.283 + rng() * 0.5);
        mb.translate(0, 0.05, 0.04);
        bentLeaf(mb, 0.85 + rng() * 0.4, 0.34, 0.75 + rng() * 0.45, 1.0 + rng() * 0.6, 3, FERN_BASE, FERN_TIP, 'frond');
        mb.pop();
    }
    mb.jitter = 0;
    mb.pop();
}

export function addBigLeaf(sink: VegSink, rng: Rng, x: number, y: number, z: number, scale: number) {
    const mb = sink.leaf;
    const count = 4 + Math.floor(rng() * 3);
    mb.push();
    mb.translate(x, y, z);
    mb.rotateY(rng() * 6.283);
    mb.scale(scale, scale, scale);
    mb.extraMode = 'height';
    mb.extraBase = y;
    mb.extraScale = 0.8 / scale;
    mb.jitter = 0.1;
    for (let i = 0; i < count; i++) {
        mb.push();
        mb.rotateY((i / count) * 6.283 + rng() * 0.7);
        mb.translate(0, 0, 0.05);
        bentLeaf(mb, 1.25 + rng() * 0.6, 0.62 + rng() * 0.25, 0.95 + rng() * 0.3, 1.1 + rng() * 0.5, 3, BIGLEAF_BASE, BIGLEAF_TIP, 'frond');
        mb.pop();
    }
    mb.jitter = 0;
    mb.pop();
}

export function addBush(sink: VegSink, rng: Rng, x: number, y: number, z: number, scale: number, palette: number, flowering: number) {
    const mb = sink.solid;
    const count = 3 + Math.floor(rng() * 3);
    const base = BUSH_COLORS[palette % BUSH_COLORS.length];
    mb.push();
    mb.translate(x, y, z);
    mb.rotateY(rng() * 6.283);
    mb.upBlend = 0.55;
    mb.extraMode = 'const';
    mb.extraValue = 0.3;
    mb.jitter = 0.1;
    for (let i = 0; i < count; i++) {
        const r = (0.42 + rng() * 0.4) * scale;
        mb.blob((rng() - 0.5) * 0.95 * scale, r * 0.62, (rng() - 0.5) * 0.95 * scale, r, r * 0.78, r, i === 0 ? 1 : 0, mixRgb(base, BUSH_COLORS[(palette + 1) % BUSH_COLORS.length], rng() * 0.5), 0.14, 0.55, 0.1);
    }
    mb.jitter = 0;
    if (flowering > 0) {
        const petal = PETALS[Math.floor(flowering * 997) % PETALS.length];
        const dots = 6 + Math.floor(rng() * 6);
        for (let i = 0; i < dots; i++) {
            const a = rng() * 6.283;
            const d = rng() * 0.6 * scale;
            mb.gem(Math.cos(a) * d, (0.55 + rng() * 0.35) * scale, Math.sin(a) * d, 0.07, petal, 0.1);
        }
    }
    mb.upBlend = 0;
    mb.pop();
}

export function addFlowers(sink: VegSink, rng: Rng, x: number, y: number, z: number, scale: number, colorIndex: number) {
    const mb = sink.leaf;
    const count = 3 + Math.floor(rng() * 3);
    const petal = PETALS[colorIndex % PETALS.length];
    mb.push();
    mb.translate(x, y, z);
    mb.rotateY(rng() * 6.283);
    mb.scale(scale, scale, scale);
    mb.extraMode = 'height';
    mb.extraBase = y;
    mb.extraScale = 0.9 / scale;
    for (let i = 0; i < count; i++) {
        const a = rng() * 6.283;
        const d = rng() * 0.32;
        const h = 0.26 + rng() * 0.3;
        mb.push();
        mb.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
        mb.quad([0.012, 0, 0], [-0.012, 0, 0], [-0.008, h, 0], [0.008, h, 0], STEM);
        mb.quad([0, 0, -0.012], [0, 0, 0.012], [0, h, 0.008], [0, h, -0.008], STEM);
        mb.translate(0, h, 0);
        mb.rotateY(rng() * 6.283);
        const petals = 6;
        for (let k = 0; k < petals; k++) {
            mb.push();
            mb.rotateY((k / petals) * 6.283);
            mb.quad([0.014, 0, 0.012], [-0.014, 0, 0.012], [-0.045, 0.03, 0.115], [0.045, 0.03, 0.115], petal, 0.95, 1.1);
            mb.pop();
        }
        mb.tri([0.03, 0.012, 0], [-0.03, 0.012, 0], [0, 0.012, 0.045], rgb(0xf8c828));
        mb.tri([0, 0.012, -0.045], [-0.03, 0.012, 0], [0.03, 0.012, 0], rgb(0xf8c828));
        mb.pop();
    }
    for (let i = 0; i < 2; i++) {
        mb.push();
        mb.rotateY(rng() * 6.283);
        bentLeaf(mb, 0.3 + rng() * 0.15, 0.1, 0.6, 0.8, 2, FERN_BASE, FERN_TIP, 'frond');
        mb.pop();
    }
    mb.pop();
}

export function addReeds(sink: VegSink, rng: Rng, x: number, y: number, z: number, scale: number) {
    const mb = sink.leaf;
    const count = 8 + Math.floor(rng() * 5);
    mb.push();
    mb.translate(x, y, z);
    mb.rotateY(rng() * 6.283);
    mb.scale(scale, scale, scale);
    mb.extraMode = 'height';
    mb.extraBase = y;
    mb.extraScale = 0.7 / scale;
    for (let i = 0; i < count; i++) {
        const a = rng() * 6.283;
        const d = rng() * 0.45;
        mb.push();
        mb.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
        mb.rotateY(rng() * 6.283);
        bentLeaf(mb, 1.1 + rng() * 1.0, 0.055, 1.35 + rng() * 0.15, 0.35 + rng() * 0.5, 3, REED_BASE, REED_TIP, 'blade');
        mb.pop();
    }
    const sol = sink.solid;
    sol.extraMode = 'const';
    sol.extraValue = 0.5;
    for (let i = 0; i < 3; i++) {
        const a = rng() * 6.283;
        const d = rng() * 0.4;
        const h = 1.1 + rng() * 0.7;
        sol.push();
        sol.translate(x, y, z);
        sol.scale(scale, scale, scale);
        sol.cylinder(Math.cos(a) * d, h - 0.3, Math.sin(a) * d, 0.04, 0.04, 0.28, 5, CATTAIL);
        sol.pop();
    }
    mb.pop();
}

export function addLilyPads(sink: VegSink, rng: Rng, x: number, y: number, z: number, scale: number) {
    const mb = sink.solid;
    const count = 2 + Math.floor(rng() * 3);
    mb.extraMode = 'const';
    mb.extraValue = 0;
    for (let i = 0; i < count; i++) {
        const a = rng() * 6.283;
        const d = rng() * 0.9 * scale;
        const r = (0.28 + rng() * 0.25) * scale;
        mb.disc(x + Math.cos(a) * d, y, z + Math.sin(a) * d, r, 8, rng() < 0.5 ? LILY : LILY_ALT);
        if (rng() < 0.22) {
            const f = LILY_FLOWER[Math.floor(rng() * LILY_FLOWER.length)];
            mb.blob(x + Math.cos(a) * d, y + 0.06, z + Math.sin(a) * d, 0.09, 0.07, 0.09, 0, f, 0, 0.3, 0.05);
        }
    }
}

export function addMushrooms(sink: VegSink, rng: Rng, x: number, y: number, z: number, scale: number) {
    const mb = sink.solid;
    const count = 2 + Math.floor(rng() * 3);
    const caps = [rgb(0xc8402e), rgb(0xe8d8b0), rgb(0xd8903a), rgb(0xa86a8a)];
    const cap = caps[Math.floor(rng() * caps.length)];
    mb.extraMode = 'const';
    mb.extraValue = 0;
    for (let i = 0; i < count; i++) {
        const a = rng() * 6.283;
        const d = rng() * 0.25 * scale;
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        const h = (0.08 + rng() * 0.1) * scale;
        mb.cylinder(px, y, pz, 0.025 * scale, 0.03 * scale, h, 5, rgb(0xe8e0cc));
        mb.blob(px, y + h, pz, 0.08 * scale, 0.05 * scale, 0.08 * scale, 0, cap, 0, 0.4, 0.05);
    }
}
