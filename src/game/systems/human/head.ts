import { Mesher, smoothstep, xfMove, xfMul, xfRotX, xfRotY, xfRotZ, xfScale, type Bump, type PaintFn, type Section, type SkinFn } from './mesher.ts';
import { MAT, chain, profile, rigid, rowCurves, type Ctx, type Row } from './anatomy.ts';
import { HAIR_LINKS, HAIR_ROOT, HAIR_TILT } from './skeleton.ts';
import { mix, tone } from './look.ts';
import { skinPaint } from './torso.ts';

const MALE_HEAD: Row[] = [
    [-0.03, 0.012, 0.012, 0.01, 0.04],
    [-0.02, 0.026, 0.026, 0.022, 0.04],
    [-0.008, 0.042, 0.04, 0.036, 0.034],
    [0.008, 0.054, 0.044, 0.05, 0.028],
    [0.028, 0.062, 0.062, 0.074, 0.014],
    [0.052, 0.068, 0.07, 0.088, 0.006],
    [0.078, 0.072, 0.074, 0.095, 0.003],
    [0.104, 0.075, 0.078, 0.098, 0],
    [0.13, 0.076, 0.08, 0.097, -0.003],
    [0.156, 0.072, 0.074, 0.092, -0.006],
    [0.182, 0.058, 0.06, 0.08, -0.008],
    [0.201, 0.036, 0.04, 0.056, -0.01],
    [0.212, 0.012, 0.014, 0.02, -0.01],
];

const FEMALE_HEAD: Row[] = [
    [-0.027, 0.011, 0.011, 0.009, 0.037],
    [-0.018, 0.024, 0.024, 0.02, 0.037],
    [-0.007, 0.039, 0.037, 0.033, 0.031],
    [0.007, 0.05, 0.041, 0.047, 0.026],
    [0.025, 0.058, 0.058, 0.07, 0.013],
    [0.048, 0.064, 0.066, 0.083, 0.006],
    [0.072, 0.068, 0.07, 0.09, 0.002],
    [0.096, 0.07, 0.074, 0.092, -0.001],
    [0.12, 0.071, 0.076, 0.091, -0.004],
    [0.143, 0.067, 0.071, 0.086, -0.006],
    [0.166, 0.054, 0.058, 0.075, -0.008],
    [0.184, 0.034, 0.038, 0.052, -0.009],
    [0.196, 0.011, 0.013, 0.017, -0.009],
];

function lid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, from: number, to: number, count: number): Section[] {
    const out: Section[] = [];
    for (let i = 0; i < count; i++) {
        const y = from + ((to - from) * i) / (count - 1);
        const t = Math.max(-1, Math.min(1, (y - cy) / ry));
        const k = Math.sqrt(Math.max(0.0004, 1 - t * t));
        out.push({ y, rx: rx * k, rf: rz * k, rb: rz * k, cx, cz });
    }
    return out;
}

export function buildHead(ctx: Ctx, out: Mesher): void {
    const { P, look, id, fem } = ctx;
    const rows = fem ? FEMALE_HEAD : MALE_HEAD;
    const hs = fem ? 0.93 : 1;
    const sy = 0.93;
    const headXf = xfMul(xfMove(0, P, 0), xfScale(1, sy, 1));
    const hc = rowCurves(rows, 0, 2.15);
    const bumps: Bump[] = [];
    const sym = (y: number, a: number, sh: number, sa: number, amp: number) => {
        bumps.push({ y, a, sy: sh, sa, amp });
        if (a !== 0) bumps.push({ y, a: -a, sy: sh, sa, amp });
    };
    sym(0.097 * hs, 0, 0.02, 0.09, 0.005);
    sym(0.045 * hs, 0, 0.011, 0.1, fem ? 0.009 : 0.012);
    sym(0.033 * hs, 0, 0.007, 0.08, 0.006);
    sym(0.037 * hs, 0.17, 0.008, 0.07, 0.008);
    sym(0.109 * hs, 0.3, 0.008, 0.32, fem ? 0.003 : 0.007);
    sym(0.106 * hs, 0, 0.007, 0.12, 0.004);
    sym(0.093 * hs, 0.4, 0.011, 0.13, -0.006);
    sym(0.07 * hs, 0.78, 0.016, 0.2, fem ? 0.008 : 0.007);
    sym(0.02 * hs, 0, 0.005, 0.14, fem ? 0.005 : 0.003);
    sym(0.003 * hs, 0, 0.006, 0.14, fem ? 0.005 : 0.003);
    sym(0.012 * hs, 0, 0.0025, 0.16, -0.002);
    sym(-0.015 * hs, 0, 0.011, 0.2, fem ? 0.005 : 0.009);
    if (!fem) sym(0.02, 1.25, 0.02, 0.25, 0.006);
    const base = skinPaint(ctx);
    const beard = mix(look.skin, look.hair, 0.3);
    const headPaint: PaintFn = (x, y, z, a) => {
        const c = base(x, y, z, a);
        const ax = Math.abs(x);
        const fine = 0.5 + 0.5 * Math.sin(x * 520 + y * 430 + z * 470);
        let out = c;
        if (z > 0.03) {
            const le = (ax / 0.022) * (ax / 0.022) + ((y - 0.0125 * hs) / (fem ? 0.0085 : 0.0075)) * ((y - 0.0125 * hs) / (fem ? 0.0085 : 0.0075));
            out = mix(out, look.lips, smoothstep(1.0, 0.55, le));
            out = mix(out, tone(look.lips, 0.55), smoothstep(0.0018, 0.0006, Math.abs(y - 0.0122 * hs)) * smoothstep(0.02, 0.012, ax));
            const brow = smoothstep(0.008, 0.016, ax) * smoothstep(0.054, 0.044, ax) * smoothstep(0.1 * hs, 0.105 * hs, y) * smoothstep(0.114 * hs, 0.108 * hs, y);
            out = mix(out, look.brow, brow * 0.9);
            const cheek = smoothstep(0.03, 0.04, ax) * smoothstep(0.066, 0.056, ax) * smoothstep(0.035 * hs, 0.05 * hs, y) * smoothstep(0.09 * hs, 0.075 * hs, y);
            out = mix(out, look.blush, cheek * (fem ? 0.38 : 0.2));
        }
        if (!fem) {
            const jaw = smoothstep(0.052, 0.01, y) * smoothstep(0.075, 0.055, ax);
            const must = smoothstep(0.03, 0.018, ax) * smoothstep(0.016, 0.026, y) * smoothstep(0.044, 0.034, y) * (z > 0.03 ? 1 : 0);
            const side = smoothstep(0.058, 0.066, ax) * smoothstep(0.03, 0.045, y) * smoothstep(0.09, 0.07, y);
            const lipsKeep = z > 0.03 ? 1 - smoothstep(0.022, 0.014, ax) * smoothstep(-0.006, 0.0, y) * smoothstep(0.028, 0.02, y) : 1;
            const stub = Math.min(1, (jaw + must + side) * (0.65 + 0.35 * fine)) * lipsKeep;
            out = mix(out, beard, stub * 0.72);
        }
        return out;
    };
    const sections: Section[] = [];
    for (let i = 0; i < 40; i++) {
        const y = hc.y0 + ((hc.y1 - hc.y0) * i) / 39;
        sections.push({ y, rx: hc.rx(y), rf: hc.rf(y), rb: hc.rb(y), cz: hc.cz(y), n: 2.15 });
    }
    const head = new Mesher();
    head.loft({ sections, seg: 52, rings: 40, bumps, skin: rigid(id.head), paint: headPaint, xf: headXf, mat: MAT.skin });
    out.merge(head);

    const eyeY = 0.093 * hs;
    const surfaceZ = (y: number, x: number) => hc.cz(y) + hc.rf(y) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / hc.rx(y), 2.15)), 1 / 2.15);
    const lashes = tone(look.brow, 0.7);
    for (const s of [1, -1]) {
        const ex = 0.0315 * s;
        const ez = surfaceZ(eyeY, ex) - 0.006 - 0.0066;
        const er: [number, number, number] = [0.0125, 0.0096, 0.011];
        const paint: PaintFn = (x, y, z) => {
            const dx = (x - ex) / er[0];
            const dy = (y - eyeY) / er[1];
            const dz = (z - ez) / er[2];
            if (dz > 0.94 && dx * dx + dy * dy < 0.12) return [0.008, 0.008, 0.01];
            if (dz > 0.62 && dx * dx + dy * dy < 0.62) return mix(look.iris, tone(look.iris, 1.5), 0.5 + 0.5 * Math.sin(dx * 14 + dy * 9));
            return look.sclera;
        };
        const eye = new Mesher();
        eye.ellipsoid(ex, eyeY, ez, er[0], er[1], er[2], 16, 12, rigid(id.head), paint, headXf, undefined, MAT.eye);
        out.merge(eye);
        const lids = new Mesher();
        const up = lid(ex, eyeY, ez, er[0] * 1.085, er[1] * 1.1, er[2] * 1.085, eyeY + 0.0012, eyeY + er[1] * 1.1, 8);
        lids.loft({ sections: up, seg: 16, rings: 8, skin: rigid(id.head), paint: ((x, y, z, a) => (y < eyeY + 0.0042 && z > ez ? lashes : base(x, y, z, a))) as PaintFn, xf: headXf, open: true, mat: MAT.skin });
        const lo = lid(ex, eyeY, ez, er[0] * 1.07, er[1] * 1.08, er[2] * 1.07, eyeY - er[1] * 1.08, eyeY - 0.0036, 6);
        lids.loft({ sections: lo, seg: 16, rings: 6, skin: rigid(id.head), paint: ((x, y, z, a) => (y > eyeY - 0.0048 && z > ez ? tone(look.skin, 0.8) : base(x, y, z, a))) as PaintFn, xf: headXf, open: true, mat: MAT.skin });
        out.merge(lids);
        const ear = new Mesher();
        ear.ellipsoid(0, 0, 0, 0.007, 0.024 * hs, 0.015, 12, 8, rigid(id.head), mix(look.skin, look.blush, 0.25), xfMul(xfMul(headXf, xfMove(0.0765 * s, 0.092 * hs, -0.004)), xfMul(xfRotY(0.35 * s), xfRotZ(0.08 * s))), undefined, MAT.skin);
        out.merge(ear);
    }

    const hairLine = fem
        ? profile([
              [0, 0.14],
              [0.5, 0.13],
              [0.95, 0.092],
              [1.45, 0.082],
              [2.3, 0.045],
              [Math.PI, 0.012],
          ])
        : profile([
              [0, 0.148],
              [0.38, 0.154],
              [0.75, 0.138],
              [1.1, 0.122],
              [1.57, 0.112],
              [2.3, 0.088],
              [Math.PI, 0.05],
          ]);
    const hairPaint: PaintFn = (x, y, z) => {
        const streak = 0.5 + 0.5 * Math.sin(x * 620 + z * 540 + Math.sin(y * 170) * 2.5);
        const broad = 0.5 + 0.5 * Math.sin(x * 60 + y * 35 + z * 50);
        return mix(tone(look.hair, 0.8 + 0.2 * streak), look.hairHi, broad * (fem ? 0.5 : 0.28));
    };
    const hair = new Mesher();
    hair.loft({
        sections,
        seg: 72,
        rings: 20,
        offset: fem ? 0.0085 : 0.0055,
        bumps: fem
            ? [
                  { y: 0.18, a: 0, sy: 0.05, sa: 1.6, amp: 0.012 },
                  { y: 0.14, a: 0.5, sy: 0.03, sa: 0.5, amp: 0.008 },
              ]
            : [
                  { y: 0.18, a: 0, sy: 0.05, sa: 1.4, amp: 0.012 },
                  { y: 0.16, a: 0.3, sy: 0.03, sa: 0.3, amp: 0.006 },
              ],
        skin: rigid(id.head),
        paint: hairPaint,
        xf: headXf,
        lo: hairLine,
        open: true,
        closeTop: true,
        mat: MAT.hair,
    });
    out.merge(hair);

    if (fem) {
        const rootY = P + HAIR_ROOT[1];
        const tail = new Mesher();
        const L = HAIR_LINKS[0] + HAIR_LINKS[1] + 0.12;
        const tailSkin: SkinFn = chain([id.hairA, id.hairB, id.hairC], [-HAIR_LINKS[0], -(HAIR_LINKS[0] + HAIR_LINKS[1])], 0.045);
        tail.loft({
            sections: [
                { y: -L, rx: 0.006, rf: 0.006, rb: 0.006 },
                { y: -L * 0.86, rx: 0.015, rf: 0.012, rb: 0.012 },
                { y: -L * 0.65, rx: 0.026, rf: 0.02, rb: 0.02 },
                { y: -L * 0.4, rx: 0.036, rf: 0.028, rb: 0.028 },
                { y: -L * 0.15, rx: 0.036, rf: 0.029, rb: 0.029 },
                { y: -0.012, rx: 0.026, rf: 0.022, rb: 0.022 },
                { y: 0.02, rx: 0.02, rf: 0.018, rb: 0.018 },
            ],
            seg: 14,
            rings: 22,
            bumps: [
                { y: -L * 0.5, a: 0.8, sy: 0.08, sa: 0.5, amp: 0.004 },
                { y: -L * 0.5, a: -0.8, sy: 0.08, sa: 0.5, amp: 0.004 },
            ],
            skin: tailSkin,
            paint: ((x, y, z) => mix(tone(look.hair, 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(x * 640 + y * 90 + z * 560))), look.hairHi, 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(x * 55 + y * 25 + z * 45)))) as PaintFn,
            capLow: 0.02,
            xf: xfMul(xfMove(0, rootY, HAIR_ROOT[2]), xfRotX(HAIR_TILT)),
            mat: MAT.hair,
        });
        out.merge(tail);
        const tie = new Mesher();
        tie.loft({
            sections: [
                { y: -0.012, rx: 0.031, rf: 0.026, rb: 0.026 },
                { y: 0.002, rx: 0.034, rf: 0.029, rb: 0.029 },
            ],
            seg: 14,
            rings: 3,
            skin: rigid(id.hairA),
            paint: look.lace,
            xf: xfMul(xfMove(0, rootY - 0.01, HAIR_ROOT[2] - 0.003), xfRotX(HAIR_TILT)),
            mat: MAT.leather,
            open: true,
        });
        out.merge(tie);
    }
}