import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { world, sayLine, startReload, updateReload, switchWeapon } from '../state/world.ts';
import { PLAYABLE_RADIUS, PLAYER_MOVE_SPEED, PLAYER_Y_LERP } from '../data/constants.ts';
import { damageEnemy, type Enemy } from '../data/enemies.ts';
import { findNearestInGrid, findEnemiesInGrid } from '../systems/spatialGrid.ts';
import { resolvePropCollision, resolveFloor } from '../systems/obstacles.ts';
import { fireProjectile } from '../systems/projectiles.ts';
import { WEAPONS } from '../data/weapons.ts';
import { resolveDoorCollision, tryToggleNearestDoor, updateDoors } from '../systems/doors.ts';

const LOW_HEALTH_FRACTION = 0.25;
const IDLE_SECONDS_BEFORE_LINE = 8;
const ACCENT_COLOR = '#4f8fff';
const TRIM_COLOR = '#1a1a22';
const GUN_COLOR = '#2b2b33';
const BASE_STRIDE_FREQ = 8;
const MAX_STRIDE_MULTIPLIER = 2.5;
const STRIDE_AMPLITUDE = 0.6;
const ARM_SWING_RATIO = 0.7;
const RUN_LEAN_SPEED_RATIO = 1.3;
const RUN_LEAN_ANGLE = 0.2;
const IDLE_BOB_FREQ = 2;
const IDLE_BOB_AMPLITUDE = 0.02;
const IDLE_LOOK_FREQ = 0.6;
const IDLE_LOOK_AMPLITUDE = 0.18;
const MELEE_THRESHOLD = 2.5;
const PUNCH_DURATION = 0.25;
const SHOOT_DURATION = 0.3;
const PUNCH_ANGLE = 1.1;
const PUNCH_TWIST_ANGLE = 0.3;
const SHOOT_RAISE_ANGLE = 1.5;
const SHOOT_FOREARM_EXTEND = 0.05;
const SHOOT_SUPPORT_ARM_ANGLE = 1.15;
const SHOOT_SUPPORT_FOREARM_BEND = 1.3;
const RELOAD_LOWER_ANGLE = 0.7;
const RELOAD_REACH_ANGLE = 1.0;
const RELOAD_FOREARM_BEND = 0.9;
const ELBOW_REST_BEND = 0.3;
const ELBOW_PUNCH_EXTEND = 0.1;
const DEATH_ANIM_DURATION = 1;
const HIT_FLASH_DURATION = 0.2;
const KNEE_BEND_AMOUNT = 0.9;
const WALK_BOB_AMPLITUDE = 0.045;

export function Player() {
  const groupRef = useRef<Group>(null!);
  const upperBodyRef = useRef<Group>(null!);
  const headRef = useRef<Group>(null!);
  const leftLegRef = useRef<Group>(null!);
  const rightLegRef = useRef<Group>(null!);
  const leftKneeRef = useRef<Group>(null!);
  const rightKneeRef = useRef<Group>(null!);
  const leftArmRef = useRef<Group>(null!);
  const rightArmRef = useRef<Group>(null!);
  const leftForearmRef = useRef<Group>(null!); 
  const rightForearmRef = useRef<Group>(null!);
  const muzzleFlashRef = useRef<Mesh>(null!);
  const gunAccentRef = useRef<Mesh>(null!);
  const hitFlashRef = useRef<Mesh>(null!);
  const keys = useKeyboard();
  const attackCooldown = useRef(0);
  const lowHealthWarned = useRef(false);
  const idleSeconds = useRef(0);
  const idleWarned = useRef(false);
  const animTime = useRef(0);
  const attackAnimTimer = useRef(0);
  const attackAnimType = useRef<'punch' | 'shoot'>('punch');
  const deathAnimTimer = useRef(0);
  const previousHealth = useRef(world.player.health);
  const hitFlashTimer = useRef(0);

  useFrame((_, delta) => {
    if (!world.player.alive) {
      if (deathAnimTimer.current < DEATH_ANIM_DURATION) {
        deathAnimTimer.current += delta;
        const progress = Math.min(1, deathAnimTimer.current / DEATH_ANIM_DURATION);
        groupRef.current.rotation.z = progress * (Math.PI / 2);
      }
      if (hitFlashTimer.current > 0) {
        hitFlashTimer.current -= delta;
        hitFlashRef.current.scale.setScalar(Math.max(0, hitFlashTimer.current) / HIT_FLASH_DURATION);
      } else {
        hitFlashRef.current.scale.setScalar(0);
      }
      return;
    }
    if (world.pendingUpgradeChoices > 0) return;

    if (world.player.regenPerSecond > 0 && world.player.health < world.player.maxHealth) {
      world.player.health = Math.min(world.player.maxHealth, world.player.health + world.player.regenPerSecond * delta);
    }
    const group = groupRef.current;
    const equippedColor = WEAPONS[world.player.equippedWeapon].color;
    const accentMat = gunAccentRef.current.material as MeshStandardMaterial;
    if (accentMat.color.getHexString() !== equippedColor.replace('#', '')) {
      accentMat.color.set(equippedColor);
      accentMat.emissive.set(equippedColor);
    }
    const { forward, back, left, right } = keys.current;

    let moveX = 0;
    let moveZ = 0;
    if (forward) moveZ -= 1;
    if (back) moveZ += 1;
    if (left) moveX -= 1;
    if (right) moveX += 1;

    const isMoving = moveX !== 0 || moveZ !== 0;
    if (isMoving) {
      const length = Math.hypot(moveX, moveZ);
      moveX /= length;
      moveZ /= length;

      const angle = world.camera.angle;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const rotatedX = moveX * sin + moveZ * cos;
      const rotatedZ = -moveX * cos + moveZ * sin;

      let nextX = group.position.x + rotatedX * world.player.moveSpeed * delta;
      let nextZ = group.position.z + rotatedZ * world.player.moveSpeed * delta;

      const distFromCenter = Math.hypot(nextX, nextZ);
      if (distFromCenter > PLAYABLE_RADIUS) {
        const scale = PLAYABLE_RADIUS / distFromCenter;
        nextX *= scale;
        nextZ *= scale;
      }
      const propResolved = resolvePropCollision(nextX, nextZ, world.player.currentFloor);
      const resolved = resolveDoorCollision(propResolved.x, propResolved.z);
      group.position.x = resolved.x;
      group.position.z = resolved.z;
      group.rotation.y = Math.atan2(rotatedX, rotatedZ);
    }

    updateDoors(delta);
    if (keys.current.interactPressed) {
      keys.current.interactPressed = false;
      tryToggleNearestDoor(group.position.x, group.position.z);
    }

    const floorResult = resolveFloor(group.position.x, group.position.z, world.player.currentFloor);
    world.player.currentFloor = floorResult.floor;
    world.player.buildingIndex = floorResult.buildingIndex;
    group.position.y += (floorResult.y - 0.3 - group.position.y) * PLAYER_Y_LERP;

    world.player.position.copy(group.position);
    animTime.current += delta;
    const speedRatio = world.player.moveSpeed / PLAYER_MOVE_SPEED;
    const strideFreq = Math.min(speedRatio, MAX_STRIDE_MULTIPLIER) * BASE_STRIDE_FREQ;
    const swing = isMoving ? Math.sin(animTime.current * strideFreq) * STRIDE_AMPLITUDE : 0;

    if (isMoving) {
      leftLegRef.current.rotation.x = swing;
      rightLegRef.current.rotation.x = -swing;
      leftKneeRef.current.rotation.x = Math.max(0, Math.sin(animTime.current * strideFreq)) * KNEE_BEND_AMOUNT;
      rightKneeRef.current.rotation.x = Math.max(0, -Math.sin(animTime.current * strideFreq)) * KNEE_BEND_AMOUNT;
      const walkBob = -Math.abs(Math.sin(animTime.current * strideFreq)) * WALK_BOB_AMPLITUDE;
      upperBodyRef.current.rotation.x = speedRatio > RUN_LEAN_SPEED_RATIO ? RUN_LEAN_ANGLE : 0;
      upperBodyRef.current.position.y = 1 + walkBob;
      headRef.current.rotation.y = 0;
    } else {
      const bob = Math.sin(animTime.current * IDLE_BOB_FREQ) * IDLE_BOB_AMPLITUDE;
      leftLegRef.current.rotation.x = 0;
      rightLegRef.current.rotation.x = 0;
      leftKneeRef.current.rotation.x = 0;
      rightKneeRef.current.rotation.x = 0;
      upperBodyRef.current.rotation.x = 0;
      upperBodyRef.current.position.y = 1 + bob;
      headRef.current.rotation.y = Math.sin(animTime.current * IDLE_LOOK_FREQ) * IDLE_LOOK_AMPLITUDE;
    }
    leftArmRef.current.rotation.x = -swing * ARM_SWING_RATIO;
    rightArmRef.current.rotation.x = swing * ARM_SWING_RATIO;
    leftForearmRef.current.rotation.x = ELBOW_REST_BEND;
    attackCooldown.current -= delta;

    if (attackCooldown.current <= 0) {
      const sameSpace = (e: Enemy) => e.currentBuildingIndex === world.player.buildingIndex && e.currentFloor === world.player.currentFloor;
      const target = findNearestInGrid(group.position, world.player.attackRange, sameSpace);
      if (target) {
        const distance = group.position.distanceTo(target.position);
        const isMelee = distance < MELEE_THRESHOLD;
        const toTargetX = target.position.x - group.position.x;
        const toTargetZ = target.position.z - group.position.z;

        if (isMelee) {
          damageEnemy(target, world.player.attackDamage);
          attackCooldown.current = world.player.attackCooldown;
          group.rotation.y = Math.atan2(toTargetX, toTargetZ);
          attackAnimType.current = 'punch';
          attackAnimTimer.current = PUNCH_DURATION;
        } else if (!world.player.isReloading) {
          const ammo = world.player.ammo[world.player.equippedWeapon];
          if (ammo.current > 0) {
            ammo.current -= 1;
            const weapon = WEAPONS[world.player.equippedWeapon];
            attackCooldown.current = world.player.attackCooldown;
            group.rotation.y = Math.atan2(toTargetX, toTargetZ);
            attackAnimType.current = 'shoot';
            attackAnimTimer.current = SHOOT_DURATION;
            const muzzleX = group.position.x + Math.sin(group.rotation.y) * 0.6;
            const muzzleZ = group.position.z + Math.cos(group.rotation.y) * 0.6;
            const muzzleY = group.position.y + 0.7;

            if (weapon.kind === 'spread') {
              const targets = findEnemiesInGrid(group.position, weapon.range, weapon.pellets ?? 1, sameSpace);
              for (const t of targets) {
                damageEnemy(t, world.player.attackDamage);
                fireProjectile(muzzleX, muzzleY, muzzleZ, t.position.x, t.position.y + 0.4, t.position.z, weapon.color, 0.85);
              }
            } else if (weapon.kind === 'splash') {
              fireProjectile(muzzleX, muzzleY, muzzleZ, target.position.x, target.position.y + 0.4, target.position.z, weapon.color, 1.7);
              const splashed = weapon.splashRadius ? findEnemiesInGrid(target.position, weapon.splashRadius, Infinity, sameSpace) : [target];
              for (const t of splashed) damageEnemy(t, world.player.attackDamage);
            } else {
              damageEnemy(target, world.player.attackDamage);
              fireProjectile(muzzleX, muzzleY, muzzleZ, target.position.x, target.position.y + 0.4, target.position.z, weapon.color, 1);
            }
          } else {
            startReload();
          }
        }
      }
    }

    if (keys.current.reloadPressed) {
      keys.current.reloadPressed = false;
      startReload();
    }
    if (keys.current.switchWeaponPressed) {
      keys.current.switchWeaponPressed = false;
      switchWeapon();
    }
    updateReload(delta);

    if (attackAnimTimer.current > 0) {
      const duration = attackAnimType.current === 'punch' ? PUNCH_DURATION : SHOOT_DURATION;
      attackAnimTimer.current -= delta;
      const progress = Math.min(1, 1 - Math.max(0, attackAnimTimer.current) / duration);
      const curve = Math.sin(progress * Math.PI);

      if (attackAnimType.current === 'punch') {
        rightArmRef.current.rotation.x = -curve * PUNCH_ANGLE;
        rightForearmRef.current.rotation.x = ELBOW_REST_BEND - curve * (ELBOW_REST_BEND - ELBOW_PUNCH_EXTEND);
        upperBodyRef.current.rotation.y = (progress < 0.5 ? -progress : progress - 1) * PUNCH_TWIST_ANGLE;
      } else {
        rightArmRef.current.rotation.x = -curve * SHOOT_RAISE_ANGLE;
        rightForearmRef.current.rotation.x = ELBOW_REST_BEND - curve * (ELBOW_REST_BEND - SHOOT_FOREARM_EXTEND);
        leftArmRef.current.rotation.x = -curve * SHOOT_SUPPORT_ARM_ANGLE;
        leftForearmRef.current.rotation.x = ELBOW_REST_BEND + curve * (SHOOT_SUPPORT_FOREARM_BEND - ELBOW_REST_BEND);
        muzzleFlashRef.current.scale.setScalar(curve);
      }
    } else {
      muzzleFlashRef.current.scale.setScalar(0);
      upperBodyRef.current.rotation.y = 0;
      rightForearmRef.current.rotation.x = ELBOW_REST_BEND;
    }

    if (world.player.isReloading) {
      const weapon = WEAPONS[world.player.equippedWeapon];
      const reloadProgress = 1 - Math.max(0, world.player.reloadTimer) / weapon.reloadDuration;
      rightArmRef.current.rotation.x = -RELOAD_LOWER_ANGLE * (1 - Math.abs(2 * reloadProgress - 1));
      leftArmRef.current.rotation.x = -RELOAD_REACH_ANGLE;
      leftForearmRef.current.rotation.x = ELBOW_REST_BEND + RELOAD_FOREARM_BEND;
    }

    if (world.player.health < previousHealth.current) {
      hitFlashTimer.current = HIT_FLASH_DURATION;
    }
    previousHealth.current = world.player.health;
    hitFlashTimer.current = Math.max(0, hitFlashTimer.current - delta);
    hitFlashRef.current.scale.setScalar(hitFlashTimer.current / HIT_FLASH_DURATION);

    if (world.player.health / world.player.maxHealth < LOW_HEALTH_FRACTION) {
      if (!lowHealthWarned.current) {
        lowHealthWarned.current = true;
        sayLine('low_health');
      }
    } else {
      lowHealthWarned.current = false;
    }

    if (!isMoving) {
      idleSeconds.current += delta;
      if (idleSeconds.current > IDLE_SECONDS_BEFORE_LINE && !idleWarned.current) {
        idleWarned.current = true;
        sayLine('idle');
      }
    } else {
      idleSeconds.current = 0;
      idleWarned.current = false;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={leftLegRef} position={[-0.13, 1, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.115, 0.22, 4, 8]} />
          <meshStandardMaterial color={ACCENT_COLOR} />
        </mesh>
        <group ref={leftKneeRef} position={[0, -0.32, 0]}>
          <mesh>
            <sphereGeometry args={[0.09, 8, 6]} />
            <meshStandardMaterial color={TRIM_COLOR} />
          </mesh>
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.22, 4, 8]} />
            <meshStandardMaterial color={ACCENT_COLOR} />
          </mesh>
          <mesh position={[0, -0.34, 0.04]}>
            <boxGeometry args={[0.14, 0.08, 0.2]} />
            <meshStandardMaterial color={TRIM_COLOR} />
          </mesh>
        </group>
      </group>
      <group ref={rightLegRef} position={[0.13, 1, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.115, 0.22, 4, 8]} />
          <meshStandardMaterial color={ACCENT_COLOR} />
        </mesh>
        <group ref={rightKneeRef} position={[0, -0.32, 0]}>
          <mesh>
            <sphereGeometry args={[0.09, 8, 6]} />
            <meshStandardMaterial color={TRIM_COLOR} />
          </mesh>
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.22, 4, 8]} />
            <meshStandardMaterial color={ACCENT_COLOR} />
          </mesh>
          <mesh position={[0, -0.34, 0.04]}>
            <boxGeometry args={[0.14, 0.08, 0.2]} />
            <meshStandardMaterial color={TRIM_COLOR} />
          </mesh>
        </group>
      </group>

      <group ref={upperBodyRef} position={[0, 1, 0]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.35, 4, 10]} />
          <meshStandardMaterial color={ACCENT_COLOR} />
        </mesh>
        <mesh position={[0, 0.5, 0.2]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#ff9d4d" emissive="#ff9d4d" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.35, -0.22]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
          <meshStandardMaterial color="#ff9d4d" emissive="#ff9d4d" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.32, -0.16]} castShadow>
          <boxGeometry args={[0.28, 0.32, 0.14]} />
          <meshStandardMaterial color={TRIM_COLOR} />
        </mesh>

        <group ref={headRef} position={[0, 0.85, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.18, 10, 8]} />
            <meshStandardMaterial color="#e8b98c" />
          </mesh>
          <mesh position={[0, 0, 0.14]}>
            <boxGeometry args={[0.16, 0.06, 0.06]} />
            <meshStandardMaterial color="#4be0f0" emissive="#4be0f0" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        </group>

        <group ref={leftArmRef} position={[-0.32, 0.65, 0]}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.16, 0.1, 0.14]} />
            <meshStandardMaterial color="#4be0f0" emissive="#4be0f0" emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.11, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
            <meshStandardMaterial color={ACCENT_COLOR} />
          </mesh>
          <mesh position={[0, -0.22, 0]}>
            <sphereGeometry args={[0.075, 8, 6]} />
            <meshStandardMaterial color={TRIM_COLOR} />
          </mesh>
          <group ref={leftForearmRef} position={[0, -0.22, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.2, 4, 8]} />
              <meshStandardMaterial color={ACCENT_COLOR} />
            </mesh>
            <mesh position={[0, -0.26, 0]}>
              <sphereGeometry args={[0.08, 8, 6]} />
              <meshStandardMaterial color={TRIM_COLOR} />
            </mesh>
          </group>
        </group>
        <group ref={rightArmRef} position={[0.32, 0.65, 0]}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.16, 0.1, 0.14]} />
            <meshStandardMaterial color="#4be0f0" emissive="#4be0f0" emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.11, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
            <meshStandardMaterial color={ACCENT_COLOR} />
          </mesh>
          <mesh position={[0, -0.22, 0]}>
            <sphereGeometry args={[0.075, 8, 6]} />
            <meshStandardMaterial color={TRIM_COLOR} />
          </mesh>
          <group ref={rightForearmRef} position={[0, -0.22, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.2, 4, 8]} />
              <meshStandardMaterial color={ACCENT_COLOR} />
            </mesh>
            <mesh position={[0, -0.26, 0]}>
              <sphereGeometry args={[0.08, 8, 6]} />
              <meshStandardMaterial color={TRIM_COLOR} />
            </mesh>
            <mesh position={[0, -0.3, 0.14]} castShadow>
              <boxGeometry args={[0.09, 0.12, 0.36]} />
              <meshStandardMaterial color={GUN_COLOR} />
            </mesh>
            <mesh position={[0, -0.35, -0.02]} castShadow>
              <boxGeometry args={[0.06, 0.1, 0.08]} />
              <meshStandardMaterial color={TRIM_COLOR} />
            </mesh>
            <mesh position={[0, -0.29, 0.37]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.22, 8]} />
              <meshStandardMaterial color={TRIM_COLOR} />
            </mesh>
            <mesh ref={gunAccentRef} position={[0, -0.24, 0.1]}>
              <boxGeometry args={[0.03, 0.05, 0.14]} />
              <meshStandardMaterial color="#4be0ff" emissive="#4be0ff" emissiveIntensity={2} toneMapped={false} />
            </mesh>
            <mesh ref={muzzleFlashRef} position={[0, -0.29, 0.5]} scale={0}>
              <sphereGeometry args={[0.11, 8, 8]} />
              <meshStandardMaterial color="#ffe066" emissive="#ffe066" emissiveIntensity={2} toneMapped={false} />
            </mesh>
          </group>
        </group>

        <mesh ref={hitFlashRef} position={[0, 0.35, 0]} scale={0}>
          <sphereGeometry args={[0.45, 10, 8]} />
          <meshStandardMaterial color="#ff2b2b" emissive="#ff2b2b" emissiveIntensity={1.5} transparent opacity={0.5} />
        </mesh>
      </group>
    </group>
  );
}