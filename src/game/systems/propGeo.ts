import { MeshBuilder, mixRgb, rgb, type Rgb } from './meshBuilder.ts';
import { createRng, type Rng } from './random.ts';
import type { PropInst, RockInst } from './scatter.ts';
import type { VegSink } from './plantGeo.ts';

const CAR_COLORS: Rgb[] = [rgb(0x8a3a28), rgb(0x3a5a7a), rgb(0xb4b0a4), rgb(0x56684a), rgb(0xb89a30), rgb(0x34363c), rgb(0x7a3a58)];
const BUS_COLORS: Rgb[] = [rgb(0xb8a040), rgb(0x8a3a30), rgb(0xa8aca4), rgb(0x3a6a58)];
const GLASS = rgb(0x1c2a32);
const TYRE = rgb(0x1a1a1c);
const MOSS = rgb(0x4a7a2e);
const MOSS_DARK = rgb(0x2f5a26);
const METAL = rgb(0x4a4e50);
const METAL_LIGHT = rgb(0x6a7074);
const CONCRETE = rgb(0x8f8c82);
const BRICK = rgb(0x8a4a3a);
const WOOD = rgb(0x6a4a30);
const ROCKS: Rgb[] = [rgb(0x746e60), rgb(0x6a6a64), rgb(0x7e7462), rgb(0x5e5c56)];
const VINE = rgb(0x2a6a2c);

function setSway(mb: MeshBuilder, value: number) {
    mb.extraMode = 'const';
    mb.extraValue = value;
}

function drape(sink: VegSink, rng: Rng, x: number, y: number, z: number, length: number, count: number) {
    const mb = sink.leaf;
    setSway(mb, 0.6);
    for (let i = 0; i < count; i++) {
        const w = 0.09 + rng() * 0.07;
        const len = length * (0.5 + rng() * 0.7);
        mb.push();
        mb.translate(x + (rng() - 0.5) * 0.8, y, z + (rng() - 0.5) * 1.6);
        mb.rotateY(rng() * 6.283);
        mb.quad([w, 0, 0], [-w, 0, 0], [-w * 0.7, -len, 0.05], [w * 0.7, -len, 0.05], VINE, 1, 0.85);
        mb.pop();
    }
}

function overgrowth(sink: VegSink, rng: Rng, x: number, y: number, z: number, rx: number, rz: number) {
    const mb = sink.solid;
    setSway(mb, 0.25);
    mb.upBlend = 0.5;
    mb.blob(x, y, z, rx, 0.18, rz, 0, MOSS, 0.12, 0.5, 0.08);
    if (rng() < 0.6) mb.blob(x + (rng() - 0.5) * rx, y + 0.12, z + (rng() - 0.5) * rz, rx * 0.5, 0.3, rz * 0.4, 0, MOSS_DARK, 0.12, 0.5, 0.08);
    mb.upBlend = 0;
    setSway(mb, 0);
}

function car(sink: VegSink, rng: Rng, variant: number) {
    const mb = sink.solid;
    const body = mixRgb(CAR_COLORS[variant % CAR_COLORS.length], rgb(0x6a4a34), 0.25 + rng() * 0.2);
    setSway(mb, 0);
    mb.jitter = 0.04;
    mb.box(0, 0.6, 0, 1.8, 0.56, 4.2, body);
    mb.box(0, 1.18, -0.2, 1.6, 0.6, 2.2, body);
    mb.box(0, 1.2, -0.2, 1.64, 0.36, 2.24, GLASS);
    mb.box(0, 1.52, -0.2, 1.62, 0.08, 2.1, body);
    mb.box(0, 0.35, 2.08, 1.7, 0.2, 0.18, METAL);
    mb.box(0, 0.35, -2.08, 1.7, 0.2, 0.18, METAL);
    mb.jitter = 0;
    for (const sx of [-0.92, 0.92]) {
        for (const sz of [-1.3, 1.3]) {
            mb.push();
            mb.translate(sx, 0.34, sz);
            mb.rotateZ(Math.PI / 2);
            mb.cylinder(0, -0.1, 0, 0.34, 0.34, 0.2, 8, TYRE);
            mb.pop();
        }
    }
    overgrowth(sink, rng, 0, 1.6, -0.2, 0.7, 0.9);
    overgrowth(sink, rng, 0, 0.9, 1.3, 0.6, 0.7);
    drape(sink, rng, 0.9, 1.0, 0, 0.9, 2);
}

function bus(sink: VegSink, rng: Rng, variant: number) {
    const mb = sink.solid;
    const body = mixRgb(BUS_COLORS[variant % BUS_COLORS.length], rgb(0x6a4a34), 0.2 + rng() * 0.2);
    setSway(mb, 0);
    mb.jitter = 0.04;
    mb.box(0, 1.5, 0, 2.5, 2.1, 9.0, body);
    mb.box(0, 1.9, 0, 2.54, 0.8, 8.6, GLASS);
    mb.box(0, 2.62, 0, 2.4, 0.14, 8.8, rgb(0x8a8a84));
    mb.box(0, 0.5, 4.5, 2.4, 0.3, 0.2, METAL);
    mb.box(0, 0.5, -4.5, 2.4, 0.3, 0.2, METAL);
    mb.jitter = 0;
    for (const sx of [-1.2, 1.2]) {
        for (const sz of [-2.9, 2.9, 3.9]) {
            mb.push();
            mb.translate(sx, 0.45, sz);
            mb.rotateZ(Math.PI / 2);
            mb.cylinder(0, -0.14, 0, 0.45, 0.45, 0.28, 8, TYRE);
            mb.pop();
        }
    }
    overgrowth(sink, rng, 0, 2.7, -1.5, 0.9, 2.2);
    overgrowth(sink, rng, 0, 2.7, 2.5, 0.8, 1.2);
    drape(sink, rng, 1.25, 2.4, 0, 1.6, 4);
    drape(sink, rng, -1.25, 2.4, 0, 1.6, 3);
}

function lamp(sink: VegSink, fallen: boolean, rot: number) {
    const mb = sink.solid;
    setSway(mb, 0);
    mb.push();
    if (fallen) {
        mb.translate(0, 0.1, 0);
        mb.rotateY(rot);
        mb.rotateZ(Math.PI / 2 - 0.08);
        mb.cylinder(0, 0, 0, 0.08, 0.05, 4.4, 6, METAL);
        mb.box(0.55, 4.4, 0, 1.1, 0.08, 0.08, METAL);
        mb.box(1.1, 4.34, 0, 0.5, 0.12, 0.26, METAL_LIGHT);
    } else {
        mb.cylinder(0, 0, 0, 0.1, 0.06, 4.6, 6, METAL);
        mb.cylinder(0, 0, 0, 0.16, 0.1, 0.3, 6, METAL);
        mb.box(0.55, 4.55, 0, 1.1, 0.08, 0.08, METAL);
        mb.box(1.1, 4.5, 0, 0.5, 0.12, 0.26, METAL_LIGHT);
        mb.box(1.1, 4.42, 0, 0.4, 0.04, 0.2, rgb(0xd8c890));
    }
    mb.pop();
}

function barrier(sink: VegSink, variant: number) {
    const mb = sink.solid;
    setSway(mb, 0);
    mb.box(0, 0.2, 0, 2.4, 0.4, 0.62, CONCRETE);
    mb.box(0, 0.62, 0, 2.4, 0.44, 0.3, CONCRETE);
    const stripe = variant % 2 === 0 ? rgb(0xd8702a) : rgb(0xc8c4b0);
    for (let i = -2; i <= 2; i += 2) mb.box(i * 0.4, 0.7, 0, 0.36, 0.3, 0.32, stripe);
}

function dumpster(sink: VegSink, rng: Rng, variant: number) {
    const mb = sink.solid;
    const colors = [rgb(0x2f5a3a), rgb(0x3a4a6a), rgb(0x6a3a2c)];
    const col = mixRgb(colors[variant % colors.length], rgb(0x5a4a34), 0.25);
    setSway(mb, 0);
    mb.jitter = 0.05;
    mb.box(0, 0.62, 0, 1.9, 0.95, 1.2, col);
    mb.jitter = 0;
    mb.push();
    mb.translate(0, 1.1, -0.6);
    mb.rotateX(-0.35);
    mb.box(0, 0.04, 0.6, 1.94, 0.08, 1.24, METAL);
    mb.pop();
    mb.box(0.3, 1.14, 0.2, 0.5, 0.2, 0.4, rgb(0x5a5a50));
    mb.box(-0.4, 1.12, 0.1, 0.4, 0.14, 0.3, rgb(0x8a8470));
    overgrowth(sink, rng, 0, 1.15, 0, 0.5, 0.4);
}

function bench(sink: VegSink) {
    const mb = sink.solid;
    setSway(mb, 0);
    mb.box(0, 0.45, 0, 1.8, 0.06, 0.5, WOOD);
    mb.box(0, 0.78, -0.22, 1.8, 0.4, 0.05, WOOD);
    mb.box(-0.75, 0.22, 0, 0.08, 0.44, 0.46, METAL);
    mb.box(0.75, 0.22, 0, 0.08, 0.44, 0.46, METAL);
}

function rubble(sink: VegSink, rng: Rng, scale: number) {
    const mb = sink.solid;
    setSway(mb, 0);
    const count = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
        const sx = (0.3 + rng() * 0.5) * scale;
        const sy = (0.18 + rng() * 0.4) * scale;
        const sz = (0.3 + rng() * 0.5) * scale;
        mb.push();
        mb.translate((rng() - 0.5) * 1.6 * scale, sy * 0.5, (rng() - 0.5) * 1.6 * scale);
        mb.rotateY(rng() * 6.283);
        mb.rotateZ((rng() - 0.5) * 0.5);
        mb.box(0, 0, 0, sx, sy, sz, rng() < 0.3 ? BRICK : CONCRETE);
        mb.pop();
    }
    for (let i = 0; i < 2; i++) {
        mb.push();
        mb.translate((rng() - 0.5) * scale, 0.2 * scale, (rng() - 0.5) * scale);
        mb.rotateY(rng() * 6.283);
        mb.rotateZ(0.5 + rng() * 0.6);
        mb.cylinder(0, 0, 0, 0.025, 0.02, 0.9 * scale, 4, rgb(0x6a3a22));
        mb.pop();
    }
    overgrowth(sink, rng, 0, 0.3 * scale, 0, 0.6 * scale, 0.5 * scale);
}

function fountain(sink: VegSink, rng: Rng, scale: number) {
    const mb = sink.solid;
    setSway(mb, 0);
    const radius = 3.0 * scale;
    const segs = 14;
    const stone = rgb(0x9a968a);
    for (let i = 0; i < segs; i++) {
        const a = (i / segs) * 6.283;
        mb.push();
        mb.translate(Math.cos(a) * (radius - 0.25), 0.3, Math.sin(a) * (radius - 0.25));
        mb.rotateY(-a + Math.PI / 2);
        mb.box(0, 0, 0, radius * 0.47, 0.6, 0.5, stone);
        mb.pop();
    }
    mb.disc(0, 0.36, 0, radius - 0.45, 18, rgb(0x2f6a3a));
    mb.cylinder(0, 0, 0, 0.7, 0.5, 1.0, 8, stone);
    mb.cylinder(0, 1.0, 0, 1.2, 0.5, 0.3, 10, stone);
    mb.cylinder(0, 1.3, 0, 0.18, 0.14, 1.2, 6, stone);
    mb.blob(0, 2.7, 0, 0.45, 0.5, 0.35, 0, rgb(0x8a867a), 0.2, 0.4, 0.05);
    for (let i = 0; i < 5; i++) {
        const a = rng() * 6.283;
        const d = (0.4 + rng() * 0.5) * (radius - 0.6);
        overgrowth(sink, rng, Math.cos(a) * d, 0.38, Math.sin(a) * d, 0.5 + rng() * 0.5, 0.4 + rng() * 0.5);
    }
    drape(sink, rng, 0, 1.4, 0, 1.0, 3);
}

function hydrant(sink: VegSink) {
    const mb = sink.solid;
    setSway(mb, 0);
    const red = rgb(0x8a2e24);
    mb.cylinder(0, 0, 0, 0.15, 0.13, 0.62, 7, red);
    mb.blob(0, 0.66, 0, 0.14, 0.1, 0.14, 0, red, 0, 0.3, 0.02);
    mb.box(0.15, 0.4, 0, 0.12, 0.1, 0.1, METAL_LIGHT);
    mb.box(-0.15, 0.4, 0, 0.12, 0.1, 0.1, METAL_LIGHT);
}

function log(sink: VegSink, rng: Rng, scale: number) {
    const mb = sink.solid;
    setSway(mb, 0);
    const r = 0.36 * scale;
    const len = 2.8 * scale;
    const bark = rgb(0x5a4430);
    mb.push();
    mb.translate(0, r * 0.9, 0);
    mb.rotateX(Math.PI / 2);
    mb.cylinder(0, -len / 2, 0, r, r * 0.88, len, 7, bark, bark, true, 0.8);
    mb.pop();
    overgrowth(sink, rng, 0, r * 1.7, 0, r * 0.9, len * 0.32);
    mb.blob(0.2 * scale, r * 0.4, 0.9 * scale, 0.14 * scale, 0.1 * scale, 0.14 * scale, 0, rgb(0xe8d8b0), 0, 0.3, 0.05);
}

function stump(sink: VegSink, rng: Rng, scale: number) {
    const mb = sink.solid;
    setSway(mb, 0);
    const bark = rgb(0x5a4430);
    mb.cylinder(0, 0, 0, 0.5 * scale, 0.4 * scale, 0.6 * scale, 8, bark, rgb(0xb89868), true, 0.75);
    mb.cylinder(0, 0, 0, 0.7 * scale, 0.5 * scale, 0.22 * scale, 8, bark, bark, false, 0.7);
    overgrowth(sink, rng, 0.1 * scale, 0.5 * scale, 0, 0.3 * scale, 0.3 * scale);
}

function sign(sink: VegSink, rng: Rng) {
    const mb = sink.solid;
    setSway(mb, 0);
    const colors = [rgb(0xb83a2a), rgb(0x2a5aa0), rgb(0xc8a830), rgb(0x2a7a48)];
    mb.cylinder(0, 0, 0, 0.04, 0.035, 2.3, 5, METAL);
    mb.push();
    mb.translate(0, 2.1, 0);
    mb.rotateZ((rng() - 0.5) * 0.3);
    mb.box(0, 0, 0.04, 0.6, 0.6, 0.04, colors[Math.floor(rng() * colors.length)]);
    mb.pop();
}

export function addProp(sink: VegSink, prop: PropInst, lx: number, lz: number) {
    const rng = createRng(prop.variant * 7919 + Math.floor(prop.x * 31) + Math.floor(prop.z * 17));
    sink.solid.push();
    sink.leaf.push();
    sink.solid.translate(lx, prop.y, lz);
    sink.leaf.translate(lx, prop.y, lz);
    if (prop.kind !== 'lampFallen') {
        sink.solid.rotateY(prop.rot);
        sink.leaf.rotateY(prop.rot);
    }
    sink.solid.upBlend = 0;
    switch (prop.kind) {
        case 'car':
            car(sink, rng, prop.variant);
            break;
        case 'bus':
            bus(sink, rng, prop.variant);
            break;
        case 'lamp':
            lamp(sink, false, 0);
            break;
        case 'lampFallen':
            lamp(sink, true, prop.rot);
            break;
        case 'barrier':
            barrier(sink, prop.variant);
            break;
        case 'dumpster':
            dumpster(sink, rng, prop.variant);
            break;
        case 'bench':
            bench(sink);
            break;
        case 'rubble':
            rubble(sink, rng, prop.scale);
            break;
        case 'fountain':
            fountain(sink, rng, prop.scale);
            break;
        case 'hydrant':
            hydrant(sink);
            break;
        case 'log':
            log(sink, rng, prop.scale);
            break;
        case 'stump':
            stump(sink, rng, prop.scale);
            break;
        case 'sign':
            sign(sink, rng);
            break;
    }
    sink.solid.pop();
    sink.leaf.pop();
}

export function addRock(sink: VegSink, rock: RockInst, lx: number, lz: number) {
    const mb = sink.solid;
    const rng = createRng(rock.seed);
    const col = ROCKS[Math.floor(rng() * ROCKS.length)];
    const s = rock.scale;
    setSway(mb, 0);
    mb.push();
    mb.translate(lx, rock.y, lz);
    mb.rotateY(rock.rot);
    mb.upBlend = 0.15;
    mb.blob(0, 0.28 * s, 0, 0.66 * s, 0.46 * s, 0.58 * s, 1, col, 0.2, 0.5, 0.06);
    mb.blob(0.5 * s, 0.14 * s, 0.2 * s, 0.34 * s, 0.26 * s, 0.3 * s, 0, mixRgb(col, rgb(0x4a4840), 0.3), 0.18, 0.5, 0.06);
    mb.upBlend = 0.5;
    if (rng() < 0.7) mb.blob(-0.05 * s, 0.56 * s, 0, 0.46 * s, 0.14 * s, 0.4 * s, 0, MOSS, 0.12, 0.5, 0.08);
    mb.upBlend = 0;
    mb.pop();
}
