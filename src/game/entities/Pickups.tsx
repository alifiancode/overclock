import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';
import { pickups, collectNearby, ammoWeaponIdFor, weaponIdForPickupKind } from '../systems/pickups.ts';
import { ammoGeometry, beaconGeometry, coinGeometry, gunGeometry } from '../systems/pickupGeo.ts';
import { pickupMaterial } from '../systems/materials.ts';
import { world, pickUpAmmo, pickUpWeapon, sayLine } from '../state/world.ts';
import { WEAPONS, WEAPON_ORDER, type WeaponId } from '../data/weapons.ts';
import { wrapDelta } from '../systems/wrap.ts';

const MAX_PER_PILE = 72;
const SHOW_RADIUS = 84;
const dummy = new Object3D();
const tint = new Color();

type Writer = (mesh: InstancedMesh, slot: number, x: number, y: number, z: number, id: number, t: number) => void;

function useCounter() {
    return useRef(0);
}

function visibleNear(kindMatches: (kind: string) => boolean, mesh: InstancedMesh, write: Writer, t: number) {
    const px = world.player.position.x;
    const pz = world.player.position.z;
    let slot = 0;
    for (let i = 0; i < pickups.length && slot < MAX_PER_PILE; i++) {
        const p = pickups[i];
        if (!kindMatches(p.kind)) continue;
        const dx = wrapDelta(p.position.x - px);
        const dz = wrapDelta(p.position.z - pz);
        if (dx * dx + dz * dz > SHOW_RADIUS * SHOW_RADIUS) continue;
        write(mesh, slot, px + dx, p.position.y, pz + dz, p.id, t);
        slot++;
    }
    mesh.count = slot;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function GunPile({ id }: { id: WeaponId }) {
    const meshRef = useRef<InstancedMesh>(null!);
    const geometry = useMemo(() => gunGeometry(id), [id]);
    const time = useCounter();
    const kind = `weapon_${id}`;

    useLayoutEffect(() => () => geometry.dispose(), [geometry]);

    useFrame((_, delta) => {
        time.current += delta;
        visibleNear(
            (k) => k === kind,
            meshRef.current,
            (mesh, slot, x, y, z, pid, t) => {
                dummy.position.set(x, y + 0.62 + Math.sin(t * 2.4 + pid) * 0.08, z);
                dummy.rotation.set(0, t * 1.4 + pid, Math.sin(t * 1.7 + pid) * 0.12);
                dummy.scale.setScalar(1.55);
                dummy.updateMatrix();
                mesh.setMatrixAt(slot, dummy.matrix);
            },
            time.current
        );
    });

    return <instancedMesh ref={meshRef} args={[geometry, pickupMaterial, MAX_PER_PILE]} count={0} frustumCulled={false} castShadow />;
}

function AmmoPile() {
    const meshRef = useRef<InstancedMesh>(null!);
    const geometry = useMemo(() => ammoGeometry(), []);
    const time = useCounter();

    useLayoutEffect(() => {
        meshRef.current.setColorAt(0, tint.set('#ffffff'));
        return () => geometry.dispose();
    }, [geometry]);

    useFrame((_, delta) => {
        time.current += delta;
        const px = world.player.position.x;
        const pz = world.player.position.z;
        const mesh = meshRef.current;
        let slot = 0;
        for (let i = 0; i < pickups.length && slot < MAX_PER_PILE; i++) {
            const p = pickups[i];
            const weaponId = ammoWeaponIdFor(p.kind);
            if (!weaponId) continue;
            const dx = wrapDelta(p.position.x - px);
            const dz = wrapDelta(p.position.z - pz);
            if (dx * dx + dz * dz > SHOW_RADIUS * SHOW_RADIUS) continue;
            dummy.position.set(px + dx, p.position.y + 0.04 + Math.max(0, Math.sin(time.current * 2 + p.id)) * 0.03, pz + dz);
            dummy.rotation.set(0, p.id * 1.7 + time.current * 0.35, 0);
            dummy.scale.setScalar(1.25);
            dummy.updateMatrix();
            mesh.setMatrixAt(slot, dummy.matrix);
            mesh.setColorAt(slot, tint.set(WEAPONS[weaponId].color));
            slot++;
        }
        mesh.count = slot;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return <instancedMesh ref={meshRef} args={[geometry, pickupMaterial, MAX_PER_PILE]} count={0} frustumCulled={false} castShadow />;
}

function CoinPile() {
    const meshRef = useRef<InstancedMesh>(null!);
    const geometry = useMemo(() => coinGeometry(), []);
    const time = useCounter();

    useLayoutEffect(() => () => geometry.dispose(), [geometry]);

    useFrame((_, delta) => {
        time.current += delta;
        visibleNear(
            (k) => k === 'currency',
            meshRef.current,
            (mesh, slot, x, y, z, pid, t) => {
                dummy.position.set(x, y + 0.55 + Math.sin(t * 3 + pid) * 0.1, z);
                dummy.rotation.set(0, t * 2.4 + pid, 0);
                dummy.scale.setScalar(1.15);
                dummy.updateMatrix();
                mesh.setMatrixAt(slot, dummy.matrix);
            },
            time.current
        );
    });

    return <instancedMesh ref={meshRef} args={[geometry, pickupMaterial, MAX_PER_PILE]} count={0} frustumCulled={false} />;
}

function Beacons() {
    const meshRef = useRef<InstancedMesh>(null!);
    const geometry = useMemo(() => beaconGeometry(), []);
    const material = useMemo(() => new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0.55 }), []);
    const time = useCounter();

    useLayoutEffect(() => {
        meshRef.current.setColorAt(0, tint.set('#ffffff'));
        return () => {
            geometry.dispose();
            material.dispose();
        };
    }, [geometry, material]);

    useFrame((_, delta) => {
        time.current += delta;
        const px = world.player.position.x;
        const pz = world.player.position.z;
        const mesh = meshRef.current;
        let slot = 0;
        for (let i = 0; i < pickups.length && slot < MAX_PER_PILE; i++) {
            const p = pickups[i];
            const weaponId = weaponIdForPickupKind(p.kind);
            if (!weaponId) continue;
            const dx = wrapDelta(p.position.x - px);
            const dz = wrapDelta(p.position.z - pz);
            if (dx * dx + dz * dz > SHOW_RADIUS * SHOW_RADIUS) continue;
            const pulse = 0.9 + Math.sin(time.current * 3 + p.id) * 0.1;
            dummy.position.set(px + dx, p.position.y, pz + dz);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(pulse, 1, pulse);
            dummy.updateMatrix();
            mesh.setMatrixAt(slot, dummy.matrix);
            mesh.setColorAt(slot, tint.set(WEAPONS[weaponId].color));
            slot++;
        }
        mesh.count = slot;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return <instancedMesh ref={meshRef} args={[geometry, material, MAX_PER_PILE]} count={0} frustumCulled={false} renderOrder={3} />;
}

export function Pickups() {
    useFrame(() => {
        const collected = collectNearby(world.player.position.x, world.player.position.z, world.player.position.y + 0.3);
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
            <CoinPile />
            <AmmoPile />
            {WEAPON_ORDER.map((id) => (
                <GunPile key={id} id={id} />
            ))}
            <Beacons />
        </>
    );
}