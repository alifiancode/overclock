import { BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from 'three';
import { drum, ellipsoid, fuse, limbGeometry, place, revolve, slab, tube } from './bodyGeo.ts';
import { BODY } from './humanoid.ts';

export const PALETTE = {
    skin: '#e2ab84',
    skinShade: '#c98f68',
    hair: '#2b1c13',
    jacket: '#3f70d8',
    jacketDark: '#2d4f9e',
    pants: '#28334c',
    boots: '#1c1c23',
    trim: '#1a1a22',
    gear: '#2a2d36',
    cyan: '#4be0f0',
    orange: '#ff9d4d',
    gold: '#ffd24a',
    ammo: '#6f7a52',
    flash: '#ffe066',
    flashCore: '#fff6d0',
} as const;

export type PlayerMaterials = {
    skin: MeshStandardMaterial;
    hair: MeshStandardMaterial;
    jacket: MeshStandardMaterial;
    jacketDark: MeshStandardMaterial;
    pants: MeshStandardMaterial;
    boots: MeshStandardMaterial;
    trim: MeshStandardMaterial;
    gear: MeshStandardMaterial;
    metal: MeshStandardMaterial;
    metalLight: MeshStandardMaterial;
    wood: MeshStandardMaterial;
    polymer: MeshStandardMaterial;
    brass: MeshStandardMaterial;
    gold: MeshStandardMaterial;
    ammo: MeshStandardMaterial;
    cyan: MeshStandardMaterial;
    orange: MeshStandardMaterial;
    flash: MeshStandardMaterial;
    flashCore: MeshStandardMaterial;
    hit: MeshStandardMaterial;
    lens: MeshBasicMaterial;
    accent: Record<string, MeshStandardMaterial>;
};

function solid(color: string, roughness = 0.85, metalness = 0): MeshStandardMaterial {
    return new MeshStandardMaterial({ color, roughness, metalness });
}

function glowing(color: string, intensity: number): MeshStandardMaterial {
    return new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, toneMapped: false });
}

let materials: PlayerMaterials | null = null;

export function playerMaterials(): PlayerMaterials {
    if (materials) return materials;
    materials = {
        skin: solid(PALETTE.skin, 0.7),
        hair: solid(PALETTE.hair, 0.9),
        jacket: solid(PALETTE.jacket, 0.8),
        jacketDark: solid(PALETTE.jacketDark, 0.85),
        pants: solid(PALETTE.pants, 0.9),
        boots: solid(PALETTE.boots, 0.8),
        trim: solid(PALETTE.trim, 0.85),
        gear: solid(PALETTE.gear, 0.8),
        metal: solid('#30333a', 0.4, 0.6),
        metalLight: solid('#555a64', 0.4, 0.6),
        wood: solid('#6d4a30', 0.8),
        polymer: solid('#1f2026', 0.7, 0.1),
        brass: solid('#c9a94a', 0.35, 0.8),
        gold: solid(PALETTE.gold, 0.3, 0.75),
        ammo: solid(PALETTE.ammo, 0.8),
        cyan: glowing(PALETTE.cyan, 2.2),
        orange: glowing(PALETTE.orange, 2.2),
        flash: glowing(PALETTE.flash, 2.4),
        flashCore: glowing(PALETTE.flashCore, 2.6),
        hit: new MeshStandardMaterial({ color: '#ff2b2b', emissive: '#ff2b2b', emissiveIntensity: 1.5, transparent: true, opacity: 0.5 }),
        lens: new MeshBasicMaterial({ color: '#ffe2b0', toneMapped: false }),
        accent: {},
    };
    return materials;
}

export function accentMaterial(color: string): MeshStandardMaterial {
    const m = playerMaterials();
    let found = m.accent[color];
    if (!found) {
        found = glowing(color, 2);
        m.accent[color] = found;
    }
    return found;
}

export type PlayerGeometry = {
    pelvis: BufferGeometry;
    belt: BufferGeometry;
    thigh: BufferGeometry;
    shin: BufferGeometry;
    boot: BufferGeometry;
    torso: BufferGeometry;
    torsoGear: BufferGeometry;
    torsoGlow: BufferGeometry;
    shoulderGlow: BufferGeometry;
    neck: BufferGeometry;
    head: BufferGeometry;
    hair: BufferGeometry;
    visor: BufferGeometry;
    upperArm: BufferGeometry;
    sleeveHem: BufferGeometry;
    foreArm: BufferGeometry;
    cuff: BufferGeometry;
    palm: [BufferGeometry, BufferGeometry];
    thumb: [BufferGeometry, BufferGeometry];
    index: [BufferGeometry, BufferGeometry, BufferGeometry];
    bank: [[BufferGeometry, BufferGeometry, BufferGeometry], [BufferGeometry, BufferGeometry, BufferGeometry]];
    lamp: BufferGeometry;
    lens: BufferGeometry;
    flame: BufferGeometry;
    coin: BufferGeometry;
    crate: BufferGeometry;
};

export const HAND = {
    scale: 1.15,
    thumbBase: [0.034, -0.03, 0.008] as const,
    indexBase: [0.03, -0.094, 0] as const,
    bankBase: [-0.009, -0.094, 0] as const,
    thumbLength: [0.04, 0.033] as const,
    indexLength: [0.04, 0.025, 0.021] as const,
    bankLength: [0.042, 0.027, 0.021] as const,
};

function finger(length: number, radiusTop: number, radiusBottom: number): BufferGeometry {
    return limbGeometry({
        length,
        radii: [
            [0, radiusTop],
            [1, radiusBottom],
        ],
        rings: 1,
        sides: 6,
        topCap: 0.6,
        bottomCap: 1,
    });
}

function bankSegment(side: number, index: 0 | 1 | 2): BufferGeometry {
    const base = HAND.bankLength[index];
    const scales = [1, 0.95, 0.8];
    const offsets = [0.02, -0.001, -0.02];
    const radius = [0.0088, 0.0078, 0.0068][index];
    const parts: BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
        const piece = finger(base * scales[i], radius * (i === 2 ? 0.88 : 1), radius * 0.86);
        parts.push(place(piece, side * offsets[i], 0, 0));
    }
    return fuse(parts);
}

function palmGeometry(side: number): BufferGeometry {
    return fuse([
        ellipsoid(0.04, 0.05, 0.0185, 12, 8).translate(0, -0.047, 0),
        ellipsoid(0.016, 0.024, 0.014, 8, 6).translate(side * 0.028, -0.034, 0.012),
        ellipsoid(0.034, 0.02, 0.016, 8, 6).translate(0, -0.088, -0.002),
    ]);
}

export function createGeometry(): PlayerGeometry {
    const pelvis = fuse([
        revolve(
            [
                [0, -0.118],
                [0.095, -0.112],
                [0.14, -0.07],
                [0.156, -0.01],
                [0.152, 0.05],
                [0.138, 0.1],
                [0.06, 0.112],
                [0, 0.114],
            ],
            20,
            1.1,
            0.78
        ),
    ]);
    const belt = fuse([
        drum(0.178, 0.05, 0.128, 20).translate(0, 0.085, 0),
        slab(0.05, 0.04, 0.02).translate(0, 0.085, 0.13),
        place(slab(0.05, 0.07, 0.05), 0.15, 0.04, 0.02, 0, 0, 0.12),
        place(slab(0.05, 0.07, 0.05), -0.15, 0.04, 0.02, 0, 0, -0.12),
        slab(0.06, 0.06, 0.04).translate(0, 0.07, -0.14),
    ]);
    const thigh = limbGeometry({
        length: BODY.thigh,
        radii: [
            [0, 0.083],
            [0.12, 0.09],
            [0.45, 0.076],
            [0.8, 0.061],
            [1, 0.056],
        ],
        rings: 8,
        sides: 12,
    });
    const shin = limbGeometry({
        length: BODY.shin,
        radii: [
            [0, 0.057],
            [0.18, 0.059],
            [0.55, 0.046],
            [1, 0.037],
        ],
        rings: 8,
        sides: 12,
    });
    const boot = fuse([
        tube(0.052, 0.047, 0.17, 12).translate(0, 0.045, -0.004),
        ellipsoid(0.048, 0.04, 0.12, 12, 8).translate(0, -0.045, 0.05),
        ellipsoid(0.046, 0.034, 0.05, 10, 6).translate(0, -0.052, 0.155),
        ellipsoid(0.044, 0.04, 0.045, 10, 6).translate(0, -0.05, -0.04),
        slab(0.092, 0.016, 0.27).translate(0, -0.077, 0.045),
    ]);
    const torso = fuse([
        revolve(
            [
                [0, -0.078],
                [0.14, -0.072],
                [0.138, -0.03],
                [0.13, 0],
                [0.134, 0.05],
                [0.142, 0.12],
                [0.157, 0.21],
                [0.166, 0.29],
                [0.16, 0.35],
                [0.138, 0.395],
                [0.095, 0.43],
                [0.064, 0.452],
                [0, 0.468],
            ],
            22,
            1.22,
            0.74
        ),
        ellipsoid(0.064, 0.06, 0.06, 10, 8).translate(BODY.shoulderX - 0.002, BODY.shoulderY - 0.01, -0.004),
        ellipsoid(0.064, 0.06, 0.06, 10, 8).translate(-BODY.shoulderX + 0.002, BODY.shoulderY - 0.01, -0.004),
        ellipsoid(0.088, 0.032, 0.072, 12, 6).translate(0, 0.438, 0),
    ]);
    const torsoGear = fuse([
        place(slab(0.27, 0.21, 0.05), 0, 0.2, 0.112, -0.05),
        slab(0.07, 0.07, 0.045).translate(-0.085, 0.14, 0.15),
        slab(0.07, 0.07, 0.045).translate(0.0, 0.14, 0.15),
        slab(0.07, 0.07, 0.045).translate(0.085, 0.14, 0.15),
        slab(0.31, 0.34, 0.13).translate(0, 0.205, -0.165),
        place(tube(0.06, 0.06, 0.29, 10), 0, 0.395, -0.165, 0, 0, Math.PI / 2),
    ]);
    const torsoGlow = fuse([ellipsoid(0.03, 0.03, 0.02, 8, 6).translate(0.07, 0.3, 0.14), tube(0.022, 0.022, 0.3, 8).translate(0.105, 0.2, -0.24)]);
    const shoulderGlow = fuse([
        slab(0.07, 0.012, 0.05).translate(BODY.shoulderX + 0.012, BODY.shoulderY + 0.05, -0.004),
        slab(0.07, 0.012, 0.05).translate(-BODY.shoulderX - 0.012, BODY.shoulderY + 0.05, -0.004),
    ]);
    const neck = limbGeometry({
        length: 0.08,
        radii: [
            [0, 0.047],
            [1, 0.041],
        ],
        rings: 2,
        sides: 10,
        topCap: 0.4,
        bottomCap: 0.4,
    });
    const head = fuse([
        ellipsoid(0.088, 0.106, 0.098, 18, 12).translate(0, 0.103, -0.004),
        ellipsoid(0.07, 0.062, 0.078, 14, 10).translate(0, 0.04, 0.016),
        ellipsoid(0.013, 0.021, 0.03, 8, 6).translate(0, 0.075, 0.095),
        ellipsoid(0.03, 0.022, 0.03, 8, 6).translate(0, 0.002, 0.07),
        ellipsoid(0.072, 0.014, 0.032, 10, 6).translate(0, 0.122, 0.07),
        ellipsoid(0.011, 0.027, 0.019, 8, 6).translate(0.087, 0.09, -0.01),
        ellipsoid(0.011, 0.027, 0.019, 8, 6).translate(-0.087, 0.09, -0.01),
    ]);
    const hairShell = new SphereGeometry(1, 22, 14, 0, Math.PI * 2, 0, 1.6);
    hairShell.scale(0.095, 0.115, 0.107);
    place(hairShell, 0, 0.105, -0.006, -0.42);
    const visorBand = new SphereGeometry(1, 20, 3, Math.PI / 2 - 0.95, 1.9, 1.55, 0.23);
    visorBand.scale(0.0935, 0.111, 0.104);
    visorBand.translate(0, 0.103, -0.004);
    const upperArm = limbGeometry({
        length: BODY.upperArm,
        radii: [
            [0, 0.052],
            [0.3, 0.055],
            [0.75, 0.044],
            [1, 0.04],
        ],
        rings: 8,
        sides: 12,
        bottomCap: 0,
    });
    const sleeveHem = tube(0.047, 0.047, 0.034, 12).translate(0, -BODY.upperArm + 0.012, 0);
    const foreArm = limbGeometry({
        length: BODY.foreArm,
        radii: [
            [0, 0.042],
            [0.2, 0.045],
            [0.7, 0.034],
            [1, 0.028],
        ],
        rings: 8,
        sides: 12,
        bottomCap: 0.4,
    });
    const cuff = tube(0.037, 0.034, 0.045, 12).translate(0, -BODY.foreArm + 0.035, 0);
    const lamp = fuse([
        tube(0.026, 0.03, 0.075, 10).translate(0, -0.045, -0.052),
        slab(0.07, 0.012, 0.03).translate(0, -0.015, -0.03),
    ]);
    const lens = new SphereGeometry(0.024, 10, 8);
    lens.translate(0, -0.088, -0.052);
    const flame = fuse([place(new SphereGeometry(0.1, 8, 6).scale(1, 1, 1.6), 0, 0, 0.1), place(new SphereGeometry(0.05, 8, 6), 0, 0, 0.02)]);
    const coin = place(tube(0.032, 0.032, 0.006, 14), 0, 0, 0, Math.PI / 2);
    const crate = fuse([slab(0.1, 0.05, 0.07), slab(0.104, 0.008, 0.074).translate(0, 0.028, 0)]);
    return {
        pelvis,
        belt,
        thigh,
        shin,
        boot,
        torso,
        torsoGear,
        torsoGlow,
        shoulderGlow,
        neck,
        head,
        hair: hairShell,
        visor: visorBand,
        upperArm,
        sleeveHem,
        foreArm,
        cuff,
        palm: [palmGeometry(1), palmGeometry(-1)],
        thumb: [finger(HAND.thumbLength[0], 0.0108, 0.0098), finger(HAND.thumbLength[1], 0.0092, 0.0074)],
        index: [finger(HAND.indexLength[0], 0.0092, 0.0084), finger(HAND.indexLength[1], 0.0083, 0.0077), finger(HAND.indexLength[2], 0.0076, 0.0058)],
        bank: [
            [bankSegment(1, 0), bankSegment(1, 1), bankSegment(1, 2)],
            [bankSegment(-1, 0), bankSegment(-1, 1), bankSegment(-1, 2)],
        ],
        lamp,
        lens,
        flame,
        coin,
        crate,
    };
}

let geometry: PlayerGeometry | null = null;

export function playerGeometry(): PlayerGeometry {
    if (!geometry) geometry = createGeometry();
    return geometry;
}

export function part(geometryValue: BufferGeometry, material: MeshStandardMaterial, castShadow = false): Mesh {
    const mesh = new Mesh(geometryValue, material);
    mesh.castShadow = castShadow;
    return mesh;
}

export type HandRig = {
    wrist: Group;
    thumb: [Group, Group];
    index: [Group, Group, Group];
    bank: [Group, Group, Group];
    side: number;
    current: number[];
};

export function buildHand(side: number): HandRig {
    const g = playerGeometry();
    const m = playerMaterials();
    const slot = side > 0 ? 0 : 1;
    const wrist = new Group();
    wrist.scale.setScalar(HAND.scale);
    wrist.add(part(g.palm[slot], m.skin));

    const thumbBase = new Group();
    thumbBase.position.set(side * HAND.thumbBase[0], HAND.thumbBase[1], HAND.thumbBase[2]);
    thumbBase.rotation.order = 'YXZ';
    thumbBase.add(part(g.thumb[0], m.skin));
    const thumbTip = new Group();
    thumbTip.position.set(0, -HAND.thumbLength[0], 0);
    thumbTip.add(part(g.thumb[1], m.skin));
    thumbBase.add(thumbTip);
    wrist.add(thumbBase);

    const indexBase = new Group();
    indexBase.position.set(side * HAND.indexBase[0], HAND.indexBase[1], HAND.indexBase[2]);
    indexBase.add(part(g.index[0], m.skin));
    const indexMid = new Group();
    indexMid.position.set(0, -HAND.indexLength[0], 0);
    indexMid.add(part(g.index[1], m.skin));
    const indexTip = new Group();
    indexTip.position.set(0, -HAND.indexLength[1], 0);
    indexTip.add(part(g.index[2], m.skin));
    indexMid.add(indexTip);
    indexBase.add(indexMid);
    wrist.add(indexBase);

    const bankBase = new Group();
    bankBase.position.set(side * HAND.bankBase[0], HAND.bankBase[1], HAND.bankBase[2]);
    bankBase.add(part(g.bank[slot][0], m.skin));
    const bankMid = new Group();
    bankMid.position.set(0, -HAND.bankLength[0], 0);
    bankMid.add(part(g.bank[slot][1], m.skin));
    const bankTip = new Group();
    bankTip.position.set(0, -HAND.bankLength[1], 0);
    bankTip.add(part(g.bank[slot][2], m.skin));
    bankMid.add(bankTip);
    bankBase.add(bankMid);
    wrist.add(bankBase);

    return {
        wrist,
        thumb: [thumbBase, thumbTip],
        index: [indexBase, indexMid, indexTip],
        bank: [bankBase, bankMid, bankTip],
        side,
        current: new Array<number>(12).fill(0),
    };
}

export function applyHand(hand: HandRig) {
    const c = hand.current;
    const s = hand.side;
    hand.thumb[0].rotation.set(-c[2], s * c[1], s * c[0]);
    hand.thumb[1].rotation.x = -c[3];
    hand.index[0].rotation.set(-c[4], 0, -s * c[10] * 0.16);
    hand.index[1].rotation.x = -c[5];
    hand.index[2].rotation.x = -c[6];
    hand.bank[0].rotation.set(-c[7], 0, s * c[10] * 0.1);
    hand.bank[1].rotation.x = -c[8];
    hand.bank[2].rotation.x = -c[9];
}