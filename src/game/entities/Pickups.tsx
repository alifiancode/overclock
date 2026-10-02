import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { pickups, collectNearby, ammoWeaponIdFor, weaponIdForPickupKind, type PickupKind } from '../systems/pickups.ts';
import { world, pickUpAmmo, pickUpWeapon, sayLine } from '../state/world.ts';
import { WEAPONS, WEAPON_ORDER } from '../data/weapons.ts';

const MAX_PICKUPS = 80;
const dummy = new Object3D();
const CURRENCY_COLOR = '#ffd24a';

function colorForKind(kind: PickupKind): string {
    if (kind === 'currency') return CURRENCY_COLOR;
    const weaponId = ammoWeaponIdFor(kind) ?? weaponIdForPickupKind(kind);
    return weaponId ? WEAPONS[weaponId].color : '#ffffff';
}

function Pile({ kind }: { kind: PickupKind }) {
    const meshRef = useRef<InstancedMesh>(null!);
    const spinTime = useRef(0);
    const isWeapon = weaponIdForPickupKind(kind) !== null;

    useFrame((_, delta) => {
        spinTime.current += delta;
        const mesh = meshRef.current;
        let count = 0;
        for (let i = 0; i < pickups.length; i++) {
            if (pickups[i].kind !== kind) continue;
            const p = pickups[i];
            dummy.position.set(p.position.x, 0.5 + Math.sin(spinTime.current * 3 + p.id) * 0.1, p.position.z);
            dummy.rotation.set(0, spinTime.current * 2 + p.id, 0);
            dummy.scale.setScalar(isWeapon ? 1.6 : 1);
            dummy.updateMatrix();
            mesh.setMatrixAt(count, dummy.matrix);
            count++;
        }
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
    });

    const color = colorForKind(kind);
    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PICKUPS]} frustumCulled={false}>
            <octahedronGeometry args={[0.18]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
        </instancedMesh>
    );
}

export function Pickups() {
    useFrame(() => {
        const collected = collectNearby(world.player.position.x, world.player.position.z);
        for (const p of collected) {
            if (p.kind === 'currency') {
                world.currency += p.amount;
                world.run.currencyEarned += p.amount;
                continue;
            }
            const weaponPickup = weaponIdForPickupKind(p.kind);
            if (weaponPickup) {
                pickUpWeapon(weaponPickup);
                sayLine('weaponPickup');
                continue;
            }
            const weaponId = ammoWeaponIdFor(p.kind);
            if (weaponId) pickUpAmmo(weaponId, p.amount);
        }
    });

    return (
        <>
            <Pile kind="currency" />
            {WEAPON_ORDER.map((id) => (
                <Pile key={`ammo_${id}`} kind={`ammo_${id}`} />
            ))}
            {WEAPON_ORDER.map((id) => (
                <Pile key={`weapon_${id}`} kind={`weapon_${id}`} />
            ))}
        </>
    );
}
