import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import { useKeyboard } from '../hooks/useKeyboard.ts';
import { world, sayLine, startReload, updateReload, switchWeapon } from '../state/world.ts';
import { PLAYER_MOVE_SPEED, PLAYER_Y_LERP, WATER_SLOW_PLAYER } from '../data/constants.ts';
import { damageEnemy, type Enemy } from '../data/enemies.ts';
import { findNearestInGrid, findEnemiesInGrid } from '../systems/spatialGrid.ts';
import { resolveCollision, resolveFloor, type FloorInfo } from '../systems/obstacles.ts';
import { fireProjectile } from '../systems/projectiles.ts';
import { WEAPONS, type WeaponDef } from '../data/weapons.ts';
import { resolveDoorCollision, tryToggleNearestDoor } from '../systems/doors.ts';
import { hasLineOfSight } from '../systems/navigation.ts';
import { fx } from '../systems/shaderFx.ts';
import { wadeFactor, wadeLift, waterDepthAt } from '../systems/water.ts';
import { createPlayerRig, createRigInput, type PlayerRig, type RigEvents, type RigInput } from '../systems/playerRig.ts';
import { buildingDecay, surfaceAt } from '../systems/surface.ts';
import { playDryFire, playEquip, playMeleeHit, playMeleeSwing, playReloadEvent, playShot, playSplash, playerStep } from '../systems/sfx.ts';
import { wrapDelta } from '../systems/wrap.ts';

const PLAYER_RADIUS = 0.3;
const MAX_FRAME = 0.05;
const MAX_SUBSTEP = 0.3;
const WADE_SINK = 0.75;
const LANTERN_OUTDOOR = 0.35;
const LANTERN_INDOOR = 1;
const LANTERN_INTENSITY = 24;
const LOW_HEALTH_FRACTION = 0.25;
const IDLE_SECONDS_BEFORE_LINE = 8;
const MELEE_THRESHOLD = 2.5;
const AIM_HOLD = 0.9;
const AIM_AFTER_SHOT = 0.4;
const DRY_FIRE_INTERVAL = 0.6;
const MELEE_HIT_DELAY = 0.1;
const TARGET_CHEST = 1;
const SHOULDER_HEIGHT = 1.35;
const MAX_JUMP = 3;
const WET_DEPTH = 0.12;
const SPLASH_SPEED = 1;
const LOOT_KIND = { currency: 0, ammo: 1, weapon: 2 } as const;

const VOLLEY_NONE = 0;
const VOLLEY_SINGLE = 1;
const VOLLEY_SPREAD = 2;
const VOLLEY_SPLASH = 3;

const floorInfo: FloorInfo = { y: 0, floor: 0, buildingIndex: -1 };
const stepOut = { x: 0, z: 0 };
const slideOut = { x: 0, z: 0 };
const muzzle = new Vector3();
const volley: Enemy[] = [];

type PlayerState = {
  cooldown: number;
  lowHealthWarned: boolean;
  idleSeconds: number;
  idleWarned: boolean;
  animTime: number;
  health: number;
  aimTimer: number;
  aimEnemy: Enemy | null;
  aimX: number;
  aimY: number;
  aimZ: number;
  facing: number;
  moveYaw: number;
  speed: number;
  dry: number;
  hitTimer: number;
  hitX: number;
  hitZ: number;
  lootSerial: number;
  wet: boolean;
  stepRatio: number;
  volleyKind: number;
  volleyWeapon: WeaponDef;
};

function createState(): PlayerState {
  const facing = Math.atan2(-Math.cos(world.camera.angle), -Math.sin(world.camera.angle));
  return {
    cooldown: 0,
    lowHealthWarned: false,
    idleSeconds: 0,
    idleWarned: false,
    animTime: 0,
    health: world.player.health,
    aimTimer: 0,
    aimEnemy: null,
    aimX: 0,
    aimY: 0,
    aimZ: 0,
    facing,
    moveYaw: facing,
    speed: 0,
    dry: 0,
    hitTimer: 0,
    hitX: 0,
    hitZ: 0,
    lootSerial: world.player.loot.serial,
    wet: false,
    stepRatio: 1,
    volleyKind: VOLLEY_NONE,
    volleyWeapon: WEAPONS[world.player.equippedWeapon],
  };
}

export function Player() {
  const groupRef = useRef<Group>(null!);
  const rigRef = useRef<PlayerRig | null>(null);
  const inputRef = useRef<RigInput | null>(null);
  const stateRef = useRef<PlayerState | null>(null);
  const eventsRef = useRef<RigEvents | null>(null);
  if (rigRef.current === null) rigRef.current = createPlayerRig();
  if (inputRef.current === null) inputRef.current = createRigInput();
  if (stateRef.current === null) stateRef.current = createState();
  if (eventsRef.current === null) {
    eventsRef.current = {
      step: () => {
        const group = groupRef.current;
        const buildingIndex = world.player.buildingIndex;
        const surface = surfaceAt(group.position.x, group.position.z, buildingIndex, world.player.currentFloor);
        playerStep(surface, stateRef.current!.stepRatio, buildingDecay(buildingIndex));
      },
      reload: playReloadEvent,
      equip: playEquip,
    };
  }
  const keys = useKeyboard();

  useLayoutEffect(() => {
    const group = groupRef.current;
    const rig = rigRef.current!;
    const s = stateRef.current!;
    group.position.copy(world.player.position);
    group.add(rig.root);
    s.health = world.player.health;
    return () => {
      group.remove(rig.root);
    };
  }, []);

  useFrame((_, rawDelta) => {
    const delta = rawDelta > MAX_FRAME ? MAX_FRAME : rawDelta;
    const rig = rigRef.current!;
    const input = inputRef.current!;
    const events = eventsRef.current!;
    const s = stateRef.current!;
    const group = groupRef.current;
    const player = world.player;

    if (player.health < s.health - 0.001) input.hurt += 1;
    s.health = player.health;

    if (!player.alive) {
      rig.lantern.intensity *= 0.9;
      input.alive = false;
      input.moving = false;
      input.aim = false;
      input.reloading = false;
      input.speed = 0;
      rig.update(input, delta, events);
      return;
    }
    if (world.pendingUpgradeChoices > 0) return;

    if (player.regenPerSecond > 0 && player.health < player.maxHealth) {
      player.health = Math.min(player.maxHealth, player.health + player.regenPerSecond * delta);
      s.health = player.health;
    }
    const startX = group.position.x;
    const startZ = group.position.z;
    const { forward, back, left, right } = keys.current;

    let moveX = 0;
    let moveZ = 0;
    if (forward) moveZ -= 1;
    if (back) moveZ += 1;
    if (left) moveX -= 1;
    if (right) moveX += 1;

    const isMoving = moveX !== 0 || moveZ !== 0;
    const depth = waterDepthAt(group.position.x, group.position.z);
    const wade = wadeFactor(depth, WATER_SLOW_PLAYER);
    if (isMoving) {
      const length = Math.hypot(moveX, moveZ);
      moveX /= length;
      moveZ /= length;

      const angle = world.camera.angle;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const rotatedX = moveX * sin + moveZ * cos;
      const rotatedZ = -moveX * cos + moveZ * sin;

      let remaining = player.moveSpeed * wade * delta;
      let cx = group.position.x;
      let cz = group.position.z;
      while (remaining > 1e-4) {
        const step = remaining > MAX_SUBSTEP ? MAX_SUBSTEP : remaining;
        remaining -= step;
        resolveCollision(cx + rotatedX * step, cz + rotatedZ * step, player.currentFloor, PLAYER_RADIUS, stepOut);
        resolveDoorCollision(stepOut.x, stepOut.z, PLAYER_RADIUS, slideOut);
        cx = slideOut.x;
        cz = slideOut.z;
      }
      group.position.x = cx;
      group.position.z = cz;
    }

    if (keys.current.interactPressed) {
      keys.current.interactPressed = false;
      tryToggleNearestDoor(group.position.x, group.position.z);
    }

    resolveFloor(group.position.x, group.position.z, player.currentFloor, floorInfo);
    player.currentFloor = floorInfo.floor;
    player.buildingIndex = floorInfo.buildingIndex;
    const lift = floorInfo.buildingIndex < 0 ? wadeLift(waterDepthAt(group.position.x, group.position.z), WADE_SINK) : 0;
    const yBlend = 1 - Math.pow(1 - PLAYER_Y_LERP, delta * 60);
    group.position.y += (floorInfo.y - 0.3 + lift - group.position.y) * yBlend;

    player.position.copy(group.position);
    s.animTime += delta;

    const dx = group.position.x - startX;
    const dz = group.position.z - startZ;
    const moved = Math.hypot(dx, dz);
    if (moved > 1e-4 && moved < MAX_JUMP) s.moveYaw = Math.atan2(dx, dz);
    const measured = moved >= MAX_JUMP ? 0 : delta > 1e-4 ? moved / delta : s.speed;
    s.speed = measured;
    s.stepRatio = measured / PLAYER_MOVE_SPEED;

    const wet = depth > WET_DEPTH;
    if (wet && !s.wet && measured > SPLASH_SPEED) playSplash();
    s.wet = wet;

    const lantern = rig.lantern;
    const flicker = 0.95 + Math.sin(s.animTime * 13) * 0.025 + Math.sin(s.animTime * 31.7) * 0.025;
    lantern.intensity = LANTERN_INTENSITY * (LANTERN_OUTDOOR + (LANTERN_INDOOR - LANTERN_OUTDOOR) * fx.uIndoor.value) * flicker;

    s.cooldown -= delta;
    s.aimTimer = s.aimTimer > delta ? s.aimTimer - delta : 0;
    s.dry = s.dry > delta ? s.dry - delta : 0;
    s.volleyKind = VOLLEY_NONE;
    volley.length = 0;

    if (s.cooldown <= 0) {
      const sameSpace = (e: Enemy) =>
        e.currentBuildingIndex === player.buildingIndex &&
        e.currentFloor === player.currentFloor &&
        hasLineOfSight(group.position.x, group.position.z, e.position.x, e.position.z, e.currentBuildingIndex, e.currentFloor);
      const target = findNearestInGrid(group.position, player.attackRange, sameSpace);
      if (target) {
        const distance = group.position.distanceTo(target.position);
        const isMelee = distance < MELEE_THRESHOLD;
        s.aimEnemy = target;
        s.aimX = target.position.x;
        s.aimY = target.position.y;
        s.aimZ = target.position.z;

        if (isMelee) {
          damageEnemy(target, player.attackDamage);
          s.cooldown = player.attackCooldown;
          s.aimTimer = AIM_HOLD;
          input.melee += 1;
          playMeleeSwing();
          s.hitTimer = MELEE_HIT_DELAY;
          s.hitX = target.position.x;
          s.hitZ = target.position.z;
        } else if (!player.isReloading) {
          const ammo = player.ammo[player.equippedWeapon];
          if (ammo.current > 0) {
            ammo.current -= 1;
            const weapon = WEAPONS[player.equippedWeapon];
            s.cooldown = player.attackCooldown;
            s.aimTimer = Math.max(AIM_HOLD, player.attackCooldown + AIM_AFTER_SHOT);
            input.shots += 1;
            playShot(weapon.id);
            s.volleyWeapon = weapon;

            if (weapon.kind === 'spread') {
              const targets = findEnemiesInGrid(group.position, weapon.range, weapon.pellets ?? 1, sameSpace);
              for (const t of targets) {
                damageEnemy(t, player.attackDamage);
                volley.push(t);
              }
              s.volleyKind = VOLLEY_SPREAD;
            } else if (weapon.kind === 'splash') {
              volley.push(target);
              const splashed = weapon.splashRadius ? findEnemiesInGrid(target.position, weapon.splashRadius, Infinity, sameSpace) : [target];
              for (const t of splashed) damageEnemy(t, player.attackDamage);
              s.volleyKind = VOLLEY_SPLASH;
            } else {
              damageEnemy(target, player.attackDamage);
              volley.push(target);
              s.volleyKind = VOLLEY_SINGLE;
            }
          } else {
            s.aimTimer = AIM_HOLD;
            startReload();
            if (!player.isReloading && s.dry <= 0) {
              playDryFire();
              s.dry = DRY_FIRE_INTERVAL;
            }
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

    const equipped = WEAPONS[player.equippedWeapon];
    input.weapon = player.equippedWeapon;
    input.reloading = player.isReloading;
    input.reloadProgress = player.isReloading ? 1 - Math.max(0, player.reloadTimer) / equipped.reloadDuration : 0;
    input.alive = true;
    input.speed = measured;
    input.moving = moved > 1e-4;
    input.moveYaw = s.moveYaw;
    input.wade = Math.min(1, Math.max(0, (1 - wade) / (1 - WATER_SLOW_PLAYER)));

    const aiming = s.aimTimer > 0;
    if (aiming) {
      const enemy = s.aimEnemy;
      if (enemy !== null && enemy.alive) {
        s.aimX = enemy.position.x;
        s.aimY = enemy.position.y;
        s.aimZ = enemy.position.z;
      }
      const tx = wrapDelta(s.aimX - group.position.x);
      const tz = wrapDelta(s.aimZ - group.position.z);
      input.hasTarget = true;
      input.targetX = tx;
      input.targetZ = tz;
      input.targetY = s.aimY + TARGET_CHEST - (group.position.y + 0.3 + SHOULDER_HEIGHT);
      s.facing = Math.atan2(tx, tz);
    } else {
      input.hasTarget = false;
      if (moved > 1e-3) s.facing = s.moveYaw;
    }
    input.aim = aiming;
    input.facingTarget = s.facing;

    const loot = player.loot;
    if (loot.serial !== s.lootSerial) {
      s.lootSerial = loot.serial;
      input.lootKind = LOOT_KIND[loot.kind];
      input.lootItem = loot.item;
      input.lootX = wrapDelta(loot.x - group.position.x);
      input.lootY = loot.y - group.position.y;
      input.lootZ = wrapDelta(loot.z - group.position.z);
      input.loot += 1;
    }

    rig.update(input, delta, events);

    if (s.volleyKind !== VOLLEY_NONE) {
      rig.muzzle(muzzle);
      const color = s.volleyWeapon.color;
      if (s.volleyKind === VOLLEY_SPREAD) {
        for (const t of volley) fireProjectile(muzzle.x, muzzle.y, muzzle.z, t.position.x, t.position.y + TARGET_CHEST, t.position.z, color, 0.85);
      } else {
        const t = volley[0];
        fireProjectile(muzzle.x, muzzle.y, muzzle.z, t.position.x, t.position.y + TARGET_CHEST, t.position.z, color, s.volleyKind === VOLLEY_SPLASH ? 1.7 : 1);
      }
    }

    if (s.hitTimer > 0) {
      s.hitTimer -= delta;
      if (s.hitTimer <= 0) playMeleeHit(s.hitX, s.hitZ);
    }

    if (player.health / player.maxHealth < LOW_HEALTH_FRACTION) {
      if (!s.lowHealthWarned) {
        s.lowHealthWarned = true;
        sayLine('low_health');
      }
    } else {
      s.lowHealthWarned = false;
    }

    if (!isMoving) {
      s.idleSeconds += delta;
      if (s.idleSeconds > IDLE_SECONDS_BEFORE_LINE && !s.idleWarned) {
        s.idleWarned = true;
        sayLine('idle');
      }
    } else {
      s.idleSeconds = 0;
      s.idleWarned = false;
    }
  });

  return <group ref={groupRef} position={[0, 0, 0]} />;
}