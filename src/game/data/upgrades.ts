import { world } from '../state/world.ts';

export type UpgradeCategory = 'offense' | 'defense' | 'utility';

export type Upgrade = {
    id: string;
    name: string;
    description: string;
    category: UpgradeCategory;
    weight: number;
    apply: () => void;
};

export const UPGRADES: Upgrade[] = [
    {
        id: 'attack-damage',
        name: 'Sharper Strikes',
        description: '+3 attack damage',
        category: 'offense',
        weight: 3,
        apply: () => {world.player.attackDamage += 3; },
    },
    {
        id: 'attack-speed',
        name: 'Quick Hands',
        description: '15% faster attacks',
        category: 'offense',
        weight: 2,
        apply: () => { world.player.attackCooldown *= 0.85; },
    },
    {
        id: 'attack-range',
        name: 'Extended Reach',
        description: '+1.5 attack range',
        category: 'offense',
        weight: 2,
        apply: () => {world.player.attackRange += 1.5; },
    },
    {
        id: 'max-health',
        name: 'Vitality',
        description: '+20 max HP, fully healed',
        category: 'defense',
        weight: 3,
        apply: () => {
            world.player.maxHealth += 20;
            world.player.health += 20;
        },
    },
    {
        id: 'damage-reduction',
        name: 'Thick Skin',
        description: '8% less damage taken',
        category: 'defense',
        weight: 2,
        apply: () => {
            world.player.damageReduction = Math.min(0.75, world.player.damageReduction + 0.08);
        },
    },
    {
        id: 'regen',
        name: 'Regeneration',
        description: '+1 HP regen per second',
        category: 'defense',
        weight: 2,
        apply: () => { world.player.regenPerSecond += 1; },
    },
    {
        id: 'move-speed',
        name: 'Swift Boots',
        description: '15% faster movement',
        category: 'utility',
        weight: 2,
        apply: () => { world.player.moveSpeed *= 1.15; },
    },
    {
        id: 'xp-gain',
        name: 'Adrenaline Rush',
        description: '15% more XP gained',
        category: 'utility',
        weight: 1,
        apply: () => { world.player.xpMultiplier += 0.15; },
    },
];