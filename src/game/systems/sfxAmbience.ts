import { Biquad, PinkNoise, SAMPLE_RATE, addGrains, between, createBuffer, makeLoop, white } from './dsp.ts';
import type { Rng } from './random.ts';

export const LOOP_SECONDS = 6;
const OVERLAP_SECONDS = 0.35;
const TAU = Math.PI * 2;
const SLICE = 4096;

type Task = Generator<void, Float32Array, void>;

function cyclic(count: number, phase: number, t: number): number {
    return Math.sin(TAU * ((count * t) / LOOP_SECONDS) + phase);
}

export function* ambWind(rng: Rng): Task {
    const out = createBuffer(LOOP_SECONDS + OVERLAP_SECONDS);
    const pink = new PinkNoise();
    const low = new Biquad('lp', 500, 0.9);
    const hiss = new Biquad('bp', 2600, 0.6);
    const p1 = rng() * TAU;
    const p2 = rng() * TAU;
    const p3 = rng() * TAU;
    for (let i = 0; i < out.length; i++) {
        const t = i / SAMPLE_RATE;
        const gust = 0.5 + 0.5 * (0.5 * cyclic(1, p1, t) + 0.3 * cyclic(3, p2, t) + 0.2 * cyclic(7, p3, t));
        if (i % 32 === 0) {
            low.configure('lp', 220 + 900 * gust, 0.9);
            hiss.configure('bp', 1800 + 2200 * gust, 0.6);
        }
        out[i] = low.process(pink.next(rng)) * (0.2 + 0.8 * gust * gust) * 1.6 + hiss.process(white(rng)) * 0.1 * gust * gust;
        if (i % SLICE === 0) yield;
    }
    return makeLoop(out, OVERLAP_SECONDS);
}

export function* ambLeaves(rng: Rng): Task {
    const out = createBuffer(LOOP_SECONDS + OVERLAP_SECONDS);
    const band = new Biquad('bp', 4200, 0.5);
    const mid = new Biquad('bp', 1500, 0.7);
    const p1 = rng() * TAU;
    const p2 = rng() * TAU;
    const p3 = rng() * TAU;
    for (let i = 0; i < out.length; i++) {
        const t = i / SAMPLE_RATE;
        const m = 0.5 + 0.5 * (0.45 * cyclic(2, p1, t) + 0.3 * cyclic(5, p2, t) + 0.25 * cyclic(11, p3, t));
        out[i] = band.process(white(rng)) * (0.15 + 0.85 * m * m) * 0.6 + mid.process(white(rng)) * 0.06 * m;
        if (i % SLICE === 0) yield;
    }
    yield;
    addGrains(out, rng, { dur: LOOP_SECONDS, count: 90, gain: 0.25, low: 2500, high: 7500, grain: 0.004 });
    return makeLoop(out, OVERLAP_SECONDS);
}

export function* ambInsects(rng: Rng): Task {
    const length = Math.round(LOOP_SECONDS * SAMPLE_RATE);
    const fuzz = createBuffer(LOOP_SECONDS + OVERLAP_SECONDS);
    const voices = [
        { carrier: 4300, pulse: 30, bursts: 7, phase: rng() * TAU, gain: 0.5 },
        { carrier: 5100, pulse: 42, bursts: 9, phase: rng() * TAU, gain: 0.4 },
        { carrier: 6300, pulse: 24, bursts: 5, phase: rng() * TAU, gain: 0.35 },
    ];
    const out = new Float32Array(length);
    for (let v = 0; v < voices.length; v++) {
        const voice = voices[v];
        const carrier = Math.round(voice.carrier * LOOP_SECONDS) / LOOP_SECONDS;
        const pulse = Math.round(voice.pulse * LOOP_SECONDS) / LOOP_SECONDS;
        for (let i = 0; i < length; i++) {
            const t = i / SAMPLE_RATE;
            const gate = Math.max(0, Math.min(1, 2.2 * Math.sin(TAU * ((voice.bursts * t) / LOOP_SECONDS) + voice.phase)));
            const chirp = Math.pow(Math.max(0, Math.sin(TAU * pulse * t)), 2);
            out[i] += Math.sin(TAU * carrier * t) * chirp * gate * voice.gain;
            if (i % SLICE === 0) yield;
        }
    }
    const fuzzFilter = new Biquad('bp', 4800, 1.2);
    for (let i = 0; i < fuzz.length; i++) {
        fuzz[i] = fuzzFilter.process(white(rng)) * 0.12;
        if (i % SLICE === 0) yield;
    }
    const fuzzLoop = makeLoop(fuzz, OVERLAP_SECONDS);
    for (let i = 0; i < length; i++) out[i] += fuzzLoop[i];
    return out;
}

export function* ambWater(rng: Rng): Task {
    const out = createBuffer(LOOP_SECONDS + OVERLAP_SECONDS);
    const pink = new PinkNoise();
    const body = new Biquad('bp', 600, 0.7);
    const ripple = new Biquad('bp', 2200, 0.8);
    const p1 = rng() * TAU;
    const p2 = rng() * TAU;
    for (let i = 0; i < out.length; i++) {
        const t = i / SAMPLE_RATE;
        const swell = 0.5 + 0.5 * (0.6 * cyclic(5, p1, t) + 0.4 * cyclic(13, p2, t));
        if (i % 64 === 0) body.configure('bp', 380 + 500 * swell, 0.7);
        out[i] = body.process(pink.next(rng)) * (0.2 + 0.8 * swell) * 1.4 + ripple.process(white(rng)) * 0.05 * swell * swell;
        if (i % SLICE === 0) yield;
    }
    yield;
    for (let k = 0; k < 7; k++) {
        const f = between(rng, 350, 1100);
        const start = rng() * LOOP_SECONDS;
        const bubble = createBuffer(0.08);
        for (let i = 0; i < bubble.length; i++) {
            const t = i / SAMPLE_RATE;
            bubble[i] = Math.sin(TAU * f * (t + 12 * t * t)) * Math.exp(-t / 0.014) * 0.2;
        }
        const first = Math.round(start * SAMPLE_RATE);
        for (let i = 0; i < bubble.length && first + i < out.length; i++) out[first + i] += bubble[i];
    }
    return makeLoop(out, OVERLAP_SECONDS);
}

export function* ambRoom(rng: Rng): Task {
    const out = createBuffer(LOOP_SECONDS + OVERLAP_SECONDS);
    const pink = new PinkNoise();
    const rumble = new Biquad('lp', 130, 0.7);
    const air = new Biquad('lp', 420, 0.7);
    const howl = new Biquad('bp', 230, 6);
    const p1 = rng() * TAU;
    const p2 = rng() * TAU;
    for (let i = 0; i < out.length; i++) {
        const t = i / SAMPLE_RATE;
        const draft = 0.5 + 0.5 * (0.6 * cyclic(1, p1, t) + 0.4 * cyclic(4, p2, t));
        if (i % 64 === 0) howl.configure('bp', 200 + 70 * draft, 6);
        const x = pink.next(rng);
        out[i] = rumble.process(x) * 1.6 + air.process(x) * 0.25 + howl.process(white(rng)) * 2.4 * draft * draft;
        if (i % SLICE === 0) yield;
    }
    return makeLoop(out, OVERLAP_SECONDS);
}