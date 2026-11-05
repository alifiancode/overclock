import { Mesh, type BufferGeometry } from 'three';
import { VIEW_RADIUS } from '../data/constants.ts';
import { ChunkField } from './chunkField.ts';
import { buildGround } from './groundGeo.ts';
import { buildVegetation, type VegGeometry } from './vegChunk.ts';
import { groundMaterial, leafVegMaterial, solidVegMaterial } from './materials.ts';

function* groundChunk(cx: number, cz: number, attach: (meshes: Mesh[]) => void): Generator<void, void> {
    const out: { geometry: BufferGeometry | null } = { geometry: null };
    yield* buildGround(cx, cz, (geometry) => {
        out.geometry = geometry;
    });
    if (!out.geometry) return;
    const mesh = new Mesh(out.geometry, groundMaterial);
    mesh.receiveShadow = true;
    attach([mesh]);
}

function* vegetationChunk(cx: number, cz: number, attach: (meshes: Mesh[]) => void): Generator<void, void> {
    const out: { geometry: VegGeometry | null } = { geometry: null };
    yield* buildVegetation(cx, cz, (geometry) => {
        out.geometry = geometry;
    });
    const meshes: Mesh[] = [];
    if (out.geometry?.solid) meshes.push(new Mesh(out.geometry.solid, solidVegMaterial));
    if (out.geometry?.leaf) meshes.push(new Mesh(out.geometry.leaf, leafVegMaterial));
    attach(meshes);
}

export const GROUND_RADIUS = VIEW_RADIUS + 34;
export const VEGETATION_RADIUS = VIEW_RADIUS + 20;

export const groundField = new ChunkField(groundChunk, 0, GROUND_RADIUS);
export const vegetationField = new ChunkField(vegetationChunk, 1, VEGETATION_RADIUS);
