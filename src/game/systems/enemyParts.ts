import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { ellipsoid, fuse, limbGeometry, mirrorX, place, revolve, slab } from './bodyGeo.ts';
import { BODY } from './humanoid.ts';

export const HAND_SCALE = 1.1;
export const WRIST_FLEX = 0.3;
export const HEAD_BASE = 0.02;

export type EnemyGeometry = {
    torso: BufferGeometry;
    pelvis: BufferGeometry;
    head: BufferGeometry;
    eyes: BufferGeometry;
    upperArm: BufferGeometry;
    foreArm: [BufferGeometry, BufferGeometry];
    thigh: BufferGeometry;
    shin: BufferGeometry;
    shoe: BufferGeometry;
    ribs: BufferGeometry;
    sac: BufferGeometry;
    flyerBody: BufferGeometry;
    flyerWing: [BufferGeometry, BufferGeometry];
    flyerEyes: BufferGeometry;
};

type Point = readonly [number, number, number];

function pipe(radiusTop: number, radiusBottom: number, length: number, sides: number): BufferGeometry {
    return new CylinderGeometry(radiusTop, radiusBottom, length, sides, 1, true);
}

const chainMatrix = new Matrix4();
const chainRotZ = new Matrix4();
const chainRotX = new Matrix4();
const chainStep = new Vector3();

type Segment = { length: number; top: number; bottom: number; curl: number };

function chain(base: Point, splay: number, segments: readonly Segment[], sides: number): BufferGeometry[] {
    const pieces: BufferGeometry[] = [];
    const joint = new Vector3(base[0], base[1], base[2]);
    let curl = 0;
    for (const segment of segments) {
        curl += segment.curl;
        chainRotX.makeRotationX(-curl);
        chainRotZ.makeRotationZ(splay);
        chainMatrix.copy(chainRotZ).multiply(chainRotX);
        const piece = pipe(segment.top, segment.bottom, segment.length, sides);
        piece.translate(0, -segment.length / 2, 0);
        piece.applyMatrix4(chainMatrix);
        piece.translate(joint.x, joint.y, joint.z);
        pieces.push(piece);
        chainStep.set(0, -segment.length, 0).applyMatrix4(chainMatrix);
        joint.add(chainStep);
    }
    return pieces;
}

function clawHand(): BufferGeometry {
    const parts: BufferGeometry[] = [ellipsoid(0.04, 0.052, 0.019, 8, 4).translate(0, -0.05, 0)];
    const lengths = [1, 1.08, 1, 0.82];
    const offsets = [0.028, 0.0095, -0.0095, -0.028];
    const curls = [0.5, 0.58, 0.64, 0.74];
    const splays = [0.12, 0.04, -0.04, -0.12];
    for (let i = 0; i < 4; i++) {
        const l = lengths[i];
        parts.push(
            ...chain(
                [offsets[i], -0.1, 0.004],
                splays[i],
                [
                    { length: 0.042 * l, top: 0.0095, bottom: 0.0085, curl: curls[i] },
                    { length: 0.036 * l, top: 0.0085, bottom: 0.0025, curl: 0.95 },
                ],
                4
            )
        );
    }
    parts.push(
        ...chain(
            [0.032, -0.035, 0.012],
            0.62,
            [
                { length: 0.04, top: 0.0115, bottom: 0.01, curl: 0.35 },
                { length: 0.032, top: 0.01, bottom: 0.0035, curl: 0.55 },
            ],
            4
        )
    );
    return fuse(parts);
}

function foreArmWithHand(side: number): BufferGeometry {
    const arm = limbGeometry({
        length: BODY.foreArm,
        radii: [
            [0, 0.04],
            [0.25, 0.043],
            [0.7, 0.032],
            [1, 0.026],
        ],
        rings: 3,
        sides: 7,
        topCap: 0,
        bottomCap: 0,
        capSteps: 1,
    });
    const hand = clawHand();
    hand.scale(HAND_SCALE, HAND_SCALE, HAND_SCALE);
    hand.rotateX(-WRIST_FLEX);
    hand.translate(0, -BODY.foreArm, 0);
    const merged = fuse([arm, hand]);
    if (side > 0) return merged;
    const mirrored = mirrorX(merged);
    merged.dispose();
    return mirrored;
}

const barAxis = new Vector3(0, 1, 0);
const barQuat = new Quaternion();

function bar(from: Point, to: Point, top: number, bottom: number): BufferGeometry {
    const direction = new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const length = direction.length();
    const piece = pipe(top, bottom, length, 4);
    barQuat.setFromUnitVectors(barAxis, direction.normalize());
    piece.applyQuaternion(barQuat);
    piece.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
    return piece;
}

function membrane(points: readonly Point[], triangles: readonly Point[]): BufferGeometry {
    const count = points.length;
    const positions: number[] = [];
    for (const p of points) positions.push(p[0], p[1], p[2]);
    for (const p of points) positions.push(p[0], p[1] - 0.004, p[2]);
    const indices: number[] = [];
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    for (const t of triangles) {
        a.set(...points[t[0]]);
        b.set(...points[t[1]]);
        c.set(...points[t[2]]);
        const up = b.clone().sub(a).cross(c.clone().sub(a)).y >= 0;
        const i0 = t[0];
        const i1 = up ? t[1] : t[2];
        const i2 = up ? t[2] : t[1];
        indices.push(i0, i1, i2);
        indices.push(count + i0, count + i2, count + i1);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(new Array<number>(count * 4).fill(0), 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

function wingGeometry(): BufferGeometry {
    const shoulder: Point = [0, 0, 0];
    const elbow: Point = [0.42, 0.02, -0.1];
    const wrist: Point = [0.88, 0.06, 0.14];
    const tipA: Point = [1.38, -0.04, 0.26];
    const tipB: Point = [1.28, -0.06, -0.2];
    const tipC: Point = [0.95, -0.06, -0.55];
    const flank: Point = [0, -0.04, -0.4];
    return fuse([
        bar(shoulder, elbow, 0.032, 0.026),
        bar(elbow, wrist, 0.026, 0.02),
        bar(wrist, tipA, 0.014, 0.004),
        bar(wrist, tipB, 0.014, 0.004),
        bar(wrist, tipC, 0.014, 0.004),
        membrane(
            [wrist, tipA, tipB, tipC, flank, shoulder, elbow],
            [
                [0, 1, 2],
                [0, 2, 3],
                [0, 3, 4],
                [0, 4, 5],
                [0, 5, 6],
            ]
        ),
    ]);
}

function ribCage(): BufferGeometry {
    const heights = [0.11, 0.165, 0.22, 0.275];
    const radii = [0.1295, 0.1385, 0.1482, 0.155];
    const rings: BufferGeometry[] = [];
    for (let i = 0; i < heights.length; i++) {
        const ring = new TorusGeometry(radii[i] + 0.008, 0.009, 3, 10, Math.PI * 1.05);
        ring.rotateX(Math.PI / 2);
        ring.scale(1.18, 1, 0.72);
        ring.translate(0, heights[i], 0);
        rings.push(ring);
    }
    rings.push(slab(0.016, 0.2, 0.012).translate(0, 0.19, 0.115));
    return fuse(rings);
}

export function createEnemyGeometry(): EnemyGeometry {
    const torso = revolve(
        [
            [0, -0.09],
            [0.12, -0.085],
            [0.126, -0.04],
            [0.12, 0],
            [0.122, 0.06],
            [0.134, 0.14],
            [0.15, 0.23],
            [0.158, 0.3],
            [0.15, 0.36],
            [0.12, 0.41],
            [0.075, 0.44],
            [0, 0.455],
        ],
        12,
        1.18,
        0.72
    );
    const pelvis = revolve(
        [
            [0, -0.115],
            [0.09, -0.108],
            [0.135, -0.07],
            [0.15, -0.01],
            [0.148, 0.05],
            [0.13, 0.1],
            [0, 0.112],
        ],
        10,
        1.1,
        0.78
    );
    const head = fuse([
        pipe(0.04, 0.047, 0.115, 7).translate(0, 0.0175, 0),
        ellipsoid(0.086, 0.1, 0.095, 9, 6).translate(0, 0.17, -0.005),
        ellipsoid(0.062, 0.062, 0.074, 7, 4).translate(0, 0.1, 0.016),
        ellipsoid(0.074, 0.016, 0.03, 8, 3).translate(0, 0.205, 0.066),
        ellipsoid(0.013, 0.022, 0.028, 6, 4).translate(0, 0.14, 0.088),
        ellipsoid(0.01, 0.026, 0.018, 5, 3).translate(0.086, 0.16, -0.01),
        ellipsoid(0.01, 0.026, 0.018, 5, 3).translate(-0.086, 0.16, -0.01),
    ]);
    const eyes = fuse([ellipsoid(0.016, 0.012, 0.012, 5, 4).translate(0.035, 0.178, 0.083), ellipsoid(0.016, 0.012, 0.012, 5, 4).translate(-0.035, 0.178, 0.083)]);
    const upperArm = limbGeometry({
        length: BODY.upperArm,
        radii: [
            [0, 0.05],
            [0.3, 0.053],
            [0.75, 0.043],
            [1, 0.039],
        ],
        rings: 3,
        sides: 7,
        topCap: 1,
        bottomCap: 0,
        capSteps: 2,
    });
    const thigh = limbGeometry({
        length: BODY.thigh,
        radii: [
            [0, 0.08],
            [0.12, 0.087],
            [0.45, 0.073],
            [0.8, 0.059],
            [1, 0.055],
        ],
        rings: 4,
        sides: 7,
        topCap: 0.3,
        bottomCap: 0.3,
        capSteps: 2,
    });
    const shin = limbGeometry({
        length: BODY.shin,
        radii: [
            [0, 0.055],
            [0.18, 0.057],
            [0.55, 0.045],
            [1, 0.036],
        ],
        rings: 3,
        sides: 7,
        topCap: 0.3,
        bottomCap: 0.3,
        capSteps: 1,
    });
    const shoe = fuse([
        pipe(0.05, 0.046, 0.12, 7).translate(0, 0.04, -0.004),
        ellipsoid(0.047, 0.04, 0.14, 8, 5).translate(0, -0.045, 0.06),
        slab(0.09, 0.016, 0.26).translate(0, -0.077, 0.045),
    ]);
    const flyerBody = fuse([
        ellipsoid(0.15, 0.14, 0.3, 10, 7).translate(0, 0, -0.02),
        ellipsoid(0.17, 0.15, 0.17, 8, 6).translate(0, 0.01, 0.12),
        ellipsoid(0.092, 0.088, 0.1, 9, 6).translate(0, 0.07, 0.34),
        ellipsoid(0.042, 0.034, 0.075, 6, 4).translate(0, 0.045, 0.43),
        place(pipe(0, 0.034, 0.12, 5), 0.062, 0.165, 0.32, 0, 0, -0.35),
        place(pipe(0, 0.034, 0.12, 5), -0.062, 0.165, 0.32, 0, 0, 0.35),
        place(pipe(0.012, 0.05, 0.5, 6), 0, 0, -0.52, -Math.PI / 2),
        place(pipe(0.022, 0, 0.3, 5), 0.07, -0.24, -0.05),
        place(pipe(0.022, 0, 0.3, 5), -0.07, -0.24, -0.05),
    ]);
    const flyerEyes = fuse([ellipsoid(0.014, 0.012, 0.012, 5, 4).translate(0.04, 0.092, 0.405), ellipsoid(0.014, 0.012, 0.012, 5, 4).translate(-0.04, 0.092, 0.405)]);
    const wingLeft = wingGeometry();
    const wingRight = mirrorX(wingLeft);
    return {
        torso,
        pelvis,
        head,
        eyes,
        upperArm,
        foreArm: [foreArmWithHand(1), foreArmWithHand(-1)],
        thigh,
        shin,
        shoe,
        ribs: ribCage(),
        sac: new SphereGeometry(0.3, 8, 6),
        flyerBody,
        flyerWing: [wingLeft, wingRight],
        flyerEyes,
    };
}

let cached: EnemyGeometry | null = null;

export function enemyGeometry(): EnemyGeometry {
    if (!cached) cached = createEnemyGeometry();
    return cached;
}