import { Mesher, xfMove, xfMul, xfRotX, xfRotY, xfRotZ, type PaintFn, type Rgb } from './mesher.ts';
import { makeCtx } from './anatomy.ts';
import { fabricPaint, mix, tone } from './look.ts';
import type { BufferGeometry } from 'three';
import type { Gender } from './skeleton.ts';

const none = () => [0, 0, 0] as const;

function box(m: Mesher, cx: number, cy: number, cz: number, w: number, h: number, d: number, color: Rgb, rotY = 0, tilt = 0, n = 4.2) {
    m.loft({
        sections: [
            { y: -h / 2, rx: w / 2, rf: d / 2, rb: d / 2, n },
            { y: h / 2, rx: w / 2, rf: d / 2, rb: d / 2, n },
        ],
        seg: 24,
        rings: 2,
        skin: none,
        paint: fabricPaint(color, 0.05),
        capLow: 0.004,
        capHigh: 0.004,
        xf: xfMul(xfMove(cx, cy, cz), xfMul(xfRotY(rotY), xfRotX(tilt))),
    });
}

export function buildGear(gender: Gender): { gear: BufferGeometry; holster: BufferGeometry } {
    const ctx = makeCtx(gender);
    const { H, C, look, fem } = ctx;
    const g = new Mesher();
    if (fem) {
        const z = -0.128;
        const packBase = fabricPaint(look.pack, 0.06);
        const packPaint: PaintFn = (x, y, zz, a) => (Math.abs(x) < 0.012 && Math.abs(a - Math.PI) < 0.5 ? look.strap : packBase(x, y, zz, a));
        g.loft({
            sections: [
                { y: H + 0.2, rx: 0.1, rf: 0.045, rb: 0.045, cz: z, n: 3.4 },
                { y: H + 0.3, rx: 0.115, rf: 0.052, rb: 0.052, cz: z, n: 3.4 },
                { y: H + 0.4, rx: 0.112, rf: 0.05, rb: 0.05, cz: z, n: 3.4 },
                { y: H + 0.47, rx: 0.09, rf: 0.04, rb: 0.04, cz: z, n: 3.4 },
            ],
            seg: 32,
            rings: 14,
            skin: none,
            paint: packPaint,
            capLow: 0.01,
            capHigh: 0.01,
            bumps: [{ y: H + 0.34, a: Math.PI, sy: 0.07, sa: 0.9, amp: 0.006 }],
        });
        box(g, 0, H + 0.275, z - 0.052, 0.12, 0.1, 0.03, tone(look.pack, 1.25));
        box(g, 0.135, H + 0.06, 0.02, 0.05, 0.075, 0.045, look.belt, 0.55);
        box(g, -0.135, H + 0.06, 0.02, 0.05, 0.075, 0.045, look.belt, -0.55);
        box(g, 0, H + 0.065, -0.115, 0.075, 0.06, 0.04, look.belt);
        box(g, 0.145, H + 0.35, -0.04, 0.03, 0.16, 0.055, tone(look.pack, 1.1), 0.0);
    } else {
        const z = -0.18;
        g.loft({
            sections: [
                { y: H + 0.12, rx: 0.135, rf: 0.062, rb: 0.062, cz: z, n: 3.2 },
                { y: H + 0.27, rx: 0.152, rf: 0.072, rb: 0.072, cz: z, n: 3.2 },
                { y: H + 0.41, rx: 0.145, rf: 0.07, rb: 0.07, cz: z, n: 3.2 },
                { y: H + 0.5, rx: 0.115, rf: 0.052, rb: 0.052, cz: z, n: 3.2 },
            ],
            seg: 36,
            rings: 16,
            skin: none,
            paint: fabricPaint(look.pack, 0.07),
            capLow: 0.012,
            capHigh: 0.012,
            bumps: [
                { y: H + 0.32, a: Math.PI, sy: 0.1, sa: 0.9, amp: 0.008 },
                { y: H + 0.2, a: Math.PI, sy: 0.02, sa: 1.2, amp: -0.004 },
            ],
        });
        g.loft({
            sections: [
                { y: -0.17, rx: 0.05, rf: 0.05, rb: 0.05 },
                { y: 0.17, rx: 0.05, rf: 0.05, rb: 0.05 },
            ],
            seg: 18,
            rings: 3,
            skin: none,
            paint: tone(look.pack, 0.78),
            capLow: 0.012,
            capHigh: 0.012,
            xf: xfMul(xfMove(0, H + 0.545, z + 0.005), xfRotZ(Math.PI / 2)),
        });
        box(g, 0.178, H + 0.25, z + 0.02, 0.045, 0.14, 0.095, tone(look.pack, 1.1));
        box(g, -0.178, H + 0.25, z + 0.02, 0.045, 0.14, 0.095, tone(look.pack, 1.1));
        for (const x of [-0.078, 0, 0.078]) box(g, x, H + 0.205, 0.148, 0.066, 0.086, 0.04, tone(look.vest, 1.25));
        box(g, 0.165, H + 0.275, 0.04, 0.05, 0.1, 0.075, tone(look.vest, 1.2), 0.5);
        box(g, 0.158, H + 0.062, 0.03, 0.055, 0.08, 0.05, look.belt, 0.5);
        box(g, -0.158, H + 0.062, 0.03, 0.055, 0.08, 0.05, look.belt, -0.5);
        box(g, 0, H + 0.068, -0.125, 0.085, 0.06, 0.042, look.belt);
        box(g, 0.058, H + 0.475, 0.112, 0.06, 0.05, 0.03, tone(look.vest, 1.1));
    }
    const gear = g.toRigid([0, -C, 0]);

    const h = new Mesher();
    const side = fem ? 0.108 : 0.112;
    const holsterColor: Rgb = fem ? tone(look.belt, 0.9) : tone(look.boots, 1.1);
    h.loft({
        sections: [
            { y: -0.115, rx: 0.026, rf: 0.04, rb: 0.04, n: 3.4 },
            { y: 0.0, rx: 0.028, rf: 0.044, rb: 0.044, n: 3.4 },
        ],
        seg: 20,
        rings: 4,
        skin: none,
        paint: holsterColor,
        capLow: 0.012,
        capHigh: 0.006,
        xf: xfMove(-side, -0.2, 0.0),
    });
    h.loft({
        sections: [
            { y: 0.0, rx: 0.011, rf: 0.016, rb: 0.016, n: 3 },
            { y: 0.05, rx: 0.011, rf: 0.014, rb: 0.014, n: 3 },
        ],
        seg: 12,
        rings: 3,
        skin: none,
        paint: tone(look.sole, 1.6),
        capHigh: 0.004,
        xf: xfMove(-side, -0.083, 0.0),
    });
    for (const y of [-0.17, -0.235]) {
        h.loft({
            sections: [
                { y: y - 0.008, rx: 0.1, rf: 0.098, rb: 0.1 },
                { y: y + 0.008, rx: 0.1, rf: 0.098, rb: 0.1 },
            ],
            seg: 28,
            rings: 3,
            skin: none,
            paint: mix(holsterColor, look.metal, 0.12),
            open: true,
        });
    }
    const holster = h.toRigid([0, 0, 0]);
    return { gear, holster };
}