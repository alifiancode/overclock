import { Mesher, curve, smoothstep, surfaceOf, xfMove, xfMul, xfScale, type Bump, type PaintFn, type Rgb, type Section, type SkinFn } from './mesher.ts';
import { MAT, chain, rigid, route, type Ctx } from './anatomy.ts';
import { FINGERS, FINGER_NAMES, bone, type FingerName } from './skeleton.ts';
import { mix, tone } from './look.ts';
import { skinPaint } from './torso.ts';

function fabric(base: Rgb, amount = 0.06): PaintFn {
    return (x, y, z) => tone(base, 1 - amount + amount * 2 * (0.5 + 0.5 * Math.sin(x * 190 + y * 150 + z * 170)));
}

function table(rows: number[][], y0: number, k: number, cx: number, ls = 1): Section[] {
    return rows.map((r) => ({ y: y0 + (r[0] < 0 ? r[0] * ls : r[0]), rx: r[1] * k, rf: r[2] * k, rb: r[3] * k, cx }));
}

function resample(sections: Section[], from: number, to: number, count: number, grow: number): Section[] {
    const ys = sections.slice().sort((a, b) => a.y - b.y).map((s) => s.y);
    const sorted = sections.slice().sort((a, b) => a.y - b.y);
    const rx = curve(ys, sorted.map((s) => s.rx));
    const rf = curve(ys, sorted.map((s) => s.rf ?? s.rx));
    const rb = curve(ys, sorted.map((s) => s.rb ?? s.rf ?? s.rx));
    const cx = curve(ys, sorted.map((s) => s.cx ?? 0));
    const cz = curve(ys, sorted.map((s) => s.cz ?? 0));
    const out: Section[] = [];
    for (let i = 0; i < count; i++) {
        const y = from + ((to - from) * i) / (count - 1);
        out.push({ y, rx: rx(y) + grow, rf: rf(y) + grow, rb: rb(y) + grow, cx: cx(y), cz: cz(y) });
    }
    return out;
}

export function buildArm(ctx: Ctx): Mesher {
    const { b, S, E, W, look, id, fem, bw } = ctx;
    const m = new Mesher();
    const k = fem ? 0.84 : 1;
    const ls = b.upperArm / 0.318;
    const lf = b.foreArm / 0.268;
    const upperRows = [
        [0.03, 0.052, 0.054, 0.05],
        [0, 0.06, 0.062, 0.058],
        [-0.07, 0.058, 0.06, 0.055],
        [-0.14, 0.052, 0.056, 0.052],
        [-0.21, 0.046, 0.049, 0.047],
        [-0.275, 0.041, 0.043, 0.042],
        [-0.318, 0.04, 0.041, 0.04],
    ];
    const upper = table(upperRows, S, k, b.shoulderX, ls);
    const upperSkin: SkinFn = (_x, y) => [id.chest, id.upper, 0.55 + 0.45 * smoothstep(S + 0.05, S - 0.02, y)];
    const elbow = chain([id.upper, id.lower], [E], 0.05);
    const armSkin: SkinFn = (x, y, z) => (y > E + 0.05 ? upperSkin(x, y, z) : elbow(x, y, z));
    const armBumps: Bump[] = [
        { y: S - 0.15 * ls, a: 0, sy: 0.065, sa: 0.55, amp: fem ? 0.002 : 0.007 },
        { y: S - 0.14 * ls, a: Math.PI, sy: 0.07, sa: 0.55, amp: fem ? 0.003 : 0.01 },
        { y: S - 0.01, a: 0.75, sy: 0.04, sa: 0.5, amp: fem ? 0.002 : 0.005 },
        { y: S - 0.01, a: Math.PI - 0.75, sy: 0.04, sa: 0.5, amp: fem ? 0.002 : 0.005 },
        { y: S - 0.2 * ls, a: Math.PI / 2, sy: 0.07, sa: 0.4, amp: fem ? 0 : 0.004 },
    ];
    if (!fem) {
        const hem = S - 0.2 * ls;
        m.loft({
            sections: resample(upper, hem, S + 0.03, 14, 0.0075),
            seg: 22,
            rings: 14,
            bumps: armBumps.map((bp) => ({ ...bp, amp: bp.amp * 0.7 })),
            skin: armSkin,
            paint: ((x, y, z, a) => (y < hem + 0.017 ? look.topDark : fabric(look.top)(x, y, z, a))) as PaintFn,
            mat: MAT.cloth,
            capHigh: 0.034,
        });
    }

    const foreRows = [
        [-0.045, 0.043, 0.044, 0.04],
        [-0.11, 0.041, 0.041, 0.037],
        [-0.18, 0.034, 0.034, 0.03],
        [-0.235, 0.029, 0.027, 0.023],
        [-0.268, 0.027, 0.0225, 0.0195],
        [-0.298, 0.027, 0.0225, 0.0195],
    ];
    const handSkin: SkinFn = (x, y, z) => (y > W + 0.06 ? armSkin(x, y, z) : [id.lower, id.wrist, smoothstep(W + 0.045, W - 0.01, y)]);
    const foreSections = table(foreRows, E, k, b.shoulderX, lf);
    m.loft({
        sections: [...upper.slice(0, upper.length - 1), { ...upper[upper.length - 1], rx: 0.039 * k, rf: 0.04 * k, rb: 0.037 * k }, ...foreSections],
        seg: 22,
        rings: 40,
        bumps: [
            ...armBumps,
            { y: E - 0.05 * lf, a: 0.7, sy: 0.05, sa: 0.5, amp: fem ? 0.002 : 0.004 },
            { y: E - 0.05 * lf, a: -0.7, sy: 0.05, sa: 0.5, amp: fem ? 0.001 : 0.003 },
            { y: E - 0.12 * lf, a: Math.PI, sy: 0.05, sa: 0.6, amp: fem ? 0.001 : 0.003 },
        ],
        skin: handSkin,
        paint: skinPaint(ctx),
        mat: MAT.skin,
        capHigh: 0.03,
    });

    const hx = bw.wristL[0];
    const hy = bw.wristL[1];
    const hxf = xfMul(xfMove(hx, hy, 0), xfScale(b.handScale, b.handScale, b.handScale));
    const knuckle = mix(look.skin, look.blush, 0.35);
    const palmSkin: SkinFn = (_x, y) => [id.lower, id.wrist, smoothstep(0.03, -0.005, y)];
    m.loft({
        sections: [
            { y: -0.1, rx: 0.034, rf: 0.012, rb: 0.01, cx: 0.001 },
            { y: -0.09, rx: 0.041, rf: 0.0135, rb: 0.0118, cx: 0.001 },
            { y: -0.075, rx: 0.0425, rf: 0.0145, rb: 0.012 },
            { y: -0.055, rx: 0.04, rf: 0.0155, rb: 0.012 },
            { y: -0.035, rx: 0.035, rf: 0.0165, rb: 0.0125 },
            { y: -0.015, rx: 0.029, rf: 0.0165, rb: 0.0132 },
            { y: 0, rx: 0.0255, rf: 0.0158, rb: 0.0135 },
            { y: 0.02, rx: 0.02, rf: 0.0135, rb: 0.012 },
        ],
        seg: 14,
        rings: 12,
        skin: palmSkin,
        paint: ((x, y, z, a) => (Math.abs(a - Math.PI) < 0.7 && y < -0.07 ? knuckle : skinPaint(ctx)(x, y, z, a))) as PaintFn,
        bumps: [
            { y: -0.035, a: 0.6, sy: 0.026, sa: 0.5, amp: 0.008 },
            { y: -0.055, a: -0.5, sy: 0.026, sa: 0.5, amp: 0.004 },
            { y: -0.088, a: Math.PI, sy: 0.008, sa: 1.2, amp: 0.002 },
        ],
        mat: MAT.skin,
        xf: hxf,
    });
    for (const f of FINGER_NAMES) m.merge(finger(f, ctx, hxf, knuckle));
    return m;
}

function finger(f: FingerName, ctx: Ctx, hxf: readonly number[], knuckle: Rgb): Mesher {
    const d = FINGERS[f];
    const names = [bone(`${f}0L`), bone(`${f}1L`), bone(`${f}2L`)];
    const l0 = d.len[0];
    const l1 = d.len[1];
    const l2 = d.len[2];
    const r = d.r * (ctx.fem ? 0.92 : 1);
    const j1 = -l0;
    const j2 = -(l0 + l1);
    const tip = -(l0 + l1 + l2);
    const skin = chain([names[0], names[1], names[2]], [j1, j2], 0.007);
    const topSkin: SkinFn = (x, y, z) => (y > -0.004 ? [bone('wristL'), names[0], smoothstep(0.006, -0.006, y)] : skin(x, y, z));
    const sections: Section[] = [
        { y: tip, rx: r * 0.78, rf: r * 0.7, rb: r * 0.7 },
        { y: tip + l2 * 0.5, rx: r * 0.86, rf: r * 0.8, rb: r * 0.76 },
        { y: j2, rx: r * 0.98, rf: r * 0.88, rb: r * 0.84 },
        { y: j2 + l1 * 0.5, rx: r * 0.92, rf: r * 0.8, rb: r * 0.78 },
        { y: j1, rx: r * 1.02, rf: r * 0.92, rb: r * 0.9 },
        { y: j1 + l0 * 0.5, rx: r * 0.96, rf: r * 0.84, rb: r * 0.82 },
        { y: 0, rx: r * 1.02, rf: r * 0.9, rb: r * 0.9 },
        { y: 0.01, rx: r * 1.02, rf: r * 0.9, rb: r * 0.9 },
    ];
    const m = new Mesher();
    const base = xfMul(hxf, xfMove(d.at[0], d.at[1], d.at[2]));
    const paint: PaintFn = (x, y, z, a) => {
        if (y < tip + 0.013 && Math.abs(a - Math.PI) < 0.95) return ctx.look.nail;
        if (Math.abs(y - j1) < 0.005 || Math.abs(y - j2) < 0.004) return knuckle;
        return skinPaint(ctx)(x, y, z, a);
    };
    m.loft({ sections, seg: 8, rings: 14, skin: topSkin, paint, capLow: r * 0.7, xf: base, mat: MAT.skin });
    return m;
}

const THIGH_M = [
    [0, 0.098, 0.1, 0.102],
    [0.14, 0.095, 0.098, 0.1],
    [0.3, 0.09, 0.092, 0.095],
    [0.5, 0.082, 0.084, 0.086],
    [0.68, 0.074, 0.076, 0.076],
    [0.85, 0.066, 0.068, 0.067],
    [1, 0.06, 0.062, 0.06],
];
const SHIN_M = [
    [0, 0.06, 0.062, 0.06],
    [0.1, 0.058, 0.06, 0.059],
    [0.25, 0.056, 0.058, 0.062],
    [0.4, 0.054, 0.056, 0.064],
    [0.6, 0.047, 0.048, 0.054],
    [0.78, 0.041, 0.042, 0.044],
    [0.93, 0.04, 0.041, 0.042],
    [1, 0.043, 0.044, 0.046],
];
const THIGH_F = [
    [0, 0.104, 0.104, 0.108],
    [0.14, 0.101, 0.101, 0.106],
    [0.3, 0.095, 0.095, 0.1],
    [0.5, 0.085, 0.086, 0.09],
    [0.68, 0.075, 0.077, 0.078],
    [0.85, 0.064, 0.066, 0.065],
    [1, 0.056, 0.058, 0.056],
];
const SHIN_F = [
    [0, 0.056, 0.058, 0.056],
    [0.1, 0.054, 0.056, 0.055],
    [0.25, 0.052, 0.054, 0.058],
    [0.4, 0.05, 0.052, 0.06],
    [0.6, 0.042, 0.043, 0.048],
    [0.78, 0.035, 0.036, 0.038],
    [0.93, 0.033, 0.034, 0.036],
    [1, 0.036, 0.037, 0.039],
];

export function buildLeg(ctx: Ctx): Mesher {
    const { b, H, K, A, look, id, fem } = ctx;
    const m = new Mesher();
    const legX = b.hipX;
    const thighT = fem ? THIGH_F : THIGH_M;
    const shinT = fem ? SHIN_F : SHIN_M;
    const sections: Section[] = [];
    for (const r of thighT) sections.push({ y: H - r[0] * b.thigh + (r[0] === 0 ? 0.02 : 0), rx: r[1], rf: r[2], rb: r[3], cx: legX });
    for (let i = 1; i < shinT.length; i++) {
        const r = shinT[i];
        sections.push({ y: K - r[0] * (b.shin - 0.045) , rx: r[1], rf: r[2], rb: r[3], cx: legX });
    }
    const legSkin: SkinFn = (_x, y) => {
        if (y > H - 0.1) return [id.pelvis, id.thigh, smoothstep(H + 0.05, H - 0.1, y)];
        if (y > K - 0.12) return [id.thigh, id.shin, smoothstep(K + 0.07, K - 0.07, y)];
        return [id.shin, id.foot, smoothstep(A + 0.12, A + 0.02, y)];
    };
    const sortedSections = sections.slice().sort((a, c) => a.y - c.y);
    const yBootTop = fem ? K - 0.07 : A + 0.165;
    const pantsBottom = fem ? yBootTop - 0.012 : A + 0.06;
    const legBumps: Bump[] = fem
        ? [
              { y: K + 0.2, a: 0, sy: 0.12, sa: 0.8, amp: 0.004 },
              { y: K + 0.18, a: Math.PI, sy: 0.12, sa: 0.8, amp: 0.006 },
              { y: K + 0.1, a: Math.PI / 2 + 0.2, sy: 0.12, sa: 0.5, amp: 0.004 },
          ]
        : [
              { y: K + 0.22, a: 0, sy: 0.1, sa: 0.7, amp: 0.006 },
              { y: K + 0.22, a: Math.PI, sy: 0.1, sa: 0.7, amp: 0.004 },
              { y: H - 0.22, a: Math.PI / 2, sy: 0.06, sa: 0.42, amp: 0.016 },
              { y: H - 0.15, a: Math.PI / 2, sy: 0.007, sa: 0.5, amp: -0.004 },
              { y: K + 0.01, a: 0, sy: 0.05, sa: 0.5, amp: 0.012 },
              { y: K + 0.01, a: Math.PI, sy: 0.03, sa: 0.5, amp: -0.006 },
          ];
    const trimmed = resample(sortedSections, pantsBottom, H + 0.02, 40, fem ? 0.0035 : 0.007);
    const pantsPaint: PaintFn = (x, y, z, a) => {
        const base = fabric(fem ? look.pants : look.pants, fem ? 0.05 : 0.07)(x, y, z, a);
        if (!fem && y < K + 0.19 && y > K + 0.15 && Math.abs(a - Math.PI / 2) < 0.8) return tone(base, 0.8);
        return base;
    };
    m.loft({ sections: trimmed, seg: 28, rings: 40, bumps: legBumps, skin: legSkin, paint: pantsPaint, mat: MAT.cloth });
    const legSurface = surfaceOf({ sections: trimmed, bumps: legBumps, offset: 0 });
    if (fem) {
        m.strip({
            surface: legSurface,
            path: route([[H - 0.02, Math.PI / 2], [K + 0.1, Math.PI / 2], [pantsBottom + 0.02, Math.PI / 2]]),
            width: () => 0.009,
            steps: 30,
            lift: 0.0012,
            paint: look.lace,
            skin: legSkin,
            mat: MAT.cloth,
        });
    }

    const bootSections = resample(sortedSections, A - 0.06, yBootTop, fem ? 30 : 14, fem ? 0.0045 : 0.01);
    const bootSkin: SkinFn = (_x, y) => [id.shin, id.foot, smoothstep(A + 0.115, A + 0.03, y)];
    const bootPaint: PaintFn = (x, y, z) => {
        if (y > yBootTop - 0.016) return tone(look.boots, 1.7);
        return tone(look.boots, 0.92 + 0.16 * (0.5 + 0.5 * Math.sin(x * 120 + y * 90 + z * 100)));
    };
    m.loft({
        sections: bootSections,
        seg: 26,
        rings: bootSections.length,
        bumps: fem ? [{ y: A + 0.03, a: 0, sy: 0.012, sa: 0.5, amp: 0.004 }] : [{ y: A + 0.05, a: 0, sy: 0.02, sa: 0.5, amp: 0.006 }],
        skin: bootSkin,
        paint: bootPaint,
        mat: MAT.leather,
        open: true,
    });
    const bootSurface = surfaceOf({ sections: bootSections, offset: 0.0015 });
    m.strip({
        surface: bootSurface,
        path: route([[yBootTop - 0.012, 0], [(yBootTop + A) / 2, 0], [A + 0.03, 0]]),
        width: () => (fem ? 0.017 : 0.02),
        steps: fem ? 24 : 10,
        lift: 0.0035,
        paint: look.lace,
        skin: bootSkin,
        mat: MAT.leather,
    });
    const rungs = fem ? 9 : 5;
    for (let i = 0; i < rungs; i++) {
        const y = yBootTop - 0.03 - ((yBootTop - A - 0.06) * i) / (rungs - 1);
        m.strip({
            surface: bootSurface,
            path: route([[y + 0.005, -0.34], [y - 0.005, 0], [y + 0.005, 0.34]]),
            width: () => 0.0065,
            steps: 8,
            lift: 0.0042,
            paint: look.lace,
            skin: bootSkin,
            mat: MAT.leather,
        });
    }

    const footXf = xfMul(xfMove(legX, A - 0.085, 0), [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0]);
    const fk = fem ? 0.92 : 1;
    const rowsFoot: number[][] = [
        [-0.07, 0.01, 0.012, 0.006, 0.052],
        [-0.062, 0.033, 0.026, 0.022, 0.048],
        [-0.04, 0.043, 0.036, 0.034, 0.045],
        [0, 0.046, 0.04, 0.038, 0.043],
        [0.05, 0.048, 0.038, 0.036, 0.04],
        [0.09, 0.05, 0.034, 0.033, 0.037],
        [0.13, 0.047, 0.031, 0.03, 0.034],
        [0.165, 0.039, 0.026, 0.025, 0.03],
        [0.188, 0.022, 0.017, 0.016, 0.026],
    ];
    m.loft({
        sections: rowsFoot.map((r) => ({ y: r[0] * fk, rx: r[1] * fk, rf: r[2] * fk, rb: r[3] * fk, cz: r[4] * fk })),
        seg: 24,
        rings: 18,
        skin: rigid(id.foot),
        paint: ((_x, _y, z) => (z < 0.027 * fk ? look.sole : tone(look.boots, 1.04))) as PaintFn,
        xf: footXf,
        capLow: 0.01,
        capHigh: 0.01,
        mat: MAT.leather,
        bumps: [
            { y: 0.185 * fk, a: 0, sy: 0.02, sa: 1.0, amp: 0.002 },
            { y: 0.02 * fk, a: Math.PI / 2 + 1.1, sy: 0.04, sa: 0.5, amp: 0 },
        ],
    });
    return m;
}