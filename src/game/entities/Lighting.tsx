import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, ConeGeometry, CylinderGeometry, DoubleSide, InstancedMesh, Object3D, SphereGeometry, Vector3, type AmbientLight, type DirectionalLight, type HemisphereLight, type PointLight } from 'three';
import { lightSources, type LightSource } from '../systems/obstacles.ts';
import { world } from '../state/world.ts';
import { fx } from '../systems/shaderFx.ts';
import { wrapDelta, wrapNear } from '../systems/wrap.ts';

const POOL_SIZE = 3;
const NEAR_RADIUS = 96;
const POOL_RADIUS = 30;
const SHADOW_SPAN = 28;
const SHADOW_MAP = 1024;
const SHADOW_TEXEL = (SHADOW_SPAN * 2) / SHADOW_MAP;
const AMBIENT_OUTDOOR = 0.66;
const AMBIENT_INDOOR = 0.95;
const HEMI_OUTDOOR = 0.5;
const HEMI_INDOOR = 0.5;
const SUN_OUTDOOR = 1.35;
const SUN_INDOOR = 0.45;

const dummy = new Object3D();
const colorScratch = new Color();
const sunOffset = new Vector3(8, 15, 5).normalize().multiplyScalar(70);
const sunDirection = sunOffset.clone().normalize();
const sunRight = new Vector3().crossVectors(new Vector3(0, 1, 0), sunDirection).normalize();
const sunUp = new Vector3().crossVectors(sunDirection, sunRight).normalize();
const snapped = new Vector3();

const torchSources = lightSources.filter((s) => s.kind === 'torch');
const lampSources = lightSources.filter((s) => s.kind === 'lamp');
const barrelSources = lightSources.filter((s) => s.kind === 'barrel');
const visibleScratch = new Int32Array(Math.max(1, torchSources.length, lampSources.length, barrelSources.length));

const poolIndex = new Int32Array(POOL_SIZE);
const poolDistance = new Float32Array(POOL_SIZE);

function gather(list: readonly LightSource[], px: number, pz: number): number {
    let n = 0;
    const limit = NEAR_RADIUS * NEAR_RADIUS;
    for (let i = 0; i < list.length; i++) {
        const dx = wrapDelta(list[i].position[0] - px);
        const dz = wrapDelta(list[i].position[2] - pz);
        if (dx * dx + dz * dz < limit) visibleScratch[n++] = i;
    }
    return n;
}

function TorchVisuals() {
    const poleRef = useRef<InstancedMesh>(null!);
    const flameRef = useRef<InstancedMesh>(null!);
    const poleGeo = useMemo(() => new CylinderGeometry(0.035, 0.045, 0.9, 6), []);
    const flameGeo = useMemo(() => new ConeGeometry(0.09, 0.28, 6), []);
    const total = torchSources.length;

    useFrame(({ clock }) => {
        if (total === 0) return;
        const t = clock.elapsedTime;
        const px = world.player.position.x;
        const pz = world.player.position.z;
        const n = gather(torchSources, px, pz);
        for (let k = 0; k < n; k++) {
            const s = torchSources[visibleScratch[k]];
            const x = wrapNear(s.position[0], px);
            const z = wrapNear(s.position[2], pz);
            dummy.position.set(x, s.position[1] + 0.45, z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            poleRef.current.setMatrixAt(k, dummy.matrix);

            const flicker = 0.85 + Math.sin(t * 11 + s.seed) * 0.1 + Math.sin(t * 23 + s.seed * 1.7) * 0.05;
            dummy.position.set(x, s.position[1] + 0.95, z);
            dummy.rotation.set(0, t * 0.6 + s.seed, 0);
            dummy.scale.setScalar(flicker);
            dummy.updateMatrix();
            flameRef.current.setMatrixAt(k, dummy.matrix);
        }
        poleRef.current.count = n;
        flameRef.current.count = n;
        poleRef.current.instanceMatrix.needsUpdate = true;
        flameRef.current.instanceMatrix.needsUpdate = true;
    });

    if (total === 0) return null;
    return (
        <>
            <instancedMesh ref={poleRef} args={[poleGeo, undefined, total]} count={0} castShadow frustumCulled={false}>
                <meshStandardMaterial color="#2e2822" roughness={0.9} />
            </instancedMesh>
            <instancedMesh ref={flameRef} args={[flameGeo, undefined, total]} count={0} frustumCulled={false}>
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
    const total = barrelSources.length;

    useFrame(({ clock }) => {
        if (total === 0) return;
        const t = clock.elapsedTime;
        const px = world.player.position.x;
        const pz = world.player.position.z;
        const n = gather(barrelSources, px, pz);
        for (let k = 0; k < n; k++) {
            const s = barrelSources[visibleScratch[k]];
            const x = wrapNear(s.position[0], px);
            const z = wrapNear(s.position[2], pz);
            dummy.position.set(x, s.position[1] + 0.25, z);
            dummy.rotation.set(0, s.seed, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            bodyRef.current.setMatrixAt(k, dummy.matrix);

            const flicker = 0.82 + Math.sin(t * 10 + s.seed) * 0.12 + Math.sin(t * 19 + s.seed * 1.4) * 0.06;
            dummy.position.set(x, s.position[1] + 0.55, z);
            dummy.rotation.set(0, t * 0.5 + s.seed, 0);
            dummy.scale.setScalar(flicker);
            dummy.updateMatrix();
            flameRef.current.setMatrixAt(k, dummy.matrix);
        }
        bodyRef.current.count = n;
        flameRef.current.count = n;
        bodyRef.current.instanceMatrix.needsUpdate = true;
        flameRef.current.instanceMatrix.needsUpdate = true;
    });

    if (total === 0) return null;
    return (
        <>
            <instancedMesh ref={bodyRef} args={[bodyGeo, undefined, total]} count={0} castShadow receiveShadow frustumCulled={false}>
                <meshStandardMaterial color="#5a4632" roughness={0.85} metalness={0.35} />
            </instancedMesh>
            <instancedMesh ref={flameRef} args={[flameGeo, undefined, total]} count={0} frustumCulled={false}>
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
    const total = lampSources.length;

    useFrame(({ clock }) => {
        if (total === 0) return;
        const t = clock.elapsedTime;
        const px = world.player.position.x;
        const pz = world.player.position.z;
        const n = gather(lampSources, px, pz);
        for (let k = 0; k < n; k++) {
            const s = lampSources[visibleScratch[k]];
            const x = wrapNear(s.position[0], px);
            const z = wrapNear(s.position[2], pz);
            const flicker = 0.92 + Math.sin(t * 3 + s.seed) * 0.08;
            dummy.position.set(x, s.position[1], z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(flicker);
            dummy.updateMatrix();
            bulbRef.current.setMatrixAt(k, dummy.matrix);

            dummy.position.set(x, s.position[1] + 0.14, z);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            fixtureRef.current.setMatrixAt(k, dummy.matrix);
        }
        bulbRef.current.count = n;
        fixtureRef.current.count = n;
        bulbRef.current.instanceMatrix.needsUpdate = true;
        fixtureRef.current.instanceMatrix.needsUpdate = true;
    });

    if (total === 0) return null;
    return (
        <>
            <instancedMesh ref={bulbRef} args={[bulbGeo, undefined, total]} count={0} frustumCulled={false}>
                <meshStandardMaterial color="#fff0c0" emissive="#ffcf7a" emissiveIntensity={2.2} toneMapped={false} />
            </instancedMesh>
            <instancedMesh ref={fixtureRef} args={[fixtureGeo, undefined, total]} count={0} castShadow frustumCulled={false}>
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

        poolDistance.fill(Infinity);
        poolIndex.fill(-1);
        const limit = POOL_RADIUS * POOL_RADIUS;
        for (let i = 0; i < lightSources.length; i++) {
            const s = lightSources[i];
            const dx = wrapDelta(s.position[0] - px);
            const dz = wrapDelta(s.position[2] - pz);
            const distSq = dx * dx + dz * dz;
            if (distSq > limit || distSq >= poolDistance[POOL_SIZE - 1]) continue;
            let slot = POOL_SIZE - 1;
            while (slot > 0 && poolDistance[slot - 1] > distSq) {
                poolDistance[slot] = poolDistance[slot - 1];
                poolIndex[slot] = poolIndex[slot - 1];
                slot--;
            }
            poolDistance[slot] = distSq;
            poolIndex[slot] = i;
        }

        const t = clock.elapsedTime;
        for (let i = 0; i < POOL_SIZE; i++) {
            const light = lightRefs.current[i];
            if (!light) continue;
            if (poolIndex[i] < 0) {
                light.intensity = 0;
                continue;
            }
            const s = lightSources[poolIndex[i]];
            const isTorch = s.kind === 'torch' || s.kind === 'barrel';
            light.position.set(wrapNear(s.position[0], px), s.position[1] + (s.kind === 'torch' ? 0.9 : s.kind === 'barrel' ? 0.55 : 0), wrapNear(s.position[2], pz));
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
                    intensity={0}
                    decay={2}
                />
            ))}
        </>
    );
}

export function SceneLights() {
    const ambientRef = useRef<AmbientLight>(null!);
    const hemiRef = useRef<HemisphereLight>(null!);
    const sunRef = useRef<DirectionalLight>(null!);

    useLayoutEffect(() => {
        const sun = sunRef.current;
        const cam = sun.shadow.camera;
        cam.left = -SHADOW_SPAN;
        cam.right = SHADOW_SPAN;
        cam.top = SHADOW_SPAN;
        cam.bottom = -SHADOW_SPAN;
        cam.near = 1;
        cam.far = 160;
        cam.updateProjectionMatrix();
    }, []);

    useFrame(() => {
        const k = fx.uIndoor.value;
        ambientRef.current.intensity = AMBIENT_OUTDOOR + (AMBIENT_INDOOR - AMBIENT_OUTDOOR) * k;
        hemiRef.current.intensity = HEMI_OUTDOOR + (HEMI_INDOOR - HEMI_OUTDOOR) * k;
        const sun = sunRef.current;
        sun.intensity = SUN_OUTDOOR + (SUN_INDOOR - SUN_OUTDOOR) * k;

        const p = world.player.position;
        const a = Math.round((p.x * sunRight.x + p.y * sunRight.y + p.z * sunRight.z) / SHADOW_TEXEL) * SHADOW_TEXEL;
        const b = Math.round((p.x * sunUp.x + p.y * sunUp.y + p.z * sunUp.z) / SHADOW_TEXEL) * SHADOW_TEXEL;
        const c = p.x * sunDirection.x + p.y * sunDirection.y + p.z * sunDirection.z;
        snapped.set(
            sunRight.x * a + sunUp.x * b + sunDirection.x * c,
            sunRight.y * a + sunUp.y * b + sunDirection.y * c,
            sunRight.z * a + sunUp.z * b + sunDirection.z * c
        );
        sun.target.position.copy(snapped);
        sun.target.updateMatrixWorld();
        sun.position.copy(snapped).add(sunOffset);
    });

    return (
        <>
            <ambientLight ref={ambientRef} intensity={AMBIENT_OUTDOOR} color="#a3a58f" />
            <hemisphereLight ref={hemiRef} args={['#9cb89a', '#4a4228', HEMI_OUTDOOR]} />
            <directionalLight ref={sunRef} intensity={SUN_OUTDOOR} color="#e8dcaa" position={[8, 15, 5]} castShadow shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]} shadow-bias={-0.0004} shadow-normalBias={0.05} />
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