import { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, InstancedMesh, Object3D, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARENA_HALF_SIZE } from '../data/constants.ts';
import { props as propList, grassClumps, flowerClusters } from '../systems/obstacles.ts';
import { getTerrainHeight } from '../systems/terrain.ts';

const BOUNDARY_PIECE_COUNT = 72;
const GRASS_SWAY_FREQ_A = 1.8;
const GRASS_SWAY_FREQ_B = 3.1;
const GRASS_SWAY_AMOUNT = 0.14;
const FLOWER_SWAY_AMOUNT = 0.08;
const GRASS_COLORS = ['#5c7a38', '#4a6b2b', '#83914c'];
const FLOWER_COLORS = ['#e8485f', '#f2c94c', '#9b6bd6', '#f4f1ea', '#f08a3c'];
const PROP_COLORS = ['#4a463f', '#5b4a3a', '#3f4649', '#57534b'];

const dummy = new Object3D();
const scratchColor = new Color();

function buildBoundaryTransforms() {
    const transforms: { position: [number, number, number]; rotationY: number; scale: [number, number, number] }[] = [];
    for (let i = 0; i < BOUNDARY_PIECE_COUNT; i++) {
        const angle = (i / BOUNDARY_PIECE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
        const radius = ARENA_HALF_SIZE - 1.5 + Math.random() * 1.5;
        const height = 1.4 + Math.random() * 2.6;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const groundY = getTerrainHeight(x, z);
        transforms.push({
            position: [x, groundY + height / 2, z],
            rotationY: Math.random() * Math.PI * 2,
            scale: [0.9 + Math.random() * 0.7, height, 0.9 + Math.random() * 0.7],
        });
    }
    return transforms;
}

function buildGrassClumpGeometry() {
    const blades: ConeGeometry[] = [];
    const bladeCount = 7;
    for (let i = 0; i < bladeCount; i++) {
        const height = 0.34 + Math.random() * 0.26;
        const blade = new ConeGeometry(0.03, height, 3);
        const angle = (i / bladeCount) * Math.PI * 2 + Math.random() * 0.6;
        const dist = Math.random() * 0.12;
        blade.translate(0, height / 2 - 0.02, 0);
        blade.rotateZ((Math.random() - 0.5) * 0.4);
        blade.rotateY(angle);
        blade.translate(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
        blades.push(blade);
    }
    return mergeGeometries(blades) ?? blades[0];
}

function buildFlowerStemGeometry() {
    const stem = new CylinderGeometry(0.012, 0.02, 0.36, 4);
    stem.translate(0, 0.18, 0);
    return stem;
}

function buildFlowerBloomGeometry() {
    const parts: SphereGeometry[] = [];
    const petalCount = 5;
    for (let i = 0; i < petalCount; i++) {
        const petal = new SphereGeometry(0.05, 5, 4);
        petal.scale(1, 0.45, 0.7);
        petal.translate(0.07, 0, 0);
        petal.rotateY((i / petalCount) * Math.PI * 2);
        parts.push(petal);
    }
    parts.push(new SphereGeometry(0.04, 5, 4));
    const merged = mergeGeometries(parts) ?? parts[0];
    merged.translate(0, 0.36, 0);
    return merged;
}

function updateGrassMatrices(mesh: InstancedMesh, t: number) {
    for (let i = 0; i < grassClumps.length; i++) {
        const g = grassClumps[i];
        const sway = Math.sin(t * GRASS_SWAY_FREQ_A + g.seed) * GRASS_SWAY_AMOUNT + Math.sin(t * GRASS_SWAY_FREQ_B + g.seed * 1.7) * GRASS_SWAY_AMOUNT * 0.4;
        dummy.position.set(g.position[0], g.position[1], g.position[2]);
        dummy.rotation.set(sway * 0.5, g.rotationY, sway);
        dummy.scale.setScalar(g.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
}

function updateFlowerMatrices(stems: InstancedMesh, blooms: InstancedMesh, t: number) {
    for (let i = 0; i < flowerClusters.length; i++) {
        const f = flowerClusters[i];
        const sway = Math.sin(t * GRASS_SWAY_FREQ_A * 0.75 + f.seed) * FLOWER_SWAY_AMOUNT + Math.sin(t * GRASS_SWAY_FREQ_B * 0.6 + f.seed * 1.3) * FLOWER_SWAY_AMOUNT * 0.4;
        dummy.position.set(f.position[0], f.position[1], f.position[2]);
        dummy.rotation.set(sway * 0.5, f.rotationY, sway);
        dummy.scale.setScalar(f.scale);
        dummy.updateMatrix();
        stems.setMatrixAt(i, dummy.matrix);
        blooms.setMatrixAt(i, dummy.matrix);
    }
    stems.instanceMatrix.needsUpdate = true;
    blooms.instanceMatrix.needsUpdate = true;
}

export function ArenaDressing() {
    const boundaryRef = useRef<InstancedMesh>(null!);
    const propsRef = useRef<InstancedMesh>(null!);
    const grassRef = useRef<InstancedMesh>(null!);
    const flowerStemRef = useRef<InstancedMesh>(null!);
    const flowerBloomRef = useRef<InstancedMesh>(null!);

    const boundaryGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
    const propGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
    const grassGeometry = useMemo(buildGrassClumpGeometry, []);
    const flowerStemGeometry = useMemo(buildFlowerStemGeometry, []);
    const flowerBloomGeometry = useMemo(buildFlowerBloomGeometry, []);
    const boundaryTransforms = useMemo(buildBoundaryTransforms, []);

    useLayoutEffect(() => {
        boundaryTransforms.forEach((t, i) => {
            dummy.position.set(...t.position);
            dummy.rotation.set(0, t.rotationY, 0);
            dummy.scale.set(...t.scale);
            dummy.updateMatrix();
            boundaryRef.current.setMatrixAt(i, dummy.matrix);
        });
        boundaryRef.current.instanceMatrix.needsUpdate = true;

        propList.forEach((prop, i) => {
            dummy.position.set(...prop.position);
            dummy.rotation.set(0, prop.rotationY, 0);
            dummy.scale.set(...prop.scale);
            dummy.updateMatrix();
            propsRef.current.setMatrixAt(i, dummy.matrix);
            scratchColor.set(PROP_COLORS[i % PROP_COLORS.length]);
            propsRef.current.setColorAt(i, scratchColor);
        });
        propsRef.current.instanceMatrix.needsUpdate = true;
        if (propsRef.current.instanceColor) propsRef.current.instanceColor.needsUpdate = true;

        grassClumps.forEach((g, i) => {
            scratchColor.set(GRASS_COLORS[g.variant % GRASS_COLORS.length]);
            grassRef.current.setColorAt(i, scratchColor);
        });
        if (grassRef.current.instanceColor) grassRef.current.instanceColor.needsUpdate = true;

        flowerClusters.forEach((f, i) => {
            scratchColor.set(FLOWER_COLORS[f.colorIndex % FLOWER_COLORS.length]);
            flowerBloomRef.current.setColorAt(i, scratchColor);
        });
        if (flowerBloomRef.current.instanceColor) flowerBloomRef.current.instanceColor.needsUpdate = true;

        updateGrassMatrices(grassRef.current, 0);
        updateFlowerMatrices(flowerStemRef.current, flowerBloomRef.current, 0);
    }, [boundaryTransforms]);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        updateGrassMatrices(grassRef.current, t);
        updateFlowerMatrices(flowerStemRef.current, flowerBloomRef.current, t);
    });

    return (
        <>
            <instancedMesh
                ref={boundaryRef}
                args={[boundaryGeometry, undefined, BOUNDARY_PIECE_COUNT]}
                castShadow
                receiveShadow
                frustumCulled={false}
            >
                <meshStandardMaterial color="#3d3a35" roughness={0.9} />
            </instancedMesh>
            <instancedMesh
                ref={propsRef}
                args={[propGeometry, undefined, propList.length]}
                castShadow
                receiveShadow
                frustumCulled={false}
            >
                <meshStandardMaterial color="#ffffff" roughness={0.85} />
            </instancedMesh>
            <instancedMesh ref={grassRef} args={[grassGeometry, undefined, grassClumps.length]} frustumCulled={false}>
                <meshStandardMaterial color="#ffffff" roughness={0.85} side={DoubleSide} />
            </instancedMesh>
            <instancedMesh ref={flowerStemRef} args={[flowerStemGeometry, undefined, flowerClusters.length]} frustumCulled={false}>
                <meshStandardMaterial color="#4c6b2c" roughness={0.9} />
            </instancedMesh>
            <instancedMesh ref={flowerBloomRef} args={[flowerBloomGeometry, undefined, flowerClusters.length]} frustumCulled={false}>
                <meshStandardMaterial color="#ffffff" roughness={0.65} />
            </instancedMesh>
        </>
    );
}
