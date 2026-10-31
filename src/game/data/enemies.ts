import { Vector3 } from 'three';
import { addXp } from '../state/world.ts';
import { PATH_MAX } from '../systems/localPath.ts';
import { maybeDropPickup } from '../systems/pickups.ts';

export type EnemyArchetype = 'rusher' | 'ranged' | 'bruiser' | 'exploder' | 'spitter' | 'flyer';

export type ArchetypeStats = {
    speed: number;
    baseHealth: number;
    contactRange: number;
    contactDamage: number;
    contactCooldown: number;
    preferredRange: number;
    size: number;
    color: string;
    xpValue: number;
    selfDestructs?: boolean; 
    isAerial?: boolean; 
    hoverHeight?: number;
};

export const ARCHETYPE_STATS: Record<EnemyArchetype, ArchetypeStats> = {
    rusher: {
        speed: 5,
        baseHealth: 20,
        contactRange: 1.5,
        contactDamage: 5,
        contactCooldown: 1,
        preferredRange: 0,
        size: 1,
        color: '#e04b4b',
        xpValue: 5,
    },
    ranged: {
        speed: 3.5,
        baseHealth: 14,
        contactRange: 9,
        contactDamage: 4,
        contactCooldown: 1.4,
        preferredRange: 8,
        size: 0.85,
        color: '#e0a84b',
        xpValue: 6,
    },
    bruiser: {
        speed: 2.8,
        baseHealth: 70,
        contactRange: 2,
        contactDamage: 10,
        contactCooldown: 1.2,
        preferredRange: 0,
        size: 1.6,
        color: '#8b3fd1',
        xpValue: 20,
    },
    exploder: {
        speed: 4.7,
        baseHealth: 16,
        contactRange: 1.7,
        contactDamage: 24,
        contactCooldown: 999,
        preferredRange: 0,
        size: 1.05,
        color: '#ff9a3a',
        xpValue: 9,
        selfDestructs: true,
    },
    spitter: {
        speed: 2.1,
        baseHealth: 24,
        contactRange: 10,
        contactDamage: 6,
        contactCooldown: 1.8,
        preferredRange: 9,
        size: 1.1,
        color: '#9acb4a',
        xpValue: 8,
    },
    flyer: {
        speed: 6.4,
        baseHealth: 12,
        contactRange: 1.8,
        contactDamage: 6,
        contactCooldown: 1.3,
        preferredRange: 0,
        size: 0.8,
        color: '#c9a6ff',
        xpValue: 7,
        isAerial: true,
        hoverHeight: 3.4,
    },
};

export type ZombieVariant = {
    id: string;
    tier: EnemyArchetype;
    skinColor: string;
    trimColor: string;
    glowColor: string;
    torsoScale: [number, number, number];
    headScale: [number, number, number];
    armScale: number;
    legScale: number;
    hasRibs: boolean;
    hasSac: boolean;
    hasOneArm: boolean;
    isCrawler: boolean;
};

export const ZOMBIE_VARIANTS: ZombieVariant[] = [

    { id: 'runner', tier: 'rusher', skinColor: '#7a8a5e', trimColor: '#3a4228', glowColor: '#c4ff4a', torsoScale: [0.85, 0.95, 0.8], headScale: [0.9, 0.95, 0.9], armScale: 1, legScale: 1.1, hasRibs: false, hasSac: false, hasOneArm: false, isCrawler: false },
    { id: 'skeletal', tier: 'rusher', skinColor: '#c8c0ae', trimColor: '#8a8272', glowColor: '#e8ffe0', torsoScale: [0.68, 1, 0.6], headScale: [0.8, 0.9, 0.8], armScale: 1.05, legScale: 1, hasRibs: true, hasSac: false, hasOneArm: false, isCrawler: false },
    { id: 'screamer', tier: 'rusher', skinColor: '#8a7a8a', trimColor: '#4a3a4a', glowColor: '#ff8fe0', torsoScale: [0.8, 1.05, 0.75], headScale: [1.1, 1.15, 1.05], armScale: 0.95, legScale: 1, hasRibs: false, hasSac: false, hasOneArm: false, isCrawler: false },

    { id: 'brute', tier: 'bruiser', skinColor: '#6a4646', trimColor: '#38201e', glowColor: '#ff2a2a', torsoScale: [1.3, 1.15, 1.2], headScale: [0.85, 0.85, 0.85], armScale: 1.3, legScale: 0.95, hasRibs: false, hasSac: false, hasOneArm: false, isCrawler: false },
    { id: 'charred', tier: 'bruiser', skinColor: '#26221e', trimColor: '#0f0d0b', glowColor: '#ff6a1a', torsoScale: [1.1, 1.05, 1.05], headScale: [0.85, 0.85, 0.85], armScale: 1.05, legScale: 1, hasRibs: true, hasSac: false, hasOneArm: false, isCrawler: false },
    { id: 'hazmat', tier: 'bruiser', skinColor: '#5a6a4a', trimColor: '#8a9a4a', glowColor: '#c4ff4a', torsoScale: [1.15, 1.1, 1.1], headScale: [1.05, 1.05, 1.05], armScale: 1.05, legScale: 1, hasRibs: false, hasSac: false, hasOneArm: false, isCrawler: false },
    { id: 'shambler', tier: 'bruiser', skinColor: '#6a7a5a', trimColor: '#3a4a30', glowColor: '#c4ff4a', torsoScale: [1, 1, 1], headScale: [1, 1, 1], armScale: 1, legScale: 1, hasRibs: false, hasSac: false, hasOneArm: false, isCrawler: false },

    { id: 'bloater', tier: 'ranged', skinColor: '#8a7a48', trimColor: '#4a2f52', glowColor: '#ff6a3a', torsoScale: [1.3, 1.1, 1.2], headScale: [0.9, 0.9, 0.9], armScale: 0.8, legScale: 0.9, hasRibs: false, hasSac: true, hasOneArm: false, isCrawler: false },
    { id: 'crawler', tier: 'ranged', skinColor: '#5a6a4e', trimColor: '#2a3222', glowColor: '#c4ff4a', torsoScale: [1, 0.7, 1.1], headScale: [0.95, 0.85, 0.95], armScale: 1.15, legScale: 0.6, hasRibs: false, hasSac: false, hasOneArm: false, isCrawler: true },
    { id: 'onearmed', tier: 'ranged', skinColor: '#7a6a5e', trimColor: '#3a3228', glowColor: '#ffb84a', torsoScale: [0.95, 1, 0.9], headScale: [0.95, 0.95, 0.95], armScale: 1.1, legScale: 1, hasRibs: false, hasSac: false, hasOneArm: true, isCrawler: false },

    { id: 'gasbag', tier: 'exploder', skinColor: '#8a5a2e', trimColor: '#ff9a3a', glowColor: '#ffcf3a', torsoScale: [1.55, 1.3, 1.45], headScale: [0.85, 0.85, 0.85], armScale: 0.9, legScale: 0.95, hasRibs: false, hasSac: true, hasOneArm: false, isCrawler: false },
    { id: 'swollen', tier: 'exploder', skinColor: '#7a4a2a', trimColor: '#ff7a2a', glowColor: '#ff9a3a', torsoScale: [1.4, 1.5, 1.35], headScale: [0.8, 0.8, 0.8], armScale: 0.85, legScale: 0.9, hasRibs: false, hasSac: true, hasOneArm: false, isCrawler: false },

    { id: 'sprayer', tier: 'spitter', skinColor: '#5e7a3a', trimColor: '#2e3a1e', glowColor: '#c4ff4a', torsoScale: [1.35, 0.65, 1.3], headScale: [0.8, 0.7, 0.8], armScale: 1.2, legScale: 0.55, hasRibs: false, hasSac: true, hasOneArm: false, isCrawler: true },
    { id: 'bilious', tier: 'spitter', skinColor: '#6a8a3a', trimColor: '#3a4a20', glowColor: '#d4ff6a', torsoScale: [1.45, 0.6, 1.35], headScale: [0.75, 0.68, 0.78], armScale: 1.1, legScale: 0.5, hasRibs: false, hasSac: true, hasOneArm: false, isCrawler: true },

    { id: 'screecher', tier: 'flyer', skinColor: '#6a5a7a', trimColor: '#3a2f4a', glowColor: '#c9a6ff', torsoScale: [1, 1, 1], headScale: [1, 1, 1], armScale: 1, legScale: 1, hasRibs: false, hasSac: false, hasOneArm: false, isCrawler: false },
    { id: 'nightwing', tier: 'flyer', skinColor: '#4a3f5a', trimColor: '#2a2236', glowColor: '#e0c6ff', torsoScale: [1, 1, 1], headScale: [1, 1, 1], armScale: 1, legScale: 1, hasRibs: false, hasSac: false, hasOneArm: false, isCrawler: false },
];

export function pickVariantForTier(tier: EnemyArchetype): ZombieVariant {
    const options = ZOMBIE_VARIANTS.filter((v) => v.tier === tier);
    return options[Math.floor(Math.random() * options.length)];
}

export type Enemy = {
    id: number;
    archetype: EnemyArchetype;
    variantId: string;
    position: Vector3;
    health: number;
    maxHealth: number;
    alive: boolean;
    attackCooldown: number;
    attackFlashTimer: number;
    currentFloor: number;
    currentBuildingIndex: number;
    stuckTimer: number;
    stuckAnchorX: number;
    stuckAnchorZ: number;
    escapeTimer: number;
    escapeAnchorX: number;
    escapeAnchorZ: number;
    escapeDirX: number;
    escapeDirZ: number;
    lockX: number;
    lockZ: number;
    lockTimer: number;
    wayX: number;
    wayZ: number;
    wayTimer: number;
    path: Float32Array;
    pathLen: number;
    pathIdx: number;
    pathTimer: number;
    pathGoalX: number;
    pathGoalZ: number;
    pathFloor: number;
    pathBuilding: number;
    planTimer: number;
    avoidX: number;
    avoidZ: number;
    probeTimer: number;
    headingX: number;
    headingZ: number;
    wading: number;
    facing: number;
    moving: boolean;
    stepTime: number;
    phase: number;
};

export const enemies: Enemy[] = [];

let nextEnemyId = 0;

export function spawnEnemy(archetype: EnemyArchetype, position: Vector3, healthMultiplier: number = 1): Enemy {
    const health = Math.round(ARCHETYPE_STATS[archetype].baseHealth * healthMultiplier);
    const enemy: Enemy = {
        id: nextEnemyId++,
        archetype,
        variantId: pickVariantForTier(archetype).id,
        position: position.clone(),
        health,
        maxHealth: health,
        alive: true,
        attackCooldown: 0,
        attackFlashTimer: 0,
        currentFloor: 0,
        currentBuildingIndex: -1,
        stuckTimer: 0,
        stuckAnchorX: position.x,
        stuckAnchorZ: position.z,
        escapeTimer: 0,
        escapeAnchorX: position.x,
        escapeAnchorZ: position.z,
        escapeDirX: 0,
        escapeDirZ: 0,
        lockX: 0,
        lockZ: 0,
        lockTimer: 0,
        wayX: 0,
        wayZ: 0,
        wayTimer: 0,
        path: new Float32Array(PATH_MAX * 2),
        pathLen: 0,
        pathIdx: 0,
        pathTimer: 0,
        pathGoalX: 0,
        pathGoalZ: 0,
        pathFloor: 0,
        pathBuilding: -1,
        planTimer: 0,
        avoidX: 0,
        avoidZ: 0,
        probeTimer: Math.random() * 0.3,
        headingX: 0,
        headingZ: 1,
        wading: 0,
        facing: 0,
        moving: false,
        stepTime: 0,
        phase: Math.random() * 6.28,
    };
    enemies.push(enemy);
    return enemy;
}

export function pickWeightedArchetype(): EnemyArchetype {
    const roll = Math.random();
    if (roll < 0.4) return 'rusher';
    if (roll < 0.58) return 'ranged';
    if (roll < 0.7) return 'bruiser';
    if (roll < 0.82) return 'spitter';
    if (roll < 0.92) return 'exploder';
    return 'flyer';
}

export function damageEnemy(enemy: Enemy, amount: number) {
    enemy.health -= amount;
    if (enemy.health <= 0 && enemy.alive) {
        enemy.alive = false;
        addXp(ARCHETYPE_STATS[enemy.archetype].xpValue);
    }
}

export function removeDeadEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (!enemies[i].alive) {
            maybeDropPickup(enemies[i].position);
            enemies.splice(i, 1);
        }
    }
}