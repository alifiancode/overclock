import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, ConeGeometry, CylinderGeometry, DoubleSide, InstancedMesh, Object3D, PointLight, SphereGeometry } from 'three';
import { lightSources } from '../systems/obstacles.ts';
import { world } from '../state/world.ts';

const POOL_SIZE = 6;
const dummy = new Object3D();
const colorScratch = new Color();

const torchSources = lightSources.filter((s) => s.kind === 'torch');
const lampSources = lightSources.filter((s) => s.kind === 'lamp');
const barrelSources = lightSources.filter((s) => s.kind === 'barrel');

function TorchVisuals() {
    const poleRef = useRef<InstancedMesh>(null!);
    const flameRef = useRef<InstancedMesh>(null!);
    const poleGeo = useMemo(() => new CylinderGeometry(0.035, 0.045, 0.9, 6), []);
    const flameGeo = useMemo(() => new ConeGeometry(0.09, 0.28, 6), []);
    const count = torchSources.length;

    useFrame(({ clock }) => {
        if (count === 0) return;
        const t = clock.elapsedTime;
        for (let i = 0; i < count; i++) {
            const s = torchSources[i];
            dummy.position.set(s.position[0], s.position[1] + 0.45, s.position[2]);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            poleRef.current.setMatrixAt(i, dummy.matrix);

            const flicker = 0.85 + Math.sin(t * 11 + s.seed) * 0.1 + Math.sin(t * 23 + s.seed * 1.7) * 0.05;
            dummy.position.set(s.position[0], s.position[1] + 0.95, s.position[2]);
            dummy.rotation.set(0, t * 0.6 + s.seed, 0);
            dummy.scale.setScalar(flicker);
            dummy.updateMatrix();
            flameRef.current.setMatrixAt(i, dummy.matrix);
        }
        poleRef.current.instanceMatrix.needsUpdate = true;
        flameRef.current.instanceMatrix.needsUpdate = true;
    });

    if (count === 0) return null;
    return (
        <>
            <instancedMesh ref={poleRef} args={[poleGeo, undefined, count]} count={count} castShadow frustumCulled={false}>
                <meshStandardMaterial color="#2e2822" roughness={0.9} />
            </instancedMesh>
            <instancedMesh ref={flameRef} args={[flameGeo, undefined, count]} count={count} frustumCulled={false}>
                <meshStandardMaterial color="#ffb347" emissive="#ff7a1a" emissiveIntensity={2.6} toneMapped={false} />
            </instancedMesh>
        </>
    );
}

function BarrelVisuals() {
    const bodyRef = useRef<InstancedMesh>(null!);
    const flameRef = useRef<InstancedMesh>(null!);
    const bodyGeo = useMemo(() => new CylinderGeometry(0.24, 0.2, 0.5, 8), []);
    const flameGeo = useMemo(() => new ConeGeometry(0.16, 0.4, 6), []);
    const count = barrelSources.length;

    useFrame(({ clock }) => {
        if (count === 0) return;
        const t = clock.elapsedTime;
        for (let i = 0; i < count; i++) {
            const s = barrelSources[i];
            dummy.position.set(s.position[0], s.position[1] + 0.25, s.position[2]);
            dummy.rotation.set(0, s.seed, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            bodyRef.current.setMatrixAt(i, dummy.matrix);

            const flicker = 0.82 + Math.sin(t * 10 + s.seed) * 0.12 + Math.sin(t * 19 + s.seed * 1.4) * 0.06;
            dummy.position.set(s.position[0], s.position[1] + 0.55, s.position[2]);
            dummy.rotation.set(0, t * 0.5 + s.seed, 0);
            dummy.scale.setScalar(flicker);
            dummy.updateMatrix();
            flameRef.current.setMatrixAt(i, dummy.matrix);
        }
        bodyRef.current.instanceMatrix.needsUpdate = true;
        flameRef.current.instanceMatrix.needsUpdate = true;
    });

    if (count === 0) return null;
    return (
        <>
            <instancedMesh ref={bodyRef} args={[bodyGeo, undefined, count]} count={count} castShadow receiveShadow frustumCulled={false}>
                <meshStandardMaterial color="#5a4632" roughness={0.85} metalness={0.35} />
            </instancedMesh>
            <instancedMesh ref={flameRef} args={[flameGeo, undefined, count]} count={count} frustumCulled={false}>
                <meshStandardMaterial color="#ffb347" emissive="#ff7a1a" emissiveIntensity={2.6} toneMapped={false} />
            </instancedMesh>
        </>
    );
}

function LampVisuals() {
    const bulbRef = useRef<InstancedMesh>(null!);
    const fixtureRef = useRef<InstancedMesh>(null!);
    const bulbGeo = useMemo(() => new SphereGeometry(0.09, 8, 6), []);
    const fixtureGeo = useMemo(() => new ConeGeometry(0.14, 0.16, 8, 1, true), []);
    const count = lampSources.length;

    useFrame(({ clock }) => {
        if (count === 0) return;
        const t = clock.elapsedTime;
        for (let i = 0; i < count; i++) {
            const s = lampSources[i];
            const flicker = 0.92 + Math.sin(t * 3 + s.seed) * 0.08;
            dummy.position.set(s.position[0], s.position[1], s.position[2]);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(flicker);
            dummy.updateMatrix();
            bulbRef.current.setMatrixAt(i, dummy.matrix);

            dummy.position.set(s.position[0], s.position[1] + 0.14, s.position[2]);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            fixtureRef.current.setMatrixAt(i, dummy.matrix);
        }
        bulbRef.current.instanceMatrix.needsUpdate = true;
        fixtureRef.current.instanceMatrix.needsUpdate = true;
    });

    if (count === 0) return null;
    return (
        <>
            <instancedMesh ref={bulbRef} args={[bulbGeo, undefined, count]} count={count} frustumCulled={false}>
                <meshStandardMaterial color="#fff0c0" emissive="#ffcf7a" emissiveIntensity={2.2} toneMapped={false} />
            </instancedMesh>
            <instancedMesh ref={fixtureRef} args={[fixtureGeo, undefined, count]} count={count} castShadow frustumCulled={false}>
                <meshStandardMaterial color="#3a342a" roughness={0.7} metalness={0.4} side={DoubleSide} />
            </instancedMesh>
        </>
    );
}

function LightPool() {
    const lightRefs = useRef<Array<PointLight | null>>([]);

    useFrame(({ clock }) => {
        const px = world.player.position.x;
        const pz = world.player.position.z;

        const nearest: { source: (typeof lightSources)[number]; distSq: number }[] = [];
        for (const s of lightSources) {
            const dx = s.position[0] - px;
            const dz = s.position[2] - pz;
            const distSq = dx * dx + dz * dz;
            if (nearest.length < POOL_SIZE) {
                nearest.push({ source: s, distSq });
                nearest.sort((a, b) => a.distSq - b.distSq);
            } else if (distSq < nearest[nearest.length - 1].distSq) {
                nearest[nearest.length - 1] = { source: s, distSq };
                nearest.sort((a, b) => a.distSq - b.distSq);
            }
        }

        const t = clock.elapsedTime;
        for (let i = 0; i < POOL_SIZE; i++) {
            const light = lightRefs.current[i];
            if (!light) continue;
            const entry = nearest[i];
            if (!entry) {
                light.intensity = 0;
                continue;
            }
            const s = entry.source;
            const isTorch = s.kind === 'torch' || s.kind === 'barrel';
            light.position.set(s.position[0], s.position[1] + (s.kind === 'torch' ? 0.9 : s.kind === 'barrel' ? 0.55 : 0), s.position[2]);
            light.color.copy(colorScratch.set(s.color));
            light.distance = isTorch ? 9 : 6;
            const flicker = isTorch ? 0.8 + Math.sin(t * 11 + s.seed) * 0.15 + Math.sin(t * 23 + s.seed * 1.7) * 0.08 : 0.94 + Math.sin(t * 3 + s.seed) * 0.06;
            light.intensity = (isTorch ? 3.4 : 2.4) * flicker;
        }
    });

    return (
        <>
            {Array.from({ length: POOL_SIZE }).map((_, i) => (
                <pointLight
                    key={i}
                    ref={(el) => {
                        lightRefs.current[i] = el;
                    }}
                    decay={2}
                />
            ))}
        </>
    );
}

export function Lighting() {
    return (
        <>
            <TorchVisuals />
            <BarrelVisuals />
            <LampVisuals />
            <LightPool />
        </>
    );
}
