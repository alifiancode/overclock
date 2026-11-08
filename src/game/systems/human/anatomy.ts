import { curve, smoothstep, wrapPi, type Bump, type Section, type SkinFn } from './mesher.ts';
import { BUILDS, bindWorld, bone, type BindMap, type Build, type Gender } from './skeleton.ts';
import { lookFor, type Look } from './look.ts';

export type Row = readonly [number, number, number, number, number];

export const MALE_TORSO: Row[] = [
    [-0.11, 0.122, 0.074, 0.092, -0.004],
    [-0.07, 0.152, 0.092, 0.108, -0.004],
    [0, 0.176, 0.108, 0.116, -0.006],
    [0.06, 0.168, 0.102, 0.108, -0.004],
    [0.12, 0.15, 0.098, 0.098, 0],
    [0.19, 0.158, 0.104, 0.1, 0.004],
    [0.27, 0.178, 0.117, 0.104, 0.007],
    [0.35, 0.192, 0.128, 0.106, 0.008],
    [0.41, 0.19, 0.122, 0.102, 0.004],
    [0.465, 0.178, 0.108, 0.094, 0],
    [0.515, 0.15, 0.09, 0.082, -0.003],
    [0.553, 0.104, 0.068, 0.07, -0.004],
    [0.585, 0.068, 0.057, 0.064, -0.005],
];

export const FEMALE_TORSO: Row[] = [
    [-0.11, 0.13, 0.078, 0.1, -0.004],
    [-0.07, 0.172, 0.095, 0.122, -0.006],
    [0, 0.19, 0.112, 0.13, -0.01],
    [0.06, 0.172, 0.104, 0.116, -0.006],
    [0.12, 0.138, 0.094, 0.094, 0],
    [0.175, 0.118, 0.086, 0.082, 0.002],
    [0.24, 0.128, 0.092, 0.086, 0.004],
    [0.3, 0.146, 0.1, 0.09, 0.008],
    [0.36, 0.15, 0.098, 0.088, 0.006],
    [0.41, 0.14, 0.086, 0.08, 0.002],
    [0.46, 0.122, 0.074, 0.072, -0.002],
    [0.505, 0.088, 0.06, 0.062, -0.004],
    [0.535, 0.058, 0.05, 0.056, -0.005],
];

export type Ids = {
    pelvis: number;
    chest: number;
    head: number;
    hairA: number;
    hairB: number;
    hairC: number;
    thigh: number;
    shin: number;
    foot: number;
    upper: number;
    lower: number;
    wrist: number;
};

export type Ctx = {
    gender: Gender;
    fem: boolean;
    b: Build;
    bw: BindMap;
    look: Look;
    H: number;
    C: number;
    S: number;
    E: number;
    W: number;
    K: number;
    A: number;
    P: number;
    topY: number;
    rows: Row[];
    id: Ids;
};

export function makeCtx(gender: Gender): Ctx {
    const b = BUILDS[gender];
    const fem = gender === 'female';
    const H = b.ankle + b.shin + b.thigh;
    const C = H + b.waist;
    const S = C + b.shoulderY;
    const rows = fem ? FEMALE_TORSO : MALE_TORSO;
    return {
        gender,
        fem,
        b,
        bw: bindWorld(b),
        look: lookFor(gender),
        H,
        C,
        S,
        E: S - b.upperArm,
        W: S - b.upperArm - b.foreArm,
        K: H - b.thigh,
        A: b.ankle,
        P: C + b.neckY,
        topY: H + rows[rows.length - 1][0],
        rows,
        id: {
            pelvis: bone('pelvis'),
            chest: bone('chest'),
            head: bone('head'),
            hairA: bone('hairA'),
            hairB: bone('hairB'),
            hairC: bone('hairC'),
            thigh: bone('thighL'),
            shin: bone('shinL'),
            foot: bone('footL'),
            upper: bone('upperL'),
            lower: bone('lowerL'),
            wrist: bone('wristL'),
        },
    };
}

export function rowCurves(rows: readonly Row[], y0: number, n = 2.3) {
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

export function sample(rows: readonly Row[], y0: number, from: number, to: number, count: number, n = 2.3): Section[] {
    const c = rowCurves(rows, y0, n);
    const out: Section[] = [];
    for (let i = 0; i < count; i++) {
        const y = from + ((to - from) * i) / (count - 1);
        out.push({ y, rx: c.rx(y), rf: c.rf(y), rb: c.rb(y), cz: c.cz(y), n });
    }
    return out;
}

export function rigid(id: number): SkinFn {
    return () => [id, id, 0];
}

export function chain(bones: number[], joints: number[], half: number): SkinFn {
    return (_x, y) => {
        for (let i = 0; i < joints.length; i++) {
            if (y > joints[i] + half) return [bones[i], bones[i], 0];
            if (y > joints[i] - half) return [bones[i], bones[i + 1], smoothstep(joints[i] + half, joints[i] - half, y)];
        }
        const last = bones[bones.length - 1];
        return [last, last, 0];
    };
}

export function profile(points: readonly (readonly [number, number])[]): (a: number) => number {
    return (a) => {
        const t = Math.abs(wrapPi(a));
        for (let i = 0; i < points.length - 1; i++) {
            if (t <= points[i + 1][0]) {
                const k = (t - points[i][0]) / (points[i + 1][0] - points[i][0]);
                return points[i][1] + (points[i + 1][1] - points[i][1]) * k;
            }
        }
        return points[points.length - 1][1];
    };
}

export function pair(list: Bump[], y: number, a: number, sy: number, sa: number, amp: number) {
    list.push({ y, a, sy, sa, amp });
    if (a !== 0 && Math.abs(Math.abs(a) - Math.PI) > 1e-6) list.push({ y, a: -a, sy, sa, amp });
}

export function scaleBumps(list: Bump[], k: number): Bump[] {
    return list.map((b) => ({ ...b, amp: b.amp * k }));
}

export function extent(lo: (a: number) => number, hi: (a: number) => number): [number, number] {
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        mn = Math.min(mn, lo(a));
        mx = Math.max(mx, hi(a));
    }
    return [mn, mx];
}

export function torsoBumps(ctx: Ctx): Bump[] {
    const H = ctx.H;
    const m: Bump[] = [];
    if (ctx.fem) {
        pair(m, H + 0.315, 0.54, 0.05, 0.4, 0.064);
        pair(m, H + 0.347, 0.52, 0.04, 0.38, 0.026);
        pair(m, H + 0.253, 0.5, 0.018, 0.5, -0.01);
        m.push({ y: H + 0.33, a: 0, sy: 0.05, sa: 0.12, amp: -0.01 });
        pair(m, H - 0.015, Math.PI - 0.52, 0.075, 0.5, 0.034);
        pair(m, H - 0.075, Math.PI - 0.5, 0.04, 0.5, 0.02);
        pair(m, H, Math.PI / 2, 0.07, 0.55, 0.008);
        m.push({ y: H + 0.09, a: 0, sy: 0.06, sa: 0.5, amp: 0.006 });
        m.push({ y: H + 0.14, a: 0, sy: 0.01, sa: 0.07, amp: -0.004 });
        pair(m, H + 0.4, Math.PI - 0.5, 0.05, 0.5, 0.004);
        pair(m, H + 0.42, 0.75, 0.012, 0.3, 0.003);
        m.push({ y: H + 0.3, a: Math.PI, sy: 0.15, sa: 0.09, amp: -0.004 });
        return m;
    }
    pair(m, H + 0.35, 0.58, 0.048, 0.4, 0.016);
    pair(m, H + 0.295, 0.6, 0.012, 0.45, -0.004);
    pair(m, H + 0.25, 1.25, 0.06, 0.3, 0.004);
    pair(m, H + 0.31, Math.PI / 2 + 0.45, 0.09, 0.45, 0.012);
    pair(m, H + 0.49, Math.PI - 0.55, 0.05, 0.55, 0.012);
    pair(m, H + 0.52, 1.0, 0.03, 0.4, 0.008);
    for (const dy of [0.14, 0.195, 0.25]) pair(m, H + dy, 0.17, 0.021, 0.15, 0.0045);
    m.push({ y: H + 0.3, a: Math.PI, sy: 0.15, sa: 0.09, amp: -0.004 });
    pair(m, H - 0.03, Math.PI - 0.45, 0.07, 0.5, 0.016);
    return m;
}

export const MAT = { skin: 0, cloth: 1, leather: 2, hair: 3, eye: 4, metal: 5 } as const;

export function route(points: readonly (readonly [number, number])[]): (t: number) => [number, number] {
    const ts = points.map((_, i) => i / (points.length - 1));
    const cy = curve(ts, points.map((p) => p[0]));
    const ca = curve(ts, points.map((p) => p[1]));
    return (t) => [cy(t), ca(t)];
}

export function mirrorRoute(points: readonly (readonly [number, number])[]): [number, number][] {
    return points.map((p) => [p[0], -p[1]]);
}