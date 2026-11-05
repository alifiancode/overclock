import { createRng, hashInts, type Rng } from './random.ts';
import { fadeEdges, highpassInPlace, normalize, trimTail } from './dsp.ts';
import * as foley from './sfxFoley.ts';
import * as weapons from './sfxWeapons.ts';
import * as creatures from './sfxCreatures.ts';
import * as ambience from './sfxAmbience.ts';

type Task = Generator<void, Float32Array, void>;
type Recipe = (rng: Rng, variant: number) => Float32Array | Task;

type SoundDef = {
    recipe: Recipe;
    variants: number;
    peak: number;
    priority: number;
    loop?: boolean;
    lows?: boolean;
};

export const SOUNDS = {
    step_grass: { recipe: foley.stepGrass, variants: 4, peak: 0.4, priority: 0 },
    step_leaves: { recipe: foley.stepLeaves, variants: 4, peak: 0.42, priority: 1 },
    step_dirt: { recipe: foley.stepDirt, variants: 4, peak: 0.42, priority: 0 },
    step_mud: { recipe: foley.stepMud, variants: 4, peak: 0.5, priority: 1 },
    step_gravel: { recipe: foley.stepGravel, variants: 4, peak: 0.5, priority: 1 },
    step_asphalt: { recipe: foley.stepAsphalt, variants: 4, peak: 0.42, priority: 0 },
    step_pavement: { recipe: foley.stepPavement, variants: 4, peak: 0.45, priority: 0 },
    step_concrete: { recipe: foley.stepConcrete, variants: 4, peak: 0.45, priority: 0 },
    step_wood: { recipe: foley.stepWood, variants: 4, peak: 0.5, priority: 0 },
    step_carpet: { recipe: foley.stepCarpet, variants: 4, peak: 0.3, priority: 0 },
    step_tile: { recipe: foley.stepTile, variants: 4, peak: 0.5, priority: 0 },
    step_stairs: { recipe: foley.stepStairs, variants: 4, peak: 0.5, priority: 1 },
    step_debris: { recipe: foley.stepDebris, variants: 4, peak: 0.48, priority: 1 },
    step_shallow: { recipe: foley.stepShallowWater, variants: 4, peak: 0.5, priority: 0 },
    step_deep: { recipe: foley.stepDeepWater, variants: 3, peak: 0.6, priority: 1 },
    water_splash: { recipe: foley.waterSplash, variants: 2, peak: 0.7, priority: 2 },
    creak_wood: { recipe: foley.woodCreak, variants: 4, peak: 0.35, priority: 2 },
    door_open: { recipe: foley.doorOpen, variants: 3, peak: 0.55, priority: 1 },
    door_close: { recipe: foley.doorClose, variants: 3, peak: 0.6, priority: 1, lows: true },
    gear_rattle: { recipe: foley.gearRattle, variants: 3, peak: 0.22, priority: 2 },
    body_fall: { recipe: foley.bodyFall, variants: 1, peak: 0.7, priority: 2, lows: true },

    shot_pistol: { recipe: weapons.shotPistol, variants: 3, peak: 0.8, priority: 0 },
    shot_smg: { recipe: weapons.shotSmg, variants: 3, peak: 0.6, priority: 0 },
    shot_rifle: { recipe: weapons.shotRifle, variants: 3, peak: 0.85, priority: 1 },
    shot_shotgun: { recipe: weapons.shotShotgun, variants: 3, peak: 0.95, priority: 1, lows: true },
    shot_sniper: { recipe: weapons.shotSniper, variants: 2, peak: 0.95, priority: 1 },
    shot_launcher: { recipe: weapons.shotLauncher, variants: 2, peak: 0.9, priority: 1, lows: true },
    explosion: { recipe: weapons.explosion, variants: 2, peak: 1, priority: 1, lows: true },
    melee_swing: { recipe: weapons.meleeSwing, variants: 3, peak: 0.45, priority: 1 },
    melee_hit: { recipe: weapons.meleeHit, variants: 3, peak: 0.6, priority: 1 },
    hit_flesh: { recipe: weapons.hitFlesh, variants: 4, peak: 0.5, priority: 0 },
    dry_click: { recipe: weapons.dryClick, variants: 2, peak: 0.4, priority: 1 },
    equip_gear: { recipe: foley.equipGear, variants: 2, peak: 0.35, priority: 1 },
    rl_mag_out: { recipe: weapons.reloadMagOut, variants: 2, peak: 0.4, priority: 1 },
    rl_mag_in: { recipe: weapons.reloadMagIn, variants: 2, peak: 0.45, priority: 1 },
    rl_slide: { recipe: weapons.reloadSlide, variants: 2, peak: 0.45, priority: 1 },
    rl_shell: { recipe: weapons.reloadShell, variants: 3, peak: 0.4, priority: 1 },
    rl_pump: { recipe: weapons.reloadPump, variants: 2, peak: 0.45, priority: 1 },
    rl_bolt: { recipe: weapons.reloadBolt, variants: 2, peak: 0.45, priority: 1 },
    rl_launcher: { recipe: weapons.reloadLauncher, variants: 2, peak: 0.5, priority: 1, lows: true },

    pickup_coin: { recipe: foley.coinPickup, variants: 3, peak: 0.5, priority: 0 },
    pickup_ammo: { recipe: foley.ammoPickup, variants: 3, peak: 0.45, priority: 0 },
    pickup_weapon: { recipe: foley.weaponPickup, variants: 2, peak: 0.6, priority: 0 },
    level_up: { recipe: foley.levelUp, variants: 1, peak: 0.55, priority: 1 },
    ui_click: { recipe: foley.uiClick, variants: 1, peak: 0.3, priority: 0 },

    bot_zap: { recipe: weapons.botZap, variants: 2, peak: 0.4, priority: 1 },
    bot_pulse: { recipe: weapons.botPulse, variants: 1, peak: 0.7, priority: 2, lows: true },
    bot_shield_break: { recipe: weapons.botShieldBreak, variants: 1, peak: 0.55, priority: 2 },
    bot_shield_up: { recipe: weapons.botShieldUp, variants: 1, peak: 0.4, priority: 2 },
    bot_heal: { recipe: weapons.botHeal, variants: 1, peak: 0.3, priority: 2 },

    z_idle: { recipe: creatures.zombieIdle, variants: 4, peak: 0.5, priority: 2 },
    z_attack: { recipe: creatures.zombieAttack, variants: 3, peak: 0.7, priority: 2 },
    z_hurt: { recipe: creatures.zombieHurt, variants: 3, peak: 0.6, priority: 2 },
    z_die: { recipe: creatures.zombieDie, variants: 3, peak: 0.65, priority: 2, lows: true },
    flyer_screech: { recipe: creatures.flyerScreech, variants: 2, peak: 0.55, priority: 2 },
    flyer_flap: { recipe: creatures.flyerFlap, variants: 2, peak: 0.4, priority: 2 },
    acid_spit: { recipe: creatures.acidSpit, variants: 2, peak: 0.5, priority: 2 },
    acid_splat: { recipe: creatures.acidSplat, variants: 2, peak: 0.55, priority: 2 },
    fuse_hiss: { recipe: creatures.fuseHiss, variants: 1, peak: 0.3, priority: 2 },
    p_hurt: { recipe: creatures.playerHurt, variants: 4, peak: 0.7, priority: 1 },
    p_death: { recipe: creatures.playerDeath, variants: 1, peak: 0.75, priority: 1, lows: true },
    p_pant: { recipe: creatures.playerPant, variants: 2, peak: 0.35, priority: 2 },
    heartbeat: { recipe: foley.heartbeat, variants: 1, peak: 0.75, priority: 1, lows: true },

    amb_wind: { recipe: ambience.ambWind, variants: 1, peak: 0.35, priority: 3, loop: true },
    amb_leaves: { recipe: ambience.ambLeaves, variants: 1, peak: 0.25, priority: 3, loop: true },
    amb_insects: { recipe: ambience.ambInsects, variants: 1, peak: 0.2, priority: 3, loop: true },
    amb_water: { recipe: ambience.ambWater, variants: 1, peak: 0.3, priority: 3, loop: true },
    amb_room: { recipe: ambience.ambRoom, variants: 1, peak: 0.3, priority: 3, loop: true, lows: true },

    bird: { recipe: creatures.birdCall, variants: 6, peak: 0.35, priority: 4 },
    parrot: { recipe: creatures.parrotSquawk, variants: 2, peak: 0.4, priority: 4 },
    frog: { recipe: creatures.frogCroak, variants: 3, peak: 0.35, priority: 4 },
    drip: { recipe: creatures.waterDrip, variants: 3, peak: 0.35, priority: 4 },
    branch_snap: { recipe: creatures.branchSnap, variants: 2, peak: 0.45, priority: 4 },
    metal_groan: { recipe: foley.metalGroan, variants: 2, peak: 0.4, priority: 4, lows: true },
} satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUNDS;

type Job = { id: SoundId; variant: number };
type Active = { job: Job; task: Task };

const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];
const defs: Record<SoundId, SoundDef> = SOUNDS;
const store = new Map<SoundId, (Float32Array | null)[]>();
const lastPicked = new Map<SoundId, number>();
const readyScratch: number[] = [];

let queue: Job[] = [];
let active: Active | null = null;
let started = false;
let scheduled = false;
let totalJobs = 0;
let finishedJobs = 0;

function finalize(def: SoundDef, raw: Float32Array): Float32Array {
    if (def.loop) {
        let mean = 0;
        for (let i = 0; i < raw.length; i++) mean += raw[i];
        mean /= raw.length;
        for (let i = 0; i < raw.length; i++) raw[i] -= mean;
        normalize(raw, def.peak);
        return raw;
    }
    highpassInPlace(raw, def.lows ? 12 : 24);
    normalize(raw, def.peak);
    const trimmed = trimTail(raw, def.peak * 0.004, 0.06);
    fadeEdges(trimmed, 0, 0.006);
    return trimmed;
}

function keep(job: Job, data: Float32Array) {
    const slots = store.get(job.id);
    if (slots) slots[job.variant] = finalize(defs[job.id], data);
    finishedJobs++;
}

function begin(job: Job): Float32Array | Task {
    const seed = hashInts(SOUND_IDS.indexOf(job.id), job.variant, 0x5eed);
    return defs[job.id].recipe(createRng(seed), job.variant);
}

function pump(budgetMs: number) {
    const started0 = performance.now();
    do {
        if (!active) {
            const job = queue.shift();
            if (!job) return;
            const result = begin(job);
            if (result instanceof Float32Array) {
                keep(job, result);
                continue;
            }
            active = { job, task: result };
        }
        const step = active.task.next();
        if (step.done) {
            keep(active.job, step.value);
            active = null;
        }
    } while (performance.now() - started0 < budgetMs);
}

function schedule() {
    if (scheduled) return;
    scheduled = true;
    const run = (deadline?: IdleDeadline) => {
        scheduled = false;
        const budget = deadline && !deadline.didTimeout ? Math.min(6, Math.max(1.5, deadline.timeRemaining() - 1)) : 3;
        pump(budget);
        if (active || queue.length > 0) schedule();
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 120 });
    else setTimeout(run, 6);
}

function boost(id: SoundId) {
    const mine = queue.filter((job) => job.id === id);
    if (mine.length === 0) return;
    queue = mine.concat(queue.filter((job) => job.id !== id));
}

export function startGeneration() {
    if (started) return;
    started = true;
    const jobs: Job[] = [];
    for (const id of SOUND_IDS) {
        store.set(id, new Array<Float32Array | null>(defs[id].variants).fill(null));
        for (let v = 0; v < defs[id].variants; v++) jobs.push({ id, variant: v });
    }
    const order = new Map<Job, number>(jobs.map((job, i) => [job, i]));
    jobs.sort((a, b) => defs[a.id].priority - defs[b.id].priority || (order.get(a) ?? 0) - (order.get(b) ?? 0));
    queue = jobs;
    totalJobs = jobs.length;
    schedule();
}

export function generateAllNow() {
    startGeneration();
    pump(Infinity);
}

export function generationProgress(): number {
    return totalJobs === 0 ? 0 : finishedJobs / totalJobs;
}

export function isLooping(id: SoundId): boolean {
    return defs[id].loop === true;
}

export function pickVariant(id: SoundId, forced: number = -1): { index: number; data: Float32Array } | null {
    const slots = store.get(id);
    if (!slots) {
        startGeneration();
        return null;
    }
    if (forced >= 0 && slots[forced % slots.length]) {
        const index = forced % slots.length;
        return { index, data: slots[index] as Float32Array };
    }
    readyScratch.length = 0;
    for (let i = 0; i < slots.length; i++) if (slots[i]) readyScratch.push(i);
    if (readyScratch.length === 0) {
        boost(id);
        schedule();
        return null;
    }
    const last = lastPicked.get(id) ?? -1;
    let index = readyScratch[Math.floor(Math.random() * readyScratch.length)];
    if (readyScratch.length > 1 && index === last) index = readyScratch[(readyScratch.indexOf(index) + 1) % readyScratch.length];
    lastPicked.set(id, index);
    return { index, data: slots[index] as Float32Array };
}

export function soundIds(): SoundId[] {
    return SOUND_IDS;
}

export function variantCount(id: SoundId): number {
    return defs[id].variants;
}