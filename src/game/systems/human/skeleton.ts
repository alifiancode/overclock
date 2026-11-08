export type Gender = 'male' | 'female';

export type Build = {
    gender: Gender;
    ankle: number;
    shin: number;
    thigh: number;
    hipX: number;
    waist: number;
    shoulderX: number;
    shoulderY: number;
    neckY: number;
    upperArm: number;
    foreArm: number;
    handScale: number;
};

export const BUILDS: Record<Gender, Build> = {
    male: { gender: 'male', ankle: 0.08, shin: 0.43, thigh: 0.435, hipX: 0.098, waist: 0.1, shoulderX: 0.195, shoulderY: 0.39, neckY: 0.555, upperArm: 0.318, foreArm: 0.268, handScale: 1.15 },
    female: { gender: 'female', ankle: 0.075, shin: 0.41, thigh: 0.42, hipX: 0.102, waist: 0.095, shoulderX: 0.166, shoulderY: 0.365, neckY: 0.505, upperArm: 0.298, foreArm: 0.25, handScale: 1.06 },
};

export const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
export type FingerName = (typeof FINGER_NAMES)[number];

export const FINGERS: Record<FingerName, { at: readonly [number, number, number]; len: readonly [number, number, number]; r: number }> = {
    thumb: { at: [0.028, -0.024, 0.008], len: [0.03, 0.03, 0.025], r: 0.0108 },
    index: { at: [0.03, -0.094, 0], len: [0.04, 0.025, 0.02], r: 0.0092 },
    middle: { at: [0.0105, -0.097, 0], len: [0.044, 0.028, 0.021], r: 0.0096 },
    ring: { at: [-0.0105, -0.094, 0], len: [0.041, 0.026, 0.02], r: 0.0088 },
    pinky: { at: [-0.03, -0.088, 0], len: [0.032, 0.02, 0.017], r: 0.0076 },
};

export const BONE_NAMES: string[] = ['pelvis', 'chest', 'head', 'hairA', 'hairB', 'hairC'];
for (const side of ['L', 'R']) {
    BONE_NAMES.push(`thigh${side}`, `shin${side}`, `foot${side}`, `upper${side}`, `lower${side}`, `wrist${side}`);
    for (const f of FINGER_NAMES) for (let k = 0; k < 3; k++) BONE_NAMES.push(`${f}${k}${side}`);
}

const lookup: Record<string, number> = {};
BONE_NAMES.forEach((n, i) => {
    lookup[n] = i;
});

export const BONE_COUNT = BONE_NAMES.length;

export function bone(name: string): number {
    return lookup[name];
}

export const MIRROR: number[] = BONE_NAMES.map((n) => {
    if (n.endsWith('L')) return lookup[`${n.slice(0, -1)}R`];
    if (n.endsWith('R')) return lookup[`${n.slice(0, -1)}L`];
    return lookup[n];
});

export type BoneDef = { name: string; parent: string; local: [number, number, number] };

export const HAIR_ROOT: readonly [number, number, number] = [0, 0.145, -0.086];
export const HAIR_TILT = 0.35;
export const HAIR_LINKS: readonly [number, number] = [0.12, 0.11];

export function boneDefs(b: Build): BoneDef[] {
    const defs: BoneDef[] = [];
    const H = b.ankle + b.shin + b.thigh;
    defs.push({ name: 'pelvis', parent: 'legs', local: [0, H, 0] });
    defs.push({ name: 'chest', parent: 'root', local: [0, H + b.waist, 0] });
    defs.push({ name: 'head', parent: 'chest', local: [0, b.neckY, 0] });
    defs.push({ name: 'hairA', parent: 'head', local: [HAIR_ROOT[0], HAIR_ROOT[1], HAIR_ROOT[2]] });
    defs.push({ name: 'hairB', parent: 'hairA', local: [0, -HAIR_LINKS[0] * Math.cos(HAIR_TILT), -HAIR_LINKS[0] * Math.sin(HAIR_TILT)] });
    defs.push({ name: 'hairC', parent: 'hairB', local: [0, -HAIR_LINKS[1] * Math.cos(HAIR_TILT), -HAIR_LINKS[1] * Math.sin(HAIR_TILT)] });
    for (const side of ['L', 'R']) {
        const s = side === 'L' ? 1 : -1;
        defs.push({ name: `thigh${side}`, parent: 'legs', local: [s * b.hipX, H, 0] });
        defs.push({ name: `shin${side}`, parent: `thigh${side}`, local: [0, -b.thigh, 0] });
        defs.push({ name: `foot${side}`, parent: `shin${side}`, local: [0, -b.shin, 0] });
        defs.push({ name: `upper${side}`, parent: 'chest', local: [s * b.shoulderX, b.shoulderY, 0] });
        defs.push({ name: `lower${side}`, parent: `upper${side}`, local: [0, -b.upperArm, 0] });
        defs.push({ name: `wrist${side}`, parent: `lower${side}`, local: [0, -b.foreArm, 0] });
        for (const f of FINGER_NAMES) {
            const d = FINGERS[f];
            defs.push({ name: `${f}0${side}`, parent: `wrist${side}`, local: [s * d.at[0], d.at[1], d.at[2]] });
            defs.push({ name: `${f}1${side}`, parent: `${f}0${side}`, local: [0, -d.len[0], 0] });
            defs.push({ name: `${f}2${side}`, parent: `${f}1${side}`, local: [0, -d.len[1], 0] });
        }
    }
    return defs;
}

export type BindMap = Record<string, [number, number, number]>;

export function bindWorld(b: Build): BindMap {
    const out: BindMap = { root: [0, 0, 0], legs: [0, 0, 0] };
    const acc: Record<string, number> = { root: 1, legs: 1 };
    for (const d of boneDefs(b)) {
        const p = out[d.parent];
        const k = acc[d.parent];
        out[d.name] = [p[0] + d.local[0] * k, p[1] + d.local[1] * k, p[2] + d.local[2] * k];
        acc[d.name] = d.name.startsWith('wrist') ? k * b.handScale : k;
    }
    return out;
}