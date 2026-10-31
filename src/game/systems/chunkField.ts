import { Group, Mesh } from 'three';
import { CHUNK_SIZE, CHUNKS_PER_AXIS, WORLD_HALF } from '../data/constants.ts';
import { cancelTask, enqueueTask, runToCompletion } from './buildQueue.ts';
import { chunkOrigin } from './scatter.ts';
import { wrapDelta, wrapIndex, wrapNear } from './wrap.ts';

export type ChunkBuildFn = (cx: number, cz: number, attach: (meshes: Mesh[]) => void) => Generator<void, void>;

type Entry = { key: number; cx: number; cz: number; group: Group; gen: Generator<void, void>; done: boolean; dead: boolean };

export class ChunkField {
    readonly root = new Group();
    private readonly entries = new Map<number, Entry>();
    private readonly build: ChunkBuildFn;
    private readonly basePriority: number;
    private readonly radius: number;
    private cellX = Number.NaN;
    private cellZ = Number.NaN;

    constructor(build: ChunkBuildFn, basePriority: number, radius: number) {
        this.build = build;
        this.basePriority = basePriority;
        this.radius = radius;
    }

    private distanceTo(cx: number, cz: number, px: number, pz: number): number {
        const centerX = chunkOrigin(cx) + CHUNK_SIZE / 2;
        const centerZ = chunkOrigin(cz) + CHUNK_SIZE / 2;
        const dx = Math.max(0, Math.abs(wrapDelta(centerX - px)) - CHUNK_SIZE / 2);
        const dz = Math.max(0, Math.abs(wrapDelta(centerZ - pz)) - CHUNK_SIZE / 2);
        return Math.hypot(dx, dz);
    }

    private spawn(cx: number, cz: number, distance: number, immediate: boolean) {
        const key = cz * CHUNKS_PER_AXIS + cx;
        const group = new Group();
        const entry = { key, cx, cz, group, done: false, dead: false } as Entry;
        const attach = (meshes: Mesh[]) => {
            if (entry.dead) {
                for (const mesh of meshes) mesh.geometry.dispose();
                return;
            }
            for (const mesh of meshes) group.add(mesh);
            entry.done = true;
        };
        entry.gen = this.build(cx, cz, attach);
        this.entries.set(key, entry);
        this.root.add(group);
        if (immediate) runToCompletion(entry.gen);
        else enqueueTask(entry.gen, this.basePriority * 1000 + Math.round(distance));
    }

    private remove(entry: Entry) {
        entry.dead = true;
        cancelTask(entry.gen);
        this.entries.delete(entry.key);
        this.root.remove(entry.group);
        entry.group.traverse((object) => {
            if (object instanceof Mesh) object.geometry.dispose();
        });
    }

    private refresh(px: number, pz: number, immediateRadius: number) {
        const reach = Math.ceil(this.radius / CHUNK_SIZE) + 1;
        const ccx = Math.floor((px + WORLD_HALF) / CHUNK_SIZE);
        const ccz = Math.floor((pz + WORLD_HALF) / CHUNK_SIZE);
        const wanted = new Set<number>();
        for (let dz = -reach; dz <= reach; dz++) {
            for (let dx = -reach; dx <= reach; dx++) {
                const cx = wrapIndex(ccx + dx, CHUNKS_PER_AXIS);
                const cz = wrapIndex(ccz + dz, CHUNKS_PER_AXIS);
                const key = cz * CHUNKS_PER_AXIS + cx;
                if (wanted.has(key)) continue;
                const distance = this.distanceTo(cx, cz, px, pz);
                if (distance > this.radius) continue;
                wanted.add(key);
                if (!this.entries.has(key)) this.spawn(cx, cz, distance, distance <= immediateRadius);
            }
        }
        for (const entry of Array.from(this.entries.values())) {
            if (wanted.has(entry.key)) continue;
            if (this.distanceTo(entry.cx, entry.cz, px, pz) > this.radius + 24) this.remove(entry);
        }
    }

    prime(px: number, pz: number, immediateRadius: number) {
        this.refresh(px, pz, immediateRadius);
        this.cellX = Math.floor(px / (CHUNK_SIZE / 2));
        this.cellZ = Math.floor(pz / (CHUNK_SIZE / 2));
        this.place(px, pz);
    }

    private place(px: number, pz: number) {
        for (const entry of this.entries.values()) {
            const centerX = chunkOrigin(entry.cx) + CHUNK_SIZE / 2;
            const centerZ = chunkOrigin(entry.cz) + CHUNK_SIZE / 2;
            entry.group.position.set(wrapNear(centerX, px) - CHUNK_SIZE / 2, 0, wrapNear(centerZ, pz) - CHUNK_SIZE / 2);
        }
    }

    update(px: number, pz: number) {
        const cellX = Math.floor(px / (CHUNK_SIZE / 2));
        const cellZ = Math.floor(pz / (CHUNK_SIZE / 2));
        if (cellX !== this.cellX || cellZ !== this.cellZ) {
            this.cellX = cellX;
            this.cellZ = cellZ;
            this.refresh(px, pz, -1);
        }
        this.place(px, pz);
    }

    reset() {
        for (const entry of Array.from(this.entries.values())) this.remove(entry);
        this.cellX = Number.NaN;
        this.cellZ = Number.NaN;
    }

    isReady(px: number, pz: number, radius: number): boolean {
        for (const entry of this.entries.values()) {
            if (!entry.done && this.distanceTo(entry.cx, entry.cz, px, pz) <= radius) return false;
        }
        return true;
    }
}
