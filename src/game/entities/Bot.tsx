import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { world } from '../state/world.ts';
import { damageEnemy, type Enemy } from '../data/enemies.ts';
import { findNearestInGrid, findEnemiesInGrid } from '../systems/spatialGrid.ts';
import {
  BOT_FOLLOW_OFFSET,
  BOT_FOLLOW_LERP,
  TURRET_RANGE,
  TURRET_DAMAGE,
  TURRET_COOLDOWN,
  SHIELD_RECHARGE_SECONDS,
  SHIELD_MAX_CHARGE,
  HEALER_REGEN_PER_SECOND,
  PULSE_RADIUS,
  PULSE_DAMAGE,
  PULSE_INTERVAL,
  PULSE_VISUAL_DURATION,
} from '../data/constants.ts';

const LIGHT_COLOR = '#ffe066';
const HOVER_BOB_FREQ = 3;
const HOVER_BOB_AMPLITUDE = 0.12;
const TILT_MAX_ANGLE = 0.3;
const RECOIL_DURATION = 0.15;
const SHIELD_PULSE_DURATION = 0.3;
const HEALER_PULSE_FREQ = 2.5;
const IDLE_SPIN_SPEED = 0.5;
const TURRET_AIM_LERP = 0.18;
const SHIELD_ORBIT_SPEED = 1.1;
const PULSE_TUMBLE_SPEED_X = 0.9;
const PULSE_TUMBLE_SPEED_Y = 1.4;

const followTarget = new Vector3();

function shortAngleLerp(current: number, target: number, t: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * t;
}

export function Bot() {
  const groupRef = useRef<Group>(null!);
  const bobRef = useRef<Group>(null!);
  const muzzleFlashRef = useRef<Mesh>(null!);
  const shieldBubbleRef = useRef<Mesh>(null!);
  const pulseRingRef = useRef<Mesh>(null!);

  const turretGroupRef = useRef<Group>(null!);
  const turretYawRef = useRef<Group>(null!);
  const shieldGroupRef = useRef<Group>(null!);
  const shieldOrbitRef = useRef<Group>(null!);
  const healerGroupRef = useRef<Group>(null!);
  const healerCoreRef = useRef<Mesh>(null!);
  const pulseGroupRef = useRef<Group>(null!);
  const pulseKnotRef = useRef<Mesh>(null!);

  const attackCooldown = useRef(0);
  const shieldTimer = useRef(0);
  const previousShieldCharge = useRef(world.bot.shieldCharge);
  const recoilTimer = useRef(0);
  const shieldPulseTimer = useRef(0);
  const pulseTimer = useRef(0);
  const pulseVisualTimer = useRef(0);
  const animTime = useRef(0);

  useFrame((_, delta) => {
    if (!world.player.alive || world.pendingUpgradeChoices > 0) return;

    const group = groupRef.current;
    animTime.current += delta;

    followTarget.set(
      world.player.position.x + BOT_FOLLOW_OFFSET.x,
      world.player.position.y + BOT_FOLLOW_OFFSET.y,
      world.player.position.z + BOT_FOLLOW_OFFSET.z
    );

    const dx = followTarget.x - group.position.x;
    const dz = followTarget.z - group.position.z;
    group.rotation.z = Math.max(-TILT_MAX_ANGLE, Math.min(TILT_MAX_ANGLE, -dx * 2));
    group.rotation.x = Math.max(-TILT_MAX_ANGLE, Math.min(TILT_MAX_ANGLE, dz * 2));

    group.position.lerp(followTarget, BOT_FOLLOW_LERP);
    bobRef.current.position.y = Math.sin(animTime.current * HOVER_BOB_FREQ) * HOVER_BOB_AMPLITUDE;

    const activeModule = world.meta.selectedBotModule;
    turretGroupRef.current.visible = activeModule === 'turret';
    shieldGroupRef.current.visible = activeModule === 'shield';
    healerGroupRef.current.visible = activeModule === 'healer';
    pulseGroupRef.current.visible = activeModule === 'pulse';

    if (activeModule === 'turret') {
      attackCooldown.current -= delta;
      recoilTimer.current = Math.max(0, recoilTimer.current - delta);

      const sameSpace = (e: Enemy) => e.currentBuildingIndex === world.player.buildingIndex && e.currentFloor === world.player.currentFloor;
      const watchTarget = findNearestInGrid(group.position, TURRET_RANGE, sameSpace);
      const targetAngle = watchTarget
        ? Math.atan2(watchTarget.position.x - group.position.x, watchTarget.position.z - group.position.z)
        : turretYawRef.current.rotation.y + IDLE_SPIN_SPEED * delta;
      turretYawRef.current.rotation.y = shortAngleLerp(turretYawRef.current.rotation.y, targetAngle, watchTarget ? TURRET_AIM_LERP : 1);

      if (attackCooldown.current <= 0 && watchTarget) {
        damageEnemy(watchTarget, TURRET_DAMAGE);
        attackCooldown.current = TURRET_COOLDOWN;
        recoilTimer.current = RECOIL_DURATION;
      }
      const recoilCurve = recoilTimer.current > 0 ? Math.sin((recoilTimer.current / RECOIL_DURATION) * Math.PI) : 0;
      muzzleFlashRef.current.scale.setScalar(recoilCurve);
      turretGroupRef.current.scale.setScalar(1 - recoilCurve * 0.08);
      shieldBubbleRef.current.scale.setScalar(0);
      pulseRingRef.current.scale.setScalar(0);
    } else if (activeModule === 'shield') {
      shieldOrbitRef.current.rotation.y += SHIELD_ORBIT_SPEED * delta;
      shieldTimer.current += delta;
      if (shieldTimer.current >= SHIELD_RECHARGE_SECONDS && world.bot.shieldCharge < SHIELD_MAX_CHARGE) {
        shieldTimer.current = 0;
        world.bot.shieldCharge += 1;
      }

      if (world.bot.shieldCharge < previousShieldCharge.current) {
        shieldPulseTimer.current = SHIELD_PULSE_DURATION;
      }
      previousShieldCharge.current = world.bot.shieldCharge;
      shieldPulseTimer.current = Math.max(0, shieldPulseTimer.current - delta);

      const hasCharge = world.bot.shieldCharge > 0;
      const pulseCurve = shieldPulseTimer.current > 0 ? Math.sin((shieldPulseTimer.current / SHIELD_PULSE_DURATION) * Math.PI) : 0;
      shieldBubbleRef.current.scale.setScalar(hasCharge ? 1 + pulseCurve * 0.3 : 0);
      muzzleFlashRef.current.scale.setScalar(0);
      pulseRingRef.current.scale.setScalar(0);
    } else if (activeModule === 'healer') {
      healerGroupRef.current.rotation.y += IDLE_SPIN_SPEED * delta;
      if (world.player.health < world.player.maxHealth) {
        world.player.health = Math.min(world.player.maxHealth, world.player.health + HEALER_REGEN_PER_SECOND * delta);
        healerCoreRef.current.scale.setScalar(0.85 + Math.sin(animTime.current * HEALER_PULSE_FREQ) * 0.15);
      } else {
        healerCoreRef.current.scale.setScalar(1);
      }
      muzzleFlashRef.current.scale.setScalar(0);
      shieldBubbleRef.current.scale.setScalar(0);
      pulseRingRef.current.scale.setScalar(0);
    } else {

      pulseKnotRef.current.rotation.x += PULSE_TUMBLE_SPEED_X * delta;
      pulseKnotRef.current.rotation.y += PULSE_TUMBLE_SPEED_Y * delta;

      pulseTimer.current += delta;
      if (pulseTimer.current >= PULSE_INTERVAL) {
        pulseTimer.current = 0;
        const sameSpacePulse = (e: Enemy) => e.currentBuildingIndex === world.player.buildingIndex && e.currentFloor === world.player.currentFloor;
        const targets = findEnemiesInGrid(group.position, PULSE_RADIUS, Infinity, sameSpacePulse);
        for (const t of targets) damageEnemy(t, PULSE_DAMAGE);
        pulseVisualTimer.current = PULSE_VISUAL_DURATION;
      }
      pulseVisualTimer.current = Math.max(0, pulseVisualTimer.current - delta);
      if (pulseVisualTimer.current > 0) {
        const t = 1 - pulseVisualTimer.current / PULSE_VISUAL_DURATION;
        pulseRingRef.current.scale.setScalar(Math.max(0.001, t * PULSE_RADIUS));
        (pulseRingRef.current.material as MeshStandardMaterial).opacity = 0.8 * (1 - t);
      } else {
        pulseRingRef.current.scale.setScalar(0);
      }
      muzzleFlashRef.current.scale.setScalar(0);
      shieldBubbleRef.current.scale.setScalar(0);
    }
  });

  return (
    <group ref={groupRef} position={[2, 1.5, 2]}>
      <group ref={bobRef}>
        <group ref={turretGroupRef}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.16, 0.5]} />
            <meshStandardMaterial color="#5a6068" metalness={0.6} roughness={0.4} />
          </mesh>
          <group ref={turretYawRef} position={[0, 0.16, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.3, 0.18, 0.34]} />
              <meshStandardMaterial color="#4a4f56" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.02, 0.34]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.045, 0.045, 0.5, 8]} />
              <meshStandardMaterial color="#2e3236" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[-0.13, 0.11, 0.06]}>
              <boxGeometry args={[0.05, 0.05, 0.05]} />
              <meshStandardMaterial color={LIGHT_COLOR} emissive={LIGHT_COLOR} emissiveIntensity={2} toneMapped={false} />
            </mesh>
            <mesh position={[0.13, 0.11, 0.06]}>
              <boxGeometry args={[0.05, 0.05, 0.05]} />
              <meshStandardMaterial color={LIGHT_COLOR} emissive={LIGHT_COLOR} emissiveIntensity={2} toneMapped={false} />
            </mesh>
            <mesh ref={muzzleFlashRef} position={[0, 0.02, 0.6]} scale={0}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#ffe066" emissive="#ffe066" emissiveIntensity={2} toneMapped={false} />
            </mesh>
          </group>
          {[
            [-0.2, -0.2],
            [0.2, -0.2],
            [-0.2, 0.2],
            [0.2, 0.2],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, -0.06, z]}>
              <coneGeometry args={[0.04, 0.14, 4]} />
              <meshStandardMaterial color="#3a3e44" metalness={0.5} roughness={0.5} />
            </mesh>
          ))}
        </group>

        <group ref={shieldGroupRef}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial color="#6ec8ff" emissive="#2a6ca8" emissiveIntensity={0.7} metalness={0.2} roughness={0.15} />
          </mesh>
          <group ref={shieldOrbitRef}>
            {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a, i) => (
              <mesh key={i} position={[Math.cos(a) * 0.46, Math.sin(a * 1.3) * 0.12, Math.sin(a) * 0.46]} rotation={[a, a * 0.6, 0]} castShadow>
                <tetrahedronGeometry args={[0.09, 0]} />
                <meshStandardMaterial color="#a8e0ff" emissive="#4ba8e0" emissiveIntensity={1} />
              </mesh>
            ))}
          </group>
          <mesh ref={shieldBubbleRef} scale={0}>
            <sphereGeometry args={[0.6, 12, 8]} />
            <meshStandardMaterial color="#4be0f0" emissive="#4be0f0" emissiveIntensity={0.8} transparent opacity={0.25} />
          </mesh>
        </group>

        <group ref={healerGroupRef}>
          <mesh ref={healerCoreRef} castShadow>
            <sphereGeometry args={[0.3, 12, 10]} />
            <meshStandardMaterial color="#8fffb0" emissive="#3a9c5c" emissiveIntensity={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.29]}>
            <boxGeometry args={[0.18, 0.05, 0.03]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.29]}>
            <boxGeometry args={[0.05, 0.18, 0.03]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.015, 6, 20]} />
            <meshStandardMaterial color="#8fffb0" emissive="#8fffb0" emissiveIntensity={0.8} transparent opacity={0.5} />
          </mesh>
        </group>

        <group ref={pulseGroupRef}>
          <mesh ref={pulseKnotRef} castShadow>
            <torusKnotGeometry args={[0.2, 0.065, 64, 8]} />
            <meshStandardMaterial color="#ff6ec7" emissive="#c73a8f" emissiveIntensity={0.9} metalness={0.3} roughness={0.3} />
          </mesh>
        </group>

        <mesh ref={pulseRingRef} rotation={[Math.PI / 2, 0, 0]} scale={0}>
          <torusGeometry args={[1, 0.035, 8, 32]} />
          <meshStandardMaterial color="#ff6ec7" emissive="#ff6ec7" emissiveIntensity={1.5} transparent opacity={0.8} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
