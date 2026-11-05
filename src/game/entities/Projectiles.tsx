import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, Vector3 } from 'three';
import { projectiles, updateProjectiles, TRAVEL_DURATION, MAX_PROJECTILES } from '../systems/projectiles.ts';

const dummy = new Object3D();
const current = new Vector3();
const colorScratch = new Color();

export function Projectiles() {
    const meshRef = useRef<InstancedMesh>(null!);

    useLayoutEffect(() => {
        meshRef.current.setColorAt(0, colorScratch.set('#ffffff'));
        meshRef.current.count = 0;
    }, []);

    useFrame((_, delta) => {
        updateProjectiles(delta);
        const mesh = meshRef.current;
        let visibleCount = 0;
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (!p.alive) continue;
            const t = Math.min(1, p.elapsed / TRAVEL_DURATION);
            current.lerpVectors(p.start, p.end, t);
            dummy.position.copy(current);
            dummy.scale.setScalar(p.size);
            dummy.updateMatrix();
            mesh.setMatrixAt(visibleCount, dummy.matrix);
            mesh.setColorAt(visibleCount, colorScratch.copy(p.color));
            visibleCount++;
        }
        mesh.count = visibleCount;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PROJECTILES]} frustumCulled={false}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial emissiveIntensity={3} toneMapped={false} />
        </instancedMesh>
    );
}