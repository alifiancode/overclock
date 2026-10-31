import { mixRgb, rgb, type Rgb } from './meshBuilder.ts';
import { shade } from './bldCommon.ts';
import { BLACK, BRASS, FABRICS, GLASS, LINENS, PAINTS, STEEL_DARK, WHITE, WOODS, bottle, bowl, bread, bookRow, bx, cup, cyl, flatItem, fruit, glow, paperStack, pickOf, plate, qy, qz, tiltBox, type Pen } from './furnCommon.ts';

function woodTone(p: Pen): Rgb {
    return mixRgb(rgb(p.style.wood), pickOf(WOODS, p.v), 0.45);
}

function fabricTone(p: Pen, salt: number = 0): Rgb {
    return pickOf(FABRICS, p.v, salt);
}

export function sofa(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const fab = fabricTone(p);
    const dark = shade(fab, 0.78);
    const light = shade(fab, 1.12);
    const leg = rgb(0x2a2018);
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) bx(p, sx * (hw - 0.09) - 0.035, 0, sz * (hd - 0.09) - 0.035, sx * (hw - 0.09) + 0.035, 0.1, sz * (hd - 0.09) + 0.035, leg);
    }
    bx(p, -hw, 0.1, -hd, hw, 0.32, hd, dark);
    const n = 3;
    const cw = (p.piece.w - 0.44) / n;
    for (let i = 0; i < n; i++) {
        const x0 = -hw + 0.22 + i * cw;
        bx(p, x0 + 0.01, 0.32, -hd + 0.3, x0 + cw - 0.01, 0.5, hd - 0.03, light);
        bx(p, x0 + 0.015, 0.5, -hd + 0.26, x0 + cw - 0.015, 0.86, -hd + 0.4, light);
    }
    bx(p, -hw, 0.32, -hd, hw, 0.9, -hd + 0.26, fab);
    bx(p, -hw, 0.32, -hd + 0.04, -hw + 0.22, 0.68, hd, fab);
    bx(p, hw - 0.22, 0.32, -hd + 0.04, hw, 0.68, hd, fab);
    if (p.v % 3 !== 0) tiltBox(p, (p.v % 2 === 0 ? 1 : -1) * (hw - 0.55), 0.64, -hd + 0.5, 0.4, 0.38, 0.12, 0.35, 0, 0.12, pickOf(LINENS, p.v, 2));
    if (p.v % 5 === 0) bx(p, hw - 0.22, 0.68, -hd + 0.1, hw + 0.01, 0.72, hd - 0.1, pickOf(LINENS, p.v, 4));
}

export function armchair(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const fab = fabricTone(p, 3);
    const dark = shade(fab, 0.78);
    const light = shade(fab, 1.1);
    const leg = rgb(0x2a2018);
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) bx(p, sx * (hw - 0.08) - 0.03, 0, sz * (hd - 0.08) - 0.03, sx * (hw - 0.08) + 0.03, 0.1, sz * (hd - 0.08) + 0.03, leg);
    }
    bx(p, -hw, 0.1, -hd, hw, 0.32, hd, dark);
    bx(p, -hw + 0.2, 0.32, -hd + 0.28, hw - 0.2, 0.5, hd - 0.03, light);
    bx(p, -hw, 0.32, -hd, hw, 0.95, -hd + 0.28, fab);
    bx(p, -hw + 0.22, 0.5, -hd + 0.24, hw - 0.22, 0.88, -hd + 0.38, light);
    bx(p, -hw, 0.32, -hd + 0.04, -hw + 0.2, 0.66, hd, fab);
    bx(p, hw - 0.2, 0.32, -hd + 0.04, hw, 0.66, hd, fab);
}

export function coffeeTable(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = woodTone(p);
    const dark = shade(wood, 0.7);
    bx(p, -hw, 0.38, -hd, hw, 0.43, hd, wood, [dark, dark, shade(wood, 1.1), undefined, dark, dark]);
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) bx(p, sx * (hw - 0.07) - 0.03, 0, sz * (hd - 0.07) - 0.03, sx * (hw - 0.07) + 0.03, 0.38, sz * (hd - 0.07) + 0.03, dark);
    }
    bx(p, -hw + 0.07, 0.1, -hd + 0.07, hw - 0.07, 0.13, hd - 0.07, dark);
    const k = p.v % 4;
    if (k === 0) {
        bx(p, -0.3, 0.43, -0.12, -0.08, 0.455, 0.1, pickOf(PAINTS, p.v));
        bx(p, -0.29, 0.455, -0.11, -0.09, 0.47, 0.09, pickOf(PAINTS, p.v, 2));
        cup(p, 0.25, 0.43, 0.05, pickOf(PAINTS, p.v, 3));
    } else if (k === 1) {
        cyl(p, 0, 0.43, 0, 0.07, 0.05, 0.2, 8, pickOf(PAINTS, p.v), pickOf(PAINTS, p.v), true);
        paperStack(p, 0.3, 0.43, 0.08, 0.4);
    } else if (k === 2) {
        flatItem(p, -0.2, 0.43, 0.05, 0.18, 0.05, 0.5, BLACK);
        paperStack(p, 0.2, 0.43, -0.05, 0.9);
        paperStack(p, 0.26, 0.45, -0.02, 0.2);
    } else {
        bowl(p, 0.05, 0.43, 0, 0.14, pickOf(LINENS, p.v), true);
    }
}

export function tv(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = shade(woodTone(p), 0.8);
    bx(p, -hw, 0.06, -hd, hw, 0.5, hd, wood, [wood, wood, shade(wood, 1.2), undefined, wood, wood]);
    for (const sx of [-1, 1]) bx(p, sx * (hw - 0.07) - 0.035, 0, -hd + 0.05, sx * (hw - 0.07) + 0.035, 0.06, hd - 0.05, BLACK);
    qz(p, -hw + 0.05, 0.12, -0.03, 0.44, hd + 0.002, 1, shade(wood, 0.7));
    qz(p, 0.03, 0.12, hw - 0.05, 0.44, hd + 0.002, 1, shade(wood, 0.7));
    bx(p, -0.1, 0.5, -0.1, 0.1, 0.62, 0.0, BLACK);
    bx(p, -0.3, 0.5, -0.15, 0.3, 0.52, 0.05, BLACK);
    bx(p, -0.56, 0.62, -0.06, 0.56, 1.24, 0.03, BLACK);
    const on = p.v % 7 === 0;
    glow(p, on);
    qz(p, -0.52, 0.66, 0.52, 1.2, 0.031, 1, on ? rgb(0x5f86a8) : GLASS, 0.8, 1.1);
    glow(p, false);
    if (!on) qz(p, -0.5, 0.9, -0.1, 1.18, 0.032, 1, rgb(0x3b4c58), 0.9, 1.1);
    bx(p, hw - 0.4, 0.5, -0.1, hw - 0.18, 0.56, 0.1, STEEL_DARK);
    bx(p, -hw + 0.12, 0.5, -0.1, -hw + 0.4, 0.58, 0.1, BLACK);
}

export function bookshelf(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const h = p.piece.h;
    const wood = woodTone(p);
    const dark = shade(wood, 0.72);
    bx(p, -hw, 0, -hd, -hw + 0.03, h, hd, wood);
    bx(p, hw - 0.03, 0, -hd, hw, h, hd, wood);
    bx(p, -hw, 0, -hd, hw, h, -hd + 0.015, dark);
    const levels = [0.04, 0.4, 0.76, 1.12, 1.48, 1.92];
    for (const y of levels) bx(p, -hw + 0.03, y, -hd + 0.015, hw - 0.03, y + 0.025, hd, wood);
    for (let i = 0; i < levels.length - 1; i++) {
        const y = levels[i] + 0.025;
        const gap = levels[i + 1] - y;
        if (p.rng() < 0.82) bookRow(p, -hw + 0.05, hw - 0.05 - (p.rng() < 0.35 ? 0.3 : 0), y, hd - 0.06, gap - 0.04);
        if (p.rng() < 0.4) {
            const col = pickOf(PAINTS, p.v, i);
            bx(p, hw - 0.28, y, -hd + 0.06, hw - 0.06, y + 0.04 + p.rng() * 0.08, hd - 0.08, col);
        }
        if (p.rng() < 0.2) cup(p, -hw + 0.12 + p.rng() * 0.5, y, 0, pickOf(PAINTS, p.v, i + 2));
    }
}

export function rug(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const base = pickOf(FABRICS, p.v, 1);
    const cream = mixRgb(base, rgb(0xe6dcc4), 0.6);
    qy(p, -hw, -hd, hw, hd, 0.012, true, shade(base, 0.9));
    qy(p, -hw + 0.12, -hd + 0.12, hw - 0.12, hd - 0.12, 0.016, true, cream);
    qy(p, -hw + 0.3, -hd + 0.3, hw - 0.3, hd - 0.3, 0.02, true, shade(base, 1.05));
    if (p.v % 2 === 0) qy(p, -hw + 0.55, -hd + 0.55, hw - 0.55, hd - 0.55, 0.024, true, mixRgb(base, cream, 0.5));
}

export function bedDouble(p: Pen) {
    bedFrame(p, 0.62);
}

export function bedSingle(p: Pen) {
    bedFrame(p, 0.35);
}

function bedFrame(p: Pen, pillowSpread: number) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = woodTone(p);
    const dark = shade(wood, 0.75);
    const sheet = pickOf(LINENS, p.v);
    const blanket = pickOf(FABRICS, p.v, 2);
    bx(p, -hw, 0.1, -hd, hw, 0.3, hd, dark);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, sx * (hw - 0.05) - 0.04, 0, sz * (hd - 0.05) - 0.04, sx * (hw - 0.05) + 0.04, 0.1, sz * (hd - 0.05) + 0.04, dark);
    bx(p, -hw + 0.04, 0.3, -hd + 0.08, hw - 0.04, 0.5, hd - 0.04, sheet);
    bx(p, -hw + 0.02, 0.5, -hd + 0.7, hw - 0.02, 0.57, hd - 0.02, blanket);
    bx(p, -hw + 0.02, 0.57, -hd + 0.7, hw - 0.02, 0.6, -hd + 0.86, shade(blanket, 1.15));
    const pillows = p.piece.w > 1.3 ? 2 : 1;
    for (let i = 0; i < pillows; i++) {
        const cx = pillows === 2 ? (i === 0 ? -1 : 1) * pillowSpread * 0.65 : 0;
        bx(p, cx - 0.26, 0.5, -hd + 0.14, cx + 0.26, 0.62, -hd + 0.5, shade(WHITE, 0.95 + p.rng() * 0.08));
    }
    bx(p, -hw, 0.1, -hd, hw, 0.72, -hd + 0.07, wood);
    bx(p, -hw - 0.02, 0.7, -hd - 0.01, hw + 0.02, 0.75, -hd + 0.09, dark);
    bx(p, -hw, 0.1, hd - 0.05, hw, 0.4, hd, wood);
    if (p.decay > 0.5 && p.v % 2 === 0) qy(p, -hw * 0.5, -0.2, hw * 0.4, 0.5, 0.572, true, shade(blanket, 0.6));
}

export function nightstand(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = woodTone(p);
    const dark = shade(wood, 0.7);
    bx(p, -hw, 0.08, -hd, hw, 0.52, hd, wood);
    bx(p, -hw - 0.015, 0.52, -hd - 0.015, hw + 0.015, 0.55, hd + 0.015, dark);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, sx * (hw - 0.04) - 0.025, 0, sz * (hd - 0.04) - 0.025, sx * (hw - 0.04) + 0.025, 0.08, sz * (hd - 0.04) + 0.025, dark);
    qz(p, -hw + 0.04, 0.12, hw - 0.04, 0.3, hd + 0.002, 1, dark);
    qz(p, -hw + 0.04, 0.32, hw - 0.04, 0.5, hd + 0.002, 1, dark);
    bx(p, -0.03, 0.2, hd + 0.002, 0.03, 0.23, hd + 0.02, BRASS);
    bx(p, -0.03, 0.4, hd + 0.002, 0.03, 0.43, hd + 0.02, BRASS);
    if (p.v % 3 === 0) {
        cyl(p, 0, 0.55, -0.02, 0.07, 0.07, 0.025, 8, dark);
        cyl(p, 0, 0.575, -0.02, 0.012, 0.012, 0.22, 5, BRASS);
        glow(p, p.v % 6 === 0);
        cyl(p, 0, 0.74, -0.02, 0.13, 0.085, 0.14, 9, rgb(0xe0c98a), rgb(0xe8d9a0), false);
        glow(p, false);
    } else if (p.v % 3 === 1) {
        bx(p, -0.1, 0.55, -0.04, 0.1, 0.57, 0.1, pickOf(PAINTS, p.v));
        bx(p, -0.12, 0.57, 0.1, -0.04, 0.63, 0.15, BLACK);
    } else {
        cup(p, 0.08, 0.55, 0.0, pickOf(PAINTS, p.v));
    }
}

export function wardrobe(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const h = p.piece.h;
    const wood = woodTone(p);
    const dark = shade(wood, 0.72);
    bx(p, -hw, 0.06, -hd, hw, h - 0.08, hd, wood);
    bx(p, -hw - 0.02, 0, -hd - 0.02, hw + 0.02, 0.06, hd + 0.02, dark);
    bx(p, -hw - 0.025, h - 0.08, -hd - 0.025, hw + 0.025, h, hd + 0.025, dark);
    const open = p.v % 4 === 0;
    qz(p, -hw + 0.05, 0.14, -0.015, h - 0.18, hd + 0.003, 1, dark);
    if (!open) {
        qz(p, 0.015, 0.14, hw - 0.05, h - 0.18, hd + 0.003, 1, dark);
        bx(p, 0.05, 1.0, hd + 0.003, 0.08, 1.18, hd + 0.025, BRASS);
    } else {
        qz(p, 0.015, 0.14, hw - 0.05, h - 0.18, hd + 0.003, 1, rgb(0x161412));
        for (let i = 0; i < 4; i++) {
            const col = pickOf(PAINTS, p.v, i);
            bx(p, 0.1 + i * 0.14, 1.0, hd - 0.22, 0.2 + i * 0.14, 1.72, hd - 0.18, mixRgb(col, rgb(0x6a6055), 0.3));
        }
        tiltBox(p, hw + 0.16, 1.0, hd + 0.18, 0.03, 1.82, 0.6, 0, 0.9, 0, wood);
    }
    bx(p, -0.08, 1.0, hd + 0.003, -0.05, 1.18, hd + 0.025, BRASS);
}

export function dresser(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = woodTone(p);
    const dark = shade(wood, 0.7);
    bx(p, -hw, 0.1, -hd, hw, 0.9, hd, wood);
    bx(p, -hw - 0.02, 0.9, -hd - 0.02, hw + 0.02, 0.95, hd + 0.02, dark);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, sx * (hw - 0.06) - 0.03, 0, sz * (hd - 0.06) - 0.03, sx * (hw - 0.06) + 0.03, 0.1, sz * (hd - 0.06) + 0.03, dark);
    for (let i = 0; i < 3; i++) {
        const y0 = 0.16 + i * 0.25;
        qz(p, -hw + 0.05, y0, hw - 0.05, y0 + 0.21, hd + 0.003, 1, dark);
        bx(p, -0.1, y0 + 0.08, hd + 0.003, 0.1, y0 + 0.12, hd + 0.02, BRASS);
    }
    if (p.v % 2 === 0) {
        bx(p, -0.38, 0.95, -hd, 0.38, 1.7, -hd + 0.03, dark);
        qz(p, -0.34, 1.0, 0.34, 1.66, -hd + 0.032, 1, rgb(0x93a9b4), 0.8, 1.15);
    } else {
        bx(p, -0.3, 0.95, -0.1, -0.05, 1.05, 0.1, rgb(0x5a3a2a));
        bottle(p, 0.25, 0.95, 0.0, pickOf(PAINTS, p.v));
    }
}

export function chair(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = woodTone(p);
    const dark = shade(wood, 0.75);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, sx * (hw - 0.04) - 0.025, 0, sz * (hd - 0.04) - 0.025, sx * (hw - 0.04) + 0.025, 0.45, sz * (hd - 0.04) + 0.025, dark);
    bx(p, -hw, 0.44, -hd, hw, 0.48, hd, wood);
    for (const sx of [-1, 1]) bx(p, sx * (hw - 0.04) - 0.025, 0.48, -hd, sx * (hw - 0.04) + 0.025, 0.92, -hd + 0.05, dark);
    bx(p, -hw + 0.04, 0.62, -hd, hw - 0.04, 0.7, -hd + 0.04, wood);
    bx(p, -hw + 0.04, 0.78, -hd, hw - 0.04, 0.86, -hd + 0.04, wood);
    if (p.v % 3 === 0) bx(p, -hw + 0.02, 0.48, -hd + 0.04, hw - 0.02, 0.52, hd - 0.02, pickOf(FABRICS, p.v));
}

export function diningTable(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = woodTone(p);
    const dark = shade(wood, 0.72);
    bx(p, -hw, 0.71, -hd, hw, 0.76, hd, wood, [dark, dark, shade(wood, 1.1), undefined, dark, dark]);
    bx(p, -hw + 0.06, 0.64, -hd + 0.06, hw - 0.06, 0.71, hd - 0.06, dark);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, sx * (hw - 0.08) - 0.035, 0, sz * (hd - 0.08) - 0.035, sx * (hw - 0.08) + 0.035, 0.71, sz * (hd - 0.08) + 0.035, dark);
    const cloth = p.v % 3 === 0;
    if (cloth) bx(p, -hw + 0.1, 0.76, -hd + 0.1, hw - 0.1, 0.765, hd - 0.1, pickOf(LINENS, p.v, 3));
    const top = cloth ? 0.765 : 0.76;
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            if (p.rng() < 0.2) continue;
            const x = sx * 0.5;
            const z = sz * 0.28;
            plate(p, x, top, z);
            if (p.rng() < 0.55) {
                const k = p.rng();
                if (k < 0.4) bread(p, x, top + 0.02, z);
                else fruit(p, x, top + 0.02, z, Math.floor(p.rng() * 5));
            }
            cup(p, x + 0.2, top, z - sz * 0.05, pickOf(PAINTS, p.v, sx + sz + 3));
        }
    }
    if (p.v % 2 === 0) bowl(p, 0, top, 0, 0.16, pickOf(LINENS, p.v, 1), true);
    else bottle(p, 0, top, 0, pickOf(PAINTS, p.v, 5));
}

export function cabinet(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const h = p.piece.h;
    const wood = woodTone(p);
    const dark = shade(wood, 0.72);
    bx(p, -hw, 0.08, -hd, hw, h - 0.04, hd, wood);
    bx(p, -hw - 0.02, h - 0.04, -hd - 0.02, hw + 0.02, h, hd + 0.02, dark);
    bx(p, -hw + 0.02, 0, -hd + 0.02, hw - 0.02, 0.08, hd - 0.04, dark);
    qz(p, -hw + 0.04, 0.14, -0.01, h - 0.1, hd + 0.003, 1, dark);
    qz(p, 0.01, 0.14, hw - 0.04, h - 0.1, hd + 0.003, 1, dark);
    bx(p, -0.06, 0.5, hd + 0.003, -0.03, 0.66, hd + 0.02, BRASS);
    bx(p, 0.03, 0.5, hd + 0.003, 0.06, 0.66, hd + 0.02, BRASS);
    if (p.v % 2 === 0) {
        cyl(p, 0.1, h, 0, 0.07, 0.05, 0.2, 8, pickOf(PAINTS, p.v), pickOf(PAINTS, p.v), true);
    } else {
        plate(p, -0.15, h, 0, 0.14);
        cup(p, 0.2, h, 0, pickOf(PAINTS, p.v, 1));
    }
}

export function plant(p: Pen) {
    const dry = p.decay > 0.7 && p.v % 3 === 0;
    const pot = rgb(0xa8603a);
    cyl(p, 0, 0, 0, 0.17, 0.23, 0.34, 10, pot, shade(pot, 1.1), false);
    cyl(p, 0, 0.32, 0, 0.22, 0.22, 0.03, 10, shade(pot, 0.85), shade(pot, 0.85), false);
    cyl(p, 0, 0.335, 0, 0.2, 0.2, 0.01, 10, rgb(0x3a2a1c), rgb(0x3a2a1c), true);
    const leaf = p.leaf;
    const blades = 9 + (p.v % 5);
    const greens = [rgb(0x3f8a3a), rgb(0x2f6f33), rgb(0x56a043), rgb(0x2a5f2e)];
    for (let i = 0; i < blades; i++) {
        const a = (i / blades) * Math.PI * 2 + p.rng() * 0.5;
        const reach = 0.18 + p.rng() * 0.26;
        const height = 0.55 + p.rng() * 0.7;
        const col = dry ? mixRgb(rgb(0x8a7a3a), rgb(0x5a4a2a), p.rng()) : greens[Math.floor(p.rng() * greens.length)];
        const bx0 = Math.cos(a) * 0.05;
        const bz0 = Math.sin(a) * 0.05;
        const tx = Math.cos(a) * reach;
        const tz = Math.sin(a) * reach;
        const mx = Math.cos(a) * reach * 0.45;
        const mz = Math.sin(a) * reach * 0.45;
        const sx = -Math.sin(a) * 0.075;
        const sz = Math.cos(a) * 0.075;
        const ty = dry ? height * 0.7 : height;
        leaf.quad([bx0, 0.34, bz0], [mx + sx, 0.34 + height * 0.55, mz + sz], [tx, 0.34 + ty * 0.85, tz], [mx - sx, 0.34 + height * 0.55, mz - sz], col, 0.85, 1.1);
    }
}

export function lamp(p: Pen) {
    const wood = shade(woodTone(p), 0.8);
    cyl(p, 0, 0, 0, 0.16, 0.16, 0.03, 10, wood, wood, true);
    cyl(p, 0, 0.03, 0, 0.016, 0.016, 1.38, 6, BRASS, BRASS, false);
    const on = p.v % 4 !== 0;
    glow(p, on);
    cyl(p, 0, 1.38, 0, 0.2, 0.12, 0.3, 10, rgb(0xe6cf94), rgb(0xf0dca8), false);
    glow(p, false);
}

export function piano(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const dark = rgb(0x1f1a18);
    const wood = shade(dark, 1.5);
    bx(p, -hw, 0.1, -hd, hw, 1.25, 0.1, dark, [dark, dark, wood, undefined, dark, dark]);
    bx(p, -hw - 0.02, 0.58, 0.05, hw + 0.02, 0.66, hd, dark);
    qy(p, -hw + 0.06, 0.12, hw - 0.06, hd - 0.04, 0.661, true, rgb(0xe8e2d0));
    const keys = 22;
    const span = p.piece.w - 0.12;
    for (let i = 0; i < keys; i++) {
        const x = -hw + 0.06 + (span * (i + 1)) / (keys + 1);
        const k = i % 7;
        if (k === 2 || k === 6) continue;
        bx(p, x - 0.012, 0.661, 0.14, x + 0.012, 0.69, 0.3, BLACK);
    }
    bx(p, -hw, 0.66, hd - 0.04, hw, 0.7, hd, dark);
    for (const sx of [-1, 1]) bx(p, sx * (hw - 0.04) - 0.04, 0, -hd, sx * (hw - 0.04) + 0.04, 0.12, hd - 0.02, dark);
    bx(p, -0.4, 1.0, 0.03, 0.4, 1.1, 0.07, shade(dark, 1.6));
    paperStack(p, 0, 1.1, 0.07, 0);
}

export function bench(p: Pen) {
    const hw = p.piece.w / 2;
    const hd = p.piece.d / 2;
    const wood = woodTone(p);
    const dark = shade(wood, 0.72);
    bx(p, -hw, 0.42, -hd, hw, 0.47, hd, wood);
    for (const sx of [-1, 1]) bx(p, sx * (hw - 0.1) - 0.03, 0, -hd + 0.04, sx * (hw - 0.1) + 0.03, 0.42, hd - 0.04, dark);
    bx(p, -hw + 0.1, 0.12, -0.02, hw - 0.1, 0.16, 0.02, dark);
    if (p.v % 3 === 0) bx(p, -hw + 0.1, 0.47, -hd + 0.04, hw - 0.1, 0.53, hd - 0.04, pickOf(FABRICS, p.v));
}

export function coatRack(p: Pen) {
    const wood = shade(woodTone(p), 0.8);
    bx(p, -0.18, 0, -0.025, 0.18, 0.04, 0.025, wood);
    bx(p, -0.025, 0, -0.18, 0.025, 0.04, 0.18, wood);
    cyl(p, 0, 0.04, 0, 0.025, 0.025, 1.7, 6, wood, wood, true);
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        tiltBox(p, Math.cos(a) * 0.07, 1.6, Math.sin(a) * 0.07, 0.04, 0.04, 0.16, -0.5, -a + Math.PI / 2, 0, wood);
    }
    const coats = p.v % 3;
    for (let i = 0; i < coats; i++) {
        const col = mixRgb(pickOf(FABRICS, p.v, i), rgb(0x3a3a3a), 0.35);
        tiltBox(p, (i === 0 ? 0.12 : -0.12), 1.15, i === 0 ? 0.04 : -0.04, 0.1, 0.9, 0.3, 0, 0, i === 0 ? 0.08 : -0.08, col);
    }
    if (p.v % 2 === 0) bx(p, -0.06, 1.72, -0.06, 0.06, 1.76, 0.06, rgb(0x5a4a3a));
}

export function debris(p: Pen) {
    const count = 8 + (p.v % 5);
    const greys = [rgb(0x8d8b84), rgb(0x6f6d68), rgb(0x7a5a48), rgb(0x9c9a92), rgb(0x5a4430)];
    for (let i = 0; i < count; i++) {
        const a = p.rng() * Math.PI * 2;
        const d = p.rng() * 0.42;
        const sx = 0.14 + p.rng() * 0.3;
        const sy = 0.06 + p.rng() * 0.12;
        const sz = 0.12 + p.rng() * 0.26;
        const col = greys[Math.floor(p.rng() * greys.length)];
        tiltBox(p, Math.cos(a) * d, sy * 0.5 + 0.03 * (1 - d / 0.45), Math.sin(a) * d, sx, sy, sz, (p.rng() - 0.5) * 0.7, p.rng() * 3.1, (p.rng() - 0.5) * 0.7, col);
    }
    if (p.v % 2 === 0) tiltBox(p, 0.1, 0.12, -0.1, 0.9, 0.05, 0.12, 0.1, p.rng() * 3, 0.25, rgb(0x5a4430));
    for (let i = 0; i < 3; i++) paperStack(p, (p.rng() - 0.5) * 0.8, 0.03, (p.rng() - 0.5) * 0.8, p.rng() * 6);
}

export function pillar(p: Pen) {
    const hw = p.piece.w / 2;
    const h = p.piece.h;
    const concrete = rgb(0x9a968c);
    bx(p, -hw, 0, -hw, hw, h - 0.02, hw, concrete);
    bx(p, -hw - 0.04, 0, -hw - 0.04, hw + 0.04, 0.12, hw + 0.04, shade(concrete, 0.8));
    bx(p, -hw - 0.04, h - 0.2, -hw - 0.04, hw + 0.04, h - 0.02, hw + 0.04, shade(concrete, 0.8));
    qz(p, -hw + 0.05, 0.9, 0.02, 1.9, hw + 0.002, 1, shade(concrete, 0.85));
}

export const HOME_KINDS = { sofa, armchair, coffeeTable, tv, bookshelf, rug, bedDouble, bedSingle, nightstand, wardrobe, dresser, chair, diningTable, cabinet, plant, lamp, piano, bench, coatRack, debris, pillar };
