import type { BufferGeometry } from 'three';
import { MeshBuilder, rgb } from './meshBuilder.ts';
import { createRng } from './random.ts';

export const LEAF_HEIGHT = 2.26;
export const JAMB_INSET = 0.13;

export function buildDoorLeaf(): BufferGeometry {
    const mb = new MeshBuilder(createRng(0xd007), 1024);
    mb.setExtra(1, 0);
    const slab = rgb(0xe6e2da);
    const panel = rgb(0xc6c1b6);
    const rail = rgb(0xd6d1c6);
    const brass = rgb(0xc9a94a);
    const dark = rgb(0x4a4238);
    const h = LEAF_HEIGHT;
    mb.box(0.5, h / 2, 0, 1, h, 0.06, slab, undefined, 0.88, 8);
    for (const side of [-1, 1]) {
        const z = side * 0.034;
        mb.box(0.5, h * 0.74, z, 0.72, h * 0.3, 0.014, panel, undefined, 1, 8);
        mb.box(0.5, h * 0.3, z, 0.72, h * 0.44, 0.014, panel, undefined, 1, 8);
        mb.box(0.5, h * 0.5, z, 0.9, 0.05, 0.012, rail, undefined, 1, 8);
        mb.box(0.86, 1.02, side * 0.062, 0.05, 0.05, 0.03, brass, undefined, 1, 8);
        mb.box(0.86, 1.02, side * 0.085, 0.07, 0.07, 0.016, brass, undefined, 1, 8);
        mb.box(0.86, 1.14, side * 0.04, 0.06, 0.12, 0.008, dark, undefined, 1, 8);
    }
    return mb.build();
}
