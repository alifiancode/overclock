import { mixRgb, rgb, type Rgb } from './meshBuilder.ts';
import { shade } from './bldCommon.ts';
import { BLACK, BRASS, CARDBOARD, CERAMIC, FABRICS, GLASS, LINENS, PAINTS, RUST, STEEL, STEEL_DARK, WHITE, WOODS, bottle, bowl, bread, bx, cup, cyl, flatItem, fruit, glow, paperStack, pickOf, plate, qy, qz, tin, tiltBox, type Pen } from './furnCommon.ts';

const CABINETS: Rgb[] = [0xd8d2c0, 0x6a8a7a, 0x8a5a3a, 0xb8c0c8, 0xe0d8b0, 0x5a6a8a].map(rgb);
const STONE: Rgb[] = [0x8a8a86, 0xb8b2a2, 0x4a4a4e, 0x9a9488].map(rgb);
const DRUMS: Rgb[] = [0x8a5436, 0x3f5f8a, 0x3f7a4f, 0xb8962f, 0x7a2f2f, 0x5a5e62].map(rgb);

function woodTone(p: Pen): Rgb {
    return mixRgb(rgb(p.style.wood), pickOf(WOODS, p.v), 0.45);
}

function kitchenBody(p: Pen, hw: number, hd: number, doors: boolean) {
    const cab = pickOf(CABINETS, p.v);
    const dark = shade(cab, 0.74);
    bx(p, -hw, 0.08, -hd, hw, 0.86, hd, cab);
    bx(p, -hw + 0.03, 0, -hd + 0.03, hw - 0.03, 0.08, hd - 0.06, shade(cab, 0.45));
    const top = pickOf(STONE, p.v, 1);
    bx(p, -hw - 0.01, 0.86, -hd - 0.01, hw + 0.01, 0.92, hd + 0.03, top, [shade(top, 0.8), shade(top, 0.8), shade(top, 1.1), undefined, shade(top, 0.8), shade(top, 0.8)]);
    if (doors) {
        const n = Math.max(1, Math.round(hw * 2 / 0.6));
        const cw = (hw * 2 - 0.08) / n;
        for (let i = 0; i < n; i++) {
            const x0 = -hw + 0.04 + i * cw;
            qz(p, x0 + 0.01, 0.14, x0 + cw - 0.01, 0.8, hd + 0.003, 1, dark);
            bx(p, x0 + cw / 2 - 0.02, 0.62, hd + 0.003, x0 + cw / 2 + 0.02, 0.74, hd + 0.02, BRASS);
        }
    }
    return top;
}

export function counter(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    kitchenBody(p, hw, hd, true);
    const k = p.v % 5;
    if (k === 0) {
        bx(p, -0.35, 0.92, -0.2, 0.05, 0.945, 0.15, woodTone(p));
        bread(p, -0.15, 0.945, 0);
    } else if (k === 1) {
        bowl(p, 0.1, 0.92, -0.05, 0.15, pickOf(LINENS, p.v), true);
    } else if (k === 2) {
        for (let i = 0; i < 3; i++) tin(p, -0.3 + i * 0.1, 0.92, -0.15, pickOf(PAINTS, p.v, i));
        cup(p, 0.25, 0.92, 0.0, pickOf(PAINTS, p.v, 4));
    } else if (k === 3) {
        bx(p, -0.2, 0.92, -0.2, 0.1, 1.08, 0.08, pickOf(CABINETS, p.v, 2));
        bx(p, -0.18, 1.08, -0.16, 0.08, 1.1, 0.04, STEEL);
    } else {
        cyl(p, 0.0, 0.92, -0.05, 0.1, 0.1, 0.22, 8, pickOf(PAINTS, p.v), pickOf(PAINTS, p.v), true);
    }
}

export function kitchenSink(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    kitchenBody(p, hw, hd, true);
    bx(p, -0.38, 0.9, -0.22, 0.2, 0.925, 0.2, STEEL);
    qy(p, -0.33, -0.17, 0.15, 0.15, 0.926, true, mixRgb(STEEL_DARK, rgb(0x1e2a30), 0.4));
    cyl(p, -0.08, 0.92, -hd + 0.08, 0.025, 0.025, 0.3, 6, STEEL, STEEL, true);
    tiltBox(p, -0.08, 1.24, -hd + 0.15, 0.035, 0.035, 0.22, 0, 0, 0, STEEL);
    const stack = 1 + (p.v % 4);
    for (let i = 0; i < stack; i++) plate(p, 0.45, 0.92 + i * 0.024, 0.0, 0.12);
    if (p.v % 2 === 0) cyl(p, 0.5, 0.92, -0.16, 0.09, 0.09, 0.09, 8, STEEL_DARK, STEEL_DARK, false);
}

export function stove(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const body = pickOf([WHITE, rgb(0xc8ccce), rgb(0x2a2c30)], p.v);
    bx(p, -hw, 0.0, -hd, hw, 0.9, hd, body);
    bx(p, -hw, 0.9, -hd, hw, 0.92, hd, BLACK);
    bx(p, -hw, 0.92, -hd, hw, 1.02, -hd + 0.06, body);
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            cyl(p, sx * 0.17, 0.92, sz * 0.14 - 0.02, 0.085, 0.085, 0.012, 10, shade(STEEL_DARK, 0.7), shade(STEEL_DARK, 0.6), true);
            cyl(p, sx * 0.17, 0.932, sz * 0.14 - 0.02, 0.04, 0.04, 0.008, 8, BLACK, BLACK, true);
        }
    }
    qz(p, -hw + 0.05, 0.08, hw - 0.05, 0.64, hd + 0.003, 1, GLASS, 0.9, 1.1);
    bx(p, -hw + 0.1, 0.67, hd + 0.003, hw - 0.1, 0.7, hd + 0.05, STEEL);
    for (let i = 0; i < 4; i++) bx(p, -hw + 0.1 + i * 0.17, 0.78, hd + 0.003, -hw + 0.15 + i * 0.17, 0.83, hd + 0.04, BLACK);
    if (p.v % 3 === 0) {
        cyl(p, 0.17, 0.932, 0.12, 0.11, 0.11, 0.1, 10, STEEL_DARK, shade(STEEL_DARK, 1.2), true);
        cyl(p, 0.17, 1.032, 0.12, 0.115, 0.115, 0.02, 10, STEEL, STEEL, true);
    }
}

export function fridge(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const h = p.piece.h;
    const body = pickOf([WHITE, rgb(0xc4c8ca), rgb(0xd8cfa8), rgb(0x8a9aa0)], p.v);
    const dark = shade(body, 0.7);
    if (p.v % 5 === 0) {
        bx(p, -hw, 0.04, -hd, -hw + 0.04, h, hd, body);
        bx(p, hw - 0.04, 0.04, -hd, hw, h, hd, body);
        bx(p, -hw, 0.04, -hd, hw, h, -hd + 0.04, shade(body, 0.9));
        bx(p, -hw, h - 0.04, -hd, hw, h, hd, body);
        bx(p, -hw, 0.04, -hd, hw, 0.1, hd, body);
        qz(p, -hw + 0.04, 0.1, hw - 0.04, h - 0.04, -hd + 0.041, 1, rgb(0xd2dadc));
        for (const y of [0.5, 0.9, 1.3]) bx(p, -hw + 0.04, y, -hd + 0.04, hw - 0.04, y + 0.02, hd - 0.02, rgb(0x9fb4b8));
        for (let i = 0; i < 3; i++) {
            tin(p, -0.2 + i * 0.1, 0.52, -0.1, pickOf(PAINTS, p.v, i));
            bottle(p, 0.15 - i * 0.07, 0.92, -0.1, pickOf(PAINTS, p.v, i + 3), 1);
        }
        fruit(p, 0.1, 1.32, -0.1, p.v % 5);
        fruit(p, -0.1, 1.32, -0.12, (p.v + 2) % 5);
        tiltBox(p, hw + 0.3, 0.95, hd + 0.3, 0.74, 1.7, 0.05, 0, 0.95, 0, body);
    } else {
        bx(p, -hw, 0.04, -hd, hw, h, hd, body);
        qz(p, -hw, 1.22, hw, 1.245, hd + 0.002, 1, dark);
        bx(p, hw - 0.12, 0.7, hd + 0.002, hw - 0.09, 1.12, hd + 0.04, STEEL);
        bx(p, hw - 0.12, 1.3, hd + 0.002, hw - 0.09, 1.65, hd + 0.04, STEEL);
        for (let i = 0; i < 3; i++) {
            const col = pickOf(PAINTS, p.v, i);
            qz(p, -hw + 0.1 + i * 0.12, 1.4 + (i % 2) * 0.1, -hw + 0.17 + i * 0.12, 1.47 + (i % 2) * 0.1, hd + 0.003, 1, col);
        }
        qz(p, -hw + 0.12, 1.0, -hw + 0.3, 1.14, hd + 0.003, 1, rgb(0xeae4cf));
    }
}

export function toilet(p: Pen) {
    const hd = p.piece.d / 2;
    cyl(p, 0, 0, 0.12, 0.1, 0.14, 0.22, 8, CERAMIC, CERAMIC, false);
    cyl(p, 0, 0.2, 0.1, 0.14, 0.2, 0.2, 10, CERAMIC, CERAMIC, false);
    cyl(p, 0, 0.4, 0.1, 0.2, 0.2, 0.03, 10, shade(CERAMIC, 0.96), shade(CERAMIC, 0.9), true);
    cyl(p, 0, 0.405, 0.1, 0.13, 0.13, 0.01, 10, rgb(0x6a7478), rgb(0x6a7478), true);
    bx(p, -0.19, 0.38, -hd, 0.19, 0.78, -hd + 0.2, CERAMIC);
    bx(p, -0.2, 0.78, -hd - 0.005, 0.2, 0.82, -hd + 0.21, shade(CERAMIC, 0.96));
    bx(p, 0.12, 0.76, -hd + 0.2, 0.17, 0.8, -hd + 0.23, STEEL);
}

export function bathSink(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    bx(p, -0.07, 0, -hd + 0.1, 0.07, 0.72, -hd + 0.2, CERAMIC);
    bx(p, -hw, 0.72, -hd, hw, 0.88, hd, CERAMIC);
    qy(p, -hw + 0.07, -hd + 0.05, hw - 0.07, hd - 0.08, 0.881, true, rgb(0xcbd3d4));
    cyl(p, 0, 0.88, -hd + 0.06, 0.02, 0.02, 0.14, 6, STEEL, STEEL, true);
    tiltBox(p, 0, 1.02, -hd + 0.11, 0.025, 0.025, 0.12, 0, 0, 0, STEEL);
    bx(p, -0.28, 1.12, -hd, 0.28, 1.76, -hd + 0.03, shade(woodTone(p), 0.8));
    qz(p, -0.25, 1.15, 0.25, 1.73, -hd + 0.032, 1, p.decay > 0.8 ? rgb(0x6a7a80) : rgb(0xa0b6c0), 0.8, 1.15);
}

export function bathtub(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    bx(p, -hw, 0.06, -hd, -hw + 0.07, 0.6, hd, CERAMIC);
    bx(p, hw - 0.07, 0.06, -hd, hw, 0.6, hd, CERAMIC);
    bx(p, -hw, 0.06, -hd, hw, 0.6, -hd + 0.07, CERAMIC);
    bx(p, -hw, 0.06, hd - 0.07, hw, 0.6, hd, CERAMIC);
    bx(p, -hw + 0.07, 0.06, -hd + 0.07, hw - 0.07, 0.2, hd - 0.07, rgb(0xc4cccc));
    const water = p.decay > 0.5 && p.v % 2 === 0;
    if (water) qy(p, -hw + 0.07, -hd + 0.07, hw - 0.07, hd - 0.07, 0.42, true, rgb(0x4a6a4a));
    cyl(p, -hw + 0.12, 0.6, 0.0, 0.02, 0.02, 0.14, 6, STEEL, STEEL, true);
    tiltBox(p, -hw + 0.18, 0.74, 0.0, 0.12, 0.025, 0.025, 0, 0, 0, STEEL);
    bx(p, -hw + 0.07, 0.6, hd - 0.14, -hw + 0.3, 0.64, hd - 0.07, pickOf(PAINTS, p.v));
}

export function shower(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const h = p.piece.h;
    bx(p, -hw, 0, -hd, hw, 0.08, hd, CERAMIC);
    qy(p, -hw + 0.06, -hd + 0.06, hw - 0.06, hd - 0.06, 0.081, true, rgb(0xbac4c6));
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) bx(p, sx * (hw - 0.02) - 0.02, 0.08, sz * (hd - 0.02) - 0.02, sx * (hw - 0.02) + 0.02, h, sz * (hd - 0.02) + 0.02, STEEL);
    }
    bx(p, -hw, h - 0.04, -hd, hw, h, -hd + 0.04, STEEL);
    bx(p, -hw, h - 0.04, hd - 0.04, hw, h, hd, STEEL);
    bx(p, -hw, h - 0.04, -hd, -hw + 0.04, h, hd, STEEL);
    bx(p, hw - 0.04, h - 0.04, -hd, hw, h, hd, STEEL);
    const glass = rgb(0x8aa4ae);
    qz(p, -hw + 0.02, 0.1, hw - 0.02, h - 0.06, hd - 0.02, 1, glass, 0.9, 1.15);
    qz(p, -hw + 0.02, 0.1, hw - 0.02, h - 0.06, hd - 0.02, -1, glass, 0.9, 1.15);
    cyl(p, 0.2, h - 0.5, -hd + 0.06, 0.02, 0.02, 0.5, 6, STEEL, STEEL, true);
    tiltBox(p, 0.2, h - 0.52, -hd + 0.14, 0.14, 0.03, 0.14, 0.3, 0, 0, STEEL);
}

export function washer(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const body = pickOf([WHITE, rgb(0xc8ccce)], p.v);
    bx(p, -hw, 0, -hd, hw, p.piece.h, hd, body);
    bx(p, -hw, p.piece.h - 0.12, hd, hw, p.piece.h, hd + 0.004, shade(body, 0.85));
    p.mb.push();
    p.mb.translate(0, 0.42, hd);
    p.mb.rotateX(Math.PI / 2);
    p.mb.cylinder(0, 0, 0, 0.23, 0.23, 0.02, 14, STEEL, STEEL, true);
    p.mb.cylinder(0, 0.02, 0, 0.19, 0.19, 0.01, 14, GLASS, rgb(0x3a4a54), true);
    p.mb.pop();
    bx(p, -hw + 0.06, p.piece.h - 0.09, hd + 0.004, -hw + 0.12, p.piece.h - 0.03, hd + 0.02, BLACK);
    bx(p, hw - 0.14, p.piece.h - 0.09, hd + 0.004, hw - 0.06, p.piece.h - 0.03, hd + 0.02, rgb(0x4a7aa0));
}

export function crate(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const h = p.piece.h;
    const wood = mixRgb(rgb(0x9a7a4a), pickOf(WOODS, p.v), 0.4);
    const dark = shade(wood, 0.7);
    bx(p, -hw, 0.04, -hd, hw, h, hd, wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, sx * (hw - 0.04) - 0.04, 0, sz * (hd - 0.04) - 0.04, sx * (hw - 0.04) + 0.04, h + 0.01, sz * (hd - 0.04) + 0.04, dark);
    for (const y of [0.22, 0.42, 0.62]) {
        qz(p, -hw + 0.08, y, hw - 0.08, y + 0.015, hd + 0.002, 1, dark);
        qz(p, -hw + 0.08, y, hw - 0.08, y + 0.015, -hd - 0.002, -1, dark);
    }
    if (p.v % 3 === 0) {
        for (let i = 0; i < 5; i++) tin(p, -0.25 + (i % 3) * 0.22, h, -0.2 + Math.floor(i / 3) * 0.3, pickOf(PAINTS, p.v, i));
    } else if (p.v % 3 === 1) {
        for (let i = 0; i < 4; i++) fruit(p, -0.2 + (i % 2) * 0.35, h + 0.0, -0.15 + Math.floor(i / 2) * 0.35, (p.v + i) % 5);
    }
}

export function crateStack(p: Pen) {
    const hw = p.piece.w / 2;
    const wood = mixRgb(rgb(0x9a7a4a), pickOf(WOODS, p.v), 0.4);
    const dark = shade(wood, 0.7);
    bx(p, -hw, 0, -hw, hw, 0.8, hw, wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, sx * (hw - 0.04) - 0.04, 0, sz * (hw - 0.04) - 0.04, sx * (hw - 0.04) + 0.04, 0.81, sz * (hw - 0.04) + 0.04, dark);
    qz(p, -hw + 0.08, 0.35, hw - 0.08, 0.37, hw + 0.002, 1, dark);
    tiltBox(p, 0.02, 1.2, 0.0, 0.78, 0.78, 0.78, 0, 0.3 + (p.v % 5) * 0.1, 0, shade(wood, 1.1));
    if (p.v % 2 === 0) tiltBox(p, 0.0, 1.78, 0.04, 0.5, 0.36, 0.4, 0, 0.6, 0, CARDBOARD);
}

export function barrel(p: Pen) {
    const col = pickOf(DRUMS, p.v);
    const band = shade(col, 0.7);
    cyl(p, 0, 0, 0, 0.27, 0.28, 0.95, 10, col, shade(col, 1.15), true);
    for (const y of [0.14, 0.46, 0.78]) cyl(p, 0, y, 0, 0.292, 0.292, 0.035, 10, band, band, false);
    cyl(p, 0, 0.95, 0, 0.24, 0.24, 0.015, 10, shade(col, 0.6), shade(col, 0.6), true);
    if (p.v % 4 === 0) qy(p, -0.45, -0.1, 0.1, 0.45, 0.004, true, rgb(0x1c1a16));
}

function shelfStuff(p: Pen, x0: number, x1: number, y: number, z: number, depth: number) {
    let x = x0 + 0.05;
    while (x < x1 - 0.2) {
        const k = p.rng();
        if (k < 0.25) {
            const w = 0.2 + p.rng() * 0.15;
            const h = 0.15 + p.rng() * 0.15;
            bx(p, x, y, z - depth * 0.35, x + w, y + h, z + depth * 0.35, pickOf([CARDBOARD, rgb(0x8a7a5a), rgb(0xb8a888)], Math.floor(p.rng() * 3)));
            qz(p, x + w * 0.2, y + h * 0.3, x + w * 0.8, y + h * 0.7, z + depth * 0.35 + 0.002, 1, rgb(0xe8e0c8));
            x += w + 0.04;
        } else if (k < 0.5) {
            for (let i = 0; i < 3; i++) tin(p, x + i * 0.08, y, z, pickOf(PAINTS, Math.floor(p.rng() * 8)));
            x += 0.3;
        } else if (k < 0.7) {
            bottle(p, x, y, z, pickOf(PAINTS, Math.floor(p.rng() * 8)), 1 + p.rng() * 0.5);
            bottle(p, x + 0.09, y, z, pickOf(PAINTS, Math.floor(p.rng() * 8)), 1);
            x += 0.24;
        } else if (k < 0.85) {
            cyl(p, x + 0.1, y, z, 0.1, 0.1, 0.2, 8, pickOf(DRUMS, Math.floor(p.rng() * 6)), pickOf(DRUMS, Math.floor(p.rng() * 6)), true);
            x += 0.28;
        } else {
            x += 0.2;
        }
    }
}

export function metalShelf(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const h = p.piece.h;
    const frame = shade(STEEL_DARK, 0.9);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, sx * (hw - 0.025) - 0.02, 0, sz * (hd - 0.025) - 0.02, sx * (hw - 0.025) + 0.02, h, sz * (hd - 0.025) + 0.02, frame);
    const levels = [0.1, 0.62, 1.14, 1.66];
    for (const y of levels) {
        bx(p, -hw, y, -hd, hw, y + 0.025, hd, STEEL);
        if (p.rng() < 0.85) shelfStuff(p, -hw, hw, y + 0.025, 0, p.piece.d);
    }
    bx(p, -hw, h - 0.02, -hd, hw, h, hd, STEEL);
}

export function filing(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const h = p.piece.h;
    const body = pickOf([rgb(0x7a8288), rgb(0x5a6a5a), rgb(0x8a8a82)], p.v);
    bx(p, -hw, 0, -hd, hw, h, hd, body);
    for (let i = 0; i < 3; i++) {
        const y0 = 0.06 + i * 0.43;
        qz(p, -hw + 0.03, y0, hw - 0.03, y0 + 0.39, hd + 0.003, 1, shade(body, 0.8));
        bx(p, -0.09, y0 + 0.28, hd + 0.003, 0.09, y0 + 0.31, hd + 0.04, STEEL);
        qz(p, -0.07, y0 + 0.17, 0.07, y0 + 0.23, hd + 0.004, 1, rgb(0xe8e0c8));
    }
    if (p.v % 3 === 0) {
        bx(p, -hw + 0.03, 0.68, hd, hw - 0.03, 1.05, hd + 0.5, shade(body, 0.8));
        paperStack(p, 0, 1.05, hd + 0.25, 0.3);
    }
}

export function shopCounter(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = woodTone(p);
    const dark = shade(wood, 0.72);
    bx(p, -hw, 0, -hd, hw, 0.97, hd, wood);
    for (let i = 0; i < 4; i++) {
        const x0 = -hw + 0.08 + i * ((hw * 2 - 0.16) / 4);
        qz(p, x0, 0.12, x0 + (hw * 2 - 0.16) / 4 - 0.04, 0.88, hd + 0.003, 1, dark);
    }
    bx(p, -hw - 0.03, 0.97, -hd - 0.02, hw + 0.03, 1.03, hd + 0.05, STEEL_DARK, [STEEL_DARK, STEEL_DARK, shade(STEEL_DARK, 1.2), undefined, STEEL_DARK, STEEL_DARK]);
    const rx = (p.v % 2 === 0 ? 1 : -1) * (hw - 0.45);
    bx(p, rx - 0.2, 1.03, -0.2, rx + 0.2, 1.2, 0.12, rgb(0x3a3c40));
    tiltBox(p, rx, 1.32, -0.12, 0.3, 0.2, 0.04, -0.3, 0, 0, BLACK);
    glow(p, p.v % 4 === 0);
    qz(p, rx - 0.12, 1.25, rx + 0.12, 1.4, -0.09, 1, p.v % 4 === 0 ? rgb(0x7ac0a0) : GLASS);
    glow(p, false);
    for (let i = 0; i < 3; i++) {
        cyl(p, -hw + 0.3 + i * 0.16, 1.03, 0.1, 0.06, 0.06, 0.2, 8, rgb(0xd8e0e0), rgb(0xd8e0e0), false);
        cyl(p, -hw + 0.3 + i * 0.16, 1.23, 0.1, 0.062, 0.062, 0.03, 8, pickOf(PAINTS, p.v, i), pickOf(PAINTS, p.v, i), true);
    }
    if (p.v % 3 === 0) bx(p, -0.2, 1.03, 0.0, 0.1, 1.28, 0.25, CARDBOARD);
}

function goodsRow(p: Pen, x0: number, x1: number, y: number, z: number, maxH: number) {
    let x = x0;
    const lane = pickOf(PAINTS, Math.floor(p.rng() * 8));
    while (x < x1 - 0.05) {
        const w = 0.07 + p.rng() * 0.09;
        if (x + w > x1) break;
        const h = maxH * (0.55 + p.rng() * 0.45);
        const col = p.rng() < 0.4 ? lane : pickOf(PAINTS, Math.floor(p.rng() * 8));
        qz(p, x, y, x + w, y + h, z, 1, col, 0.85, 1.05);
        qz(p, x + w * 0.15, y + h * 0.35, x + w * 0.85, y + h * 0.6, z + 0.001, 1, mixRgb(col, rgb(0xf0e8d0), 0.6));
        x += w + 0.01;
    }
}

export function shopShelf(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const h = p.piece.h;
    const frame = mixRgb(woodTone(p), rgb(0x6a6a6a), 0.35);
    bx(p, -hw, 0, -hd, -hw + 0.04, h, hd, frame);
    bx(p, hw - 0.04, 0, -hd, hw, h, hd, frame);
    bx(p, -hw, 0.1, -hd, hw, h - 0.05, -hd + 0.02, shade(frame, 0.8));
    const levels = [0.1, 0.5, 0.9, 1.3, 1.7];
    for (let i = 0; i < levels.length; i++) {
        const y = levels[i];
        bx(p, -hw + 0.04, y, -hd + 0.02, hw - 0.04, y + 0.03, hd, frame);
        if (i === levels.length - 1 || p.rng() < 0.12) continue;
        const gap = levels[i + 1] - y - 0.03;
        bx(p, -hw + 0.08, y + 0.03, -hd + 0.04, hw - 0.08, y + 0.03 + gap * 0.5, hd - 0.2, mixRgb(CARDBOARD, rgb(0x6a6055), 0.3));
        goodsRow(p, -hw + 0.08, hw - 0.08, y + 0.03, hd - 0.19, gap * 0.9);
    }
}

export function freezer(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const body = pickOf([WHITE, rgb(0xc8d0d4), rgb(0x9ab4c0)], p.v);
    bx(p, -hw, 0.05, -hd, hw, 0.92, hd, body);
    bx(p, -hw - 0.01, 0.92, -hd - 0.01, hw + 0.01, 0.98, hd + 0.01, shade(body, 0.92));
    qy(p, -hw + 0.06, -hd + 0.06, hw - 0.06, hd - 0.06, 0.981, true, rgb(0x5a6a74));
    qz(p, -hw + 0.1, 0.5, hw - 0.1, 0.7, hd + 0.002, 1, pickOf(PAINTS, p.v));
    bx(p, -0.3, 0.8, hd + 0.002, 0.3, 0.85, hd + 0.04, STEEL);
    for (const sx of [-1, 1]) bx(p, sx * (hw - 0.1) - 0.03, 0, -hd + 0.05, sx * (hw - 0.1) + 0.03, 0.05, hd - 0.05, BLACK);
}

export function desk(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = woodTone(p);
    const dark = shade(wood, 0.72);
    bx(p, -hw, 0.74, -hd, hw, 0.78, hd, wood, [dark, dark, shade(wood, 1.1), undefined, dark, dark]);
    bx(p, -hw + 0.02, 0, -hd + 0.02, -hw + 0.05, 0.74, hd - 0.02, dark);
    bx(p, hw - 0.42, 0.02, -hd + 0.02, hw - 0.02, 0.74, hd - 0.02, wood);
    for (let i = 0; i < 3; i++) {
        const y0 = 0.08 + i * 0.22;
        qz(p, hw - 0.4, y0, hw - 0.04, y0 + 0.19, hd - 0.019, 1, dark);
        bx(p, hw - 0.28, y0 + 0.08, hd - 0.019, hw - 0.16, y0 + 0.11, hd - 0.0, BRASS);
    }
    bx(p, -hw + 0.05, 0.25, -hd + 0.02, hw - 0.42, 0.72, -hd + 0.05, dark);
    const k = p.v % 3;
    if (k !== 2) {
        const on = p.v % 9 === 0;
        bx(p, -0.1, 0.78, -0.12, 0.1, 0.8, 0.0, BLACK);
        bx(p, -0.03, 0.8, -0.08, 0.03, 0.9, -0.04, BLACK);
        bx(p, -0.28, 0.9, -0.1, 0.28, 1.28, -0.06, BLACK);
        glow(p, on);
        qz(p, -0.25, 0.93, 0.25, 1.25, -0.058, 1, on ? rgb(0x6f9ec0) : GLASS, 0.8, 1.1);
        glow(p, false);
        bx(p, -0.2, 0.78, 0.12, 0.2, 0.795, 0.26, rgb(0x2a2c30));
        bx(p, 0.3, 0.78, 0.15, 0.36, 0.79, 0.22, rgb(0x2a2c30));
    } else {
        paperStack(p, -0.2, 0.78, 0.05, 0.3);
        paperStack(p, 0.1, 0.78, -0.05, -0.2);
        cyl(p, 0.45, 0.78, -0.2, 0.05, 0.05, 0.1, 8, STEEL_DARK, STEEL_DARK, false);
    }
    cup(p, -hw + 0.18, 0.78, -0.22, pickOf(PAINTS, p.v, 3));
}

export function officeChair(p: Pen) {
    const fab = mixRgb(pickOf(FABRICS, p.v, 5), rgb(0x2a2a2e), 0.5);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        tiltBox(p, Math.cos(a) * 0.14, 0.05, Math.sin(a) * 0.14, 0.04, 0.03, 0.3, 0, -a + Math.PI / 2, 0, BLACK);
    }
    cyl(p, 0, 0.06, 0, 0.025, 0.025, 0.38, 6, STEEL_DARK, STEEL_DARK, false);
    bx(p, -0.24, 0.44, -0.22, 0.24, 0.5, 0.24, fab);
    bx(p, -0.22, 0.52, -0.26, 0.22, 0.97, -0.2, fab);
    for (const sx of [-1, 1]) bx(p, sx * 0.25 - 0.015, 0.5, -0.15, sx * 0.25 + 0.015, 0.68, 0.12, BLACK);
}

export function conferenceTable(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = shade(woodTone(p), 0.85);
    const dark = shade(wood, 0.65);
    bx(p, -hw, 0.72, -hd, hw, 0.78, hd, wood, [dark, dark, shade(wood, 1.15), undefined, dark, dark]);
    for (const sx of [-1, 1]) bx(p, sx * (hw - 0.5) - 0.12, 0, -0.34, sx * (hw - 0.5) + 0.12, 0.72, 0.34, dark);
    for (let i = 0; i < 6; i++) {
        const x = -1.2 + (i % 3) * 1.2 + (p.rng() - 0.5) * 0.2;
        const z = (i < 3 ? -1 : 1) * 0.32;
        paperStack(p, x, 0.78, z, p.rng() * 6);
        if (p.rng() < 0.5) cup(p, x + 0.3, 0.78, z, pickOf(PAINTS, p.v, i));
    }
    bx(p, -0.12, 0.78, -0.12, 0.12, 0.82, 0.12, BLACK);
    if (p.v % 2 === 0) {
        bx(p, 0.5, 0.78, -0.1, 0.8, 0.795, 0.15, rgb(0x6a6e72));
        tiltBox(p, 0.65, 0.9, -0.12, 0.3, 0.2, 0.01, -0.35, 0, 0, rgb(0x2a2c30));
    }
}

export function whiteboard(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    bx(p, -hw, 0.9, -hd, hw, 2.0, hd, STEEL);
    qz(p, -hw + 0.04, 0.94, hw - 0.04, 1.96, hd + 0.002, 1, rgb(0xeceae4), 0.95, 1.05);
    bx(p, -hw + 0.12, 0.88, hd, hw - 0.12, 0.91, hd + 0.06, STEEL);
    const lines = 3 + (p.v % 4);
    for (let i = 0; i < lines; i++) {
        const col = pickOf([rgb(0x2a4fa0), rgb(0xa02a2a), rgb(0x2a7a3a), BLACK], p.v, i);
        const y = 1.1 + p.rng() * 0.75;
        const x0 = -hw + 0.15 + p.rng() * (hw * 1.2);
        const len = 0.3 + p.rng() * 0.7;
        const tilt = (p.rng() - 0.5) * 0.08;
        p.mb.quad([x0, y, hd + 0.004], [x0 + len, y + tilt, hd + 0.004], [x0 + len, y + tilt + 0.014, hd + 0.004], [x0, y + 0.014, hd + 0.004], col);
    }
}

export function boiler(p: Pen) {
    const rust = RUST;
    bx(p, -0.34, 0, -0.34, 0.34, 0.1, 0.34, STEEL_DARK);
    cyl(p, 0, 0.1, 0, 0.32, 0.32, 1.1, 12, pickOf([rgb(0x8a8e90), rgb(0x6a7a82), rgb(0x9a9a8a)], p.v), rgb(0xa0a4a6), true);
    cyl(p, 0, 1.2, 0, 0.32, 0.18, 0.2, 12, STEEL_DARK, STEEL_DARK, true);
    cyl(p, 0, 1.4, 0, 0.1, 0.1, 0.2, 8, STEEL_DARK, STEEL_DARK, true);
    tiltBox(p, 0.0, 1.55, -0.2, 0.07, 0.07, 0.5, 0, 0, 0, rust);
    tiltBox(p, 0.22, 0.55, -0.3, 0.06, 0.06, 0.5, 0, 0.3, 0, rust);
    p.mb.push();
    p.mb.translate(0, 0.7, 0.31);
    p.mb.rotateX(Math.PI / 2);
    p.mb.cylinder(0, 0, 0, 0.08, 0.08, 0.04, 10, STEEL, STEEL, true);
    p.mb.cylinder(0, 0.04, 0, 0.065, 0.065, 0.005, 10, rgb(0xe8e4d8), rgb(0xe8e4d8), true);
    p.mb.pop();
    qy(p, -0.3, -0.3, 0.3, 0.3, 0.006, true, rgb(0x2a2420));
    flatItem(p, 0.3, 0.0, 0.4, 0.4, 0.3, 0.4, rgb(0x3a2f26));
}

export const UTILITY_KINDS = { counter, kitchenSink, stove, fridge, toilet, bathSink, bathtub, shower, washer, crate, crateStack, barrel, metalShelf, filing, shopCounter, shopShelf, freezer, desk, officeChair, conferenceTable, whiteboard, boiler };
