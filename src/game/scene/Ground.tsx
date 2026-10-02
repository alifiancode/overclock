import { useMemo } from 'react';
import { BufferAttribute, Color, PlaneGeometry } from 'three';
import { ARENA_HALF_SIZE } from '../data/constants.ts';
import { getTerrainHeight, getOvergrowth, TERRAIN_AMPLITUDE } from '../systems/terrain.ts';

const SEGMENTS = 160;
const SLAB_SIZE = 4.5;
const SEAM_WIDTH = 0.08;
const BASE_COLOR = new Color('#5c5648');
const STAIN_COLOR = new Color('#3c372f');
const SEAM_COLOR = new Color('#2c2a26');
const LOW_GROUND_COLOR = new Color('#3a4530');
const HIGH_GROUND_COLOR = new Color('#79694f');
const WEED_COLOR = new Color('#4f6b2e');
const RUBBLE_COLOR = new Color('#7a7468');
const CRACK_COLOR = new Color('#221f1b');
const POTHOLE_COLOR = new Color('#18160f');
const GRASS_LUSH_COLOR = new Color('#42692a');
const GRASS_DRY_COLOR = new Color('#66723a');
const DIRT_COLOR = new Color('#4f4030');
const MOSS_SEAM_COLOR = new Color('#365523');
const CRACK_HEIGHT = 0.015;
const CRACK_WIDTH = 0.09;
const POTHOLE_DEPTH = 0.12;

type Segment = { x1: number; z1: number; x2: number; z2: number };
type Circle = { x: number; z: number; radius: number };

function seamFactor(x: number, z: number) {
    const fx = ((x % SLAB_SIZE) + SLAB_SIZE) % SLAB_SIZE;
    const fz = ((z % SLAB_SIZE) + SLAB_SIZE) % SLAB_SIZE;
    const distToSeam = Math.min(fx, SLAB_SIZE - fx, fz, SLAB_SIZE - fz);
    return distToSeam < SEAM_WIDTH ? 1 : 0;
}

function stainFactor(x: number, z: number) {
    const n = Math.sin(x * 0.4 + Math.sin(z * 0.3) * 2) * Math.cos(z * 0.37 + Math.sin(x * 0.21) * 2);
    return Math.max(0, n - 0.55) * 2.2;
}

function weedFactor(x: number, z: number) {
    const n = Math.sin(x * 0.9 + Math.sin(z * 0.6) * 1.5) * Math.cos(z * 0.85 + Math.sin(x * 0.5) * 1.5);
    return Math.max(0, n - 0.64) * 3;
}

function smoothRange(value: number, low: number, high: number) {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
}

function grassToneNoise(x: number, z: number) {
    const n = Math.sin(x * 0.53 + Math.sin(z * 0.41) * 1.9) * Math.cos(z * 0.47 + Math.sin(x * 0.29) * 1.7);
    return Math.max(0, Math.min(1, n * 0.5 + 0.5));
}

function rubbleFactor(x: number, z: number) {
    const n = Math.sin(x * 0.22 - z * 0.27 + Math.sin(x * 0.11 + z * 0.19) * 2.4);
    return Math.max(0, n - 0.68) * 3.1;
}

function generateCracks(chainCount: number, halfSize: number): Segment[] {
    const segments: Segment[] = [];
    for (let c = 0; c < chainCount; c++) {
        let x = (Math.random() - 0.5) * halfSize * 1.85;
        let z = (Math.random() - 0.5) * halfSize * 1.85;
        let angle = Math.random() * Math.PI * 2;
        const steps = 3 + Math.floor(Math.random() * 4);
        for (let s = 0; s < steps; s++) {
            angle += (Math.random() - 0.5) * 1.3;
            const segLen = 1.2 + Math.random() * 1.6;
            const nx = x + Math.cos(angle) * segLen;
            const nz = z + Math.sin(angle) * segLen;
            segments.push({ x1: x, z1: z, x2: nx, z2: nz });
            x = nx;
            z = nz;
            if (Math.random() < 0.25 && s < steps - 1) {
                let branchAngle = angle + (Math.random() - 0.5) * 2;
                let bx = x;
                let bz = z;
                const branchSteps = 1 + Math.floor(Math.random() * 2);
                for (let b = 0; b < branchSteps; b++) {
                    branchAngle += (Math.random() - 0.5) * 1;
                    const blen = 0.8 + Math.random() * 1.2;
                    const nbx = bx + Math.cos(branchAngle) * blen;
                    const nbz = bz + Math.sin(branchAngle) * blen;
                    segments.push({ x1: bx, z1: bz, x2: nbx, z2: nbz });
                    bx = nbx;
                    bz = nbz;
                }
            }
        }
    }
    return segments;
}

function generatePotholes(count: number, halfSize: number): Circle[] {
    const holes: Circle[] = [];
    for (let i = 0; i < count; i++) {
        holes.push({
            x: (Math.random() - 0.5) * halfSize * 1.8,
            z: (Math.random() - 0.5) * halfSize * 1.8,
            radius: 0.55 + Math.random() * 1.1,
        });
    }
    return holes;
}

function distToSegment(px: number, pz: number, seg: Segment): number {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.0001) return Math.hypot(px - seg.x1, pz - seg.z1);
    let t = ((px - seg.x1) * dx + (pz - seg.z1) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (seg.x1 + dx * t), pz - (seg.z1 + dz * t));
}

function buildBucket<T>(items: T[], getX: (t: T) => number, getZ: (t: T) => number, cellSize: number) {
    const map = new Map<string, T[]>();
    for (const item of items) {
        const cx = Math.floor(getX(item) / cellSize);
        const cz = Math.floor(getZ(item) / cellSize);
        const key = `${cx},${cz}`;
        const bucket = map.get(key);
        if (bucket) bucket.push(item);
        else map.set(key, [item]);
    }
    return { map, cellSize };
}

function nearbyItems<T>(bucket: { map: Map<string, T[]>; cellSize: number }, x: number, z: number): T[] {
    const cx = Math.floor(x / bucket.cellSize);
    const cz = Math.floor(z / bucket.cellSize);
    const results: T[] = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const bucketItems = bucket.map.get(`${cx + dx},${cz + dz}`);
            if (bucketItems) results.push(...bucketItems);
        }
    }
    return results;
}

function buildGroundGeometry() {
    const size = ARENA_HALF_SIZE * 2;
    const geometry = new PlaneGeometry(size, size, SEGMENTS, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);

    const cracks = generateCracks(60, ARENA_HALF_SIZE);
    const potholes = generatePotholes(26, ARENA_HALF_SIZE);
    const crackBucket = buildBucket(cracks, (s) => (s.x1 + s.x2) / 2, (s) => (s.z1 + s.z2) / 2, 4);
    const potholeBucket = buildBucket(potholes, (p) => p.x, (p) => p.z, 4);

    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const scratchColor = new Color();
    const scratchGrass = new Color();

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        const terrainY = getTerrainHeight(x, z);
        const seam = seamFactor(x, z);

        let crackDepth = 0;
        for (const seg of nearbyItems(crackBucket, x, z)) {
            const d = distToSegment(x, z, seg);
            if (d < CRACK_WIDTH) {
                crackDepth = Math.max(crackDepth, 1 - d / CRACK_WIDTH);
            }
        }

        let potholeDepth = 0;
        for (const hole of nearbyItems(potholeBucket, x, z)) {
            const d = Math.hypot(x - hole.x, z - hole.z);
            if (d < hole.radius) {
                potholeDepth = Math.max(potholeDepth, 1 - d / hole.radius);
            }
        }

        const heightDrop = (seam ? CRACK_HEIGHT : 0) + crackDepth * CRACK_HEIGHT * 1.6 + potholeDepth * POTHOLE_DEPTH;
        position.setY(i, terrainY - heightDrop);

        scratchColor.copy(BASE_COLOR);
        const elevation = Math.max(-1, Math.min(1, terrainY / TERRAIN_AMPLITUDE));
        if (elevation > 0) scratchColor.lerp(HIGH_GROUND_COLOR, elevation * 0.55);
        else if (elevation < 0) scratchColor.lerp(LOW_GROUND_COLOR, -elevation * 0.55);

        const overgrowth = getOvergrowth(x, z);
        const dirtAmount = smoothRange(overgrowth, 0.1, 0.32) * (1 - smoothRange(overgrowth, 0.32, 0.65)) * 0.4;
        if (dirtAmount > 0) scratchColor.lerp(DIRT_COLOR, dirtAmount);
        const grassAmount = smoothRange(overgrowth, 0.22, 0.6);
        if (grassAmount > 0) {
            scratchGrass.copy(GRASS_LUSH_COLOR).lerp(GRASS_DRY_COLOR, grassToneNoise(x, z) * 0.8);
            scratchColor.lerp(scratchGrass, grassAmount * 0.92);
        }

        const rubble = rubbleFactor(x, z);
        if (rubble > 0) scratchColor.lerp(RUBBLE_COLOR, Math.min(1, rubble) * 0.7 * (1 - grassAmount * 0.8));
        const weed = weedFactor(x, z);
        if (weed > 0) scratchColor.lerp(WEED_COLOR, Math.min(1, weed));
        const stain = stainFactor(x, z);
        if (stain > 0) scratchColor.lerp(STAIN_COLOR, Math.min(1, stain) * (1 - grassAmount * 0.85));
        if (crackDepth > 0) scratchColor.lerp(CRACK_COLOR, crackDepth * (1 - grassAmount * 0.5));
        if (potholeDepth > 0) scratchColor.lerp(POTHOLE_COLOR, potholeDepth);
        if (seam) {
            scratchColor.copy(SEAM_COLOR);
            if (grassAmount > 0) scratchColor.lerp(MOSS_SEAM_COLOR, grassAmount);
        }

        colors[i * 3] = scratchColor.r;
        colors[i * 3 + 1] = scratchColor.g;
        colors[i * 3 + 2] = scratchColor.b;
    }

    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
}

export function Ground() {
    const geometry = useMemo(buildGroundGeometry, []);

    return (
        <mesh geometry={geometry} receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.82} metalness={0.05} />
        </mesh>
    );
}
