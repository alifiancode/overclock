import { Color } from 'three';
import { Mesher, curve, smoothstep, xfMove, xfMul, xfRotX, xfRotY, xfRotZ, xfScale, type Bump, type PaintFn, type Rgb, type Section, type SkinFn } from './mesher.ts';
import { BUILDS, FINGERS, FINGER_NAMES, HAIR_ROOT, HAIR_TILT, MIRROR, bindWorld, bone, type Build, type FingerName, type Gender } from './skeleton.ts';

export type Look = {
    skin: string;
    hair: string;
    jacket: string;
    jacketDark: string;
    pants: string;
    boots: string;
    trim: string;
    sole: string;
    lips: string;
    iris: string;
};

export const LOOKS: Record<Gender, Look> = {
    male: { skin: '#dba67f', hair: '#2b1c13', jacket: '#3f70d8', jacketDark: '#2d4f9e', pants: '#28334c', boots: '#1c1c23', trim: '#1a1a22', sole: '#2c2c34', lips: '#b9715f', iris: '#4a3320' },
    female: { skin: '#e8b793', hair: '#3a2415', jacket: '#3f70d8', jacketDark: '#2d4f9e', pants: '#28334c', boots: '#1c1c23', trim: '#1a1a22', sole: '#2c2c34', lips: '#c4687a', iris: '#3d5a46' },
};

const lin = (hex: string): Rgb => {
    const c = new Color(hex);
    return [c.r, c.g, c.b];
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const tone = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];

const rigid =
    (id: number): SkinFn =>
    () => [id, id, 0];

function chain(bones: number[], joints: number[], half: number): SkinFn {
    return (_x, y) => {
        for (let i = 0; i < joints.length; i++) {
            if (y > joints[i] + half) return [bones[i], bones[i], 0];
            if (y > joints[i] - half) return [bones[i], bones[i + 1], smoothstep(joints[i] + half, joints[i] - half, y)];
        }
        const last = bones[bones.length - 1];
        return [last, last, 0];
    };
}

type Row = readonly [number, number, number, number, number];

const MALE_TORSO: Row[] = [
    [-0.1, 0.125, 0.085, 0.092, -0.004],
    [-0.07, 0.152, 0.098, 0.104, -0.004],
    [0, 0.176, 0.106, 0.114, -0.006],
    [0.06, 0.17, 0.102, 0.108, -0.004],
    [0.12, 0.152, 0.098, 0.096, 0],
    [0.19, 0.158, 0.104, 0.098, 0.004],
    [0.27, 0.17, 0.114, 0.1, 0.007],
    [0.35, 0.178, 0.124, 0.102, 0.008],
    [0.41, 0.176, 0.118, 0.098, 0.004],
    [0.465, 0.166, 0.104, 0.09, 0],
    [0.51, 0.138, 0.086, 0.08, -0.003],
    [0.545, 0.096, 0.066, 0.068, -0.004],
    [0.572, 0.062, 0.056, 0.062, -0.005],
];

const FEMALE_TORSO: Row[] = [
    [-0.1, 0.128, 0.086, 0.092, -0.004],
    [-0.07, 0.155, 0.099, 0.104, -0.004],
    [0, 0.176, 0.108, 0.116, -0.006],
    [0.06, 0.164, 0.102, 0.108, -0.004],
    [0.12, 0.134, 0.092, 0.092, 0],
    [0.18, 0.126, 0.088, 0.086, 0.002],
    [0.25, 0.138, 0.096, 0.09, 0.005],
    [0.32, 0.15, 0.106, 0.094, 0.008],
    [0.38, 0.15, 0.1, 0.09, 0.004],
    [0.43, 0.14, 0.088, 0.082, 0],
    [0.47, 0.118, 0.074, 0.072, -0.003],
    [0.505, 0.082, 0.06, 0.062, -0.004],
    [0.535, 0.054, 0.048, 0.054, -0.005],
];

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
    [0.007, 0.051, 0.041, 0.047, 0.026],
    [0.025, 0.059, 0.058, 0.07, 0.013],
    [0.048, 0.065, 0.066, 0.083, 0.006],
    [0.072, 0.069, 0.07, 0.09, 0.002],
    [0.096, 0.071, 0.074, 0.092, -0.001],
    [0.12, 0.072, 0.076, 0.091, -0.004],
    [0.143, 0.068, 0.071, 0.086, -0.006],
    [0.166, 0.055, 0.058, 0.075, -0.008],
    [0.184, 0.034, 0.038, 0.052, -0.009],
    [0.196, 0.011, 0.013, 0.017, -0.009],
];

function rowsToCurves(rows: Row[], y0: number, n = 2.3) {
    const ys = rows.map((r) => y0 + r[0]);
    return {
        y0: ys[0],
        y1: ys[ys.length - 1],
        rx: curve(ys, rows.map((r) => r[1])),
        rf: curve(ys, rows.map((r) => r[2])),
        rb: curve(ys, rows.map((r) => r[3])),
        cz: curve(ys, rows.map((r) => r[4])),
        n,
    };
}

function sample(rows: Row[], y0: number, from: number, to: number, count: number, n = 2.3): Section[] {
    const c = rowsToCurves(rows, y0, n);
    const out: Section[] = [];
    for (let i = 0; i < count; i++) {
        const y = from + ((to - from) * i) / (count - 1);
        out.push({ y, rx: c.rx(y), rf: c.rf(y), rb: c.rb(y), cz: c.cz(y), n });
    }
    return out;
}

export function buildBody(gender: Gender, look: Look = LOOKS[gender]): Mesher {
    const b: Build = BUILDS[gender];
    const bw = bindWorld(b);
    const fem = gender === 'female';
    const H = b.ankle + b.shin + b.thigh;
    const C = H + b.waist;
    const S = C + b.shoulderY;
    const E = S - b.upperArm;
    const W = E - b.foreArm;
    const K = H - b.thigh;
    const A = b.ankle;
    const P = C + b.neckY;
    const torsoRows = fem ? FEMALE_TORSO : MALE_TORSO;
    const topY = H + torsoRows[torsoRows.length - 1][0];

    const cSkin = lin(look.skin);
    const cHair = lin(look.hair);
    const cJacket = lin(look.jacket);
    const cJacketDark = lin(look.jacketDark);
    const cPants = lin(look.pants);
    const cBoots = lin(look.boots);
    const cTrim = lin(look.trim);
    const cSole = lin(look.sole);
    const cLips = lin(look.lips);
    const cIris = lin(look.iris);
    const cBrow = tone(cHair, 1.1);
    const cNail = mix(cSkin, lin('#f1d3c4'), 0.55);
    const cKnuckle = mix(cSkin, lin('#c0705a'), 0.25);
    const cSclera = lin('#e9e6df');

    const id = {
        pelvis: bone('pelvis'),
        chest: bone('chest'),
        head: bone('head'),
        hairA: bone('hairA'),
        hairB: bone('hairB'),
        thigh: bone('thighL'),
        shin: bone('shinL'),
        foot: bone('footL'),
        upper: bone('upperL'),
        lower: bone('lowerL'),
        wrist: bone('wristL'),
    };

    const out = new Mesher();
    const center = new Mesher();
    const left = new Mesher();

    const torsoSkin: SkinFn = (_x, y) => [id.pelvis, id.chest, smoothstep(H - 0.02, C + 0.075, y)];
    const bumpsJacket: Bump[] = fem
        ? [
              { y: H + 0.318, a: 0.5, sy: 0.056, sa: 0.42, amp: 0.04 },
              { y: H + 0.318, a: -0.5, sy: 0.056, sa: 0.42, amp: 0.04 },
              { y: H + 0.38, a: Math.PI - 0.5, sy: 0.06, sa: 0.5, amp: 0.005 },
              { y: H + 0.38, a: Math.PI + 0.5, sy: 0.06, sa: 0.5, amp: 0.005 },
          ]
        : [
              { y: H + 0.36, a: 0.55, sy: 0.05, sa: 0.42, amp: 0.012 },
              { y: H + 0.36, a: -0.55, sy: 0.05, sa: 0.42, amp: 0.012 },
              { y: H + 0.38, a: Math.PI - 0.5, sy: 0.06, sa: 0.5, amp: 0.008 },
              { y: H + 0.38, a: Math.PI + 0.5, sy: 0.06, sa: 0.5, amp: 0.008 },
              { y: H + 0.27, a: Math.PI / 2 + 0.4, sy: 0.08, sa: 0.4, amp: 0.008 },
              { y: H + 0.27, a: -Math.PI / 2 - 0.4, sy: 0.08, sa: 0.4, amp: 0.008 },
          ];
    const glute = fem ? 0.02 : 0.012;
    const bumpsPants: Bump[] = [
        { y: H - 0.035, a: Math.PI - 0.42, sy: 0.07, sa: 0.5, amp: glute },
        { y: H - 0.035, a: Math.PI + 0.42, sy: 0.07, sa: 0.5, amp: glute },
        { y: H + 0.0, a: Math.PI / 2, sy: 0.07, sa: 0.5, amp: fem ? 0.008 : 0.004 },
        { y: H + 0.0, a: -Math.PI / 2, sy: 0.07, sa: 0.5, amp: fem ? 0.008 : 0.004 },
    ];

    center.loft({
        sections: sample(torsoRows, H, H - 0.1, H + 0.1, 12),
        seg: 40,
        rings: 12,
        offset: -0.004,
        bumps: bumpsPants,
        skin: torsoSkin,
        paint: cPants,
        capLow: 0.012,
    });
    center.loft({
        sections: sample(torsoRows, H, H + 0.012, H + 0.062, 5).map((s) => ({ ...s, rx: s.rx + 0.014, rf: (s.rf ?? s.rx) + 0.012, rb: (s.rb ?? s.rx) + 0.012 })),
        seg: 40,
        rings: 5,
        skin: torsoSkin,
        paint: ((_x, y, z, a) => (Math.abs(y - (H + 0.037)) < 0.014 && Math.abs(a) < 0.1 && z > 0 ? tone(lin('#b8bcc6'), 0.9) : cTrim)) as PaintFn,
        bumps: [{ y: H + 0.037, a: 0, sy: 0.014, sa: 0.1, amp: 0.006 }],
    });
    center.loft({
        sections: sample(torsoRows, H, H + 0.045, topY, 34),
        seg: 40,
        rings: 34,
        offset: 0.004,
        bumps: bumpsJacket,
        skin: torsoSkin,
        paint: ((_x, y) => (y < H + 0.075 ? cJacketDark : cJacket)) as PaintFn,
        capLow: 0.004,
    });
    const neckR = fem ? 0.047 : 0.056;
    const neckSkin: SkinFn = (_x, y) => [id.chest, id.head, smoothstep(topY - 0.02, P + 0.01, y)];
    center.loft({
        sections: [
            { y: topY - 0.03, rx: neckR + 0.002, rf: neckR - 0.002, rb: neckR + 0.004, cz: -0.004 },
            { y: topY + 0.02, rx: neckR, rf: neckR - 0.003, rb: neckR + 0.004, cz: -0.002 },
            { y: P - 0.005, rx: neckR - 0.002, rf: neckR - 0.004, rb: neckR + 0.004, cz: 0.002 },
            { y: P + 0.03, rx: neckR - 0.002, rf: neckR - 0.004, rb: neckR + 0.004, cz: 0.004 },
        ],
        seg: 18,
        rings: 8,
        skin: neckSkin,
        paint: cSkin,
        bumps: [
            { y: topY + 0.03, a: 0.9, sy: 0.03, sa: 0.5, amp: 0.004 },
            { y: topY + 0.03, a: -0.9, sy: 0.03, sa: 0.5, amp: 0.004 },
        ],
    });
    center.loft({
        sections: [
            { y: topY - 0.012, rx: neckR + 0.014, rf: neckR + 0.01, rb: neckR + 0.014, cz: -0.004 },
            { y: topY + 0.02, rx: neckR + 0.01, rf: neckR + 0.006, rb: neckR + 0.01, cz: -0.003 },
            { y: topY + 0.046, rx: neckR + 0.012, rf: neckR + 0.008, rb: neckR + 0.012, cz: -0.002 },
        ],
        seg: 24,
        rings: 5,
        skin: neckSkin,
        paint: cJacketDark,
        open: true,
    });

    const headRows = fem ? FEMALE_HEAD : MALE_HEAD;
    const hc = rowsToCurves(headRows, 0, 2.15);
    const faceBumps: Bump[] = [];
    const sym = (y: number, a: number, sy: number, sa: number, amp: number) => {
        faceBumps.push({ y, a, sy, sa, amp });
        if (a !== 0) faceBumps.push({ y, a: -a, sy, sa, amp });
    };
    const hs = fem ? 0.93 : 1;
    sym(0.097 * hs, 0, 0.02, 0.09, 0.007);
    sym(0.043 * hs, 0, 0.011, 0.1, fem ? 0.017 : 0.02);
    sym(0.033 * hs, 0, 0.007, 0.08, 0.006);
    sym(0.037 * hs, 0.17, 0.008, 0.07, 0.009);
    sym(0.109 * hs, 0.3, 0.008, 0.32, fem ? 0.003 : 0.007);
    sym(0.106 * hs, 0, 0.007, 0.12, 0.004);
    sym(0.093 * hs, 0.4, 0.011, 0.13, -0.006);
    sym(0.07 * hs, 0.78, 0.016, 0.2, fem ? 0.008 : 0.007);
    sym(0.02 * hs, 0, 0.005, 0.14, fem ? 0.006 : 0.005);
    sym(0.003 * hs, 0, 0.006, 0.14, fem ? 0.006 : 0.005);
    sym(0.012 * hs, 0, 0.0025, 0.16, -0.002);
    sym(-0.015 * hs, 0, 0.011, 0.2, 0.008);
    if (!fem) sym(0.0, 1.25, 0.02, 0.25, 0.005);
    const headPaint: PaintFn = (x, y, z) => {
        if (z > 0.03) {
            if (Math.abs(x) < 0.017 && y > 0.0 * hs && y < (fem ? 0.024 : 0.022) * hs) return cLips;
            if (Math.abs(x) > 0.01 && Math.abs(x) < 0.05 && y > 0.105 * hs && y < 0.113 * hs) return cBrow;
        }
        return cSkin;
    };
    const headXf = xfMove(0, P, 0);
    const headSections: Section[] = [];
    for (let i = 0; i < 34; i++) {
        const y = hc.y0 + ((hc.y1 - hc.y0) * i) / 33;
        headSections.push({ y, rx: hc.rx(y), rf: hc.rf(y), rb: hc.rb(y), cz: hc.cz(y), n: 2.15 });
    }
    const headMesh = new Mesher();
    headMesh.loft({ sections: headSections, seg: 48, rings: 34, bumps: faceBumps, skin: rigid(id.head), paint: headPaint, xf: headXf });
    center.merge(headMesh);

    const eyeY = 0.093 * hs;
    const surfaceZ = (y: number, x: number) => hc.cz(y) + hc.rf(y) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / hc.rx(y), 2.15)), 1 / 2.15);
    for (const s of [1, -1]) {
        const eye = new Mesher();
        const ex = 0.0315 * s;
        const ez = surfaceZ(eyeY, ex) - 0.006 - 0.0066;
        const er: [number, number, number] = [0.0125, 0.0096, 0.011];
        const paint: PaintFn = (x, y, z) => {
            const dx = (x - ex) / er[0];
            const dy = (y - eyeY) / er[1];
            const dz = (z - ez) / er[2];
            if (dz > 0.94 && dx * dx + dy * dy < 0.12) return [0.01, 0.01, 0.012];
            if (dz > 0.62 && dx * dx + dy * dy < 0.62) return cIris;
            return cSclera;
        };
        eye.ellipsoid(ex, eyeY, ez, er[0], er[1], er[2], 14, 10, rigid(id.head), paint, headXf);
        center.merge(eye);
        const ear = new Mesher();
        ear.ellipsoid(0, 0, 0, 0.007, 0.024 * hs, 0.015, 10, 8, rigid(id.head), cSkin, xfMul(xfMul(headXf, xfMove(0.0765 * s, 0.092 * hs, -0.004)), xfMul(xfRotY(0.35 * s), xfRotZ(0.08 * s))));
        center.merge(ear);
    }

    const hairLine = (a: number): number => {
        const t = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
        const pts: number[][] = fem
            ? [
                  [0, 0.14],
                  [0.5, 0.134],
                  [1.1, 0.112],
                  [1.57, 0.09],
                  [2.3, 0.045],
                  [3.14, 0.012],
              ]
            : [
                  [0, 0.148],
                  [0.38, 0.154],
                  [0.75, 0.138],
                  [1.1, 0.122],
                  [1.57, 0.112],
                  [2.3, 0.088],
                  [3.14, 0.05],
              ];
        for (let i = 0; i < pts.length - 1; i++) {
            if (t <= pts[i + 1][0]) {
                const k = (t - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
                return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
            }
        }
        return pts[pts.length - 1][1];
    };
    const hairPaint: PaintFn = (x, y, z) => tone(cHair, 0.86 + 0.24 * (0.5 + 0.5 * Math.sin(x * 170 + y * 110 + z * 130)));
    const hairMesh = new Mesher();
    hairMesh.loft({
        sections: headSections,
        seg: 64,
        rings: 16,
        offset: fem ? 0.0085 : 0.0055,
        bumps: fem
            ? [{ y: 0.18, a: 0, sy: 0.05, sa: 1.6, amp: 0.012 }]
            : [
                  { y: 0.18, a: 0, sy: 0.05, sa: 1.4, amp: 0.012 },
                  { y: 0.16, a: 0.3, sy: 0.03, sa: 0.3, amp: 0.006 },
              ],
        skin: rigid(id.head),
        paint: hairPaint,
        xf: headXf,
        lo: hairLine,
        open: true,
    });
    center.merge(hairMesh);
    if (fem) {
        const rootY = P + HAIR_ROOT[1];
        const tail = new Mesher();
        const tailSkin: SkinFn = (_x, y) => [id.hairA, id.hairB, smoothstep(-0.04, -0.15, y)];
        tail.loft({
            sections: [
                { y: -0.3, rx: 0.007, rf: 0.007, rb: 0.007 },
                { y: -0.24, rx: 0.014, rf: 0.012, rb: 0.012 },
                { y: -0.16, rx: 0.024, rf: 0.02, rb: 0.02 },
                { y: -0.07, rx: 0.033, rf: 0.027, rb: 0.027 },
                { y: -0.01, rx: 0.028, rf: 0.024, rb: 0.024 },
                { y: 0.02, rx: 0.02, rf: 0.018, rb: 0.018 },
            ],
            seg: 12,
            rings: 14,
            skin: tailSkin,
            paint: cHair,
            capLow: 0.02,
            xf: xfMul(xfMove(0, rootY, HAIR_ROOT[2]), xfRotX(HAIR_TILT)),
        });
        center.merge(tail);
    }

    const upperSkin: SkinFn = (_x, y) => [id.chest, id.upper, 0.55 + 0.45 * smoothstep(S + 0.05, S - 0.02, y)];
    const elbowBlend = chain([id.upper, id.lower], [E], 0.05);
    const armSkin: SkinFn = (x, y, z) => (y > E + 0.05 ? upperSkin(x, y, z) : elbowBlend(x, y, z));
    const k = fem ? 0.9 : 1;
    const sleeve: Section[] = [
        [0.028, 0.052, 0.053, 0.05],
        [0, 0.056, 0.057, 0.054],
        [-0.07, 0.054, 0.056, 0.052],
        [-0.14, 0.049, 0.051, 0.049],
        [-0.21, 0.044, 0.046, 0.045],
        [-0.27, 0.041, 0.042, 0.041],
        [-0.295, 0.041, 0.042, 0.041],
        [-0.335, 0.046, 0.047, 0.046],
        [-0.375, 0.047, 0.048, 0.047],
    ].map((r) => ({ y: S + r[0], rx: r[1] * k, rf: r[2] * k, rb: r[3] * k, cx: b.shoulderX }));
    left.loft({
        sections: sleeve,
        seg: 20,
        rings: 16,
        skin: armSkin,
        paint: ((_x, y) => (y < S - 0.345 ? cJacketDark : cJacket)) as PaintFn,
        capHigh: 0.03,
        bumps: [
            { y: S - 0.15, a: 0, sy: 0.06, sa: 0.55, amp: fem ? 0.002 : 0.004 },
            { y: S - 0.15, a: Math.PI, sy: 0.06, sa: 0.55, amp: fem ? 0.002 : 0.004 },
        ],
    });
    const handSkin: SkinFn = (x, y, z) => {
        if (y > W + 0.06) return armSkin(x, y, z);
        return [id.lower, id.wrist, smoothstep(W + 0.045, W - 0.01, y)];
    };
    const fore: Section[] = [
        [0, 0.032, 0.033, 0.031],
        [-0.04, 0.035, 0.036, 0.033],
        [-0.08, 0.037, 0.038, 0.035],
        [-0.115, 0.04, 0.04, 0.037],
        [-0.17, 0.033, 0.033, 0.03],
        [-0.23, 0.028, 0.026, 0.022],
        [-0.265, 0.026, 0.0215, 0.0185],
        [-0.295, 0.026, 0.0215, 0.0185],
    ].map((r) => ({ y: E + r[0], rx: r[1] * k, rf: r[2] * k, rb: r[3] * k, cx: b.shoulderX }));
    left.loft({
        sections: fore,
        seg: 18,
        rings: 14,
        skin: handSkin,
        paint: cSkin,
        bumps: [
            { y: E - 0.05, a: 0.7, sy: 0.05, sa: 0.5, amp: 0.003 },
            { y: E - 0.05, a: -0.7, sy: 0.05, sa: 0.5, amp: 0.002 },
        ],
    });

    const hx = bw.wristL[0];
    const hy = bw.wristL[1];
    const hxf = xfMul(xfMove(hx, hy, 0), xfScale(b.handScale, b.handScale, b.handScale));
    const palmSkin: SkinFn = (_x, y) => [id.lower, id.wrist, smoothstep(0.03, -0.005, y)];
    left.loft({
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
        paint: ((_x, y, _z, a) => (Math.abs(a - Math.PI) < 0.7 && y < -0.07 ? cKnuckle : cSkin)) as PaintFn,
        bumps: [
            { y: -0.035, a: 0.6, sy: 0.026, sa: 0.5, amp: 0.008 },
            { y: -0.055, a: -0.5, sy: 0.026, sa: 0.5, amp: 0.004 },
            { y: -0.088, a: Math.PI, sy: 0.008, sa: 1.2, amp: 0.002 },
        ],
        xf: hxf,
    });
    for (const f of FINGER_NAMES) left.merge(fingerMesh(f, b, hxf, cSkin, cNail));

    const legX = b.hipX;
    const legSkin: SkinFn = (_x, y) => {
        if (y > H - 0.1) return [id.pelvis, id.thigh, smoothstep(H + 0.05, H - 0.1, y)];
        if (y > K - 0.12) return [id.thigh, id.shin, smoothstep(K + 0.07, K - 0.07, y)];
        return [id.shin, id.foot, smoothstep(A + 0.12, A + 0.02, y)];
    };
    const sc = b.thigh / 0.425;
    const ss = b.shin / 0.415;
    const lk = fem ? 0.94 : 1;
    const legRows: number[][] = [
        [H + 0.02, 0.098, 0.1, 0.102],
        [H - 0.06 * sc, 0.095, 0.098, 0.1],
        [H - 0.15 * sc, 0.09, 0.092, 0.095],
        [H - 0.25 * sc, 0.082, 0.084, 0.086],
        [H - 0.33 * sc, 0.074, 0.076, 0.076],
        [H - 0.4 * sc, 0.066, 0.068, 0.067],
        [K, 0.06, 0.062, 0.06],
        [K - 0.04 * ss, 0.058, 0.06, 0.059],
        [K - 0.1 * ss, 0.056, 0.058, 0.062],
        [K - 0.17 * ss, 0.053, 0.055, 0.062],
        [K - 0.25 * ss, 0.047, 0.048, 0.054],
        [K - 0.32 * ss, 0.041, 0.042, 0.044],
        [A + 0.1, 0.04, 0.041, 0.042],
        [A + 0.03, 0.043, 0.044, 0.046],
    ];
    left.loft({
        sections: legRows.map((r) => ({ y: r[0], rx: r[1] * lk, rf: r[2] * lk, rb: r[3] * lk, cx: legX })),
        seg: 24,
        rings: 34,
        skin: legSkin,
        paint: cPants,
        bumps: [
            { y: K + 0.22, a: 0, sy: 0.1, sa: 0.7, amp: 0.006 },
            { y: K + 0.22, a: Math.PI, sy: 0.1, sa: 0.7, amp: 0.004 },
            { y: K - 0.1 * ss, a: Math.PI - 0.35, sy: 0.08, sa: 0.5, amp: 0.012 },
            { y: K - 0.1 * ss, a: Math.PI + 0.35, sy: 0.08, sa: 0.5, amp: 0.006 },
            { y: K, a: 0, sy: 0.03, sa: 0.5, amp: 0.004 },
        ],
    });

    const bootSkin: SkinFn = (_x, y) => [id.shin, id.foot, smoothstep(A + 0.115, A + 0.03, y)];
    left.loft({
        sections: [
            { y: A - 0.06, rx: 0.046 * k, rf: 0.047 * k, rb: 0.051 * k, cx: legX, cz: -0.004 },
            { y: A + 0.02, rx: 0.046 * k, rf: 0.047 * k, rb: 0.051 * k, cx: legX, cz: -0.004 },
            { y: A + 0.11, rx: 0.049 * k, rf: 0.05 * k, rb: 0.053 * k, cx: legX, cz: -0.004 },
            { y: A + 0.125, rx: 0.051 * k, rf: 0.052 * k, rb: 0.055 * k, cx: legX, cz: -0.004 },
        ],
        seg: 22,
        rings: 10,
        skin: bootSkin,
        paint: ((_x, y) => (y > A + 0.108 ? tone(cBoots, 1.5) : cBoots)) as PaintFn,
        open: true,
    });
    const footXf = xfMul(xfMove(legX, A - 0.085, 0), [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0]);
    const fk = k;
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
    left.loft({
        sections: rowsFoot.map((r) => ({ y: r[0] * fk, rx: r[1] * fk, rf: r[2] * fk, rb: r[3] * fk, cz: r[4] * fk })),
        seg: 22,
        rings: 16,
        skin: rigid(id.foot),
        paint: ((_x, _y, z) => (z < 0.026 * fk ? cSole : cBoots)) as PaintFn,
        xf: footXf,
        capLow: 0.01,
        capHigh: 0.01,
    });

    const mirrorMap = MIRROR;
    out.merge(center);
    out.merge(left);
    out.merge(left, mirrorMap, true);
    return out;
}

function fingerMesh(f: FingerName, b: Build, hxf: readonly number[], cSkin: Rgb, cNail: Rgb): Mesher {
    const d = FINGERS[f];
    const names = [bone(`${f}0L`), bone(`${f}1L`), bone(`${f}2L`)];
    const l0 = d.len[0];
    const l1 = d.len[1];
    const l2 = d.len[2];
    const r = d.r * (b.gender === 'female' ? 0.92 : 1);
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
    const at = d.at;
    const base = xfMul(hxf, xfMove(at[0], at[1], at[2]));
    m.loft({
        sections,
        seg: 8,
        rings: 14,
        skin: topSkin,
        paint: ((_x, y, _z, a) => (y < tip + 0.012 && Math.abs(a - Math.PI) < 0.9 ? cNail : cSkin)) as PaintFn,
        capLow: r * 0.7,
        xf: base,
    });
    return m;
}

const cache: Partial<Record<Gender, Mesher>> = {};

export function bodyMesher(gender: Gender): Mesher {
    let m = cache[gender];
    if (!m) {
        m = buildBody(gender);
        cache[gender] = m;
    }
    return m;
}