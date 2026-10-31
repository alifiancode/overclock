import { MeshBuilder, mixRgb, rgb, type Rgb } from './meshBuilder.ts';
import { createRng, type Rng } from './random.ts';
import { bentLeaf, type VegSink } from './plantGeo.ts';
import type { TreeInst } from './scatter.ts';

const BARKS: Rgb[] = [rgb(0x5c4634), rgb(0x6a5440), rgb(0x4e3c2e), rgb(0x76624a)];
const DEAD_BARK = rgb(0x70655a);
const PALM_BARK_A = rgb(0x8a7458);
const PALM_BARK_B = rgb(0x6e5a44);
const MOSS = rgb(0x4a7a2e);
const VINE = rgb(0x2a6a2c);
const VINE_TIP = rgb(0x4a8a36);
const BLOSSOMS: Rgb[] = [rgb(0xf26aa8), rgb(0xe8403a), rgb(0xf8d52c), rgb(0xf48a28), rgb(0xf6f1e2)];

function leafColor(tint: number, level: number): Rgb {
    const dark = mixRgb(rgb(0x1a5026), rgb(0x2c5a22), tint);
    const mid = mixRgb(rgb(0x2b7a30), rgb(0x4a8a2c), tint);
    const light = mixRgb(rgb(0x55ac42), rgb(0x8cba3e), tint);
    return level < 0.5 ? mixRgb(dark, mid, level * 2) : mixRgb(mid, light, (level - 0.5) * 2);
}

function both(sink: VegSink, fn: (mb: MeshBuilder) => void) {
    fn(sink.solid);
    fn(sink.leaf);
}

function setSway(mb: MeshBuilder, value: number) {
    mb.extraMode = 'const';
    mb.extraValue = value;
}

function addVines(sink: VegSink, rng: Rng, count: number, radius: number, top: number, length: number, s: number) {
    const mb = sink.leaf;
    setSway(mb, 0.7);
    for (let i = 0; i < count; i++) {
        const a = rng() * 6.283;
        const r = radius * (0.55 + rng() * 0.45);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const len = length * (0.6 + rng() * 0.6);
        const w = (0.07 + rng() * 0.06) * s;
        mb.push();
        mb.translate(x, top, z);
        mb.rotateY(rng() * 6.283);
        mb.quad([w, 0, 0], [-w, 0, 0], [-w * 0.8, -len * 0.5, 0.06 * s], [w * 0.8, -len * 0.5, 0.06 * s], VINE, 1, 0.9);
        mb.quad([w * 0.8, -len * 0.5, 0.06 * s], [-w * 0.8, -len * 0.5, 0.06 * s], [-w * 0.4, -len, 0.02 * s], [w * 0.4, -len, 0.02 * s], VINE_TIP, 0.9, 1);
        mb.pop();
    }
}

function addBlossoms(sink: VegSink, rng: Rng, count: number, cy: number, radius: number, height: number, color: Rgb) {
    const mb = sink.solid;
    setSway(mb, 0.45);
    for (let i = 0; i < count; i++) {
        const a = rng() * 6.283;
        const d = Math.sqrt(rng()) * radius * 0.9;
        const y = cy + height * Math.sqrt(Math.max(0, 1 - (d / radius) * (d / radius))) * (0.8 + rng() * 0.3);
        mb.blob(Math.cos(a) * d, y, Math.sin(a) * d, 0.2, 0.15, 0.2, 0, color, 0, 0.2, 0.1);
    }
}

function jungleTree(sink: VegSink, rng: Rng, s: number, tint: number, flower: Rgb | null) {
    const mb = sink.solid;
    const bark = BARKS[Math.floor(rng() * BARKS.length)];
    const h = (3.4 + rng() * 0.9) * s;
    setSway(mb, 0);
    mb.upBlend = 0;
    mb.cylinder(0, 0, 0, 0.3 * s, 0.19 * s, h, 7, bark, bark, true, 0.7);
    mb.cylinder(0, 0, 0, 0.62 * s, 0.3 * s, 0.9 * s, 7, bark, bark, false, 0.6);
    const base = h + 0.2 * s;
    setSway(mb, 0.4);
    mb.upBlend = 0.4;
    mb.blob(0, base + 1.0 * s, 0, 2.5 * s, 1.7 * s, 2.5 * s, 1, leafColor(tint, 0.45), 0.14, 0.6, 0.07);
    const around = 4;
    for (let k = 0; k < around; k++) {
        const a = (k / around) * 6.283 + rng() * 0.9;
        const r = (1.5 + rng() * 0.5) * s;
        mb.blob(Math.cos(a) * r, base + (0.2 + rng() * 0.9) * s, Math.sin(a) * r, 1.5 * s, 1.1 * s, 1.5 * s, 0, leafColor(tint, 0.2 + rng() * 0.4), 0.12, 0.6, 0.08);
    }
    mb.blob((rng() - 0.5) * 0.8 * s, base + 2.1 * s, (rng() - 0.5) * 0.8 * s, 1.5 * s, 0.9 * s, 1.5 * s, 0, leafColor(tint, 0.85), 0.1, 0.6, 0.06);
    mb.upBlend = 0;
    addVines(sink, rng, 3 + Math.floor(rng() * 3), 2.2 * s, base + 0.3 * s, 2.6 * s, s);
    if (flower) addBlossoms(sink, rng, 10, base + 1.4 * s, 2.0 * s, 1.0 * s, flower);
}

function tallTree(sink: VegSink, rng: Rng, s: number, tint: number, flower: Rgb | null) {
    const mb = sink.solid;
    const bark = BARKS[Math.floor(rng() * BARKS.length)];
    const h = (4.3 + rng() * 0.8) * s;
    setSway(mb, 0);
    mb.upBlend = 0;
    mb.cylinder(0, 0, 0, 0.36 * s, 0.2 * s, h, 7, bark, bark, true, 0.7);
    mb.cylinder(0, 0, 0, 0.7 * s, 0.36 * s, 1.1 * s, 7, bark, bark, false, 0.6);
    for (let k = 0; k < 2; k++) {
        mb.push();
        mb.translate(0, h * (0.62 + k * 0.18), 0);
        mb.rotateY(rng() * 6.283);
        mb.rotateZ(0.9);
        mb.cylinder(0, 0, 0, 0.1 * s, 0.05 * s, 1.5 * s, 5, bark, bark, true, 1);
        mb.pop();
    }
    setSway(mb, 0.4);
    mb.upBlend = 0.4;
    const top = h + 0.4 * s;
    mb.blob(0, top + 0.7 * s, 0, 2.7 * s, 2.0 * s, 2.7 * s, 1, leafColor(tint, 0.4), 0.14, 0.6, 0.07);
    for (let k = 0; k < 5; k++) {
        const a = (k / 5) * 6.283 + rng() * 0.7;
        const r = (1.8 + rng() * 0.6) * s;
        mb.blob(Math.cos(a) * r, top + (-0.5 + rng() * 1.1) * s, Math.sin(a) * r, 1.6 * s, 1.2 * s, 1.6 * s, 0, leafColor(tint, 0.15 + rng() * 0.5), 0.12, 0.6, 0.08);
    }
    mb.blob(0, top + 2.3 * s, 0, 1.6 * s, 1.0 * s, 1.6 * s, 0, leafColor(tint, 0.9), 0.1, 0.6, 0.06);
    mb.upBlend = 0;
    addVines(sink, rng, 4, 2.6 * s, top, 3.4 * s, s);
    if (flower) addBlossoms(sink, rng, 12, top + 1.5 * s, 2.3 * s, 1.1 * s, flower);
}

function palmTree(sink: VegSink, rng: Rng, s: number, tint: number) {
    const segs = 5;
    const lean = 0.07 + rng() * 0.05;
    const dir = rng() * 6.283;
    both(sink, (mb) => {
        mb.rotateY(dir);
    });
    const L = 1.0 * s;
    setSway(sink.solid, 0);
    sink.solid.upBlend = 0;
    for (let k = 0; k < segs; k++) {
        const r0 = (0.2 - k * 0.018) * s;
        const r1 = (0.2 - (k + 1) * 0.018) * s;
        sink.solid.cylinder(0, 0, 0, r0, r1, L, 6, k % 2 === 0 ? PALM_BARK_A : PALM_BARK_B, k % 2 === 0 ? PALM_BARK_A : PALM_BARK_B, false, 0.85);
        both(sink, (mb) => {
            mb.translate(0, L, 0);
            mb.rotateX(lean);
        });
    }
    const leaf = sink.leaf;
    setSway(leaf, 1.0);
    const fronds = 9;
    const light = mixRgb(rgb(0x3f8a3a), rgb(0x6aa83a), tint);
    const tip = mixRgb(rgb(0x5aa844), rgb(0x9cc850), tint);
    for (let k = 0; k < fronds; k++) {
        leaf.push();
        leaf.rotateY((k / fronds) * 6.283 + rng() * 0.4);
        leaf.translate(0, 0.05 * s, 0.05 * s);
        bentLeaf(leaf, (1.9 + rng() * 0.5) * s, 0.5 * s, 0.55 + rng() * 0.25, 1.5 + rng() * 0.5, 4, light, tip, 'frond');
        leaf.pop();
    }
    setSway(sink.solid, 0.3);
    for (let k = 0; k < 3; k++) {
        const a = (k / 3) * 6.283 + rng();
        sink.solid.blob(Math.cos(a) * 0.2 * s, -0.12 * s, Math.sin(a) * 0.2 * s, 0.13 * s, 0.13 * s, 0.13 * s, 0, rgb(0x5a3a22), 0, 0.2, 0.05);
    }
}

function deadTree(sink: VegSink, rng: Rng, s: number) {
    const mb = sink.solid;
    const h = (3.2 + rng() * 1.0) * s;
    setSway(mb, 0);
    mb.upBlend = 0;
    mb.cylinder(0, 0, 0, 0.3 * s, 0.12 * s, h, 6, DEAD_BARK, DEAD_BARK, true, 0.75);
    mb.cylinder(0, 0, 0, 0.5 * s, 0.3 * s, 0.6 * s, 6, DEAD_BARK, DEAD_BARK, false, 0.65);
    const branches = 4 + Math.floor(rng() * 3);
    for (let k = 0; k < branches; k++) {
        const len = (1.0 + rng() * 1.1) * s;
        mb.push();
        mb.translate(0, h * (0.45 + rng() * 0.5), 0);
        mb.rotateY(rng() * 6.283);
        mb.rotateZ(0.7 + rng() * 0.5);
        mb.cylinder(0, 0, 0, 0.09 * s, 0.035 * s, len, 5, DEAD_BARK, DEAD_BARK, true, 1);
        mb.translate(0, len, 0);
        mb.rotateZ(-0.6 - rng() * 0.4);
        mb.cylinder(0, 0, 0, 0.04 * s, 0.015 * s, len * 0.6, 4, DEAD_BARK, DEAD_BARK, true, 1);
        mb.pop();
    }
    mb.upBlend = 0.4;
    mb.blob(0.05 * s, 0.12 * s, 0.05 * s, 0.55 * s, 0.22 * s, 0.55 * s, 0, MOSS, 0.1, 0.5, 0.08);
    mb.upBlend = 0;
    addVines(sink, rng, 3, 0.9 * s, h * 0.85, 2.0 * s, s);
}

function banyanTree(sink: VegSink, rng: Rng, s: number, tint: number) {
    const mb = sink.solid;
    const bark = BARKS[Math.floor(rng() * BARKS.length)];
    const h = 2.9 * s;
    setSway(mb, 0);
    mb.upBlend = 0;
    mb.cylinder(0, 0, 0, 0.72 * s, 0.46 * s, h, 8, bark, bark, true, 0.7);
    mb.cylinder(0, 0, 0, 1.1 * s, 0.72 * s, 0.9 * s, 8, bark, bark, false, 0.6);
    const roots = 4;
    for (let k = 0; k < roots; k++) {
        const a = (k / roots) * 6.283 + rng() * 0.8;
        mb.push();
        mb.rotateY(a);
        mb.translate((1.9 + rng() * 0.8) * s, 0, 0);
        mb.rotateZ(0.32 + rng() * 0.1);
        mb.cylinder(0, 0, 0, 0.26 * s, 0.13 * s, 3.5 * s, 6, bark, bark, true, 0.75);
        mb.pop();
    }
    setSway(mb, 0.4);
    mb.upBlend = 0.4;
    const base = h + 0.3 * s;
    mb.blob(0, base + 0.9 * s, 0, 3.0 * s, 1.8 * s, 3.0 * s, 1, leafColor(tint, 0.4), 0.14, 0.6, 0.07);
    const ring = 6;
    for (let k = 0; k < ring; k++) {
        const a = (k / ring) * 6.283 + rng() * 0.6;
        const r = (2.3 + rng() * 0.5) * s;
        mb.blob(Math.cos(a) * r, base + (0.1 + rng() * 0.8) * s, Math.sin(a) * r, 1.7 * s, 1.1 * s, 1.7 * s, 0, leafColor(tint, 0.15 + rng() * 0.5), 0.12, 0.6, 0.08);
    }
    mb.upBlend = 0;
    addVines(sink, rng, 8, 2.8 * s, base + 0.2 * s, 3.4 * s, s);
}

function willowTree(sink: VegSink, rng: Rng, s: number, tint: number) {
    const mb = sink.solid;
    const bark = BARKS[Math.floor(rng() * BARKS.length)];
    const h = 2.6 * s;
    setSway(mb, 0);
    mb.upBlend = 0;
    mb.cylinder(0, 0, 0, 0.34 * s, 0.2 * s, h, 7, bark, bark, true, 0.7);
    mb.cylinder(0, 0, 0, 0.55 * s, 0.34 * s, 0.7 * s, 7, bark, bark, false, 0.6);
    setSway(mb, 0.35);
    mb.upBlend = 0.4;
    const light = mixRgb(rgb(0x6aa842), rgb(0x9cc450), tint);
    mb.blob(0, h + 0.6 * s, 0, 2.3 * s, 1.2 * s, 2.3 * s, 1, light, 0.12, 0.6, 0.06);
    mb.upBlend = 0;
    const leaf = sink.leaf;
    setSway(leaf, 0.85);
    const strands = 16;
    const stem = mixRgb(rgb(0x6a9a3a), rgb(0x8aba48), tint);
    const end = mixRgb(rgb(0x88b548), rgb(0xb4d060), tint);
    for (let k = 0; k < strands; k++) {
        const a = (k / strands) * 6.283 + rng() * 0.3;
        const r = (1.5 + rng() * 0.7) * s;
        const len = (2.1 + rng() * 1.0) * s;
        const w = 0.13 * s;
        leaf.push();
        leaf.translate(Math.cos(a) * r, h + 0.35 * s, Math.sin(a) * r);
        leaf.rotateY(-a);
        leaf.quad([0, 0, w], [0, 0, -w], [0.12 * s, -len * 0.4, -w * 0.9], [0.12 * s, -len * 0.4, w * 0.9], stem, 1, 0.92);
        leaf.quad([0.12 * s, -len * 0.4, w * 0.9], [0.12 * s, -len * 0.4, -w * 0.9], [0.16 * s, -len * 0.8, -w * 0.6], [0.16 * s, -len * 0.8, w * 0.6], mixRgb(stem, end, 0.5), 0.92, 0.95);
        leaf.quad([0.16 * s, -len * 0.8, w * 0.6], [0.16 * s, -len * 0.8, -w * 0.6], [0.14 * s, -len, 0], [0.14 * s, -len, 0], end, 0.95, 1.05);
        leaf.pop();
    }
}

const TREE_SIZE = 0.78;

export function addTree(sink: VegSink, tree: TreeInst, lx: number, lz: number) {
    const rng = createRng(tree.seed);
    const size = tree.scale * TREE_SIZE;
    const tint = rng();
    const flowerRoll = rng();
    const flower = flowerRoll < 0.1 ? BLOSSOMS[Math.floor(rng() * BLOSSOMS.length)] : null;
    sink.solid.jitter = 0.05;
    both(sink, (mb) => {
        mb.push();
        mb.translate(lx, tree.y - 0.08, lz);
        mb.rotateY(tree.rot);
    });
    const lean = (rng() - 0.5) * 0.08;
    both(sink, (mb) => {
        mb.rotateZ(lean);
    });
    switch (tree.kind) {
        case 'jungle':
            jungleTree(sink, rng, size, tint, flower);
            break;
        case 'tall':
            tallTree(sink, rng, size, tint, flower);
            break;
        case 'palm':
            palmTree(sink, rng, size, tint);
            break;
        case 'dead':
            deadTree(sink, rng, size);
            break;
        case 'banyan':
            banyanTree(sink, rng, size, tint);
            break;
        case 'willow':
            willowTree(sink, rng, size, tint);
            break;
    }
    sink.solid.jitter = 0;
    sink.solid.upBlend = 0;
    both(sink, (mb) => {
        mb.pop();
    });
}
