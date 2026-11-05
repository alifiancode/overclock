import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { WATER_LEVEL } from '../data/constants.ts';
import { enemies } from '../data/enemies.ts';
import { world } from '../state/world.ts';
import { play, setEnvironment, setListener, startLoop, type Loop } from '../systems/audio.ts';
import { enemyGroan, exploderHiss, flyerFlap } from '../systems/sfx.ts';
import { createBiome, getTerrainHeight, sampleBiome } from '../systems/terrain.ts';
import type { SoundId } from '../systems/soundBank.ts';

const SAMPLE_INTERVAL = 0.4;
const ENEMY_INTERVAL = 0.25;
const LOOP_RETRY = 0.6;
const WATER_RINGS = [5, 10, 16, 24];
const WATER_DIRECTIONS = 6;
const GROAN_RANGE = 26;
const HISS_RANGE = 14;
const FLAP_RANGE = 18;
const LOW_HEALTH = 0.3;
const TAU = Math.PI * 2;

type Layers = { wind: Loop | null; leaves: Loop | null; insects: Loop | null; water: Loop | null; room: Loop | null };

type Ambient = {
    forest: number;
    bush: number;
    overgrowth: number;
    city: number;
    water: number;
    indoor: number;
};

type Timers = {
    sample: number;
    enemy: number;
    retry: number;
    bird: number;
    parrot: number;
    frog: number;
    drip: number;
    creak: number;
    groan: number;
    snap: number;
    far: number;
    heart: number;
    pant: number;
    flap: number;
    hiss: number;
};

const biome = createBiome();

function between(low: number, high: number): number {
    return low + Math.random() * (high - low);
}

function waterProximity(px: number, pz: number): number {
    let best = 0;
    for (let r = 0; r < WATER_RINGS.length; r++) {
        for (let k = 0; k < WATER_DIRECTIONS; k++) {
            const a = (k / WATER_DIRECTIONS) * TAU + r * 0.5;
            const h = getTerrainHeight(px + Math.cos(a) * WATER_RINGS[r], pz + Math.sin(a) * WATER_RINGS[r]);
            if (h < WATER_LEVEL) best = Math.max(best, 1 - r / WATER_RINGS.length);
        }
    }
    return best;
}

function scatter(id: SoundId, minDistance: number, maxDistance: number, volume: number, rate: number, indoors: boolean) {
    const a = Math.random() * TAU;
    const d = between(minDistance, maxDistance);
    const player = world.player.position;
    play(id, {
        bus: 'amb',
        x: player.x + Math.cos(a) * d,
        z: player.z + Math.sin(a) * d,
        volume,
        rate,
        maxDistance: maxDistance + 14,
        building: indoors ? world.player.buildingIndex : undefined,
        floor: indoors ? world.player.currentFloor : undefined,
        priority: 0,
    });
}

export function AudioDriver() {
    const layers = useRef<Layers>({ wind: null, leaves: null, insects: null, water: null, room: null });
    const ambient = useRef<Ambient>({ forest: 0.3, bush: 0.2, overgrowth: 0.3, city: 0, water: 0, indoor: 0 });
    const timers = useRef<Timers>({
        sample: 0,
        enemy: 0,
        retry: 0,
        bird: 3,
        parrot: 12,
        frog: 6,
        drip: 3,
        creak: 9,
        groan: 2,
        snap: 14,
        far: 20,
        heart: 0,
        pant: 3,
        flap: 0,
        hiss: 0,
    });

    useEffect(() => {
        const held = layers.current;
        return () => {
            held.wind?.stop();
            held.leaves?.stop();
            held.insects?.stop();
            held.water?.stop();
            held.room?.stop();
            held.wind = held.leaves = held.insects = held.water = held.room = null;
        };
    }, []);

    useFrame((_, rawDelta) => {
        const delta = rawDelta > 0.1 ? 0.1 : rawDelta;
        const player = world.player;
        const t = timers.current;
        const a = ambient.current;
        const held = layers.current;
        const indoors = player.buildingIndex >= 0;

        setListener(player.position.x, player.position.z, world.camera.angle, player.buildingIndex, player.currentFloor);
        a.indoor += ((indoors ? 1 : 0) - a.indoor) * (1 - Math.exp(-delta * 5));
        setEnvironment(a.indoor);

        t.sample -= delta;
        if (t.sample <= 0) {
            t.sample = SAMPLE_INTERVAL;
            if (!indoors) {
                sampleBiome(player.position.x, player.position.z, biome);
                a.forest = biome.forest;
                a.bush = biome.bush;
                a.overgrowth = biome.overgrowth;
                a.city = biome.city;
                a.water = waterProximity(player.position.x, player.position.z);
            }
        }

        t.retry -= delta;
        if (t.retry <= 0) {
            t.retry = LOOP_RETRY;
            held.wind ??= startLoop('amb_wind');
            held.leaves ??= startLoop('amb_leaves');
            held.insects ??= startLoop('amb_insects');
            held.water ??= startLoop('amb_water');
            held.room ??= startLoop('amb_room');
        }

        const open = 1 - a.indoor;
        const aliveFactor = player.alive ? 1 : 0.35;
        const jungle = Math.min(1, a.forest * 0.7 + a.bush * 0.4 + a.overgrowth * 0.3);
        held.wind?.setVolume((0.2 + open * (0.5 + a.city * 0.3 - a.forest * 0.15)) * aliveFactor * (a.indoor > 0.5 ? 0.5 : 1));
        held.leaves?.setVolume(open * Math.min(0.85, jungle) * aliveFactor);
        held.insects?.setVolume((open * (0.25 + jungle * 0.55) + a.indoor * 0.05) * aliveFactor * (1 - a.city * 0.5));
        held.water?.setVolume(a.water * (0.15 + open * 0.85) * 0.9 * aliveFactor);
        held.room?.setVolume(a.indoor * 0.9 * aliveFactor);

        if (world.pendingUpgradeChoices > 0) return;

        if (!indoors) {
            t.bird -= delta;
            if (t.bird <= 0) {
                t.bird = between(3, 9) * (1.5 - jungle);
                scatter('bird', 12, 30, between(0.6, 1), between(0.9, 1.15), false);
            }
            t.parrot -= delta;
            if (t.parrot <= 0) {
                t.parrot = between(14, 32);
                if (jungle > 0.4) scatter('parrot', 14, 30, 0.8, between(0.9, 1.1), false);
            }
            t.frog -= delta;
            if (t.frog <= 0) {
                t.frog = between(4, 11);
                if (a.water > 0.3) scatter('frog', 8, 22, between(0.6, 1), between(0.9, 1.15), false);
            }
            t.snap -= delta;
            if (t.snap <= 0) {
                t.snap = between(18, 40);
                if (a.forest > 0.4) scatter('branch_snap', 16, 32, 0.8, between(0.9, 1.1), false);
            }
            t.far -= delta;
            if (t.far <= 0) {
                t.far = between(22, 48);
                if (a.city > 0.3) scatter('metal_groan', 20, 34, 0.7, between(0.85, 1.1), false);
            }
        } else {
            t.drip -= delta;
            if (t.drip <= 0) {
                t.drip = between(2.5, 7);
                scatter('drip', 3, 9, between(0.6, 1), between(0.85, 1.2), true);
            }
            t.creak -= delta;
            if (t.creak <= 0) {
                t.creak = between(8, 20);
                scatter('creak_wood', 4, 10, 0.55, between(0.85, 1.1), true);
            }
            t.far -= delta;
            if (t.far <= 0) {
                t.far = between(18, 40);
                scatter('metal_groan', 12, 22, 0.55, between(0.85, 1.1), true);
            }
        }

        if (player.alive && player.health / player.maxHealth < LOW_HEALTH) {
            const fraction = Math.max(0, player.health / player.maxHealth);
            t.heart -= delta;
            if (t.heart <= 0) {
                t.heart = 0.55 + (fraction / LOW_HEALTH) * 0.65;
                play('heartbeat', { bus: 'ui', volume: 0.95 - fraction, priority: 2 });
            }
            t.pant -= delta;
            if (t.pant <= 0) {
                t.pant = between(3.5, 5.5);
                play('p_pant', { bus: 'voice', volume: 0.7, priority: 1 });
            }
        } else {
            t.heart = 0;
        }

        t.enemy -= delta;
        if (t.enemy > 0) return;
        t.enemy = ENEMY_INTERVAL;

        const px = player.position.x;
        const pz = player.position.z;
        t.groan -= ENEMY_INTERVAL;
        t.flap -= ENEMY_INTERVAL;
        t.hiss -= ENEMY_INTERVAL;
        const wantGroan = t.groan <= 0;
        const wantFlap = t.flap <= 0;
        const wantHiss = t.hiss <= 0;
        if (!wantGroan && !wantFlap && !wantHiss) return;

        let groanPick = -1;
        let groanSeen = 0;
        let flapped = 0;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.alive) continue;
            const dx = e.position.x - px;
            const dz = e.position.z - pz;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (wantGroan && distance < GROAN_RANGE) {
                groanSeen++;
                if (Math.random() * groanSeen < 1) groanPick = i;
            }
            if (wantFlap && e.archetype === 'flyer' && distance < FLAP_RANGE && flapped < 2) {
                flyerFlap(e);
                flapped++;
            }
            if (wantHiss && e.archetype === 'exploder' && distance < HISS_RANGE) {
                exploderHiss(e);
                t.hiss = 0.55;
            }
        }
        if (wantGroan) {
            t.groan = between(0.9, 2.1);
            if (groanPick >= 0 && player.alive) enemyGroan(enemies[groanPick]);
        }
        if (wantFlap) t.flap = 0.42;
        if (wantHiss && t.hiss <= 0) t.hiss = 0.5;
    });

    return null;
}