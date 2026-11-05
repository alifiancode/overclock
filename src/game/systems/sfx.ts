import type { WeaponId } from '../data/weapons.ts';
import type { EnemyArchetype } from '../data/enemies.ts';
import { play } from './audio.ts';
import type { SoundId } from './soundBank.ts';
import type { Surface } from './surface.ts';

export type Actor = {
    position: { x: number; y: number; z: number };
    archetype: EnemyArchetype;
    currentBuildingIndex: number;
    currentFloor: number;
};

export type ReloadEvent = 'magOut' | 'magIn' | 'slide' | 'shell' | 'pump' | 'bolt' | 'launcher';
export type PickupSound = 'currency' | 'ammo' | 'weapon';

const SHOT_SOUND: Record<WeaponId, SoundId> = {
    pistol: 'shot_pistol',
    rifle: 'shot_rifle',
    smg: 'shot_smg',
    shotgun: 'shot_shotgun',
    sniper: 'shot_sniper',
    launcher: 'shot_launcher',
};

const RELOAD_SOUND: Record<ReloadEvent, SoundId> = {
    magOut: 'rl_mag_out',
    magIn: 'rl_mag_in',
    slide: 'rl_slide',
    shell: 'rl_shell',
    pump: 'rl_pump',
    bolt: 'rl_bolt',
    launcher: 'rl_launcher',
};

const VOICE_RATE: Record<EnemyArchetype, number> = {
    rusher: 1.05,
    ranged: 1.22,
    bruiser: 0.68,
    exploder: 0.86,
    spitter: 0.9,
    flyer: 1,
};

const VOICE_REACH = 36;
const COMBO_WINDOW = 0.45;
const MAX_COMBO = 6;

let coinCombo = 0;
let lastCoinTime = -10;

function rand(low: number, high: number): number {
    return low + Math.random() * (high - low);
}

export function playShot(weapon: WeaponId) {
    play(SHOT_SOUND[weapon], { bus: 'sfx', volume: rand(0.88, 1), rate: rand(0.96, 1.04), priority: 2 });
}

export function playReloadEvent(event: ReloadEvent) {
    play(RELOAD_SOUND[event], { bus: 'sfx', volume: rand(0.85, 1), rate: rand(0.97, 1.03), priority: 2 });
}

export function playDryFire() {
    play('dry_click', { bus: 'sfx', volume: rand(0.8, 1), throttle: 0.2, priority: 2 });
}

export function playEquip() {
    play('equip_gear', { bus: 'sfx', volume: rand(0.8, 1), throttle: 0.1, priority: 2 });
}

export function playMeleeSwing() {
    play('melee_swing', { bus: 'sfx', volume: rand(0.8, 1), rate: rand(0.92, 1.08), priority: 2 });
}

export function playMeleeHit(x: number, z: number) {
    play('melee_hit', { bus: 'sfx', x, z, volume: rand(0.85, 1), rate: rand(0.94, 1.06), priority: 2 });
}

export function playSplash() {
    play('water_splash', { bus: 'step', volume: rand(0.8, 1), rate: rand(0.94, 1.06), throttle: 0.4, priority: 1 });
}

export function playerStep(surface: Surface, speedRatio: number, decay: number) {
    let kind: Surface = surface;
    if (decay > 0.55 && (surface === 'wood' || surface === 'concrete' || surface === 'tile') && Math.random() < 0.3) kind = 'debris';
    const speed = Math.min(1.3, Math.max(0.3, speedRatio));
    play(`step_${kind}`, { bus: 'step', volume: rand(0.82, 1.05) * (0.78 + 0.22 * speed), rate: rand(0.94, 1.06), priority: 1 });
    if (kind === 'wood' && Math.random() < 0.12) play('creak_wood', { bus: 'step', volume: rand(0.4, 0.7), delay: 0.02, priority: 0 });
    if (kind !== 'shallow' && kind !== 'deep' && Math.random() < 0.22) {
        play('gear_rattle', { bus: 'step', volume: rand(0.35, 0.7), delay: 0.01, priority: 0 });
    }
}

export function enemyStep(surface: Surface, enemy: Actor, size: number) {
    play(`step_${surface}`, {
        bus: 'step',
        x: enemy.position.x,
        z: enemy.position.z,
        maxDistance: 26,
        volume: rand(0.62, 0.85) * (0.65 + 0.35 * size),
        rate: Math.min(1.2, Math.max(0.62, 1.12 - size * 0.22 + rand(-0.05, 0.05))),
        building: enemy.currentBuildingIndex,
        floor: enemy.currentFloor,
        priority: 0,
    });
}

export function playerHurt() {
    play('p_hurt', { bus: 'voice', volume: rand(0.85, 1), rate: rand(0.95, 1.05), throttle: 0.28, priority: 2 });
    play('hit_flesh', { bus: 'sfx', volume: 0.5, rate: rand(0.8, 0.95), throttle: 0.2, priority: 2 });
}

export function playerDeath() {
    play('p_death', { bus: 'voice', volume: 1, priority: 2 });
    play('body_fall', { bus: 'sfx', volume: 0.9, delay: 0.7, priority: 2 });
}

export function playPickup(kind: PickupSound, now: number) {
    if (kind === 'currency') {
        coinCombo = now - lastCoinTime < COMBO_WINDOW ? Math.min(MAX_COMBO, coinCombo + 1) : 0;
        lastCoinTime = now;
        play('pickup_coin', { bus: 'sfx', volume: 0.85, rate: 1 + coinCombo * 0.07, priority: 2 });
        return;
    }
    if (kind === 'ammo') {
        play('pickup_ammo', { bus: 'sfx', volume: 0.9, rate: rand(0.96, 1.04), priority: 2 });
        return;
    }
    play('pickup_weapon', { bus: 'sfx', volume: 1, priority: 2 });
}

export function playLevelUp() {
    play('level_up', { bus: 'ui', volume: 0.9, priority: 2 });
}

export function playDoor(opening: boolean, x: number, z: number, building: number) {
    play(opening ? 'door_open' : 'door_close', {
        bus: 'sfx',
        x,
        z,
        maxDistance: 34,
        volume: rand(0.85, 1),
        rate: rand(0.95, 1.05),
        building,
        floor: 0,
        priority: 1,
    });
}

function voiceOptions(enemy: Actor, volume: number) {
    return {
        bus: 'voice' as const,
        x: enemy.position.x,
        z: enemy.position.z,
        maxDistance: VOICE_REACH,
        volume,
        rate: VOICE_RATE[enemy.archetype] * rand(0.94, 1.06),
        building: enemy.currentBuildingIndex,
        floor: enemy.currentFloor,
        priority: 1,
    };
}

export function enemyHit(enemy: Actor, lethal: boolean) {
    play('hit_flesh', {
        bus: 'sfx',
        x: enemy.position.x,
        z: enemy.position.z,
        maxDistance: 30,
        volume: rand(0.7, 1),
        rate: rand(0.85, 1.12),
        throttle: 0.03,
        building: enemy.currentBuildingIndex,
        floor: enemy.currentFloor,
        priority: 1,
    });
    if (!lethal && Math.random() < 0.45) {
        play(enemy.archetype === 'flyer' ? 'flyer_screech' : 'z_hurt', { ...voiceOptions(enemy, 0.7), throttle: 0.09 });
    }
}

export function enemyDeath(enemy: Actor, exploded: boolean) {
    if (exploded) {
        play('explosion', {
            bus: 'sfx',
            x: enemy.position.x,
            z: enemy.position.z,
            maxDistance: 50,
            volume: 0.9,
            building: enemy.currentBuildingIndex,
            floor: enemy.currentFloor,
            priority: 2,
        });
        return;
    }
    if (enemy.archetype === 'flyer') {
        play('flyer_screech', { ...voiceOptions(enemy, 0.95), rate: 0.72 * rand(0.95, 1.05), priority: 2 });
        play('body_fall', {
            bus: 'sfx',
            x: enemy.position.x,
            z: enemy.position.z,
            maxDistance: 26,
            volume: 0.45,
            rate: 1.2,
            delay: 0.5,
            building: enemy.currentBuildingIndex,
            floor: enemy.currentFloor,
            priority: 0,
        });
        return;
    }
    play('z_die', { ...voiceOptions(enemy, 1), priority: 2 });
    play('body_fall', {
        bus: 'sfx',
        x: enemy.position.x,
        z: enemy.position.z,
        maxDistance: 28,
        volume: 0.55,
        rate: enemy.archetype === 'bruiser' ? 0.75 : 1,
        delay: 0.55,
        building: enemy.currentBuildingIndex,
        floor: enemy.currentFloor,
        priority: 0,
    });
}

export function enemyAttack(enemy: Actor, targetX: number, targetZ: number) {
    switch (enemy.archetype) {
        case 'ranged':
        case 'spitter':
            play('acid_spit', voiceOptions(enemy, 0.9));
            play('acid_splat', { bus: 'sfx', x: targetX, z: targetZ, maxDistance: 30, volume: 0.9, delay: 0.16, priority: 2 });
            break;
        case 'flyer':
            play('flyer_screech', { ...voiceOptions(enemy, 0.85), throttle: 0.2 });
            break;
        default:
            play('z_attack', { ...voiceOptions(enemy, 1), throttle: 0.12 });
            break;
    }
}

export function enemyGroan(enemy: Actor) {
    if (enemy.archetype === 'flyer') {
        play('flyer_screech', { ...voiceOptions(enemy, 0.5), rate: 0.9 * rand(0.95, 1.1) });
        return;
    }
    play('z_idle', voiceOptions(enemy, 0.62));
}

export function flyerFlap(enemy: Actor) {
    play('flyer_flap', {
        bus: 'sfx',
        x: enemy.position.x,
        z: enemy.position.z,
        maxDistance: 22,
        volume: rand(0.6, 0.9),
        rate: rand(0.92, 1.1),
        building: enemy.currentBuildingIndex,
        floor: enemy.currentFloor,
        priority: 0,
    });
}

export function exploderHiss(enemy: Actor) {
    play('fuse_hiss', {
        bus: 'sfx',
        x: enemy.position.x,
        z: enemy.position.z,
        maxDistance: 20,
        volume: 0.8,
        rate: rand(0.95, 1.1),
        throttle: 0.15,
        building: enemy.currentBuildingIndex,
        floor: enemy.currentFloor,
        priority: 0,
    });
}

export function botShot(x: number, z: number) {
    play('bot_zap', { bus: 'sfx', x, z, maxDistance: 30, volume: 0.8, rate: rand(0.94, 1.08), priority: 1 });
}

export function botPulse(x: number, z: number) {
    play('bot_pulse', { bus: 'sfx', x, z, maxDistance: 30, volume: 0.9, priority: 2 });
}

export function botShieldBreak() {
    play('bot_shield_break', { bus: 'sfx', volume: 0.9, priority: 2 });
}

export function botShieldUp() {
    play('bot_shield_up', { bus: 'sfx', volume: 0.8, priority: 2 });
}

export function botHeal() {
    play('bot_heal', { bus: 'sfx', volume: 0.55, throttle: 2.4, priority: 0 });
}