import { Vector3 } from 'three';
import { PLAYER_MAX_HEALTH, CAMERA_OFFSET, PLAYER_MOVE_SPEED, PLAYER_ATTACK_RANGE, PLAYER_ATTACK_DAMAGE, PLAYER_ATTACK_COOLDOWN, DANGER_DIAL_DEFAULT, PERMANENT_MAX_HEALTH_PER_LEVEL, PERMANENT_ATTACK_DAMAGE_PER_LEVEL, PERMANENT_MOVE_SPEED_PER_LEVEL, PERMANENT_DAMAGE_REDUCTION_PER_LEVEL, PERMANENT_REGEN_PER_LEVEL, PERMANENT_XP_BOOST_PER_LEVEL, BOT_MODULE_DEFAULT, type BotModule } from '../data/constants.ts';
import { xpToNextLevel } from '../systems/leveling.ts';
import { WEAPONS, WEAPON_ORDER, STARTING_WEAPON, buildInitialAmmo, type WeaponId } from '../data/weapons.ts';
import dialogueBank from '../../assets/dialogue.json';
import { resetDoors } from '../systems/doors.ts';
import { regenerateLoot } from '../systems/loot.ts';
import { randomStart } from '../systems/obstacles.ts';
import { createRng } from '../systems/random.ts';
import { getTerrainHeight } from '../systems/terrain.ts';

const CURRENCY_STORAGE_KEY = 'overclock-currency';
const META_STORAGE_KEY = 'overclock-meta';

function loadCurrency(): number {
    const raw = localStorage.getItem(CURRENCY_STORAGE_KEY);
    return raw ? Number(raw) || 0 : 0;
}

type Meta = {
    maxHealthLevel: number,
    attackDamageLevel: number,
    moveSpeedLevel: number;
    damageReductionLevel: number;
    regenLevel: number;
    xpBoostLevel: number;
    unlockedBotModules: BotModule[],
    selectedBotModule: BotModule;
}

function defaultMeta(): Meta {
    return {
        maxHealthLevel: 0,
        attackDamageLevel: 0,
        moveSpeedLevel: 0,
        damageReductionLevel: 0,
        regenLevel: 0,
        xpBoostLevel: 0,
        unlockedBotModules: ['turret'],
        selectedBotModule: BOT_MODULE_DEFAULT,
    };
}

function loadMeta(): Meta {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return defaultMeta();
    try {
        return { ...defaultMeta(), ...JSON.parse(raw) };
    } catch {
        return defaultMeta();
    }
}

type DialogueEntry = { event: string, lines: string[] };
let nextDialogueId = 1;

export const world = {
    player: {
        position: new Vector3(0, 1, 0),
        health: PLAYER_MAX_HEALTH,
        maxHealth: PLAYER_MAX_HEALTH,
        alive: true,
        xp: 0,
        level: 1,
        moveSpeed: PLAYER_MOVE_SPEED,
        attackRange: PLAYER_ATTACK_RANGE,
        attackDamage: PLAYER_ATTACK_DAMAGE,
        attackCooldown: PLAYER_ATTACK_COOLDOWN,
        damageReduction: 0,
        regenPerSecond: 0,
        xpMultiplier: 1,
        currentFloor: 0,
        buildingIndex: -1,
        equippedWeapon: STARTING_WEAPON as WeaponId,
        ownedWeapons: [STARTING_WEAPON] as WeaponId[],
        ammo: buildInitialAmmo(),
        isReloading: false,
        reloadTimer: 0,
    },
    camera: {
        angle: Math.atan2(CAMERA_OFFSET.z, CAMERA_OFFSET.x),
    },
    bot: {
        shieldCharge: 0,
    },
    dangerDial: DANGER_DIAL_DEFAULT,
    pendingUpgradeChoices: 0,
    run: {
        elapsedSeconds: 0,
        over: false,
        currencyEarned: 0,
    },
    currency: loadCurrency(),
    meta: loadMeta(),
    dialogue: {
        id: 0,
        text: '',
    },
};

export function sayLine(event: string) {
    const entry = (dialogueBank as DialogueEntry[]).find((e) => e.event === event);
    if (!entry || entry.lines.length === 0) return;
    const line = entry.lines[Math.floor(Math.random() * entry.lines.length)];
    world.dialogue.id = nextDialogueId++;
    world.dialogue.text = line;
}

export function recomputeAttackStats() {
    const weapon = WEAPONS[world.player.equippedWeapon];
    world.player.attackRange = weapon.range;
    world.player.attackDamage = weapon.damage + world.meta.attackDamageLevel * PERMANENT_ATTACK_DAMAGE_PER_LEVEL;
    world.player.attackCooldown = weapon.cooldown;
}

export function switchWeapon() {
    if (world.player.isReloading || world.player.ownedWeapons.length < 2) return;
    const currentIndex = WEAPON_ORDER.indexOf(world.player.equippedWeapon);
    for (let step = 1; step <= WEAPON_ORDER.length; step++) {
        const candidate = WEAPON_ORDER[(currentIndex + step) % WEAPON_ORDER.length];
        if (world.player.ownedWeapons.includes(candidate)) {
            world.player.equippedWeapon = candidate;
            recomputeAttackStats();
            return;
        }
    }
}

export function startReload() {
    const id = world.player.equippedWeapon;
    if (world.player.isReloading) return;
    const ammo = world.player.ammo[id];
    const weapon = WEAPONS[id];
    if (ammo.current >= weapon.magazineSize || ammo.reserve <= 0) return;
    world.player.isReloading = true;
    world.player.reloadTimer = weapon.reloadDuration;
}

export function updateReload(delta: number) {
    if (!world.player.isReloading) return;
    world.player.reloadTimer -= delta;
    if (world.player.reloadTimer <= 0) {
        const id = world.player.equippedWeapon;
        const ammo = world.player.ammo[id];
        const weapon = WEAPONS[id];
        const needed = weapon.magazineSize - ammo.current;
        const taken = Math.min(needed, ammo.reserve);
        ammo.current += taken;
        ammo.reserve -= taken;
        world.player.isReloading = false;
    }
}

export function pickUpWeapon(id: WeaponId) {
    if (!world.player.ownedWeapons.includes(id)) {
        world.player.ownedWeapons.push(id);
    }
    world.player.ammo[id].reserve += WEAPONS[id].magazineSize;
}

export function pickUpAmmo(id: WeaponId, amount: number) {
    world.player.ammo[id].reserve += amount;
}

export function damagePlayer(amount: number) {
    if (!world.player.alive) return;
    if (world.bot.shieldCharge > 0) {
        world.bot.shieldCharge -= 1;
        return;
    }
    const reduced = amount * (1 - world.player.damageReduction);
    world.player.health = Math.max(0, world.player.health - reduced);
    if (world.player.health <= 0) {
        world.player.alive = false;
        sayLine('death');
        endRun();
    }
}

export function addXp(amount: number) {
    if (!world.player.alive) return;
    world.player.xp += amount * world.player.xpMultiplier;
    while (world.player.xp >= xpToNextLevel(world.player.level)) {
        world.player.xp -= xpToNextLevel(world.player.level);
        world.player.level += 1;
        world.pendingUpgradeChoices += 1;
        sayLine('level_up');
    }
}

export function endRun() {
    if (world.run.over) return;
    world.run.over = true;
    const earned = Math.round(world.player.level * 10 + world.run.elapsedSeconds * 0.1 * world.dangerDial);
    world.run.currencyEarned = earned;
    world.currency += earned;
    localStorage.setItem(CURRENCY_STORAGE_KEY, String(world.currency));
}

export function trySpendCurrency(amount: number): boolean {
    if (world.currency < amount) return false;
    world.currency -= amount;
    localStorage.setItem(CURRENCY_STORAGE_KEY, String(world.currency));
    return true;
}

export function saveMeta() {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(world.meta));
}

export function resetRun() {
    const seed = Math.floor(Math.random() * 2147483647);
    const rng = createRng(seed);
    const start = randomStart(rng);
    world.player.position.set(start.x, getTerrainHeight(start.x, start.z) - 0.3, start.z);
    world.player.maxHealth = PLAYER_MAX_HEALTH + world.meta.maxHealthLevel * PERMANENT_MAX_HEALTH_PER_LEVEL;
    world.player.health = world.player.maxHealth;
    world.player.alive = true;
    world.player.xp = 0;
    world.player.level = 1;
    world.player.moveSpeed = PLAYER_MOVE_SPEED * (1 + world.meta.moveSpeedLevel * PERMANENT_MOVE_SPEED_PER_LEVEL);
    world.player.equippedWeapon = STARTING_WEAPON;
    world.player.ownedWeapons = [STARTING_WEAPON];
    world.player.ammo = buildInitialAmmo();
    world.player.isReloading = false;
    world.player.reloadTimer = 0;
    recomputeAttackStats();
    world.player.damageReduction = world.meta.damageReductionLevel * PERMANENT_DAMAGE_REDUCTION_PER_LEVEL;
    world.player.regenPerSecond = world.meta.regenLevel * PERMANENT_REGEN_PER_LEVEL;
    world.player.xpMultiplier = 1 + world.meta.xpBoostLevel * PERMANENT_XP_BOOST_PER_LEVEL;
    world.player.currentFloor = 0;
    world.player.buildingIndex = -1;
    world.camera.angle = Math.atan2(CAMERA_OFFSET.z, CAMERA_OFFSET.x);
    world.bot.shieldCharge = 0;
    world.pendingUpgradeChoices = 0;
    world.run.elapsedSeconds = 0;
    world.run.over = false;
    world.run.currencyEarned = 0;
    resetDoors(seed ^ 0x5bd1e995);
    regenerateLoot(start.x, start.z, rng);
    sayLine('run_start');
}