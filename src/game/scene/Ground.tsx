import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PlaneGeometry, type Mesh } from 'three';
import { WATER_LEVEL } from '../data/constants.ts';
import { world } from '../state/world.ts';
import '../systems/obstacles.ts';
import { groundField } from '../systems/fields.ts';
import { createWaterMaterial } from '../systems/waterMaterial.ts';

const PRIME_RADIUS = 52;
const WATER_SPAN = 190;

export function Ground() {
    useLayoutEffect(() => {
        groundField.reset();
        groundField.prime(world.player.position.x, world.player.position.z, PRIME_RADIUS);
        return () => groundField.reset();
    }, []);

    useFrame(() => {
        groundField.update(world.player.position.x, world.player.position.z);
    });

    return <primitive object={groundField.root} />;
}

export function Water() {
    const meshRef = useRef<Mesh>(null!);
    const material = useMemo(() => createWaterMaterial(), []);
    const geometry = useMemo(() => {
        const plane = new PlaneGeometry(WATER_SPAN, WATER_SPAN);
        plane.rotateX(-Math.PI / 2);
        return plane;
    }, []);

    useFrame(() => {
        meshRef.current.position.set(Math.round(world.player.position.x), WATER_LEVEL, Math.round(world.player.position.z));
    });

    return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={2} frustumCulled={false} />;
}