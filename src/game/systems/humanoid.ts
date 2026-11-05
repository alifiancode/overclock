import { Matrix4, Quaternion, Vector3 } from 'three';

export const BODY = {
    ankle: 0.085,
    shin: 0.415,
    thigh: 0.425,
    hipX: 0.098,
    waist: 0.1,
    shoulderX: 0.188,
    shoulderY: 0.385,
    neckY: 0.455,
    upperArm: 0.295,
    foreArm: 0.265,
} as const;

export const LEG_LENGTH = BODY.shin + BODY.thigh;
export const STAND_HIP = BODY.ankle + LEG_LENGTH;

export function clamp(value: number, low: number, high: number): number {
    return value < low ? low : value > high ? high : value;
}

export function smooth(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function wrapAngle(angle: number): number {
    const turns = Math.round(angle / (Math.PI * 2));
    return angle - turns * Math.PI * 2;
}

export function damp(current: number, target: number, rate: number, dt: number): number {
    return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export function dampAngle(current: number, target: number, rate: number, dt: number): number {
    return current + wrapAngle(target - current) * (1 - Math.exp(-rate * dt));
}

const ikAxis = new Vector3();
const ikSide = new Vector3();

export function solveTwoBone(root: Vector3, target: Vector3, upper: number, lower: number, pole: Vector3, mid: Vector3, end: Vector3): number {
    ikAxis.subVectors(target, root);
    const raw = ikAxis.length();
    const reachMax = (upper + lower) * 0.9995;
    const reachMin = Math.abs(upper - lower) * 1.02 + 0.001;
    const d = clamp(raw, reachMin, reachMax);
    if (raw > 1e-6) ikAxis.multiplyScalar(1 / raw);
    else ikAxis.set(0, -1, 0);
    ikSide.copy(pole).addScaledVector(ikAxis, -pole.dot(ikAxis));
    if (ikSide.lengthSq() < 1e-8) {
        ikSide.set(0, 0, 1).addScaledVector(ikAxis, -ikAxis.z);
        if (ikSide.lengthSq() < 1e-8) ikSide.set(1, 0, 0);
    }
    ikSide.normalize();
    const along = (upper * upper - lower * lower + d * d) / (2 * d);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    mid.copy(root).addScaledVector(ikAxis, along).addScaledVector(ikSide, height);
    end.copy(root).addScaledVector(ikAxis, d);
    return raw - d;
}

const basisX = new Vector3();
const basisY = new Vector3();
const basisZ = new Vector3();
const basisM = new Matrix4();

export function boneQuat(out: Quaternion, from: Vector3, to: Vector3, front: Vector3): Quaternion {
    basisY.subVectors(from, to).normalize();
    basisZ.copy(front).addScaledVector(basisY, -front.dot(basisY));
    if (basisZ.lengthSq() < 1e-8) basisZ.set(0, 0, 1).addScaledVector(basisY, -basisY.z);
    basisZ.normalize();
    basisX.crossVectors(basisY, basisZ);
    basisM.makeBasis(basisX, basisY, basisZ);
    return out.setFromRotationMatrix(basisM);
}

export function handQuat(out: Quaternion, fingers: Vector3, palm: Vector3): Quaternion {
    basisY.copy(fingers).multiplyScalar(-1).normalize();
    basisZ.copy(palm).addScaledVector(basisY, -palm.dot(basisY));
    if (basisZ.lengthSq() < 1e-8) basisZ.set(0, 0, 1).addScaledVector(basisY, -basisY.z);
    basisZ.normalize();
    basisX.crossVectors(basisY, basisZ);
    basisM.makeBasis(basisX, basisY, basisZ);
    return out.setFromRotationMatrix(basisM);
}

export type Gait = {
    step: number;
    cycleRate: number;
    duty: number;
    contact: number;
    ahead: number;
    lift: number;
    crouch: number;
    bob: number;
    run: number;
};

export function createGait(): Gait {
    return { step: 0.6, cycleRate: 1, duty: 0.6, contact: 0.5, ahead: 0.2, lift: 0.1, crouch: 0.02, bob: 0.02, run: 0 };
}

export function gaitFor(speed: number, wade: number, out: Gait, stride = 1): Gait {
    const v = Math.max(0.05, speed);
    out.step = (0.43 + 0.177 * v) * stride;
    out.cycleRate = v / (2 * out.step);
    const base = clamp(0.64 - 0.055 * v, 0.2, 0.64);
    out.run = smooth(1.8, 3.4, v);
    out.contact = Math.min(2 * out.step * base, 0.74);
    out.duty = out.contact / (2 * out.step);
    out.ahead = out.contact * 0.42;
    const waterLift = 1 + 0.8 * wade;
    out.lift = lerp(0.06 + 0.02 * v, 0.14 + 0.037 * v, out.run) * waterLift;
    out.crouch = lerp(0.02, 0.095, out.run) + 0.03 * wade;
    out.bob = lerp(0.022, 0.03, out.run);
    return out;
}

export type FootPose = { z: number; y: number; pitch: number; stance: boolean };

export function createFoot(): FootPose {
    return { z: 0, y: BODY.ankle, pitch: 0, stance: true };
}

export function footPath(phase: number, gait: Gait, out: FootPose): FootPose {
    const toeDrop = 0.15;
    const toeOff = 0.75;
    const landing = 0.24 * (1 - gait.run);
    if (phase < gait.duty) {
        const s = phase / gait.duty;
        const toe = smooth(0.55, 1, s);
        const heel = 1 - smooth(0, 0.22, s);
        out.stance = true;
        out.z = gait.ahead - gait.contact * s;
        out.pitch = -toeOff * toe + landing * heel;
        out.y = BODY.ankle + toeDrop * Math.sin(Math.max(0, -out.pitch));
        return out;
    }
    const u = (phase - gait.duty) / (1 - gait.duty);
    const zStart = gait.ahead - gait.contact;
    const slope = (-gait.contact * (1 - gait.duty)) / gait.duty;
    const m = slope * 0.55;
    const u2 = u * u;
    const u3 = u2 * u;
    out.stance = false;
    out.z = (2 * u3 - 3 * u2 + 1) * zStart + (u3 - 2 * u2 + u) * m + (-2 * u3 + 3 * u2) * gait.ahead + (u3 - u2) * m;
    const toeLeft = toeDrop * Math.sin(toeOff) * (1 - smooth(0, 0.4, u));
    out.y = BODY.ankle + toeLeft + gait.lift * Math.sin(Math.PI * Math.pow(u, 0.8));
    out.pitch = -toeOff * (1 - smooth(0, 0.35, u)) + landing * smooth(0.6, 1, u);
    return out;
}

export type HandPose = {
    thumbSplay: number;
    thumbTwist: number;
    thumb: readonly [number, number];
    index: readonly [number, number, number];
    bank: readonly [number, number, number];
    spread: number;
};

export const HAND_POSE_SIZE = 12;

export function packPose(pose: HandPose, out: number[]): number[] {
    out[0] = pose.thumbSplay;
    out[1] = pose.thumbTwist;
    out[2] = pose.thumb[0];
    out[3] = pose.thumb[1];
    out[4] = pose.index[0];
    out[5] = pose.index[1];
    out[6] = pose.index[2];
    out[7] = pose.bank[0];
    out[8] = pose.bank[1];
    out[9] = pose.bank[2];
    out[10] = pose.spread;
    out[11] = 0;
    return out;
}

export const POSES = {
    relaxed: { thumbSplay: 0.5, thumbTwist: 0.1, thumb: [0.25, 0.2], index: [0.25, 0.3, 0.2], bank: [0.4, 0.5, 0.3], spread: 0.25 },
    open: { thumbSplay: 0.7, thumbTwist: 0, thumb: [0.05, 0.05], index: [0.05, 0.05, 0.05], bank: [0.08, 0.08, 0.05], spread: 0.6 },
    fist: { thumbSplay: 0.2, thumbTwist: 0.7, thumb: [0.7, 0.7], index: [1.35, 1.6, 1.0], bank: [1.4, 1.65, 1.0], spread: 0 },
    pistolGrip: { thumbSplay: 0.15, thumbTwist: 0.55, thumb: [0.35, 0.15], index: [0.55, 0.35, 0.2], bank: [1.25, 1.55, 1.0], spread: 0.05 },
    triggerGrip: { thumbSplay: 0.15, thumbTwist: 0.55, thumb: [0.35, 0.15], index: [0.7, 0.5, 0.3], bank: [1.25, 1.55, 1.0], spread: 0.05 },
    supportGrip: { thumbSplay: 0.2, thumbTwist: 0.6, thumb: [0.3, 0.2], index: [1.2, 1.45, 0.9], bank: [1.25, 1.5, 1.0], spread: 0.04 },
    cupGrip: { thumbSplay: 0.5, thumbTwist: 0.2, thumb: [0.25, 0.1], index: [0.8, 0.9, 0.5], bank: [0.9, 1.0, 0.6], spread: 0.1 },
    barrelGrip: { thumbSplay: 0.35, thumbTwist: 0.35, thumb: [0.35, 0.2], index: [0.85, 1.0, 0.6], bank: [0.95, 1.1, 0.7], spread: 0.1 },
    pinch: { thumbSplay: 0.35, thumbTwist: 0.65, thumb: [0.5, 0.3], index: [0.7, 0.8, 0.5], bank: [0.6, 0.7, 0.45], spread: 0.15 },
    grab: { thumbSplay: 0.4, thumbTwist: 0.55, thumb: [0.55, 0.35], index: [1.0, 1.1, 0.7], bank: [1.05, 1.2, 0.8], spread: 0.1 },
    flat: { thumbSplay: 0.15, thumbTwist: 0.1, thumb: [0.1, 0.1], index: [0.08, 0.06, 0.04], bank: [0.1, 0.08, 0.05], spread: 0.05 },
} as const satisfies Record<string, HandPose>;

export type PoseName = keyof typeof POSES;