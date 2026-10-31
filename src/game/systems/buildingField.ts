import { Group, Mesh, type BufferGeometry } from 'three';
import { VIEW_RADIUS } from '../data/constants.ts';
import { buildings } from './footprints.ts';
import type { BuildingDef } from './buildingGen.ts';
import { cancelTask, enqueueTask, runToCompletion } from './buildQueue.ts';
import { buildShell } from './bldShell.ts';
import { buildInterior } from './bldInterior.ts';
import { buildingLeafMaterial, buildingMaterial } from './materials.ts';
import { wrapDelta } from './wrap.ts';

export const SHELL_ON = VIEW_RADIUS + 14;
export const SHELL_OFF = SHELL_ON + 26;
export const SHELL_SHOW = VIEW_RADIUS + 10;
export const INTERIOR_ON = 30;
export const INTERIOR_OFF = 48;
export const INTERIOR_SHOW = 38;

type Entry = {
    def: BuildingDef;
    group: Group;
    shell: Mesh[];
    interior: Mesh[];
    shellGen: Generator<void, void> | null;
    interiorGen: Generator<void, void> | null;
    shellReady: boolean;
    interiorReady: boolean;
    dist: number;
};

function meshesFrom(solid: BufferGeometry | null, leaf: BufferGeometry | null, castShadow: boolean): Mesh[] {
    const out: Mesh[] = [];
    if (solid) {
        const mesh = new Mesh(solid, buildingMaterial);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        out.push(mesh);
    }
    if (leaf) {
        const mesh = new Mesh(leaf, buildingLeafMaterial);
        mesh.receiveShadow = true;
        out.push(mesh);
    }
    return out;
}

function disposeMeshes(group: Group, meshes: Mesh[]) {
    for (const mesh of meshes) {
        group.remove(mesh);
        mesh.geometry.dispose();
    }
}

function* shellTask(entry: Entry): Generator<void, void> {
    const geometry = yield* buildShell(entry.def);
    entry.shell = meshesFrom(geometry.solid, geometry.leaf, true);
    for (const mesh of entry.shell) entry.group.add(mesh);
    entry.shellReady = true;
    entry.shellGen = null;
}

function* interiorTask(entry: Entry): Generator<void, void> {
    const geometry = yield* buildInterior(entry.def);
    entry.interior = meshesFrom(geometry.solid, geometry.leaf, false);
    for (const mesh of entry.interior) {
        mesh.visible = entry.dist < INTERIOR_SHOW;
        entry.group.add(mesh);
    }
    entry.interiorReady = true;
    entry.interiorGen = null;
}

export class BuildingField {
    readonly root = new Group();
    private readonly entries = new Map<number, Entry>();

    private spawn(def: BuildingDef, dist: number): Entry {
        const group = new Group();
        group.rotation.y = def.angle;
        const entry: Entry = { def, group, shell: [], interior: [], shellGen: null, interiorGen: null, shellReady: false, interiorReady: false, dist };
        entry.shellGen = shellTask(entry);
        enqueueTask(entry.shellGen, 150 + Math.max(0, dist));
        this.entries.set(def.index, entry);
        this.root.add(group);
        return entry;
    }

    private startInterior(entry: Entry) {
        entry.interiorGen = interiorTask(entry);
        enqueueTask(entry.interiorGen, 120 + Math.max(0, entry.dist));
    }

    private dropInterior(entry: Entry) {
        if (entry.interiorGen) {
            cancelTask(entry.interiorGen);
            entry.interiorGen = null;
        }
        disposeMeshes(entry.group, entry.interior);
        entry.interior = [];
        entry.interiorReady = false;
    }

    private remove(entry: Entry) {
        if (entry.shellGen) cancelTask(entry.shellGen);
        if (entry.interiorGen) cancelTask(entry.interiorGen);
        entry.shellGen = null;
        entry.interiorGen = null;
        disposeMeshes(entry.group, entry.shell);
        disposeMeshes(entry.group, entry.interior);
        this.root.remove(entry.group);
        this.entries.delete(entry.def.index);
    }

    private finish(entry: Entry) {
        if (entry.shellGen) {
            cancelTask(entry.shellGen);
            runToCompletion(entry.shellGen);
        }
        if (entry.interiorGen) {
            cancelTask(entry.interiorGen);
            runToCompletion(entry.interiorGen);
        }
    }

    update(px: number, pz: number, playerBuilding: number) {
        for (let i = 0; i < buildings.length; i++) {
            const def = buildings[i];
            const dx = wrapDelta(def.x - px);
            const dz = wrapDelta(def.z - pz);
            const dist = Math.sqrt(dx * dx + dz * dz) - def.radius;
            let entry = this.entries.get(i);
            if (!entry) {
                if (dist >= SHELL_ON) continue;
                entry = this.spawn(def, dist);
            } else if (dist > SHELL_OFF) {
                this.remove(entry);
                continue;
            }
            entry.dist = dist;
            entry.group.visible = dist < SHELL_SHOW;
            entry.group.position.set(px + dx, def.baseY, pz + dz);
            const hasInterior = entry.interiorReady || entry.interiorGen !== null;
            if (!hasInterior) {
                if (dist < INTERIOR_ON) this.startInterior(entry);
            } else if (dist > INTERIOR_OFF && i !== playerBuilding) {
                this.dropInterior(entry);
            }
            if (i === playerBuilding) this.finish(entry);
            if (entry.interiorReady) {
                const show = dist < INTERIOR_SHOW;
                for (const mesh of entry.interior) mesh.visible = show;
            }
        }
    }

    prime(px: number, pz: number, playerBuilding: number, immediateRadius: number) {
        this.update(px, pz, playerBuilding);
        for (const entry of this.entries.values()) {
            if (entry.dist < immediateRadius) this.finish(entry);
        }
        this.update(px, pz, playerBuilding);
    }

    reset() {
        for (const entry of Array.from(this.entries.values())) this.remove(entry);
    }

    isReady(radius: number): boolean {
        for (const entry of this.entries.values()) {
            if (entry.dist < radius && !entry.shellReady) return false;
        }
        return true;
    }
}

export const buildingField = new BuildingField();
