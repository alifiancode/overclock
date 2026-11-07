import { Bone, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Skeleton, SkinnedMesh, SphereGeometry, type BufferGeometry } from 'three';
import { ellipsoid, fuse, place, slab, tube } from './bodyGeo.ts';
import { bodyMesher } from './human/body.ts';
import { BONE_NAMES, BUILDS, boneDefs, type Build, type Gender } from './human/skeleton.ts';

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
    body: MeshStandardMaterial;
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
        body: new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }),
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
    body: BufferGeometry;
    gear: BufferGeometry;
    glow: BufferGeometry;
    shoulderGlow: BufferGeometry;
    headset: BufferGeometry;
    headsetGlow: BufferGeometry;
    lamp: BufferGeometry;
    lens: BufferGeometry;
    flame: BufferGeometry;
    coin: BufferGeometry;
    crate: BufferGeometry;
};

function createGeometry(gender: Gender): PlayerGeometry {
    const b = BUILDS[gender];
    const fem = gender === 'female';
    const hs = fem ? 0.93 : 1;
    const gear = fem
        ? fuse([
              place(slab(0.1, 0.12, 0.028), 0, 0.25, 0.158, -0.1),
              place(slab(0.05, 0.07, 0.04), 0.125, -0.03, 0.06, 0, 0.6, 0),
              place(slab(0.05, 0.07, 0.04), -0.125, -0.03, 0.06, 0, -0.6, 0),
              slab(0.06, 0.06, 0.04).translate(0, -0.03, -0.13),
              slab(0.28, 0.31, 0.115).translate(0, 0.19, -0.152),
              place(tube(0.055, 0.055, 0.26, 10), 0, 0.37, -0.152, 0, 0, Math.PI / 2),
          ])
        : fuse([
              place(slab(0.27, 0.2, 0.036), 0, 0.235, 0.158, -0.05),
              slab(0.07, 0.07, 0.04).translate(-0.085, 0.13, 0.165),
              slab(0.07, 0.07, 0.04).translate(0, 0.13, 0.165),
              slab(0.07, 0.07, 0.04).translate(0.085, 0.13, 0.165),
              place(slab(0.05, 0.07, 0.05), 0.16, -0.03, 0.05, 0, 0.5, 0),
              place(slab(0.05, 0.07, 0.05), -0.16, -0.03, 0.05, 0, -0.5, 0),
              slab(0.06, 0.06, 0.04).translate(0, -0.03, -0.14),
              slab(0.31, 0.34, 0.12).translate(0, 0.205, -0.158),
              place(tube(0.06, 0.06, 0.29, 10), 0, 0.395, -0.158, 0, 0, Math.PI / 2),
          ]);
    const glow = fem
        ? fuse([ellipsoid(0.02, 0.02, 0.012, 8, 6).translate(0, 0.255, 0.178), tube(0.02, 0.02, 0.28, 8).translate(0.095, 0.19, -0.218)])
        : fuse([ellipsoid(0.03, 0.03, 0.02, 8, 6).translate(0.075, 0.3, 0.182), tube(0.022, 0.022, 0.3, 8).translate(0.105, 0.2, -0.222)]);
    const shoulderGlow = fuse([
        slab(0.07, 0.012, 0.05).translate(b.shoulderX + 0.014, b.shoulderY + 0.064, -0.004),
        slab(0.07, 0.012, 0.05).translate(-b.shoulderX - 0.014, b.shoulderY + 0.064, -0.004),
    ]);
    const earY = 0.092 * hs;
    const headset = fuse([place(tube(0.026, 0.026, 0.016, 14), 0.089, earY, -0.004, 0, 0, Math.PI / 2), place(tube(0.03, 0.03, 0.004, 14), 0.082, earY, -0.004, 0, 0, Math.PI / 2)]);
    const headsetGlow = place(tube(0.013, 0.013, 0.004, 10), 0.098, earY, -0.004, 0, 0, Math.PI / 2);
    const lamp = fuse([tube(0.026, 0.03, 0.075, 10).translate(0, -0.045, -0.052), slab(0.07, 0.012, 0.03).translate(0, -0.015, -0.03)]);
    const lens = new SphereGeometry(0.024, 10, 8);
    lens.translate(0, -0.088, -0.052);
    const flame = fuse([place(new SphereGeometry(0.1, 8, 6).scale(1, 1, 1.6), 0, 0, 0.1), place(new SphereGeometry(0.05, 8, 6), 0, 0, 0.02)]);
    const coin = place(tube(0.032, 0.032, 0.006, 14), 0, 0, 0, Math.PI / 2);
    const crate = fuse([slab(0.1, 0.05, 0.07), slab(0.104, 0.008, 0.074).translate(0, 0.028, 0)]);
    return { body: bodyMesher(gender).toGeometry(), gear, glow, shoulderGlow, headset, headsetGlow, lamp, lens, flame, coin, crate };
}

const geometries: Partial<Record<Gender, PlayerGeometry>> = {};

export function playerGeometry(gender: Gender = 'male'): PlayerGeometry {
    let g = geometries[gender];
    if (!g) {
        g = createGeometry(gender);
        geometries[gender] = g;
    }
    return g;
}

export function part(geometryValue: BufferGeometry, material: MeshStandardMaterial, castShadow = false): Mesh {
    const mesh = new Mesh(geometryValue, material);
    mesh.castShadow = castShadow;
    return mesh;
}

export type PlayerBones = { list: Bone[]; byName: Record<string, Bone> };

export function createBones(build: Build, root: Group, legs: Group): PlayerBones {
    const byName: Record<string, Bone> = {};
    const holders: Record<string, Group | Bone> = { root, legs };
    for (const d of boneDefs(build)) {
        const bn = new Bone();
        bn.name = d.name;
        bn.position.set(d.local[0], d.local[1], d.local[2]);
        if (d.name.startsWith('wrist')) bn.scale.setScalar(build.handScale);
        holders[d.parent].add(bn);
        holders[d.name] = bn;
        byName[d.name] = bn;
    }
    return { list: BONE_NAMES.map((n) => byName[n]), byName };
}

export function bindBody(gender: Gender, bones: PlayerBones, root: Group): SkinnedMesh {
    const g = playerGeometry(gender);
    const m = playerMaterials();
    root.updateMatrixWorld(true);
    const skeleton = new Skeleton(bones.list);
    const mesh = new SkinnedMesh(g.body, m.body);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.bind(skeleton);
    return mesh;
}

export type HandRig = {
    wrist: Bone;
    thumb: [Bone, Bone, Bone];
    index: [Bone, Bone, Bone];
    middle: [Bone, Bone, Bone];
    ring: [Bone, Bone, Bone];
    pinky: [Bone, Bone, Bone];
    side: number;
    current: number[];
};

export function bindHand(bones: PlayerBones, side: number): HandRig {
    const tag = side > 0 ? 'L' : 'R';
    const grab = (f: string): [Bone, Bone, Bone] => [bones.byName[`${f}0${tag}`], bones.byName[`${f}1${tag}`], bones.byName[`${f}2${tag}`]];
    return {
        wrist: bones.byName[`wrist${tag}`],
        thumb: grab('thumb'),
        index: grab('index'),
        middle: grab('middle'),
        ring: grab('ring'),
        pinky: grab('pinky'),
        side,
        current: new Array<number>(12).fill(0),
    };
}

export function applyHand(hand: HandRig) {
    const c = hand.current;
    const s = hand.side;
    const spread = c[10];
    hand.thumb[0].rotation.set(-c[2] * 0.5, s * c[1], s * c[0]);
    hand.thumb[1].rotation.x = -(c[2] * 0.5 + c[3] * 0.35);
    hand.thumb[2].rotation.x = -c[3] * 0.8;
    hand.index[0].rotation.set(-c[4], 0, -s * spread * 0.16);
    hand.index[1].rotation.x = -c[5];
    hand.index[2].rotation.x = -c[6];
    hand.middle[0].rotation.set(-(c[4] * 0.35 + c[7] * 0.65), 0, -s * spread * 0.05);
    hand.middle[1].rotation.x = -(c[5] * 0.3 + c[8] * 0.7);
    hand.middle[2].rotation.x = -(c[6] * 0.3 + c[9] * 0.7);
    hand.ring[0].rotation.set(-c[7], 0, s * spread * 0.08);
    hand.ring[1].rotation.x = -c[8];
    hand.ring[2].rotation.x = -c[9];
    hand.pinky[0].rotation.set(-c[7] * 1.08, 0, s * spread * 0.16);
    hand.pinky[1].rotation.x = -c[8] * 1.08;
    hand.pinky[2].rotation.x = -c[9] * 1.1;
}