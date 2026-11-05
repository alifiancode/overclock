import { mixRgb, rgb, scaleRgb, type ColorInput, type MeshBuilder, type Rgb } from './meshBuilder.ts';
import type { FloorStyle } from './buildingGen.ts';
import type { FurniturePiece } from './furniture.ts';
import type { Rng } from './random.ts';
import { tag } from './bldCommon.ts';

export type Pen = {
    mb: MeshBuilder;
    leaf: MeshBuilder;
    rng: Rng;
    style: FloorStyle;
    floor: number;
    decay: number;
    piece: FurniturePiece;
    v: number;
};

export const FABRICS: Rgb[] = [0x7a4a3a, 0x4a5f7a, 0x566b4b, 0x80694a, 0x6a4a6a, 0x4b525c, 0x8a6a3a, 0x3f6368].map(rgb);
export const WOODS: Rgb[] = [0x8a5a34, 0x6b4428, 0xa4783e, 0x59391f, 0x7d5a3a, 0x947050].map(rgb);
export const LINENS: Rgb[] = [0xdad4c6, 0xc9b9a0, 0xa9b9c9, 0xc9a9a9, 0xa9c9b0, 0xd9c98a].map(rgb);
export const PAINTS: Rgb[] = [0x8a3a32, 0x2f5f8a, 0x3a7a4a, 0xc9a02f, 0x6a3a7a, 0xd8d4c8, 0x2a2a2e, 0xc96a2a].map(rgb);
export const WHITE = rgb(0xe4e0d6);
export const STEEL = rgb(0xaeb2b4);
export const STEEL_DARK = rgb(0x6a6e72);
export const BLACK = rgb(0x1e1f22);
export const GLASS = rgb(0x2b3a44);
export const MOLD = rgb(0x56693a);
export const BREAD = rgb(0xc9a164);
export const BRASS = rgb(0xb89a4a);
export const CERAMIC = rgb(0xe6e2d8);
export const RUST = rgb(0x8a5436);
export const CARDBOARD = rgb(0xa8885a);

export function pickOf<T>(items: readonly T[], v: number, salt: number = 0): T {
    return items[(v + salt * 7) % items.length];
}

export function bx(p: Pen, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: ColorInput, faces?: (ColorInput | undefined)[], skip: number = 0, grad: number = 0.9) {
    p.mb.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, faces, grad, skip);
}

export function cyl(p: Pen, x: number, y: number, z: number, rb: number, rt: number, h: number, seg: number, color: ColorInput, top?: ColorInput, cap: boolean = true) {
    p.mb.cylinder(x, y, z, rb, rt, h, seg, color, top, cap);
}

export function qz(p: Pen, x0: number, y0: number, x1: number, y1: number, z: number, sign: number, color: ColorInput, sA: number = 1, sB: number = sA) {
    if (sign > 0) p.mb.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], color, sA, sB);
    else p.mb.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], color, sA, sB);
}

export function qx(p: Pen, z0: number, y0: number, z1: number, y1: number, x: number, sign: number, color: ColorInput, sA: number = 1, sB: number = sA) {
    if (sign > 0) p.mb.quad([x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], color, sA, sB);
    else p.mb.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], color, sA, sB);
}

export function qy(p: Pen, x0: number, z0: number, x1: number, z1: number, y: number, up: boolean, color: ColorInput) {
    if (up) p.mb.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color);
    else p.mb.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], color);
}

export function glow(p: Pen, on: boolean) {
    tag(p.mb, 0, p.floor, on ? 1 : 0);
}

export function tiltBox(p: Pen, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rx: number, ry: number, rz: number, color: ColorInput) {
    p.mb.push();
    p.mb.translate(cx, cy, cz);
    p.mb.rotateY(ry);
    p.mb.rotateX(rx);
    p.mb.rotateZ(rz);
    p.mb.box(0, 0, 0, sx, sy, sz, color);
    p.mb.pop();
}

export function plate(p: Pen, x: number, y: number, z: number, r: number = 0.12, color: ColorInput = CERAMIC) {
    cyl(p, x, y, z, r * 0.78, r, 0.022, 10, color, scaleRgb(rgb(0xe8e4da), 1.04));
}

export function cup(p: Pen, x: number, y: number, z: number, color: ColorInput) {
    cyl(p, x, y, z, 0.034, 0.042, 0.09, 8, color, scaleRgb(rgb(0x3a2a1c), 1), true);
}

export function bottle(p: Pen, x: number, y: number, z: number, color: ColorInput, tall: number = 1) {
    cyl(p, x, y, z, 0.034, 0.034, 0.16 * tall, 7, color, color, true);
    cyl(p, x, y + 0.16 * tall, z, 0.034, 0.014, 0.07, 7, color, color, true);
    cyl(p, x, y + 0.23 * tall, z, 0.016, 0.016, 0.02, 6, BRASS, BRASS, true);
}

export function tin(p: Pen, x: number, y: number, z: number, label: ColorInput) {
    cyl(p, x, y, z, 0.036, 0.036, 0.1, 8, STEEL, STEEL, true);
    cyl(p, x, y + 0.025, z, 0.0375, 0.0375, 0.05, 8, label, label, false);
}

export function fruit(p: Pen, x: number, y: number, z: number, kind: number) {
    const palette = [rgb(0xb8322a), rgb(0x7aa83a), rgb(0xd98a2a), rgb(0xd8c23a), rgb(0x8a3a5a)];
    const rotten = p.decay > 0.6 && p.rng() < 0.45;
    const col = rotten ? mixRgb(palette[kind % palette.length], MOLD, 0.65) : palette[kind % palette.length];
    p.mb.blob(x, y + 0.045, z, 0.045, 0.042, 0.045, 0, col, 0.05, 0.4, 0.05);
}

export function bread(p: Pen, x: number, y: number, z: number) {
    const rotten = p.decay > 0.6 && p.rng() < 0.5;
    const col = rotten ? mixRgb(BREAD, MOLD, 0.55) : BREAD;
    p.mb.blob(x, y + 0.05, z, 0.17, 0.05, 0.065, 0, col, 0.05, 0.45, 0.04);
}

export function bowl(p: Pen, x: number, y: number, z: number, r: number, color: ColorInput, filled: boolean) {
    cyl(p, x, y, z, r * 0.55, r, r * 0.55, 10, color, scaleRgb(rgb(0xdad6cc), 1), false);
    if (filled) {
        for (let i = 0; i < 3; i++) fruit(p, x + (p.rng() - 0.5) * r, y + r * 0.35 + i * 0.03, z + (p.rng() - 0.5) * r, Math.floor(p.rng() * 5));
    }
}

export function bookRow(p: Pen, x0: number, x1: number, y: number, zFront: number, maxH: number) {
    let x = x0;
    while (x < x1 - 0.03) {
        const w = 0.025 + p.rng() * 0.035;
        if (x + w > x1) break;
        const h = maxH * (0.62 + p.rng() * 0.38);
        const col = PAINTS[Math.floor(p.rng() * PAINTS.length)];
        const faded = mixRgb(col, rgb(0x6a6055), 0.3 + p.rng() * 0.3);
        qz(p, x, y, x + w, y + h, zFront, 1, faded, 0.85, 1);
        qz(p, x + w * 0.2, y + h * 0.7, x + w * 0.8, y + h * 0.78, zFront + 0.001, 1, mixRgb(faded, rgb(0xe8dcb0), 0.55));
        x += w + 0.004;
        if (p.rng() < 0.08) x += 0.05;
    }
}

export function paperStack(p: Pen, x: number, y: number, z: number, rot: number) {
    p.mb.push();
    p.mb.translate(x, y, z);
    p.mb.rotateY(rot);
    p.mb.box(0, 0.01, 0, 0.21, 0.02, 0.3, rgb(0xe2dccb));
    p.mb.box(0.01, 0.025, 0, 0.2, 0.012, 0.29, rgb(0xd7d0bd));
    p.mb.pop();
}

export function flatItem(p: Pen, x: number, y: number, z: number, w: number, d: number, rot: number, color: ColorInput) {
    p.mb.push();
    p.mb.translate(x, y, z);
    p.mb.rotateY(rot);
    p.mb.box(0, 0.008, 0, w, 0.016, d, color);
    p.mb.pop();
}
