import type { BufferGeometry } from 'three';
import { WEAPONS, type WeaponId } from '../data/weapons.ts';
import { MeshBuilder, mixRgb, rgb, type Rgb } from './meshBuilder.ts';
import { createRng } from './random.ts';

const METAL = rgb(0x30333a);
const METAL_LIGHT = rgb(0x555a64);
const WOOD = rgb(0x6d4a30);
const BRASS = rgb(0xc9a94a);

function accentOf(id: WeaponId): Rgb {
    return rgb(parseInt(WEAPONS[id].color.slice(1), 16));
}

function barrel(mb: MeshBuilder, x0: number, length: number, y: number, z: number, radius: number, color: Rgb) {
    mb.push();
    mb.translate(x0, y, z);
    mb.rotateZ(-Math.PI / 2);
    mb.cylinder(0, 0, 0, radius, radius, length, 8, color, color, true);
    mb.pop();
}

function box(mb: MeshBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Rgb) {
    mb.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color);
}

function glowBox(mb: MeshBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Rgb) {
    mb.setExtra(0, 0, 1);
    box(mb, x0, y0, z0, x1, y1, z1, color);
    mb.setExtra(0, 0, 0);
}

export function gunGeometry(id: WeaponId): BufferGeometry {
    const mb = new MeshBuilder(createRng(0x6a11 + id.length * 31), 1024);
    const a = accentOf(id);
    mb.setExtra(0, 0, 0);
    switch (id) {
        case 'pistol':
            box(mb, -0.14, 0.0, -0.025, 0.17, 0.075, 0.025, METAL);
            box(mb, -0.14, -0.15, -0.025, -0.06, 0.0, 0.025, METAL_LIGHT);
            box(mb, -0.02, -0.03, -0.015, 0.04, 0.0, 0.015, METAL_LIGHT);
            glowBox(mb, -0.1, 0.075, -0.012, 0.14, 0.092, 0.012, a);
            break;
        case 'rifle':
            box(mb, -0.34, -0.02, -0.03, 0.2, 0.08, 0.03, METAL);
            box(mb, -0.52, -0.06, -0.025, -0.34, 0.07, 0.025, WOOD);
            barrel(mb, 0.2, 0.34, 0.035, 0, 0.018, METAL_LIGHT);
            box(mb, -0.05, -0.16, -0.022, 0.03, -0.02, 0.022, METAL_LIGHT);
            box(mb, -0.2, -0.12, -0.02, -0.14, -0.02, 0.02, METAL_LIGHT);
            glowBox(mb, -0.3, 0.08, -0.012, 0.15, 0.1, 0.012, a);
            break;
        case 'smg':
            box(mb, -0.2, -0.01, -0.03, 0.16, 0.085, 0.03, METAL);
            barrel(mb, 0.16, 0.12, 0.035, 0, 0.02, METAL_LIGHT);
            box(mb, -0.02, -0.24, -0.02, 0.04, -0.01, 0.02, METAL_LIGHT);
            box(mb, -0.17, -0.13, -0.02, -0.11, -0.01, 0.02, METAL_LIGHT);
            box(mb, -0.34, 0.0, -0.01, -0.2, 0.06, 0.01, METAL_LIGHT);
            glowBox(mb, -0.15, 0.085, -0.012, 0.12, 0.104, 0.012, a);
            break;
        case 'shotgun':
            box(mb, -0.3, -0.02, -0.035, 0.08, 0.08, 0.035, METAL);
            box(mb, -0.55, -0.08, -0.03, -0.3, 0.07, 0.03, WOOD);
            barrel(mb, 0.08, 0.5, 0.045, 0, 0.026, METAL_LIGHT);
            barrel(mb, 0.08, 0.5, 0.0, 0, 0.026, METAL);
            box(mb, 0.14, -0.03, -0.04, 0.34, 0.03, 0.04, WOOD);
            glowBox(mb, -0.25, 0.08, -0.012, 0.05, 0.098, 0.012, a);
            break;
        case 'sniper':
            box(mb, -0.34, -0.02, -0.03, 0.14, 0.08, 0.03, METAL);
            box(mb, -0.6, -0.08, -0.028, -0.34, 0.07, 0.028, WOOD);
            barrel(mb, 0.14, 0.62, 0.035, 0, 0.016, METAL_LIGHT);
            barrel(mb, -0.12, 0.3, 0.12, 0, 0.032, METAL);
            glowBox(mb, 0.1, 0.1, -0.034, 0.16, 0.14, 0.034, a);
            box(mb, -0.12, -0.06, -0.022, -0.06, -0.02, 0.022, METAL_LIGHT);
            break;
        case 'launcher':
            barrel(mb, -0.45, 0.9, 0.06, 0, 0.075, METAL);
            barrel(mb, 0.4, 0.14, 0.06, 0, 0.09, METAL_LIGHT);
            box(mb, -0.12, -0.1, -0.03, -0.04, 0.0, 0.03, METAL_LIGHT);
            box(mb, 0.1, -0.08, -0.025, 0.16, 0.0, 0.025, METAL_LIGHT);
            glowBox(mb, 0.25, 0.1, -0.04, 0.35, 0.14, 0.04, a);
            glowBox(mb, -0.3, 0.1, -0.04, -0.2, 0.14, 0.04, a);
            break;
    }
    return mb.build();
}

export function ammoGeometry(): BufferGeometry {
    const mb = new MeshBuilder(createRng(0xa33), 256);
    const body = rgb(0xb8b8b0);
    const lid = mixRgb(body, rgb(0xffffff), 0.35);
    mb.setExtra(0, 0, 0);
    mb.box(0, 0.09, 0, 0.32, 0.18, 0.22, body);
    mb.box(0, 0.185, 0, 0.34, 0.03, 0.24, lid);
    mb.setExtra(0, 0, 1);
    mb.box(0, 0.1, 0.112, 0.2, 0.06, 0.006, rgb(0xffffff));
    mb.box(0, 0.1, -0.112, 0.2, 0.06, 0.006, rgb(0xffffff));
    mb.setExtra(0, 0, 0);
    mb.box(0.12, 0.2, 0, 0.04, 0.03, 0.12, BRASS);
    return mb.build();
}

export function coinGeometry(): BufferGeometry {
    const mb = new MeshBuilder(createRng(0xc01), 256);
    const gold = rgb(0xffd24a);
    const edge = rgb(0xc9961f);
    mb.setExtra(0, 0, 1);
    mb.push();
    mb.rotateX(Math.PI / 2);
    mb.cylinder(0, -0.025, 0, 0.17, 0.17, 0.05, 14, edge, gold, true);
    mb.pop();
    return mb.build();
}

export function beaconGeometry(): BufferGeometry {
    const mb = new MeshBuilder(createRng(0xbea), 128);
    mb.setExtra(0, 0, 0);
    mb.cylinder(0, 0, 0, 0.16, 0.05, 7, 10, rgb(0xffffff), rgb(0x000000), false);
    return mb.build();
}
