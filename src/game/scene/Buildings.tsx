import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { world } from '../state/world.ts';
import '../systems/obstacles.ts';
import { buildingField } from '../systems/buildingField.ts';
import { DOOR_MAX_ANGLE, DOOR_TONES, doors, updateDoors } from '../systems/doors.ts';
import { JAMB_INSET, buildDoorLeaf } from '../systems/doorGeo.ts';
import { doorMaterial } from '../systems/materials.ts';
import { wrapDelta } from '../systems/wrap.ts';

const PRIME_RADIUS = 56;
const DOOR_SHOW_RADIUS = 80;
const MAX_LEAVES = 96;

const TONE_COLORS = [0x9a6a3e, 0x7a5030, 0x4a7058, 0x6a82b0, 0xd8d0c0, 0x92403a].map((hex) => new Color(hex));
const dummy = new Object3D();

function writeLeaf(mesh: InstancedMesh, slot: number, hx: number, hy: number, hz: number, dirX: number, dirZ: number, width: number, tone: number) {
    dummy.position.set(hx, hy, hz);
    dummy.rotation.set(0, Math.atan2(-dirZ, dirX), 0);
    dummy.scale.set(width, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(slot, dummy.matrix);
    mesh.setColorAt(slot, TONE_COLORS[tone % DOOR_TONES]);
}

function Doors() {
    const meshRef = useRef<InstancedMesh>(null!);
    const geometry = useMemo(() => buildDoorLeaf(), []);

    useLayoutEffect(() => {
        meshRef.current.setColorAt(0, TONE_COLORS[0]);
        return () => geometry.dispose();
    }, [geometry]);

    useFrame((_, delta) => {
        updateDoors(delta);
        const mesh = meshRef.current;
        const px = world.player.position.x;
        const pz = world.player.position.z;
        let slot = 0;
        for (let i = 0; i < doors.length && slot < MAX_LEAVES - 1; i++) {
            const d = doors[i];
            const dx = wrapDelta(d.x - px);
            const dz = wrapDelta(d.z - pz);
            if (dx * dx + dz * dz > DOOR_SHOW_RADIUS * DOOR_SHOW_RADIUS) continue;
            const cx = px + dx;
            const cz = pz + dz;
            const tx = -d.nz;
            const tz = d.nx;
            const reach = d.width / 2 - JAMB_INSET;
            const leafWidth = (d.width - JAMB_INSET * 2) / d.leaves;
            const beta = d.openAmount * DOOR_MAX_ANGLE;
            const cosB = Math.cos(beta);
            const sinB = Math.sin(beta);
            writeLeaf(mesh, slot++, cx - tx * reach, d.y, cz - tz * reach, tx * cosB - d.nx * sinB, tz * cosB - d.nz * sinB, leafWidth, d.tone);
            if (d.leaves === 2) writeLeaf(mesh, slot++, cx + tx * reach, d.y, cz + tz * reach, -tx * cosB - d.nx * sinB, -tz * cosB - d.nz * sinB, leafWidth, d.tone);
        }
        mesh.count = slot;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return <instancedMesh ref={meshRef} args={[geometry, doorMaterial, MAX_LEAVES]} count={0} frustumCulled={false} castShadow receiveShadow />;
}

export function Buildings() {
    useLayoutEffect(() => {
        buildingField.reset();
        const p = world.player.position;
        buildingField.prime(p.x, p.z, world.player.buildingIndex, PRIME_RADIUS);
        return () => buildingField.reset();
    }, []);

    useFrame(() => {
        const p = world.player.position;
        buildingField.update(p.x, p.z, world.player.buildingIndex);
    });

    return (
        <>
            <primitive object={buildingField.root} />
            <Doors />
        </>
    );
}