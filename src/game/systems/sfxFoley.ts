import { addBell, addEchoes, addGrains, addModes, addNoise, addTone, between, createBuffer, mixInto, vary, type EchoTap } from './dsp.ts';
import type { Rng } from './random.ts';

type Contact = (out: Float32Array, at: number, strength: number) => void;

function twoContacts(rng: Rng, length: number, delay: number, toeGain: number, draw: Contact): Float32Array {
    const out = createBuffer(length);
    draw(out, 0, 1);
    draw(out, delay * vary(rng, 1, 0.18), toeGain * vary(rng, 1, 0.15));
    return out;
}

type HardSurface = {
    clickHigh: number;
    clickGain: number;
    clickTau: number;
    thump: number;
    thumpTau: number;
    thumpGain: number;
    ring: number;
    ringTau: number;
    ringGain: number;
    grit: number;
    gritLow: number;
    gritHigh: number;
    toeGain: number;
    toeDelay: number;
    length: number;
    echo: readonly EchoTap[];
};

function hardStep(rng: Rng, p: HardSurface): Float32Array {
    const out = twoContacts(rng, p.length, p.toeDelay, p.toeGain, (buffer, at, s) => {
        addNoise(buffer, rng, {
            start: at,
            dur: 0.05,
            gain: p.clickGain * s,
            attack: 0.0004,
            tau: p.clickTau,
            filters: [['hp', vary(rng, p.clickHigh, 0.2)], ['lp', 9000]],
        });
        addModes(buffer, at, [
            { f: vary(rng, p.thump, 0.12), tau: p.thumpTau, gain: p.thumpGain * s },
            { f: vary(rng, p.thump * 2.3, 0.1), tau: p.thumpTau * 0.6, gain: p.thumpGain * 0.35 * s },
        ]);
        if (p.ring > 0) {
            addModes(buffer, at, [
                { f: vary(rng, p.ring, 0.1), tau: p.ringTau, gain: p.ringGain * s },
                { f: vary(rng, p.ring * 1.62, 0.1), tau: p.ringTau * 0.6, gain: p.ringGain * 0.5 * s },
            ]);
        }
        if (p.grit > 0) {
            addNoise(buffer, rng, {
                start: at,
                dur: 0.07,
                gain: p.grit * s,
                attack: 0.001,
                tau: 0.02,
                filters: [['bp', between(rng, p.gritLow, p.gritHigh), 0.8]],
            });
        }
    });
    if (p.echo.length > 0) addEchoes(out, p.echo);
    return out;
}

export function stepConcrete(rng: Rng): Float32Array {
    return hardStep(rng, {
        clickHigh: 1400,
        clickGain: 0.7,
        clickTau: 0.006,
        thump: 150,
        thumpTau: 0.03,
        thumpGain: 0.9,
        ring: 520,
        ringTau: 0.04,
        ringGain: 0.1,
        grit: 0.25,
        gritLow: 3000,
        gritHigh: 6000,
        toeGain: 0.5,
        toeDelay: 0.07,
        length: 0.34,
        echo: [
            [0.021, 0.14, 3000],
            [0.047, 0.08, 2500],
        ],
    });
}

export function stepPavement(rng: Rng): Float32Array {
    return hardStep(rng, {
        clickHigh: 1800,
        clickGain: 0.65,
        clickTau: 0.005,
        thump: 170,
        thumpTau: 0.025,
        thumpGain: 0.8,
        ring: 780,
        ringTau: 0.035,
        ringGain: 0.16,
        grit: 0.4,
        gritLow: 3500,
        gritHigh: 7000,
        toeGain: 0.5,
        toeDelay: 0.065,
        length: 0.28,
        echo: [[0.035, 0.05, 2500]],
    });
}

export function stepAsphalt(rng: Rng): Float32Array {
    return hardStep(rng, {
        clickHigh: 1000,
        clickGain: 0.45,
        clickTau: 0.004,
        thump: 120,
        thumpTau: 0.035,
        thumpGain: 0.9,
        ring: 0,
        ringTau: 0,
        ringGain: 0,
        grit: 0.6,
        gritLow: 2000,
        gritHigh: 5000,
        toeGain: 0.55,
        toeDelay: 0.07,
        length: 0.26,
        echo: [],
    });
}

export function stepTile(rng: Rng): Float32Array {
    return hardStep(rng, {
        clickHigh: 2200,
        clickGain: 0.95,
        clickTau: 0.004,
        thump: 190,
        thumpTau: 0.022,
        thumpGain: 0.55,
        ring: 2600,
        ringTau: 0.035,
        ringGain: 0.25,
        grit: 0.1,
        gritLow: 4000,
        gritHigh: 7000,
        toeGain: 0.55,
        toeDelay: 0.06,
        length: 0.42,
        echo: [
            [0.017, 0.2, 5000],
            [0.038, 0.14, 4500],
            [0.068, 0.08, 4000],
        ],
    });
}

type WoodSurface = { low: number; knock: number; lowTau: number; click: number; delay: number; length: number; ring: number };

function woodStep(rng: Rng, p: WoodSurface): Float32Array {
    const out = twoContacts(rng, p.length, p.delay, 0.6, (buffer, at, s) => {
        addModes(buffer, at, [
            { f: vary(rng, p.low, 0.1), tau: p.lowTau, gain: s },
            { f: vary(rng, p.low * 1.85, 0.1), tau: p.lowTau * 0.7, gain: 0.5 * s },
            { f: vary(rng, p.knock, 0.08), tau: 0.03, gain: 0.45 * s },
            { f: vary(rng, p.knock * 2.4, 0.08), tau: 0.02, gain: 0.2 * s },
        ]);
        if (p.ring > 0) addModes(buffer, at, [{ f: vary(rng, p.ring, 0.06), tau: 0.025, gain: 0.25 * s }]);
        addNoise(buffer, rng, { start: at, dur: 0.06, gain: p.click * s, attack: 0.0005, tau: 0.007, filters: [['bp', 1200, 0.7]] });
        addNoise(buffer, rng, { start: at, dur: 0.12, gain: 0.35 * s, attack: 0.002, tau: 0.03, filters: [['lp', 700]] });
    });
    addEchoes(out, [
        [0.012, 0.15, 1500],
        [0.029, 0.09, 1200],
    ]);
    return out;
}

export function stepWood(rng: Rng): Float32Array {
    return woodStep(rng, { low: 115, knock: 330, lowTau: 0.075, click: 0.5, delay: 0.075, length: 0.4, ring: 0 });
}

export function stepStairs(rng: Rng): Float32Array {
    return woodStep(rng, { low: 140, knock: 480, lowTau: 0.05, click: 0.7, delay: 0.05, length: 0.3, ring: 900 });
}

export function stepCarpet(rng: Rng): Float32Array {
    return twoContacts(rng, 0.3, 0.08, 0.6, (buffer, at, s) => {
        addNoise(buffer, rng, { start: at, dur: 0.22, gain: 0.9 * s, attack: 0.008, tau: 0.045, filters: [['lp', vary(rng, 650, 0.15)]] });
        addModes(buffer, at, [{ f: vary(rng, 85, 0.1), tau: 0.05, gain: 0.8 * s }]);
        addNoise(buffer, rng, { start: at, dur: 0.15, gain: 0.07 * s, attack: 0.01, tau: 0.04, filters: [['hp', 2500]] });
    });
}

export function stepGrass(rng: Rng): Float32Array {
    return twoContacts(rng, 0.42, 0.075, 0.6, (buffer, at, s) => {
        addNoise(buffer, rng, {
            start: at,
            dur: 0.3,
            gain: 0.55 * s,
            attack: 0.015,
            tau: 0.06,
            filters: [['bp', vary(rng, 3200, 0.18), 0.7], ['hp', 800]],
        });
        addModes(buffer, at, [{ f: vary(rng, 90, 0.1), tau: 0.04, gain: 0.5 * s }]);
        addNoise(buffer, rng, { start: at, dur: 0.15, gain: 0.4 * s, attack: 0.004, tau: 0.04, filters: [['lp', 320]] });
        addGrains(buffer, rng, { start: at, dur: 0.16, count: 14, gain: 0.14 * s, low: 4000, high: 9000, grain: 0.004 });
    });
}

export function stepLeaves(rng: Rng): Float32Array {
    return twoContacts(rng, 0.5, 0.09, 0.6, (buffer, at, s) => {
        addGrains(buffer, rng, { start: at, dur: 0.26, count: Math.round(55 * s), gain: 0.28 * s, low: 1800, high: 7500, grain: 0.005, skew: 1.4 });
        addNoise(buffer, rng, { start: at, dur: 0.4, gain: 0.22 * s, attack: 0.02, tau: 0.12, filters: [['bp', vary(rng, 5200, 0.12), 0.5]] });
        addModes(buffer, at, [{ f: vary(rng, 100, 0.1), tau: 0.035, gain: 0.35 * s }]);
    });
}

export function stepDirt(rng: Rng): Float32Array {
    return twoContacts(rng, 0.3, 0.075, 0.55, (buffer, at, s) => {
        addNoise(buffer, rng, { start: at, dur: 0.2, gain: 0.75 * s, attack: 0.003, tau: 0.035, filters: [['lp', vary(rng, 1600, 0.15)]] });
        addModes(buffer, at, [{ f: vary(rng, 105, 0.1), tau: 0.05, gain: 0.8 * s }]);
        addGrains(buffer, rng, { start: at, dur: 0.1, count: 10, gain: 0.25 * s, low: 1500, high: 3200, grain: 0.004 });
    });
}

export function stepMud(rng: Rng): Float32Array {
    return twoContacts(rng, 0.55, 0.11, 0.6, (buffer, at, s) => {
        addModes(buffer, at, [{ f: vary(rng, 70, 0.1), tau: 0.05, gain: 0.7 * s }]);
        addNoise(buffer, rng, {
            start: at,
            dur: 0.24,
            gain: 0.7 * s,
            attack: 0.012,
            tau: 0.07,
            filters: [['lp', vary(rng, 900, 0.15)], ['bp', 260, 1.2]],
            sweep: { stage: 1, from: 180, to: 520 },
        });
        for (let k = 0; k < 3; k++) {
            const f = between(rng, 150, 420);
            addTone(buffer, { start: at + between(rng, 0.03, 0.18), dur: 0.05, from: f, to: f * 2.1, tau: 0.016, gain: 0.35 * s });
        }
        addNoise(buffer, rng, { start: at, dur: 0.03, gain: 0.12 * s, attack: 0.0008, tau: 0.006, filters: [['bp', 1400, 1.2]] });
    });
}

export function stepGravel(rng: Rng): Float32Array {
    return twoContacts(rng, 0.42, 0.08, 0.65, (buffer, at, s) => {
        addGrains(buffer, rng, { start: at, dur: 0.18, count: Math.round(70 * s), gain: 0.34 * s, low: 1200, high: 7000, grain: 0.004, skew: 1.3 });
        addModes(buffer, at, [{ f: vary(rng, 110, 0.1), tau: 0.03, gain: 0.5 * s }]);
        for (let k = 0; k < 4; k++) {
            addModes(buffer, at + between(rng, 0, 0.1), [{ f: between(rng, 1200, 3000), tau: 0.006, gain: 0.2 * s }]);
        }
    });
}

export function stepDebris(rng: Rng): Float32Array {
    return twoContacts(rng, 0.45, 0.07, 0.6, (buffer, at, s) => {
        addGrains(buffer, rng, { start: at, dur: 0.2, count: Math.round(40 * s), gain: 0.3 * s, low: 2000, high: 9000, grain: 0.003, skew: 1.3 });
        for (let k = 0; k < 3; k++) {
            addModes(buffer, at + between(rng, 0, 0.12), [{ f: between(rng, 3200, 6200), tau: 0.02, gain: 0.16 * s }]);
        }
        addModes(buffer, at, [{ f: vary(rng, 140, 0.1), tau: 0.03, gain: 0.8 * s }]);
        addNoise(buffer, rng, { start: at, dur: 0.04, gain: 0.5 * s, attack: 0.0005, tau: 0.006, filters: [['hp', 1600]] });
    });
}

export function stepShallowWater(rng: Rng): Float32Array {
    return twoContacts(rng, 0.62, 0.1, 0.6, (buffer, at, s) => {
        addNoise(buffer, rng, { start: at, dur: 0.04, gain: 0.5 * s, attack: 0.0008, tau: 0.01, filters: [['hp', 1800]] });
        addNoise(buffer, rng, {
            start: at,
            dur: 0.3,
            gain: 0.8 * s,
            attack: 0.006,
            tau: 0.08,
            filters: [['bp', 1500, 0.8]],
            sweep: { stage: 0, from: 1600, to: 650 },
        });
        addNoise(buffer, rng, { start: at + 0.01, dur: 0.35, gain: 0.6 * s, attack: 0.03, tau: 0.12, filters: [['lp', 380]] });
        for (let k = 0; k < 4; k++) {
            const f = between(rng, 450, 1500);
            addTone(buffer, { start: at + between(rng, 0.02, 0.18), dur: 0.03, from: f, to: f * 2, tau: 0.01, gain: 0.3 * s });
        }
        addGrains(buffer, rng, { start: at + 0.08, dur: 0.25, count: 7, gain: 0.18 * s, low: 3500, high: 7500, grain: 0.003 });
    });
}

export function stepDeepWater(rng: Rng): Float32Array {
    return twoContacts(rng, 0.9, 0.16, 0.55, (buffer, at, s) => {
        addNoise(buffer, rng, {
            start: at,
            dur: 0.5,
            gain: 0.9 * s,
            attack: 0.05,
            tau: 0.2,
            filters: [['bp', 400, 0.6]],
            sweep: { stage: 0, from: 450, to: 200 },
        });
        addNoise(buffer, rng, { start: at, dur: 0.5, gain: 0.9 * s, attack: 0.06, tau: 0.25, filters: [['lp', 220]] });
        for (let k = 0; k < 5; k++) {
            const f = between(rng, 160, 600);
            addTone(buffer, { start: at + between(rng, 0.03, 0.3), dur: 0.06, from: f, to: f * 2, tau: 0.02, gain: 0.35 * s });
        }
        addGrains(buffer, rng, { start: at + 0.1, dur: 0.4, count: 9, gain: 0.16 * s, low: 3000, high: 7000, grain: 0.003 });
    });
}

export function waterSplash(rng: Rng): Float32Array {
    const out = createBuffer(1.0);
    addNoise(out, rng, { dur: 0.05, gain: 0.7, attack: 0.0008, tau: 0.012, filters: [['hp', 1500]] });
    addNoise(out, rng, { dur: 0.6, gain: 0.9, attack: 0.01, tau: 0.16, filters: [['bp', 1200, 0.7]], sweep: { stage: 0, from: 2000, to: 500 } });
    addNoise(out, rng, { start: 0.02, dur: 0.7, gain: 0.8, attack: 0.04, tau: 0.22, filters: [['lp', 420]] });
    for (let k = 0; k < 8; k++) {
        const f = between(rng, 300, 1600);
        addTone(out, { start: between(rng, 0.03, 0.4), dur: 0.05, from: f, to: f * 2.2, tau: 0.014, gain: 0.3 });
    }
    addGrains(out, rng, { start: 0.1, dur: 0.6, count: 16, gain: 0.2, low: 3000, high: 8000, grain: 0.003 });
    return out;
}

export function woodCreak(rng: Rng): Float32Array {
    const dur = between(rng, 0.35, 0.7);
    const out = createBuffer(dur + 0.05);
    const base = between(rng, 330, 520);
    const target = base * between(rng, 0.75, 1.5);
    addNoise(out, rng, {
        dur,
        gain: 1,
        attack: dur * 0.2,
        tau: dur * 0.55,
        filters: [['bp', base, 14], ['bp', base * 2.1, 10]],
        sweep: { stage: 0, from: base, to: target },
        tremolo: { rate: between(rng, 26, 48), depth: 0.85 },
    });
    addNoise(out, rng, {
        start: dur * 0.1,
        dur: dur * 0.8,
        gain: 0.5,
        attack: dur * 0.25,
        tau: dur * 0.4,
        filters: [['bp', base * 1.5, 12]],
        sweep: { stage: 0, from: base * 1.5, to: target * 1.5 },
        tremolo: { rate: between(rng, 31, 57), depth: 0.9, phase: 1.3 },
    });
    return out;
}

export function metalGroan(rng: Rng): Float32Array {
    const dur = between(rng, 1.1, 1.8);
    const out = createBuffer(dur + 0.1);
    const base = between(rng, 120, 210);
    addNoise(out, rng, {
        dur,
        gain: 1,
        attack: dur * 0.3,
        tau: dur * 0.45,
        filters: [['bp', base, 16], ['bp', base * 2.7, 14]],
        sweep: { stage: 0, from: base, to: base * between(rng, 0.6, 1.4) },
        tremolo: { rate: between(rng, 6, 14), depth: 0.6 },
    });
    addEchoes(out, [
        [0.09, 0.3, 1200],
        [0.21, 0.18, 900],
    ]);
    return out;
}

function hinge(out: Float32Array, rng: Rng, start: number, dur: number, gain: number) {
    const base = between(rng, 420, 640);
    addNoise(out, rng, {
        start,
        dur,
        gain,
        attack: dur * 0.15,
        tau: dur * 0.6,
        filters: [['bp', base, 13], ['bp', base * 1.9, 9]],
        sweep: { stage: 0, from: base, to: base * between(rng, 1.25, 1.7) },
        tremolo: { rate: between(rng, 22, 40), depth: 0.8 },
    });
}

export function doorOpen(rng: Rng): Float32Array {
    const out = createBuffer(0.9);
    addModes(out, 0, [
        { f: vary(rng, 1900, 0.05), tau: 0.012, gain: 0.5 },
        { f: vary(rng, 3400, 0.05), tau: 0.008, gain: 0.25 },
    ]);
    addNoise(out, rng, { dur: 0.02, gain: 0.5, attack: 0.0004, tau: 0.004, filters: [['hp', 1500]] });
    hinge(out, rng, 0.05, between(rng, 0.4, 0.6), 0.9);
    addModes(out, 0.55, [
        { f: vary(rng, 120, 0.1), tau: 0.05, gain: 0.35 },
        { f: vary(rng, 310, 0.1), tau: 0.03, gain: 0.15 },
    ]);
    addEchoes(out, [[0.03, 0.12, 1800]]);
    return out;
}

export function doorClose(rng: Rng): Float32Array {
    const out = createBuffer(0.9);
    addNoise(out, rng, { dur: 0.25, gain: 0.35, attack: 0.1, tau: 0.08, filters: [['bp', 600, 0.6]] });
    hinge(out, rng, 0, 0.3, 0.5);
    addModes(out, 0.26, [
        { f: vary(rng, 85, 0.08), tau: 0.14, gain: 1 },
        { f: vary(rng, 170, 0.08), tau: 0.09, gain: 0.6 },
        { f: vary(rng, 340, 0.08), tau: 0.05, gain: 0.35 },
    ]);
    addNoise(out, rng, { start: 0.26, dur: 0.08, gain: 0.7, attack: 0.0006, tau: 0.012, filters: [['bp', 900, 0.7]] });
    addModes(out, 0.33, [
        { f: vary(rng, 2100, 0.05), tau: 0.012, gain: 0.3 },
        { f: vary(rng, 3600, 0.05), tau: 0.008, gain: 0.15 },
    ]);
    addEchoes(out, [
        [0.04, 0.18, 1600],
        [0.11, 0.08, 1200],
    ]);
    return out;
}

export function gearRattle(rng: Rng): Float32Array {
    const out = createBuffer(0.3);
    const hits = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < hits; k++) {
        const at = between(rng, 0, 0.14);
        addModes(out, at, [
            { f: between(rng, 1500, 3800), tau: 0.012, gain: 0.5 },
            { f: between(rng, 4200, 6500), tau: 0.007, gain: 0.25 },
        ]);
    }
    addNoise(out, rng, { dur: 0.2, gain: 0.25, attack: 0.02, tau: 0.06, filters: [['bp', 1300, 0.7]] });
    return out;
}

export function bodyFall(rng: Rng): Float32Array {
    const out = createBuffer(0.9);
    addModes(out, 0, [
        { f: vary(rng, 62, 0.06), tau: 0.14, gain: 1 },
        { f: vary(rng, 118, 0.06), tau: 0.09, gain: 0.55 },
    ]);
    addNoise(out, rng, { dur: 0.3, gain: 0.7, attack: 0.004, tau: 0.06, filters: [['lp', 900]] });
    addNoise(out, rng, { start: 0.02, dur: 0.4, gain: 0.3, attack: 0.03, tau: 0.12, filters: [['bp', 1800, 0.6]] });
    mixInto(out, gearRattle(rng), 0.07, 0.5);
    return out;
}

export function coinPickup(rng: Rng, variant: number): Float32Array {
    const out = createBuffer(0.7);
    const shift = [1, 1.122, 0.891][variant % 3];
    addNoise(out, rng, { dur: 0.015, gain: 0.3, attack: 0.0003, tau: 0.003, filters: [['hp', 3000]] });
    addBell(out, 0, 1568 * shift * vary(rng, 1, 0.01), 0.09, 0.55);
    addBell(out, 0.065, 2093 * shift * vary(rng, 1, 0.01), 0.3, 0.75);
    return out;
}

export function ammoPickup(rng: Rng, variant: number): Float32Array {
    const out = createBuffer(0.5);
    addModes(out, 0, [{ f: vary(rng, 180, 0.1), tau: 0.04, gain: 0.6 }]);
    addNoise(out, rng, { dur: 0.04, gain: 0.5, attack: 0.0005, tau: 0.008, filters: [['hp', 800]] });
    const rounds = 4 + variant;
    let at = 0.035;
    for (let k = 0; k < rounds; k++) {
        addModes(out, at, [
            { f: between(rng, 2200, 4200), tau: 0.011, gain: 0.5 },
            { f: between(rng, 5000, 7000), tau: 0.006, gain: 0.25 },
        ]);
        addNoise(out, rng, { start: at, dur: 0.012, gain: 0.25, attack: 0.0003, tau: 0.002, filters: [['hp', 2500]] });
        at += between(rng, 0.022, 0.05);
    }
    addNoise(out, rng, { start: 0.02, dur: 0.25, gain: 0.15, attack: 0.01, tau: 0.06, filters: [['bp', 1500, 0.7]] });
    return out;
}

export function weaponPickup(rng: Rng): Float32Array {
    const out = createBuffer(0.9);
    addNoise(out, rng, { dur: 0.1, gain: 0.2, attack: 0.02, tau: 0.05, filters: [['bp', 2000, 0.7]] });
    addModes(out, 0.03, [
        { f: vary(rng, 210, 0.05), tau: 0.09, gain: 0.8 },
        { f: vary(rng, 540, 0.05), tau: 0.07, gain: 0.5 },
        { f: vary(rng, 1350, 0.05), tau: 0.05, gain: 0.35 },
        { f: vary(rng, 3100, 0.05), tau: 0.03, gain: 0.2 },
    ]);
    addNoise(out, rng, { start: 0.03, dur: 0.04, gain: 0.5, attack: 0.0004, tau: 0.007, filters: [['hp', 1000]] });
    addModes(out, 0.17, [
        { f: vary(rng, 2400, 0.04), tau: 0.012, gain: 0.5 },
        { f: vary(rng, 4100, 0.04), tau: 0.008, gain: 0.3 },
    ]);
    addModes(out, 0.25, [
        { f: vary(rng, 1800, 0.04), tau: 0.014, gain: 0.45 },
        { f: vary(rng, 2900, 0.04), tau: 0.01, gain: 0.25 },
    ]);
    addBell(out, 0.31, 1760, 0.16, 0.22);
    addBell(out, 0.4, 2349, 0.3, 0.26);
    return out;
}

export function levelUp(rng: Rng): Float32Array {
    const out = createBuffer(1.6);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let k = 0; k < notes.length; k++) addBell(out, k * 0.09, notes[k], 0.35, 0.5);
    addBell(out, 0.3, 1046.5, 0.7, 0.35);
    addBell(out, 0.3, 1318.5, 0.7, 0.2);
    addGrains(out, rng, { start: 0.25, dur: 0.7, count: 22, gain: 0.1, low: 6000, high: 9500, grain: 0.004 });
    return out;
}

export function uiClick(rng: Rng): Float32Array {
    const out = createBuffer(0.12);
    addModes(out, 0, [
        { f: vary(rng, 1800, 0.03), tau: 0.006, gain: 0.6 },
        { f: vary(rng, 900, 0.03), tau: 0.01, gain: 0.4 },
    ]);
    addNoise(out, rng, { dur: 0.01, gain: 0.3, attack: 0.0003, tau: 0.002, filters: [['hp', 2000]] });
    return out;
}

export function heartbeat(rng: Rng): Float32Array {
    const out = createBuffer(0.9);
    addModes(out, 0, [
        { f: vary(rng, 54, 0.04), tau: 0.07, gain: 1 },
        { f: vary(rng, 96, 0.04), tau: 0.04, gain: 0.45 },
    ]);
    addModes(out, 0.2, [
        { f: vary(rng, 46, 0.04), tau: 0.09, gain: 0.8 },
        { f: vary(rng, 84, 0.04), tau: 0.05, gain: 0.35 },
    ]);
    addNoise(out, rng, { dur: 0.08, gain: 0.2, attack: 0.004, tau: 0.02, filters: [['lp', 220]] });
    addNoise(out, rng, { start: 0.2, dur: 0.08, gain: 0.15, attack: 0.004, tau: 0.02, filters: [['lp', 200]] });
    return out;
}

export function equipGear(rng: Rng): Float32Array {
    const out = createBuffer(0.4);
    addNoise(out, rng, { dur: 0.16, gain: 0.5, attack: 0.03, tau: 0.05, filters: [['bp', 1400, 0.7]], sweep: { stage: 0, from: 900, to: 2200 } });
    addModes(out, 0.13, [
        { f: vary(rng, 1500, 0.05), tau: 0.012, gain: 0.5 },
        { f: vary(rng, 3300, 0.05), tau: 0.008, gain: 0.3 },
        { f: vary(rng, 260, 0.05), tau: 0.04, gain: 0.5 },
    ]);
    addNoise(out, rng, { start: 0.13, dur: 0.02, gain: 0.4, attack: 0.0004, tau: 0.004, filters: [['hp', 1200]] });
    return out;
}