import { addEchoes, addGrains, addNoise, addTone, addVoice, between, createBuffer, vary, voiceSteps, type FormantSpec } from './dsp.ts';
import type { Rng } from './random.ts';

type Task = Generator<void, Float32Array, void>;

const AA: readonly FormantSpec[] = [
    [730, 10, 1],
    [1090, 12, 0.6],
    [2440, 18, 0.35],
    [3400, 22, 0.15],
];
const UH: readonly FormantSpec[] = [
    [640, 10, 1],
    [1190, 12, 0.55],
    [2390, 18, 0.3],
    [3300, 22, 0.12],
];
const OH: readonly FormantSpec[] = [
    [570, 10, 1],
    [840, 12, 0.65],
    [2410, 18, 0.25],
    [3300, 22, 0.1],
];
const OO: readonly FormantSpec[] = [
    [300, 9, 1],
    [870, 12, 0.5],
    [2240, 18, 0.2],
    [3300, 22, 0.08],
];
const EE: readonly FormantSpec[] = [
    [270, 9, 1],
    [2290, 14, 0.7],
    [3010, 18, 0.45],
    [3800, 22, 0.2],
];

type Contour = ReadonlyArray<readonly [number, number]>;

function contour(points: Contour): (t: number, dur: number) => number {
    return (t, dur) => {
        const u = t / dur;
        for (let i = 1; i < points.length; i++) {
            if (u <= points[i][0]) {
                const a = points[i - 1];
                const b = points[i];
                return a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0]);
            }
        }
        return points[points.length - 1][1];
    };
}

function swell(t: number, dur: number): number {
    const u = t / dur;
    return 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.1));
}

export function* zombieIdle(rng: Rng, variant: number): Task {
    const dur = between(rng, 0.9, 1.5);
    const out = createBuffer(dur + 0.1);
    const base = between(rng, 72, 100);
    const vowel = [UH, OH, AA, OO][variant % 4];
    yield* voiceSteps(out, rng, {
        dur,
        pitch: contour([[0, base * 0.9], [0.3, base * 1.15], [0.7, base], [1, base * 0.7]]),
        formants: vowel,
        formantScale: contour([[0, 0.92], [0.5, 1.08], [1, 0.9]]),
        breath: 0.55,
        rough: { rate: between(rng, 24, 38), depth: 0.55 },
        jitter: 0.04,
        attack: 0.18,
        release: 0.3,
        shape: swell,
    });
    return out;
}

export function* zombieAttack(rng: Rng): Task {
    const dur = between(rng, 0.38, 0.55);
    const out = createBuffer(dur + 0.1);
    const base = between(rng, 130, 170);
    yield* voiceSteps(out, rng, {
        dur,
        pitch: contour([[0, base], [0.3, base * 1.45], [1, base * 0.8]]),
        formants: AA,
        formantScale: contour([[0, 0.95], [0.4, 1.2], [1, 1]]),
        breath: 0.75,
        rough: { rate: between(rng, 48, 62), depth: 0.7 },
        jitter: 0.06,
        attack: 0.02,
        release: 0.12,
    });
    return out;
}

export function zombieHurt(rng: Rng): Float32Array {
    const dur = between(rng, 0.2, 0.32);
    const out = createBuffer(dur + 0.1);
    const base = between(rng, 150, 200);
    addVoice(out, rng, {
        dur,
        pitch: contour([[0, base * 1.1], [1, base * 0.65]]),
        formants: AA,
        formantScale: contour([[0, 1.1], [1, 0.85]]),
        breath: 0.4,
        rough: { rate: between(rng, 34, 46), depth: 0.5 },
        jitter: 0.05,
        attack: 0.008,
        release: 0.1,
    });
    return out;
}

export function* zombieDie(rng: Rng): Task {
    const dur = between(rng, 1.0, 1.4);
    const out = createBuffer(dur + 0.3);
    const base = between(rng, 110, 135);
    yield* voiceSteps(out, rng, {
        dur,
        pitch: contour([[0, base], [0.4, base * 0.75], [1, base * 0.42]]),
        formants: AA,
        formantScale: contour([[0, 1.05], [0.6, 0.9], [1, 0.75]]),
        breath: 0.6,
        rough: { rate: between(rng, 15, 20), depth: 0.7 },
        jitter: 0.07,
        attack: 0.03,
        release: 0.4,
        shape: (t, d) => 1 - 0.4 * (t / d),
    });
    addNoise(out, rng, {
        start: 0.25,
        dur: 0.8,
        gain: 0.5,
        attack: 0.1,
        tau: 0.3,
        filters: [['lp', 700]],
        tremolo: { rate: between(rng, 11, 16), depth: 0.9 },
    });
    return out;
}

export function* flyerScreech(rng: Rng): Task {
    const dur = between(rng, 0.45, 0.7);
    const out = createBuffer(dur + 0.1);
    const base = between(rng, 560, 720);
    yield* voiceSteps(out, rng, {
        dur,
        pitch: contour([[0, base], [0.5, base * 2.1], [1, base * 1.4]]),
        formants: EE,
        formantScale: contour([[0, 1], [0.5, 1.15], [1, 1]]),
        breath: 0.3,
        rough: { rate: between(rng, 60, 80), depth: 0.4 },
        jitter: 0.03,
        attack: 0.03,
        release: 0.15,
    });
    return out;
}

export function flyerFlap(rng: Rng): Float32Array {
    const out = createBuffer(0.4);
    addNoise(out, rng, { dur: 0.3, gain: 0.8, attack: 0.04, tau: 0.08, filters: [['lp', 520]] });
    addNoise(out, rng, {
        dur: 0.3,
        gain: 0.4,
        attack: 0.03,
        tau: 0.09,
        filters: [['bp', 1800, 0.8]],
        tremolo: { rate: between(rng, 34, 46), depth: 0.8 },
    });
    return out;
}

export function playerHurt(rng: Rng): Float32Array {
    const dur = between(rng, 0.22, 0.32);
    const out = createBuffer(dur + 0.1);
    const base = between(rng, 105, 145);
    addVoice(out, rng, {
        dur,
        pitch: contour([[0, base * 1.1], [1, base * 0.8]]),
        formants: UH,
        formantScale: contour([[0, 1.1], [1, 0.95]]),
        breath: 0.35,
        jitter: 0.02,
        attack: 0.01,
        release: 0.1,
    });
    addNoise(out, rng, { dur: 0.22, gain: 0.25, attack: 0.002, tau: 0.04, filters: [['bp', 1600, 0.7]] });
    return out;
}

export function* playerDeath(rng: Rng): Task {
    const dur = 1.3;
    const out = createBuffer(dur + 0.3);
    const base = between(rng, 118, 135);
    yield* voiceSteps(out, rng, {
        dur,
        pitch: contour([[0, base * 1.1], [0.3, base], [1, base * 0.5]]),
        formants: UH,
        formantScale: contour([[0, 1.1], [0.5, 0.95], [1, 0.8]]),
        breath: 0.5,
        jitter: 0.04,
        attack: 0.02,
        release: 0.5,
        shape: (t, d) => 1 - 0.5 * (t / d),
    });
    return out;
}

export function playerPant(rng: Rng): Float32Array {
    const out = createBuffer(1.4);
    addNoise(out, rng, { dur: 0.45, gain: 0.7, attack: 0.18, tau: 0.2, filters: [['bp', 1400, 0.6]], sweep: { stage: 0, from: 900, to: 1800 } });
    addNoise(out, rng, { start: 0.55, dur: 0.6, gain: 0.8, attack: 0.1, tau: 0.25, filters: [['bp', 1100, 0.6]], sweep: { stage: 0, from: 1500, to: 800 } });
    addNoise(out, rng, { start: 0.1, dur: 0.9, gain: 0.25, attack: 0.1, tau: 0.3, filters: [['lp', 400]] });
    return out;
}

export function acidSpit(rng: Rng): Float32Array {
    const out = createBuffer(0.7);
    addNoise(out, rng, { dur: 0.3, gain: 0.7, attack: 0.08, tau: 0.12, filters: [['bp', 900, 0.8]], sweep: { stage: 0, from: 800, to: 2400 } });
    addVoice(out, rng, {
        dur: 0.25,
        gain: 0.5,
        pitch: contour([[0, 100], [1, 65]]),
        formants: OH,
        breath: 0.5,
        rough: { rate: 40, depth: 0.7 },
        attack: 0.02,
        release: 0.1,
    });
    addNoise(out, rng, { start: 0.25, dur: 0.2, gain: 0.6, attack: 0.002, tau: 0.04, filters: [['bp', 1200, 0.9]] });
    for (let k = 0; k < 4; k++) {
        const f = between(rng, 300, 900);
        addTone(out, { start: between(rng, 0.2, 0.45), dur: 0.04, from: f, to: f * 2, tau: 0.012, gain: 0.3 });
    }
    return out;
}

export function acidSplat(rng: Rng): Float32Array {
    const out = createBuffer(0.8);
    addNoise(out, rng, { dur: 0.2, gain: 0.8, attack: 0.002, tau: 0.05, filters: [['lp', 1600]] });
    addNoise(out, rng, { dur: 0.3, gain: 0.6, attack: 0.004, tau: 0.08, filters: [['bp', 700, 0.8]], sweep: { stage: 0, from: 1200, to: 400 } });
    for (let k = 0; k < 5; k++) {
        const f = between(rng, 250, 900);
        addTone(out, { start: between(rng, 0.02, 0.3), dur: 0.05, from: f, to: f * 2.1, tau: 0.014, gain: 0.3 });
    }
    addGrains(out, rng, { start: 0.1, dur: 0.5, count: 30, gain: 0.14, low: 4000, high: 9000, grain: 0.004 });
    return out;
}

export function fuseHiss(rng: Rng): Float32Array {
    const out = createBuffer(0.7);
    addNoise(out, rng, { dur: 0.6, gain: 0.6, attack: 0.05, tau: 0.3, filters: [['hp', 3000], ['bp', 5200, 0.6]], tremolo: { rate: 24, depth: 0.4 } });
    addGrains(out, rng, { dur: 0.6, count: 20, gain: 0.3, low: 2500, high: 8000, grain: 0.003 });
    addEchoes(out, [[0.05, 0.1, 3000]]);
    return out;
}

export function birdCall(rng: Rng, variant: number): Float32Array {
    const out = createBuffer(1.1);
    const kind = variant % 3;
    const pitch = between(rng, 0.9, 1.15);
    if (kind === 0) {
        const chirps = 3 + Math.floor(rng() * 3);
        for (let k = 0; k < chirps; k++) {
            addTone(out, { start: k * 0.13, dur: 0.09, from: 2800 * pitch, to: 4200 * pitch, tau: 0.04, gain: 0.8, attack: 0.006, vibrato: { rate: 28, depth: 0.03 } });
        }
    } else if (kind === 1) {
        addTone(out, { dur: 0.28, from: 3300 * pitch, to: 2500 * pitch, tau: 0.14, gain: 0.8, attack: 0.03 });
        addTone(out, { start: 0.32, dur: 0.35, from: 2900 * pitch, to: 2200 * pitch, tau: 0.18, gain: 0.8, attack: 0.03 });
    } else {
        const blips = 8 + Math.floor(rng() * 5);
        for (let k = 0; k < blips; k++) {
            addTone(out, { start: k * 0.045, dur: 0.03, from: (k % 2 === 0 ? 3600 : 4500) * pitch, tau: 0.012, gain: 0.7, attack: 0.002 });
        }
    }
    addEchoes(out, [[0.12, 0.2, 5000], [0.27, 0.1, 4000]]);
    return out;
}

export function parrotSquawk(rng: Rng): Float32Array {
    const out = createBuffer(0.7);
    addVoice(out, rng, {
        dur: 0.38,
        pitch: contour([[0, 720], [0.3, 980], [1, 560]]),
        formants: EE,
        formantScale: contour([[0, 1.1], [1, 0.9]]),
        breath: 0.5,
        rough: { rate: 85, depth: 0.6 },
        jitter: 0.03,
        attack: 0.015,
        release: 0.12,
    });
    addEchoes(out, [[0.14, 0.2, 4000]]);
    return out;
}

export function frogCroak(rng: Rng): Float32Array {
    const out = createBuffer(0.8);
    const base = between(rng, 150, 190);
    for (let k = 0; k < 2; k++) {
        addVoice(out, rng, {
            start: k * 0.26,
            dur: 0.2,
            pitch: contour([[0, base], [1, base * 0.8]]),
            formants: [[500, 6, 1], [1400, 8, 0.5]],
            breath: 0.15,
            rough: { rate: 58, depth: 0.9 },
            attack: 0.02,
            release: 0.05,
        });
    }
    addEchoes(out, [[0.09, 0.2, 2500]]);
    return out;
}

export function waterDrip(rng: Rng): Float32Array {
    const out = createBuffer(0.7);
    const f = vary(rng, 1500, 0.2);
    addTone(out, { dur: 0.05, from: f * 0.55, to: f, tau: 0.02, gain: 0.8, attack: 0.001 });
    addTone(out, { start: 0.02, dur: 0.15, from: f * 0.8, to: f * 0.8, tau: 0.05, gain: 0.25 });
    addEchoes(out, [
        [0.08, 0.32, 2400],
        [0.17, 0.18, 1800],
        [0.29, 0.1, 1400],
    ]);
    return out;
}

export function branchSnap(rng: Rng): Float32Array {
    const out = createBuffer(0.9);
    addNoise(out, rng, { dur: 0.06, gain: 1, attack: 0.0004, tau: 0.01, filters: [['hp', 700]] });
    addNoise(out, rng, { start: between(rng, 0.03, 0.06), dur: 0.04, gain: 0.5, attack: 0.0004, tau: 0.006, filters: [['hp', 1200]] });
    addEchoes(out, [
        [0.14, 0.3, 2400],
        [0.31, 0.16, 1700],
        [0.55, 0.08, 1200],
    ]);
    return out;
}