import { world } from '../state/world.ts';
import type { BotModule } from './constants.ts';

export type PermanentUpgrade = {
    id: string;
    name: string;
    description: string;
    baseCost: number;
    costIncrement: number;
    getLevel: () => number;
    purchase: () => void;
};

export const PERMANENT_UPGRADES: PermanentUpgrade[] = [
    {
        id: 'max-health',
        name: 'Reinforced Hull',
        description: '+10 starting max HP per level',
        baseCost: 50,
        costIncrement: 50,
        getLevel: () => world.meta.maxHealthLevel,
        purchase: () => { world.meta.maxHealthLevel += 1; },
    },
    {
        id: 'attack-damage',
        name: 'Weapon Calibration',
        description: '+2 starting attack damage per level',
        baseCost: 60,
        costIncrement: 60,
        getLevel: () => world.meta.attackDamageLevel,
        purchase: () => { world.meta.attackDamageLevel += 1; },
    },
    {
        id: 'move-speed',
        name: 'Servo Tuning',
        description: '+5% starting move speed per level',
        baseCost: 40,
        costIncrement: 40,
        getLevel: () => world.meta.moveSpeedLevel,
        purchase: () => { world.meta.moveSpeedLevel += 1; },
    },
    {
        id: 'damage-reduction',
        name: 'Plating',
        description: '+2% starting damage reduction per level',
        baseCost: 70,
        costIncrement: 70,
        getLevel: () => world.meta.damageReductionLevel,
        purchase: () => { world.meta.damageReductionLevel += 1; },
    },
    {
        id: 'regen',
        name: 'Bio-Regen',
        description: '+0.3 HP/sec starting regen per level',
        baseCost: 80,
        costIncrement: 80,
        getLevel: () => world.meta.regenLevel,
        purchase: () => { world.meta.regenLevel += 1; },
    },
    {
        id: 'xp-boost',
        name: 'Neural Uplink',
        description: '+5% starting XP gain per level',
        baseCost: 55,
        costIncrement: 55,
        getLevel: () => world.meta.xpBoostLevel,
        purchase: () => { world.meta.xpBoostLevel += 1; },
    },
];

export function costForUpgrade(upgrade: PermanentUpgrade): number {
    return upgrade.baseCost + upgrade.getLevel() * upgrade.costIncrement;
}

export type BotModuleUnlock = {
    module: BotModule;
    name: string;
    description: string;
    cost: number;
};

export const BOT_MODULE_UNLOCKS: BotModuleUnlock[] =[
    {
        module: 'shield',
        name: 'Shield Module',
        description: 'Periodically absorbs one hit entirely',
        cost: 200,
    },
    {
        module: 'healer',
        name: 'Healer Module',
        description: 'Slowly regenerates HP over time',
        cost: 200,
    },
    {
        module: 'pulse',
        name: 'Pulse Module',
        description: 'Periodically damages every enemy nearby',
        cost: 260,
    },
];