import { BufferGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { WEAPONS, type WeaponId } from '../data/weapons.ts';
import { ellipsoid, fuse, place, slab, tube } from './bodyGeo.ts';
import type { PoseName } from './humanoid.ts';
import { accentMaterial, part, playerMaterials } from './playerParts.ts';
import type { ReloadEvent } from './sfx.ts';

export type Vec = readonly [number, number, number];

export type Grip = { at: Vec; fingers: Vec; palm: Vec; pose: PoseName };

export type Anchor = Grip & { frame: 'weapon' | 'chest' };

export type PoseKey = { x: number; y: number; z: number; pitch: number; yaw: number; roll: number };

export type PropAction = 'pull' | 'stow' | 'fresh' | 'seat';

export type ReloadStep = { t: number; anchor: string; weapon: 0 | 1; event?: ReloadEvent; prop?: PropAction };

export type PropKind = 'mag' | 'shell' | 'rocket';

export type WeaponSpec = {
    carry: PoseKey;
    aim: PoseKey;
    reload: PoseKey;
    stow: PoseKey;
    right: Grip;
    left: Grip;
    muzzle: Vec;
    flash: number;
    kick: { back: number; pitch: number; decay: number; torso: number };
    anchors: Record<string, Anchor>;
    steps: ReloadStep[];
    prop: PropKind;
    slideTravel: number;
    slideEvents: ReloadEvent[];
};

export type WeaponModel = {
    id: WeaponId;
    group: Group;
    muzzle: Object3D;
    mag: Object3D | null;
    slide: Object3D | null;
    prop: Mesh;
    spec: WeaponSpec;
};

const POUCH: Anchor = { frame: 'chest', at: [0.17, -0.02, 0.12], fingers: [0.1, -1, 0.3], palm: [-1, 0, 0], pose: 'pinch' };

function pose(x: number, y: number, z: number, pitch: number, yaw = 0, roll = 0): PoseKey {
    return { x, y, z, pitch, yaw, roll };
}

function anchor(at: Vec, fingers: Vec, palm: Vec, poseName: PoseName): Anchor {
    return { frame: 'weapon', at, fingers, palm, pose: poseName };
}

function withSupport(left: Grip, others: Record<string, Anchor>): Record<string, Anchor> {
    return { support: { ...left, frame: 'weapon' }, pouch: POUCH, ...others };
}

export const SPECS: Record<WeaponId, WeaponSpec> = {
    pistol: ((): WeaponSpec => {
        const left: Grip = { at: [0.037, -0.035, -0.06], fingers: [0, -0.2, 1], palm: [-1, 0, 0], pose: 'supportGrip' };
        return {
            carry: pose(-0.06, 0.17, 0.3, -0.55),
            aim: pose(-0.05, 0.34, 0.4, 0, 0.03),
            reload: pose(-0.04, 0.26, 0.27, 0.55, 0.15, -0.25),
            stow: pose(-0.1, -0.05, 0.15, -1.2, 0, 0.4),
            right: { at: [-0.037, -0.008, -0.07], fingers: [0, -0.2, 1], palm: [1, 0, 0], pose: 'triggerGrip' },
            left,
            muzzle: [0, 0.058, 0.135],
            flash: 0.75,
            kick: { back: 0.04, pitch: 0.14, decay: 0.09, torso: 0.02 },
            anchors: withSupport(left, {
                under: anchor([0, -0.12, -0.02], [0, 0, 1], [0, 1, 0], 'cupGrip'),
                out: anchor([0, -0.25, -0.03], [0, 0, 1], [0, 1, 0], 'cupGrip'),
                rack: anchor([0.035, 0.065, -0.035], [-0.3, 0.2, 1], [-1, 0, 0], 'pinch'),
            }),
            steps: [
                { t: 0, anchor: 'support', weapon: 0 },
                { t: 0.14, anchor: 'under', weapon: 1 },
                { t: 0.24, anchor: 'out', weapon: 1, event: 'magOut', prop: 'pull' },
                { t: 0.4, anchor: 'pouch', weapon: 1, prop: 'stow' },
                { t: 0.5, anchor: 'pouch', weapon: 1, prop: 'fresh' },
                { t: 0.66, anchor: 'out', weapon: 1 },
                { t: 0.74, anchor: 'under', weapon: 1, event: 'magIn', prop: 'seat' },
                { t: 0.86, anchor: 'rack', weapon: 1, event: 'slide' },
                { t: 1, anchor: 'support', weapon: 0 },
            ],
            prop: 'mag',
            slideTravel: 0.035,
            slideEvents: ['slide'],
        };
    })(),
    rifle: ((): WeaponSpec => {
        const left: Grip = { at: [0.07, 0.012, 0.29], fingers: [-1, 0.1, 0.2], palm: [0.15, 1, 0], pose: 'barrelGrip' };
        return {
            carry: pose(-0.1, 0.12, 0.2, -0.5, 0.22),
            aim: pose(-0.13, 0.3, 0.36, 0),
            reload: pose(-0.08, 0.2, 0.28, 0.5, 0.1, -0.3),
            stow: pose(-0.1, -0.05, 0.1, -1.3, 0.1, 0.3),
            right: { at: [-0.037, 0, -0.055], fingers: [0, -0.3, 1], palm: [1, 0, 0], pose: 'triggerGrip' },
            left,
            muzzle: [0, 0.07, 0.76],
            flash: 1,
            kick: { back: 0.03, pitch: 0.06, decay: 0.07, torso: 0.02 },
            anchors: withSupport(left, {
                under: anchor([0.015, -0.11, 0.12], [0, 0.15, 1], [-1, 0, 0], 'cupGrip'),
                out: anchor([0.02, -0.27, 0.14], [0, 0.15, 1], [-1, 0, 0], 'cupGrip'),
                rack: anchor([0.045, 0.09, -0.05], [-0.2, 0.1, 1], [-1, 0, 0], 'pinch'),
            }),
            steps: [
                { t: 0, anchor: 'support', weapon: 0 },
                { t: 0.14, anchor: 'under', weapon: 1 },
                { t: 0.22, anchor: 'out', weapon: 1, event: 'magOut', prop: 'pull' },
                { t: 0.36, anchor: 'pouch', weapon: 1, prop: 'stow' },
                { t: 0.44, anchor: 'pouch', weapon: 1, prop: 'fresh' },
                { t: 0.56, anchor: 'out', weapon: 1 },
                { t: 0.63, anchor: 'under', weapon: 1, event: 'magIn', prop: 'seat' },
                { t: 0.76, anchor: 'rack', weapon: 1, event: 'slide' },
                { t: 1, anchor: 'support', weapon: 0 },
            ],
            prop: 'mag',
            slideTravel: 0.045,
            slideEvents: ['slide'],
        };
    })(),
    smg: ((): WeaponSpec => {
        const left: Grip = { at: [0.036, 0, 0.12], fingers: [0, -0.05, 1], palm: [-1, 0, 0], pose: 'supportGrip' };
        return {
            carry: pose(-0.09, 0.14, 0.22, -0.45, 0.15),
            aim: pose(-0.1, 0.3, 0.34, 0, 0.02),
            reload: pose(-0.07, 0.22, 0.26, 0.5, 0.1, -0.3),
            stow: pose(-0.1, -0.05, 0.12, -1.3, 0.1, 0.3),
            right: { at: [-0.037, 0, -0.055], fingers: [0, -0.3, 1], palm: [1, 0, 0], pose: 'triggerGrip' },
            left,
            muzzle: [0, 0.062, 0.385],
            flash: 0.85,
            kick: { back: 0.022, pitch: 0.04, decay: 0.05, torso: 0.012 },
            anchors: withSupport(left, {
                under: anchor([0.015, -0.1, 0.1], [0, 0.15, 1], [-1, 0, 0], 'cupGrip'),
                out: anchor([0.02, -0.25, 0.12], [0, 0.15, 1], [-1, 0, 0], 'cupGrip'),
                rack: anchor([0.045, 0.09, 0], [-0.2, 0.1, 1], [-1, 0, 0], 'pinch'),
            }),
            steps: [
                { t: 0, anchor: 'support', weapon: 0 },
                { t: 0.14, anchor: 'under', weapon: 1 },
                { t: 0.22, anchor: 'out', weapon: 1, event: 'magOut', prop: 'pull' },
                { t: 0.36, anchor: 'pouch', weapon: 1, prop: 'stow' },
                { t: 0.44, anchor: 'pouch', weapon: 1, prop: 'fresh' },
                { t: 0.56, anchor: 'out', weapon: 1 },
                { t: 0.63, anchor: 'under', weapon: 1, event: 'magIn', prop: 'seat' },
                { t: 0.76, anchor: 'rack', weapon: 1, event: 'slide' },
                { t: 1, anchor: 'support', weapon: 0 },
            ],
            prop: 'mag',
            slideTravel: 0.04,
            slideEvents: ['slide'],
        };
    })(),
    shotgun: ((): WeaponSpec => {
        const left: Grip = { at: [0.07, -0.017, 0.33], fingers: [-1, 0.1, 0.2], palm: [0.15, 1, 0], pose: 'barrelGrip' };
        return {
            carry: pose(-0.1, 0.14, 0.22, -0.5, 0.2),
            aim: pose(-0.12, 0.29, 0.38, 0),
            reload: pose(-0.08, 0.2, 0.3, 0.75, 0.1, -0.5),
            stow: pose(-0.1, -0.05, 0.1, -1.3, 0.1, 0.3),
            right: { at: [-0.037, 0, -0.055], fingers: [0, -0.3, 1], palm: [1, 0, 0], pose: 'triggerGrip' },
            left,
            muzzle: [0, 0.082, 0.69],
            flash: 1.5,
            kick: { back: 0.09, pitch: 0.2, decay: 0.14, torso: 0.05 },
            anchors: withSupport(left, {
                port: anchor([0.02, -0.04, 0.1], [0, 0.3, 1], [0, 1, 0], 'pinch'),
                pumpBack: anchor([0.07, -0.017, 0.23], [-1, 0.1, 0.2], [0.15, 1, 0], 'barrelGrip'),
            }),
            steps: [
                { t: 0, anchor: 'support', weapon: 0 },
                { t: 0.1, anchor: 'pouch', weapon: 1, prop: 'fresh' },
                { t: 0.26, anchor: 'port', weapon: 1 },
                { t: 0.3, anchor: 'port', weapon: 1, event: 'shell', prop: 'seat' },
                { t: 0.38, anchor: 'pouch', weapon: 1, prop: 'fresh' },
                { t: 0.52, anchor: 'port', weapon: 1 },
                { t: 0.56, anchor: 'port', weapon: 1, event: 'shell', prop: 'seat' },
                { t: 0.64, anchor: 'pouch', weapon: 1, prop: 'fresh' },
                { t: 0.76, anchor: 'port', weapon: 1 },
                { t: 0.8, anchor: 'port', weapon: 1, event: 'shell', prop: 'seat' },
                { t: 0.86, anchor: 'support', weapon: 0 },
                { t: 0.9, anchor: 'pumpBack', weapon: 0, event: 'pump' },
                { t: 1, anchor: 'support', weapon: 0 },
            ],
            prop: 'shell',
            slideTravel: 0.1,
            slideEvents: ['pump'],
        };
    })(),
    sniper: ((): WeaponSpec => {
        const left: Grip = { at: [0.07, -0.005, 0.29], fingers: [-1, 0.1, 0.2], palm: [0.15, 1, 0], pose: 'barrelGrip' };
        return {
            carry: pose(-0.1, 0.12, 0.2, -0.55, 0.2),
            aim: pose(-0.12, 0.3, 0.4, 0),
            reload: pose(-0.07, 0.24, 0.3, 0.5, 0.1, -0.35),
            stow: pose(-0.1, -0.05, 0.1, -1.3, 0.1, 0.3),
            right: { at: [-0.037, 0, -0.055], fingers: [0, -0.3, 1], palm: [1, 0, 0], pose: 'triggerGrip' },
            left,
            muzzle: [0, 0.075, 0.975],
            flash: 1.3,
            kick: { back: 0.11, pitch: 0.22, decay: 0.18, torso: 0.06 },
            anchors: withSupport(left, {
                under: anchor([0.015, -0.06, 0.06], [0, 0.15, 1], [-1, 0, 0], 'cupGrip'),
                out: anchor([0.02, -0.2, 0.08], [0, 0.15, 1], [-1, 0, 0], 'cupGrip'),
            }),
            steps: [
                { t: 0, anchor: 'support', weapon: 0 },
                { t: 0.1, anchor: 'support', weapon: 0, event: 'bolt' },
                { t: 0.22, anchor: 'under', weapon: 1 },
                { t: 0.3, anchor: 'out', weapon: 1, event: 'magOut', prop: 'pull' },
                { t: 0.42, anchor: 'pouch', weapon: 1, prop: 'stow' },
                { t: 0.5, anchor: 'pouch', weapon: 1, prop: 'fresh' },
                { t: 0.62, anchor: 'out', weapon: 1 },
                { t: 0.68, anchor: 'under', weapon: 1, event: 'magIn', prop: 'seat' },
                { t: 0.8, anchor: 'support', weapon: 0 },
                { t: 0.84, anchor: 'support', weapon: 0, event: 'bolt' },
                { t: 1, anchor: 'support', weapon: 0 },
            ],
            prop: 'mag',
            slideTravel: 0.07,
            slideEvents: ['bolt'],
        };
    })(),
    launcher: ((): WeaponSpec => {
        const left: Grip = { at: [0.036, 0.002, 0.192], fingers: [0, 0.15, 1], palm: [-1, 0, 0], pose: 'supportGrip' };
        return {
            carry: pose(-0.14, 0.18, 0.12, -0.35, 0.15),
            aim: pose(-0.15, 0.3, 0.1, 0.02),
            reload: pose(-0.1, 0.15, 0.2, 0.9),
            stow: pose(-0.1, -0.05, 0.1, -1.2, 0.1, 0.3),
            right: { at: [-0.037, 0, -0.055], fingers: [0, -0.3, 1], palm: [1, 0, 0], pose: 'triggerGrip' },
            left,
            muzzle: [0, 0.125, 0.72],
            flash: 2,
            kick: { back: 0.12, pitch: 0.2, decay: 0.2, torso: 0.07 },
            anchors: withSupport(left, {
                front: anchor([0.07, 0.05, 0.6], [-0.3, 0, 1], [-1, 0.2, 0], 'cupGrip'),
            }),
            steps: [
                { t: 0, anchor: 'support', weapon: 0 },
                { t: 0.12, anchor: 'pouch', weapon: 1 },
                { t: 0.28, anchor: 'pouch', weapon: 1, event: 'launcher', prop: 'fresh' },
                { t: 0.55, anchor: 'front', weapon: 1 },
                { t: 0.62, anchor: 'front', weapon: 1, prop: 'seat' },
                { t: 0.85, anchor: 'support', weapon: 0 },
                { t: 1, anchor: 'support', weapon: 0 },
            ],
            prop: 'rocket',
            slideTravel: 0,
            slideEvents: [],
        };
    })(),
};

function add(group: Object3D, geometry: BufferGeometry, material: MeshStandardMaterial, shadow = false): Mesh {
    const mesh = part(geometry, material, shadow);
    group.add(mesh);
    return mesh;
}

function propFrom(source: Mesh): Mesh {
    const copy = new Mesh(source.geometry.clone().center(), source.material);
    return copy;
}

const barrelAlong = Math.PI / 2;

function gripBlock(group: Group, wood: boolean) {
    const m = playerMaterials();
    add(group, place(slab(0.032, 0.1, 0.046), 0, -0.032, -0.012, 0.3), wood ? m.wood : m.polymer, true);
}

function buildPistol(group: Group, accent: MeshStandardMaterial): { muzzle: Object3D; mag: Object3D; slide: Object3D; prop: Mesh } {
    const m = playerMaterials();
    add(group, place(slab(0.031, 0.105, 0.05), 0, -0.032, -0.004, 0.2), m.polymer, true);
    add(group, slab(0.028, 0.03, 0.15).translate(0, 0.022, 0.04), m.polymer);
    add(group, slab(0.012, 0.007, 0.045).translate(0, 0.004, 0.05), m.metal);
    const slide = new Object3D();
    slide.position.set(0, 0.055, 0.035);
    add(slide, slab(0.029, 0.034, 0.19), m.metal, true);
    add(slide, slab(0.008, 0.004, 0.13).translate(0, 0.019, 0), accent);
    group.add(slide);
    const mag = new Object3D();
    mag.position.set(0, -0.01, -0.008);
    const magMesh = add(mag, fuse([place(slab(0.024, 0.075, 0.034), 0, -0.05, 0, 0.2), place(slab(0.03, 0.01, 0.042), 0, -0.09, 0.016, 0.2)]), m.metalLight);
    group.add(mag);
    const muzzle = new Object3D();
    muzzle.position.set(0, 0.058, 0.135);
    group.add(muzzle);
    return { muzzle, mag, slide, prop: propFrom(magMesh) };
}

function buildRifle(group: Group, accent: MeshStandardMaterial): { muzzle: Object3D; mag: Object3D; slide: Object3D; prop: Mesh } {
    const m = playerMaterials();
    gripBlock(group, false);
    add(group, slab(0.046, 0.075, 0.3).translate(0, 0.058, 0.07), m.metal, true);
    add(group, slab(0.022, 0.014, 0.26).translate(0, 0.1, 0.09), m.metalLight);
    add(group, slab(0.008, 0.004, 0.2).translate(0, 0.109, 0.09), accent);
    add(group, slab(0.052, 0.056, 0.26).translate(0, 0.062, 0.35), m.polymer, true);
    add(group, place(tube(0.0105, 0.0105, 0.24, 8), 0, 0.07, 0.6, barrelAlong), m.metalLight);
    add(group, place(tube(0.0145, 0.0145, 0.05, 8), 0, 0.07, 0.735, barrelAlong), m.metal);
    add(group, slab(0.01, 0.032, 0.016).translate(0, 0.1, 0.54), m.metal);
    add(group, place(slab(0.038, 0.07, 0.2), 0, 0.035, -0.185, -0.04), m.wood, true);
    add(group, slab(0.04, 0.085, 0.016).translate(0, 0.03, -0.29), m.polymer);
    const slide = new Object3D();
    slide.position.set(0, 0.098, -0.06);
    add(slide, slab(0.03, 0.016, 0.035), m.polymer);
    group.add(slide);
    const mag = new Object3D();
    mag.position.set(0, 0.025, 0.1);
    const magMesh = add(mag, place(slab(0.03, 0.13, 0.044), 0, -0.06, 0.012, 0.18), m.metalLight);
    group.add(mag);
    const muzzle = new Object3D();
    muzzle.position.set(0, 0.07, 0.76);
    group.add(muzzle);
    return { muzzle, mag, slide, prop: propFrom(magMesh) };
}

function buildSmg(group: Group, accent: MeshStandardMaterial): { muzzle: Object3D; mag: Object3D; slide: Object3D; prop: Mesh } {
    const m = playerMaterials();
    gripBlock(group, false);
    add(group, slab(0.05, 0.08, 0.25).translate(0, 0.058, 0.04), m.metal, true);
    add(group, slab(0.026, 0.012, 0.2).translate(0, 0.102, 0.05), m.metalLight);
    add(group, slab(0.008, 0.004, 0.16).translate(0, 0.111, 0.05), accent);
    add(group, place(tube(0.022, 0.022, 0.14, 10), 0, 0.062, 0.235, barrelAlong), m.metal);
    add(group, place(tube(0.012, 0.012, 0.08, 8), 0, 0.062, 0.34, barrelAlong), m.metalLight);
    add(group, slab(0.01, 0.012, 0.19).translate(0.022, 0.07, -0.18), m.metalLight);
    add(group, slab(0.01, 0.012, 0.19).translate(-0.022, 0.07, -0.18), m.metalLight);
    add(group, slab(0.05, 0.075, 0.012).translate(0, 0.065, -0.282), m.polymer);
    add(group, slab(0.028, 0.085, 0.03).translate(0, 0.0, 0.2), m.polymer, true);
    const slide = new Object3D();
    slide.position.set(0.03, 0.09, 0);
    add(slide, slab(0.014, 0.014, 0.04), m.polymer);
    group.add(slide);
    const mag = new Object3D();
    mag.position.set(0, 0.02, 0.09);
    const magMesh = add(mag, slab(0.03, 0.15, 0.036).translate(0, -0.07, 0), m.metalLight);
    group.add(mag);
    const muzzle = new Object3D();
    muzzle.position.set(0, 0.062, 0.385);
    group.add(muzzle);
    return { muzzle, mag, slide, prop: propFrom(magMesh) };
}

function buildShotgun(group: Group, accent: MeshStandardMaterial): { muzzle: Object3D; slide: Object3D; prop: Mesh } {
    const m = playerMaterials();
    gripBlock(group, false);
    add(group, slab(0.05, 0.085, 0.26).translate(0, 0.055, 0.04), m.metal, true);
    add(group, place(tube(0.0155, 0.0155, 0.52, 10), 0, 0.082, 0.43, barrelAlong), m.metalLight);
    add(group, place(tube(0.012, 0.012, 0.4, 8), 0, 0.036, 0.36, barrelAlong), m.metal);
    add(group, slab(0.008, 0.004, 0.2).translate(0, 0.1, 0.06), accent);
    add(group, place(slab(0.044, 0.09, 0.27), 0, 0.03, -0.21, -0.12), m.wood, true);
    add(group, slab(0.046, 0.1, 0.016).translate(0, 0.0, -0.35), m.polymer);
    const slide = new Object3D();
    slide.position.set(0, 0.028, 0.34);
    add(slide, slab(0.048, 0.046, 0.17), m.wood, true);
    group.add(slide);
    const muzzle = new Object3D();
    muzzle.position.set(0, 0.082, 0.69);
    group.add(muzzle);
    const shell = fuse([place(tube(0.0095, 0.0095, 0.045, 8), 0, 0, 0, barrelAlong), place(tube(0.0105, 0.0105, 0.012, 8), 0, 0, -0.026, barrelAlong)]);
    const prop = part(shell, m.metalLight);
    return { muzzle, slide, prop };
}

function buildSniper(group: Group, accent: MeshStandardMaterial): { muzzle: Object3D; mag: Object3D; slide: Object3D; prop: Mesh } {
    const m = playerMaterials();
    add(group, place(slab(0.034, 0.1, 0.046), 0, -0.03, -0.012, 0.3), m.wood, true);
    add(group, slab(0.042, 0.075, 0.3).translate(0, 0.058, 0.05), m.metal, true);
    add(group, place(tube(0.0135, 0.0135, 0.72, 10), 0, 0.075, 0.56, barrelAlong), m.metalLight);
    add(group, place(tube(0.02, 0.02, 0.07, 10), 0, 0.075, 0.94, barrelAlong), m.metal);
    add(group, place(tube(0.021, 0.021, 0.3, 12), 0, 0.14, 0.1, barrelAlong), m.metal, true);
    add(group, place(tube(0.029, 0.021, 0.06, 12), 0, 0.14, 0.27, barrelAlong), m.metal);
    add(group, place(tube(0.024, 0.021, 0.04, 12), 0, 0.14, -0.07, barrelAlong), m.metal);
    add(group, place(tube(0.0295, 0.0295, 0.01, 12), 0, 0.14, 0.3, barrelAlong), accent);
    add(group, slab(0.02, 0.04, 0.03).translate(0, 0.108, 0.0), m.metal);
    add(group, slab(0.02, 0.04, 0.03).translate(0, 0.108, 0.2), m.metal);
    add(group, place(slab(0.044, 0.1, 0.32), 0, 0.025, -0.23, -0.04), m.wood, true);
    add(group, slab(0.04, 0.03, 0.12).translate(0, 0.09, -0.2), m.wood);
    add(group, slab(0.046, 0.105, 0.016).translate(0, 0.02, -0.4), m.polymer);
    add(group, slab(0.05, 0.045, 0.3).translate(0, 0.04, 0.3), m.wood, true);
    const slide = new Object3D();
    slide.position.set(0.026, 0.07, -0.02);
    add(slide, fuse([slab(0.012, 0.012, 0.06), place(tube(0.005, 0.005, 0.07, 6), 0.035, -0.012, 0, 0, 0, Math.PI / 2), ellipsoid(0.013, 0.013, 0.013, 8, 6).translate(0.075, -0.012, 0)]), m.metalLight);
    group.add(slide);
    const mag = new Object3D();
    mag.position.set(0, 0.03, 0.05);
    const magMesh = add(mag, slab(0.03, 0.06, 0.05).translate(0, -0.03, 0), m.metalLight);
    group.add(mag);
    const muzzle = new Object3D();
    muzzle.position.set(0, 0.075, 0.975);
    group.add(muzzle);
    return { muzzle, mag, slide, prop: propFrom(magMesh) };
}

function buildLauncher(group: Group, accent: MeshStandardMaterial): { muzzle: Object3D; mag: Object3D; prop: Mesh } {
    const m = playerMaterials();
    add(group, place(slab(0.032, 0.1, 0.046), 0, -0.035, 0, 0.25), m.polymer, true);
    add(group, place(tube(0.06, 0.06, 0.86, 14), 0, 0.125, 0.125, barrelAlong), m.metal, true);
    add(group, place(tube(0.078, 0.062, 0.08, 14), 0, 0.125, -0.33, barrelAlong), m.metalLight);
    add(group, place(tube(0.062, 0.085, 0.1, 14), 0, 0.125, 0.58, barrelAlong), m.metalLight);
    add(group, place(slab(0.03, 0.1, 0.04), 0, 0.01, 0.27, -0.15), m.polymer, true);
    add(group, slab(0.014, 0.05, 0.014).translate(0, 0.2, 0.0), m.metalLight);
    add(group, slab(0.014, 0.05, 0.014).translate(0, 0.2, 0.5), m.metalLight);
    add(group, place(tube(0.0625, 0.0625, 0.03, 14), 0, 0.125, 0.27, barrelAlong), accent);
    add(group, place(tube(0.0625, 0.0625, 0.03, 14), 0, 0.125, -0.2, barrelAlong), accent);
    const rocketGeometry = (): BufferGeometry =>
        fuse([place(new ConeGeometry(0.05, 0.14, 12), 0, 0, 0.07, barrelAlong), place(tube(0.045, 0.045, 0.12, 12), 0, 0, -0.06, barrelAlong)]);
    const mag = new Object3D();
    mag.position.set(0, 0.125, 0.6);
    add(mag, rocketGeometry(), accent);
    group.add(mag);
    const muzzle = new Object3D();
    muzzle.position.set(0, 0.125, 0.72);
    group.add(muzzle);
    return { muzzle, mag, prop: part(rocketGeometry(), accent) };
}

export function buildWeapon(id: WeaponId): WeaponModel {
    const group = new Group();
    const accent = accentMaterial(WEAPONS[id].color);
    let built: { muzzle: Object3D; mag?: Object3D; slide?: Object3D; prop: Mesh };
    switch (id) {
        case 'pistol':
            built = buildPistol(group, accent);
            break;
        case 'rifle':
            built = buildRifle(group, accent);
            break;
        case 'smg':
            built = buildSmg(group, accent);
            break;
        case 'shotgun':
            built = buildShotgun(group, accent);
            break;
        case 'sniper':
            built = buildSniper(group, accent);
            break;
        case 'launcher':
            built = buildLauncher(group, accent);
            break;
    }
    group.visible = false;
    return { id, group, muzzle: built.muzzle, mag: built.mag ?? null, slide: built.slide ?? null, prop: built.prop, spec: SPECS[id] };
}