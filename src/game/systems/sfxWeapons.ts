import { addEchoes, addGrains, addModes, addNoise, addTone, between, createBuffer, vary, type EchoTap } from './dsp.ts';
import type { Rng } from './random.ts';

type Task = Generator<void, Float32Array, void>;

type Gun = {
    length: number;
    crackHigh: number;
    crackGain: number;
    crackTau: number;
    snap: number;
    thumpFrom: number;
    thumpTo: number;
    thumpTau: number;
    thumpGain: number;
    bodyLow: number;
    bodyGain: number;
    bodyTau: number;
    tailGain: number;
    tailTau: number;
    tailFrom: number;
    tailTo: number;
    echoes: readonly EchoTap[];
    mechanical: number;
    mechanicalDelay: number;
};

function* gunshot(rng: Rng, g: Gun): Task {
    const out = createBuffer(g.length);
    addNoise(out, rng, { dur: 0.1, gain: g.crackGain, attack: 0.0005, tau: g.crackTau, filters: [['hp', vary(rng, g.crackHigh, 0.1)]] });
    if (g.snap > 0) {
        addModes(out, 0, [
            { f: vary(rng, g.snap, 0.05), tau: 0.008, gain: 0.5 },
            { f: vary(rng, g.snap * 2, 0.05), tau: 0.005, gain: 0.25 },
        ]);
    }
    addTone(out, { dur: g.thumpTau * 6, from: vary(rng, g.thumpFrom, 0.06), to: g.thumpTo, tau: g.thumpTau, gain: g.thumpGain, attack: 0.001 });
    yield;
    addNoise(out, rng, { dur: g.bodyTau * 6, gain: g.bodyGain, attack: 0.001, tau: g.bodyTau, filters: [['lp', g.bodyLow]] });
    yield;
    addNoise(out, rng, {
        dur: g.tailTau * 5,
        gain: g.tailGain,
        attack: 0.004,
        tau: g.tailTau,
        filters: [['lp', g.tailFrom]],
        sweep: { stage: 0, from: g.tailFrom, to: g.tailTo },
    });
    yield;
    if (g.mechanical > 0) {
        addModes(out, g.mechanicalDelay, [
            { f: vary(rng, 1900, 0.06), tau: 0.011, gain: g.mechanical },
            { f: vary(rng, 3500, 0.06), tau: 0.007, gain: g.mechanical * 0.5 },
        ]);
    }
    addEchoes(out, g.echoes);
    return out;
}

export function* shotPistol(rng: Rng): Task {
    return yield* gunshot(rng, {
        length: 0.85,
        crackHigh: 1200,
        crackGain: 1,
        crackTau: 0.012,
        snap: 3200,
        thumpFrom: 220,
        thumpTo: 70,
        thumpTau: 0.05,
        thumpGain: 0.9,
        bodyLow: 1800,
        bodyGain: 0.7,
        bodyTau: 0.04,
        tailGain: 0.25,
        tailTau: 0.22,
        tailFrom: 4000,
        tailTo: 600,
        echoes: [
            [0.09, 0.22, 2200],
            [0.19, 0.12, 1500],
            [0.33, 0.06, 1100],
        ],
        mechanical: 0.25,
        mechanicalDelay: 0.05,
    });
}

export function* shotSmg(rng: Rng): Task {
    return yield* gunshot(rng, {
        length: 0.5,
        crackHigh: 1600,
        crackGain: 0.9,
        crackTau: 0.008,
        snap: 3800,
        thumpFrom: 260,
        thumpTo: 90,
        thumpTau: 0.03,
        thumpGain: 0.65,
        bodyLow: 2200,
        bodyGain: 0.5,
        bodyTau: 0.025,
        tailGain: 0.18,
        tailTau: 0.12,
        tailFrom: 4500,
        tailTo: 900,
        echoes: [
            [0.06, 0.15, 2500],
            [0.14, 0.08, 1800],
        ],
        mechanical: 0.15,
        mechanicalDelay: 0.035,
    });
}

export function* shotRifle(rng: Rng): Task {
    return yield* gunshot(rng, {
        length: 1.2,
        crackHigh: 900,
        crackGain: 1,
        crackTau: 0.016,
        snap: 2600,
        thumpFrom: 190,
        thumpTo: 55,
        thumpTau: 0.07,
        thumpGain: 1,
        bodyLow: 1500,
        bodyGain: 0.85,
        bodyTau: 0.06,
        tailGain: 0.35,
        tailTau: 0.35,
        tailFrom: 3500,
        tailTo: 500,
        echoes: [
            [0.12, 0.26, 2000],
            [0.25, 0.16, 1400],
            [0.42, 0.09, 1000],
            [0.62, 0.05, 800],
        ],
        mechanical: 0.18,
        mechanicalDelay: 0.06,
    });
}

export function* shotShotgun(rng: Rng): Task {
    const out = yield* gunshot(rng, {
        length: 1.5,
        crackHigh: 500,
        crackGain: 1,
        crackTau: 0.022,
        snap: 1800,
        thumpFrom: 150,
        thumpTo: 42,
        thumpTau: 0.14,
        thumpGain: 1.2,
        bodyLow: 1200,
        bodyGain: 1,
        bodyTau: 0.1,
        tailGain: 0.4,
        tailTau: 0.45,
        tailFrom: 3000,
        tailTo: 400,
        echoes: [
            [0.1, 0.3, 1700],
            [0.24, 0.2, 1200],
            [0.4, 0.12, 900],
            [0.6, 0.07, 700],
        ],
        mechanical: 0,
        mechanicalDelay: 0,
    });
    addGrains(out, rng, { start: 0.01, dur: 0.09, count: 14, gain: 0.25, low: 1500, high: 6000, grain: 0.004 });
    return out;
}

export function* shotSniper(rng: Rng): Task {
    const out = yield* gunshot(rng, {
        length: 2,
        crackHigh: 700,
        crackGain: 1.1,
        crackTau: 0.02,
        snap: 2200,
        thumpFrom: 170,
        thumpTo: 50,
        thumpTau: 0.09,
        thumpGain: 1.1,
        bodyLow: 1400,
        bodyGain: 0.8,
        bodyTau: 0.07,
        tailGain: 0.35,
        tailTau: 0.55,
        tailFrom: 3200,
        tailTo: 450,
        echoes: [
            [0.16, 0.3, 1800],
            [0.33, 0.2, 1300],
            [0.55, 0.13, 1000],
            [0.8, 0.07, 800],
            [1.1, 0.04, 600],
        ],
        mechanical: 0,
        mechanicalDelay: 0,
    });
    addModes(out, 0, [{ f: vary(rng, 4400, 0.03), tau: 0.012, gain: 0.3 }]);
    return out;
}

export function* shotLauncher(rng: Rng): Task {
    const out = createBuffer(1.6);
    addTone(out, { dur: 0.7, from: vary(rng, 110, 0.05), to: 38, tau: 0.12, gain: 1.1, attack: 0.002 });
    yield;
    addNoise(out, rng, { dur: 0.5, gain: 0.8, attack: 0.002, tau: 0.09, filters: [['lp', 900]] });
    yield;
    addNoise(out, rng, { dur: 1.35, gain: 0.55, attack: 0.05, tau: 0.25, filters: [['bp', 600, 0.9]], sweep: { stage: 0, from: 250, to: 1800 } });
    yield;
    addNoise(out, rng, { dur: 0.04, gain: 0.5, attack: 0.0005, tau: 0.008, filters: [['hp', 900]] });
    addModes(out, 0, [{ f: vary(rng, 800, 0.05), tau: 0.02, gain: 0.35 }]);
    addEchoes(out, [
        [0.12, 0.25, 1500],
        [0.3, 0.14, 1000],
        [0.55, 0.08, 800],
    ]);
    return out;
}

export function* explosion(rng: Rng): Task {
    const out = createBuffer(2.4);
    addTone(out, { dur: 1.4, from: vary(rng, 90, 0.08), to: 24, tau: 0.35, gain: 1.2, attack: 0.002 });
    yield;
    addNoise(out, rng, { dur: 1.2, gain: 1, attack: 0.002, tau: 0.5, filters: [['lp', 2500]], sweep: { stage: 0, from: 2500, to: 200 } });
    yield;
    addNoise(out, rng, { dur: 0.15, gain: 0.9, attack: 0.0005, tau: 0.03, filters: [['hp', 800]] });
    addNoise(out, rng, { dur: 1.6, gain: 0.8, attack: 0.05, tau: 0.8, filters: [['lp', 160]] });
    yield;
    addGrains(out, rng, { start: 0.1, dur: 1.2, count: 50, gain: 0.25, low: 800, high: 5000, grain: 0.008, skew: 1.5 });
    addEchoes(out, [
        [0.14, 0.25, 1500],
        [0.31, 0.18, 1100],
        [0.55, 0.1, 800],
    ]);
    return out;
}

export function meleeSwing(rng: Rng): Float32Array {
    const out = createBuffer(0.4);
    addNoise(out, rng, { dur: 0.26, gain: 0.8, attack: 0.07, tau: 0.08, filters: [['bp', 600, 0.8]], sweep: { stage: 0, from: between(rng, 450, 600), to: between(rng, 2000, 2800) } });
    addNoise(out, rng, { start: 0.04, dur: 0.18, gain: 0.25, attack: 0.05, tau: 0.05, filters: [['hp', 3000]] });
    return out;
}

export function meleeHit(rng: Rng): Float32Array {
    const out = createBuffer(0.4);
    addModes(out, 0, [
        { f: vary(rng, 95, 0.08), tau: 0.06, gain: 1 },
        { f: vary(rng, 210, 0.08), tau: 0.04, gain: 0.6 },
    ]);
    addNoise(out, rng, { dur: 0.12, gain: 0.8, attack: 0.001, tau: 0.03, filters: [['lp', 1400]] });
    addNoise(out, rng, { dur: 0.04, gain: 0.5, attack: 0.0005, tau: 0.008, filters: [['bp', 2500, 0.8]] });
    return out;
}

export function hitFlesh(rng: Rng): Float32Array {
    const out = createBuffer(0.3);
    addModes(out, 0, [
        { f: vary(rng, 150, 0.1), tau: 0.035, gain: 1 },
        { f: vary(rng, 320, 0.1), tau: 0.02, gain: 0.4 },
    ]);
    addNoise(out, rng, { dur: 0.1, gain: 0.8, attack: 0.0008, tau: 0.025, filters: [['lp', 1800]] });
    addTone(out, { start: 0.01, dur: 0.05, from: 300, to: 650, tau: 0.012, gain: 0.25 });
    addNoise(out, rng, { dur: 0.015, gain: 0.35, attack: 0.0003, tau: 0.003, filters: [['hp', 2500]] });
    return out;
}

export function dryClick(rng: Rng): Float32Array {
    const out = createBuffer(0.12);
    addModes(out, 0, [
        { f: vary(rng, 2200, 0.05), tau: 0.006, gain: 0.6 },
        { f: vary(rng, 1100, 0.05), tau: 0.01, gain: 0.4 },
    ]);
    addNoise(out, rng, { dur: 0.01, gain: 0.5, attack: 0.0003, tau: 0.002, filters: [['hp', 2000]] });
    return out;
}

function slideFriction(out: Float32Array, rng: Rng, start: number, dur: number, from: number, to: number, gain: number) {
    addNoise(out, rng, {
        start,
        dur,
        gain,
        attack: dur * 0.2,
        tau: dur * 0.7,
        filters: [['bp', from, 0.9]],
        sweep: { stage: 0, from, to },
    });
}

export function reloadMagOut(rng: Rng): Float32Array {
    const out = createBuffer(0.35);
    addModes(out, 0, [{ f: vary(rng, 2800, 0.04), tau: 0.005, gain: 0.6 }]);
    addNoise(out, rng, { dur: 0.012, gain: 0.5, attack: 0.0003, tau: 0.002, filters: [['hp', 3000]] });
    slideFriction(out, rng, 0.05, 0.1, 2000, 3500, 0.25);
    addModes(out, 0.14, [
        { f: vary(rng, 190, 0.08), tau: 0.04, gain: 0.8 },
        { f: vary(rng, 420, 0.08), tau: 0.025, gain: 0.4 },
    ]);
    return out;
}

export function reloadMagIn(rng: Rng): Float32Array {
    const out = createBuffer(0.4);
    slideFriction(out, rng, 0, 0.09, 2000, 3200, 0.3);
    addModes(out, 0.09, [
        { f: vary(rng, 1100, 0.05), tau: 0.018, gain: 0.7 },
        { f: vary(rng, 2400, 0.05), tau: 0.012, gain: 0.5 },
        { f: vary(rng, 4200, 0.05), tau: 0.006, gain: 0.3 },
        { f: vary(rng, 260, 0.05), tau: 0.05, gain: 0.6 },
    ]);
    addNoise(out, rng, { start: 0.09, dur: 0.02, gain: 0.5, attack: 0.0004, tau: 0.004, filters: [['hp', 1500]] });
    return out;
}

export function reloadSlide(rng: Rng): Float32Array {
    const out = createBuffer(0.45);
    slideFriction(out, rng, 0, 0.1, 1500, 3500, 0.35);
    addModes(out, 0.1, [
        { f: vary(rng, 1700, 0.05), tau: 0.015, gain: 0.5 },
        { f: vary(rng, 3300, 0.05), tau: 0.01, gain: 0.3 },
        { f: vary(rng, 5200, 0.05), tau: 0.03, gain: 0.1 },
    ]);
    slideFriction(out, rng, 0.13, 0.07, 3200, 1800, 0.3);
    addModes(out, 0.2, [
        { f: vary(rng, 900, 0.05), tau: 0.03, gain: 0.8 },
        { f: vary(rng, 2000, 0.05), tau: 0.02, gain: 0.5 },
        { f: vary(rng, 240, 0.05), tau: 0.04, gain: 0.4 },
    ]);
    addNoise(out, rng, { start: 0.2, dur: 0.02, gain: 0.5, attack: 0.0004, tau: 0.004, filters: [['hp', 1500]] });
    return out;
}

export function reloadShell(rng: Rng): Float32Array {
    const out = createBuffer(0.25);
    slideFriction(out, rng, 0, 0.04, 1800, 2600, 0.15);
    addModes(out, 0.04, [
        { f: vary(rng, 1250, 0.06), tau: 0.02, gain: 0.7 },
        { f: vary(rng, 2900, 0.06), tau: 0.01, gain: 0.3 },
        { f: vary(rng, 160, 0.06), tau: 0.03, gain: 0.6 },
    ]);
    addNoise(out, rng, { start: 0.04, dur: 0.012, gain: 0.4, attack: 0.0003, tau: 0.003, filters: [['hp', 1500]] });
    return out;
}

export function reloadPump(rng: Rng): Float32Array {
    const out = createBuffer(0.55);
    slideFriction(out, rng, 0, 0.07, 1400, 2800, 0.3);
    addModes(out, 0.07, [
        { f: vary(rng, 1000, 0.05), tau: 0.025, gain: 0.6 },
        { f: vary(rng, 2200, 0.05), tau: 0.015, gain: 0.4 },
    ]);
    slideFriction(out, rng, 0.2, 0.07, 2800, 1400, 0.3);
    addModes(out, 0.27, [
        { f: vary(rng, 900, 0.05), tau: 0.035, gain: 0.9 },
        { f: vary(rng, 2000, 0.05), tau: 0.02, gain: 0.55 },
        { f: vary(rng, 220, 0.05), tau: 0.05, gain: 0.55 },
    ]);
    addNoise(out, rng, { start: 0.27, dur: 0.02, gain: 0.5, attack: 0.0004, tau: 0.004, filters: [['hp', 1200]] });
    return out;
}

export function reloadBolt(rng: Rng): Float32Array {
    const out = createBuffer(0.6);
    addModes(out, 0, [{ f: vary(rng, 2500, 0.04), tau: 0.008, gain: 0.5 }]);
    slideFriction(out, rng, 0.05, 0.13, 2200, 3000, 0.3);
    addModes(out, 0.18, [{ f: vary(rng, 3100, 0.04), tau: 0.01, gain: 0.35 }]);
    slideFriction(out, rng, 0.26, 0.09, 3000, 2000, 0.3);
    addModes(out, 0.36, [
        { f: vary(rng, 1300, 0.05), tau: 0.03, gain: 0.8 },
        { f: vary(rng, 2800, 0.05), tau: 0.02, gain: 0.5 },
        { f: vary(rng, 190, 0.05), tau: 0.06, gain: 0.6 },
    ]);
    addNoise(out, rng, { start: 0.36, dur: 0.02, gain: 0.5, attack: 0.0004, tau: 0.004, filters: [['hp', 1200]] });
    return out;
}

export function reloadLauncher(rng: Rng): Float32Array {
    const out = createBuffer(0.7);
    addModes(out, 0, [
        { f: vary(rng, 130, 0.06), tau: 0.1, gain: 1 },
        { f: vary(rng, 380, 0.06), tau: 0.06, gain: 0.6 },
        { f: vary(rng, 1200, 0.06), tau: 0.03, gain: 0.4 },
    ]);
    slideFriction(out, rng, 0.12, 0.25, 700, 1300, 0.35);
    addModes(out, 0.42, [
        { f: vary(rng, 520, 0.05), tau: 0.05, gain: 0.8 },
        { f: vary(rng, 1500, 0.05), tau: 0.03, gain: 0.5 },
        { f: vary(rng, 3000, 0.05), tau: 0.012, gain: 0.3 },
    ]);
    addNoise(out, rng, { start: 0.42, dur: 0.02, gain: 0.5, attack: 0.0004, tau: 0.004, filters: [['hp', 1000]] });
    return out;
}

export function botZap(rng: Rng): Float32Array {
    const out = createBuffer(0.3);
    addTone(out, { dur: 0.12, from: vary(rng, 2200, 0.05), to: 650, tau: 0.04, gain: 0.7, wave: 'softSquare' });
    addNoise(out, rng, { dur: 0.05, gain: 0.5, attack: 0.0005, tau: 0.01, filters: [['hp', 2500]] });
    addTone(out, { start: 0.01, dur: 0.1, from: 4400, to: 1500, tau: 0.03, gain: 0.25 });
    return out;
}

export function botPulse(rng: Rng): Float32Array {
    const out = createBuffer(1.0);
    addTone(out, { dur: 0.6, from: vary(rng, 220, 0.04), to: 55, tau: 0.15, gain: 1, attack: 0.003 });
    addNoise(out, rng, { dur: 0.7, gain: 0.6, attack: 0.04, tau: 0.2, filters: [['bp', 800, 0.8]], sweep: { stage: 0, from: 400, to: 3600 } });
    addGrains(out, rng, { start: 0.05, dur: 0.5, count: 18, gain: 0.15, low: 4000, high: 9000, grain: 0.004 });
    return out;
}

export function botShieldBreak(rng: Rng): Float32Array {
    const out = createBuffer(0.7);
    addNoise(out, rng, { dur: 0.04, gain: 0.8, attack: 0.0004, tau: 0.008, filters: [['hp', 2500]] });
    addGrains(out, rng, { dur: 0.3, count: 30, gain: 0.3, low: 3000, high: 9000, grain: 0.004, skew: 1.2 });
    addModes(out, 0, [
        { f: vary(rng, 2400, 0.04), tau: 0.1, gain: 0.5 },
        { f: vary(rng, 3700, 0.04), tau: 0.07, gain: 0.3 },
    ]);
    addTone(out, { dur: 0.35, from: 900, to: 220, tau: 0.1, gain: 0.45, wave: 'triangle' });
    return out;
}

export function botShieldUp(rng: Rng): Float32Array {
    const out = createBuffer(0.8);
    addTone(out, { dur: 0.35, from: 440, to: 1320, tau: 0.2, gain: 0.5, attack: 0.05 });
    addTone(out, { start: 0.12, dur: 0.4, from: 660, to: 1980, tau: 0.2, gain: 0.3, attack: 0.05 });
    addModes(out, 0.3, [
        { f: vary(rng, 1760, 0.01), tau: 0.25, gain: 0.35 },
        { f: vary(rng, 2640, 0.01), tau: 0.18, gain: 0.2 },
    ]);
    return out;
}

export function botHeal(rng: Rng): Float32Array {
    const out = createBuffer(0.6);
    addTone(out, { dur: 0.4, from: vary(rng, 880, 0.01), to: 880, tau: 0.15, gain: 0.5, attack: 0.03 });
    addTone(out, { start: 0.1, dur: 0.45, from: 1320, to: 1320, tau: 0.17, gain: 0.3, attack: 0.03 });
    return out;
}