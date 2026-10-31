import { useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { world } from '../state/world.ts';
import '../systems/obstacles.ts';
import { vegetationField } from '../systems/fields.ts';

const PRIME_RADIUS = 40;

export function ArenaDressing() {
    useLayoutEffect(() => {
        vegetationField.reset();
        vegetationField.prime(world.player.position.x, world.player.position.z, PRIME_RADIUS);
        return () => vegetationField.reset();
    }, []);

    useFrame(() => {
        vegetationField.update(world.player.position.x, world.player.position.z);
    });

    return <primitive object={vegetationField.root} />;
}