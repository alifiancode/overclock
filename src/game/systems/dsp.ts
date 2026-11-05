import type { Rng } from './random.ts';

export const SAMPLE_RATE = 22050;

const TAU = Math.PI * 2;
const NYQUIST_LIMIT = SAMPLE_RATE * 0.47;
const RETUNE_INTERVAL = 16;
const EDGE_FADE_SAMPLES = Math.floor(0.008 * SAMPLE_RATE);
const MODE_RAMP_SAMPLES = 8;
const SILENCE = 0.0003;
const VOICE_SLICE = 3072;

export type FilterKind = 'lp' | 'hp' | 'bp' | 'notch' | 'peak' | 'lowShelf' | 'highShelf';
export type FilterSpec = readonly [kind: FilterKind, freq: number, q?: number, gainDb?: number];

export class Biquad {
    private b0 = 1;
    private b1 = 0;
    private b2 = 0;
    private a1 = 0;
    private a2 = 0;
    private x1 = 0;
    private x2 = 0;
    private y1 = 0;
    private y2 = 0;

    constructor(kind: FilterKind, freq: number, q: number = 0.7071, gainDb: number = 0) {
        this.configure(kind, freq, q, gainDb);
    }

    configure(kind: FilterKind, freq: number, q: number = 0.7071, gainDb: number = 0): void {
        const f = freq < 8 ? 8 : freq > NYQUIST_LIMIT ? NYQUIST_LIMIT : freq;
        const w = (TAU * f) / SAMPLE_RATE;
        const cosW = Math.cos(w);
        const sinW = Math.sin(w);
        const alpha = sinW / (2 * q);
        let b0 = 1;
        let b1 = 0;
        let b2 = 0;
        let a0 = 1;
        let a1 = 0;
        let a2 = 0;
        switch (kind) {
            case 'lp':
                b1 = 1 - cosW;
                b0 = b1 * 0.5;
                b2 = b0;
                a0 = 1 + alpha;
                a1 = -2 * cosW;
                a2 = 1 - alpha;
                break;
            case 'hp':
                b1 = -(1 + cosW);
                b0 = -b1 * 0.5;
                b2 = b0;
                a0 = 1 + alpha;
                a1 = -2 * cosW;
                a2 = 1 - alpha;
                break;
            case 'bp':
                b0 = alpha;
                b1 = 0;
                b2 = -alpha;
                a0 = 1 + alpha;
                a1 = -2 * cosW;
                a2 = 1 - alpha;
                break;
            case 'notch':
                b0 = 1;
                b1 = -2 * cosW;
                b2 = 1;
                a0 = 1 + alpha;
                a1 = -2 * cosW;
                a2 = 1 - alpha;
                break;
            case 'peak': {
                const amp = Math.pow(10, gainDb / 40);
                b0 = 1 + alpha * amp;
                b1 = -2 * cosW;
                b2 = 1 - alpha * amp;
                a0 = 1 + alpha / amp;
                a1 = -2 * cosW;
                a2 = 1 - alpha / amp;
                break;
            }
            case 'lowShelf': {
                const amp = Math.pow(10, gainDb / 40);
                const k = 2 * Math.sqrt(amp) * alpha;
                b0 = amp * (amp + 1 - (amp - 1) * cosW + k);
                b1 = 2 * amp * (amp - 1 - (amp + 1) * cosW);
                b2 = amp * (amp + 1 - (amp - 1) * cosW - k);
                a0 = amp + 1 + (amp - 1) * cosW + k;
                a1 = -2 * (amp - 1 + (amp + 1) * cosW);
                a2 = amp + 1 + (amp - 1) * cosW - k;
                break;
            }
            case 'highShelf': {
                const amp = Math.pow(10, gainDb / 40);
                const k = 2 * Math.sqrt(amp) * alpha;
                b0 = amp * (amp + 1 + (amp - 1) * cosW + k);
                b1 = -2 * amp * (amp - 1 + (amp + 1) * cosW);
                b2 = amp * (amp + 1 + (amp - 1) * cosW - k);
                a0 = amp + 1 - (amp - 1) * cosW + k;
                a1 = 2 * (amp - 1 - (amp + 1) * cosW);
                a2 = amp + 1 - (amp - 1) * cosW - k;
                break;
            }
        }
        const inv = 1 / a0;
        this.b0 = b0 * inv;
        this.b1 = b1 * inv;
        this.b2 = b2 * inv;
        this.a1 = a1 * inv;
        this.a2 = a2 * inv;
    }

    process(x: number): number {
        const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1;
        this.x1 = x;
        this.y2 = this.y1;
        this.y1 = y;
        return y;
    }
}

function bandCompensation(freq: number, q: number): number {
    const bandwidth = Math.max(20, freq / q);
    const value = Math.sqrt((SAMPLE_RATE * 0.5) / bandwidth);
    return value < 0.7 ? 0.7 : value > 12 ? 12 : value;
}

export class FilterChain {
    private readonly specs: readonly FilterSpec[];
    private readonly stages: Biquad[];
    private readonly gains: number[];

    constructor(specs: readonly FilterSpec[]) {
        this.specs = specs;
        this.stages = specs.map((s) => new Biquad(s[0], s[1], s[2] ?? 0.7071, s[3] ?? 0));
        this.gains = specs.map((s) => (s[0] === 'bp' ? bandCompensation(s[1], s[2] ?? 0.7071) : 1));
    }

    process(x: number): number {
        let y = x;
        for (let i = 0; i < this.stages.length; i++) y = this.stages[i].process(y) * this.gains[i];
        return y;
    }

    retune(stage: number, freq: number): void {
        const spec = this.specs[stage];
        const q = spec[2] ?? 0.7071;
        this.stages[stage].configure(spec[0], freq, q, spec[3] ?? 0);
        if (spec[0] === 'bp') this.gains[stage] = bandCompensation(freq, q);
    }
}

export function white(rng: Rng): number {
    return rng() * 2 - 1;
}

export class PinkNoise {
    private b0 = 0;
    private b1 = 0;
    private b2 = 0;
    private b3 = 0;
    private b4 = 0;
    private b5 = 0;
    private b6 = 0;

    next(rng: Rng): number {
        const w = white(rng);
        this.b0 = 0.99886 * this.b0 + w * 0.0555179;
        this.b1 = 0.99332 * this.b1 + w * 0.0750759;
        this.b2 = 0.969 * this.b2 + w * 0.153852;
        this.b3 = 0.8665 * this.b3 + w * 0.3104856;
        this.b4 = 0.55 * this.b4 + w * 0.5329522;
        this.b5 = -0.7616 * this.b5 - w * 0.016898;
        const pink = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + w * 0.5362;
        this.b6 = w * 0.115926;
        return pink * 0.11;
    }
}

export function vary(rng: Rng, base: number, spread: number): number {
    return base * (1 + (rng() * 2 - 1) * spread);
}

export function between(rng: Rng, low: number, high: number): number {
    return low + rng() * (high - low);
}

export function createBuffer(seconds: number): Float32Array {
    return new Float32Array(Math.max(1, Math.ceil(seconds * SAMPLE_RATE)));
}

export class Envelope {
    private readonly attackSamples: number;
    private readonly step: number;
    private index = 0;
    private level = 1;

    constructor(attack: number, tau: number) {
        this.attackSamples = Math.max(0, Math.round(attack * SAMPLE_RATE));
        this.step = Math.exp(-1 / (Math.max(tau, 1e-4) * SAMPLE_RATE));
    }

    next(): number {
        if (this.index < this.attackSamples) {
            const u = this.index++ / this.attackSamples;
            return u * u * (3 - 2 * u);
        }
        this.index++;
        const value = this.level;
        this.level *= this.step;
        return value;
    }
}

export type NoiseLayer = {
    start?: number;
    dur: number;
    gain?: number;
    attack?: number;
    tau?: number;
    filters?: readonly FilterSpec[];
    sweep?: { stage: number; from: number; to: number };
    pink?: boolean;
    tremolo?: { rate: number; depth: number; phase?: number };
};

export function addNoise(out: Float32Array, rng: Rng, layer: NoiseLayer): void {
    const first = Math.max(0, Math.round((layer.start ?? 0) * SAMPLE_RATE));
    const count = Math.min(out.length - first, Math.round(layer.dur * SAMPLE_RATE));
    if (count <= 0) return;
    const chain = new FilterChain(layer.filters ?? []);
    const gain = layer.gain ?? 1;
    const attack = layer.attack ?? 0.002;
    const tau = layer.tau ?? layer.dur * 0.25;
    const sweep = layer.sweep;
    const tremolo = layer.tremolo;
    const pink = layer.pink ? new PinkNoise() : null;
    const ratio = sweep ? Math.log(sweep.to / sweep.from) : 0;
    const envelope = new Envelope(attack, tau);
    const attackSamples = Math.round(attack * SAMPLE_RATE);
    const edgeFade = Math.max(1, Math.min(EDGE_FADE_SAMPLES, count >> 2));
    for (let i = 0; i < count; i++) {
        const t = i / SAMPLE_RATE;
        if (sweep && i % RETUNE_INTERVAL === 0) chain.retune(sweep.stage, sweep.from * Math.exp(ratio * (i / count)));
        let amp = envelope.next();
        if (i > attackSamples && amp < SILENCE) break;
        if (tremolo) amp *= 1 - tremolo.depth * (0.5 + 0.5 * Math.sin(TAU * tremolo.rate * t + (tremolo.phase ?? 0)));
        const remaining = count - i;
        if (remaining < edgeFade) amp *= remaining / edgeFade;
        const x = chain.process(pink ? pink.next(rng) : white(rng));
        out[first + i] += x * amp * gain;
    }
}

export type Mode = { f: number; tau: number; gain: number; phase?: number };

export function addModes(out: Float32Array, start: number, modes: readonly Mode[]): void {
    const first = Math.max(0, Math.round(start * SAMPLE_RATE));
    for (let m = 0; m < modes.length; m++) {
        const mode = modes[m];
        const w = (TAU * Math.min(mode.f, NYQUIST_LIMIT)) / SAMPLE_RATE;
        const decay = Math.exp(-1 / (mode.tau * SAMPLE_RATE));
        const cr = decay * Math.cos(w);
        const ci = decay * Math.sin(w);
        const phase = mode.phase ?? 0;
        let re = Math.cos(phase);
        let im = Math.sin(phase);
        const limit = Math.min(out.length - first, Math.ceil(mode.tau * SAMPLE_RATE * 9));
        for (let i = 0; i < limit; i++) {
            const ramp = i < MODE_RAMP_SAMPLES ? i / MODE_RAMP_SAMPLES : 1;
            out[first + i] += im * mode.gain * ramp;
            const nextRe = re * cr - im * ci;
            im = re * ci + im * cr;
            re = nextRe;
        }
    }
}

const BELL_RATIOS = [1, 2.756, 5.404, 8.933];
const BELL_TAUS = [1, 0.55, 0.28, 0.14];
const BELL_GAINS = [1, 0.5, 0.28, 0.14];
const BELL_LIMIT = 9500;

export function addBell(out: Float32Array, start: number, freq: number, tau: number, gain: number): void {
    const modes: Mode[] = [];
    for (let i = 0; i < BELL_RATIOS.length; i++) {
        if (freq * BELL_RATIOS[i] > BELL_LIMIT) break;
        modes.push({ f: freq * BELL_RATIOS[i], tau: tau * BELL_TAUS[i], gain: gain * BELL_GAINS[i] });
    }
    addModes(out, start, modes);
}

export type WaveKind = 'sine' | 'triangle' | 'saw' | 'square' | 'softSquare';

function waveform(kind: WaveKind, cycle: number): number {
    switch (kind) {
        case 'sine':
            return Math.sin(TAU * cycle);
        case 'triangle':
            return cycle < 0.5 ? 4 * cycle - 1 : 3 - 4 * cycle;
        case 'saw':
            return 2 * cycle - 1;
        case 'square':
            return cycle < 0.5 ? 1 : -1;
        case 'softSquare':
            return Math.tanh(3 * Math.sin(TAU * cycle));
    }
}

export type ToneLayer = {
    start?: number;
    dur: number;
    from: number;
    to?: number;
    gain?: number;
    attack?: number;
    tau?: number;
    release?: number;
    wave?: WaveKind;
    vibrato?: { rate: number; depth: number };
    filters?: readonly FilterSpec[];
};

export function addTone(out: Float32Array, layer: ToneLayer): void {
    const first = Math.max(0, Math.round((layer.start ?? 0) * SAMPLE_RATE));
    const count = Math.min(out.length - first, Math.round(layer.dur * SAMPLE_RATE));
    if (count <= 0) return;
    const gain = layer.gain ?? 1;
    const attack = layer.attack ?? 0.004;
    const release = layer.release ?? 0.01;
    const tau = layer.tau;
    const wave = layer.wave ?? 'sine';
    const target = layer.to ?? layer.from;
    const ratio = Math.log(target / layer.from);
    const chain = layer.filters ? new FilterChain(layer.filters) : null;
    const envelope = new Envelope(attack, tau === undefined ? 1e9 : tau);
    const attackSamples = Math.round(attack * SAMPLE_RATE);
    const glide = Math.exp(ratio / count);
    let freq = layer.from;
    let cycle = 0;
    for (let i = 0; i < count; i++) {
        const t = i / SAMPLE_RATE;
        let current = freq;
        freq *= glide;
        if (layer.vibrato) current *= 1 + layer.vibrato.depth * Math.sin(TAU * layer.vibrato.rate * t);
        cycle += current / SAMPLE_RATE;
        cycle -= Math.floor(cycle);
        let amp = envelope.next();
        const remaining = t - (count / SAMPLE_RATE - release);
        if (remaining > 0) amp *= Math.max(0, 1 - remaining / release);
        if (i > attackSamples && amp < SILENCE) break;
        const sample = waveform(wave, cycle);
        out[first + i] += (chain ? chain.process(sample) : sample) * amp * gain;
    }
}

export type GrainCloud = {
    start?: number;
    dur: number;
    count: number;
    gain: number;
    low: number;
    high: number;
    grain: number;
    q?: number;
    skew?: number;
};

export function addGrains(out: Float32Array, rng: Rng, cloud: GrainCloud): void {
    const skew = cloud.skew ?? 1;
    for (let k = 0; k < cloud.count; k++) {
        const u = Math.pow(rng(), skew);
        const freq = cloud.low * Math.pow(cloud.high / cloud.low, rng());
        const length = cloud.grain * (0.6 + rng() * 0.8);
        const amp = cloud.gain * (0.25 + 0.75 * rng()) * (1 - u * 0.45);
        addNoise(out, rng, {
            start: (cloud.start ?? 0) + u * cloud.dur,
            dur: length * 5,
            gain: amp,
            attack: 0.0007,
            tau: length,
            filters: [['bp', freq, cloud.q ?? 1.4]],
        });
    }
}

export type EchoTap = readonly [delay: number, gain: number, lowpass?: number];

export function addEchoes(out: Float32Array, taps: readonly EchoTap[]): void {
    const source = out.slice();
    for (let t = 0; t < taps.length; t++) {
        const shift = Math.round(taps[t][0] * SAMPLE_RATE);
        const gain = taps[t][1];
        const filter = taps[t][2] ? new Biquad('lp', taps[t][2] as number) : null;
        for (let i = 0; i + shift < out.length; i++) {
            const s = source[i];
            out[i + shift] += (filter ? filter.process(s) : s) * gain;
        }
    }
}

export function mixInto(target: Float32Array, source: Float32Array, start: number, gain: number = 1): void {
    const first = Math.max(0, Math.round(start * SAMPLE_RATE));
    const count = Math.min(source.length, target.length - first);
    for (let i = 0; i < count; i++) target[first + i] += source[i] * gain;
}

export type FormantSpec = readonly [freq: number, q: number, gain: number];

export type VoiceLayer = {
    start?: number;
    dur: number;
    gain?: number;
    pitch: (t: number, dur: number) => number;
    formants: readonly FormantSpec[];
    formantScale?: (t: number, dur: number) => number;
    breath?: number;
    rough?: { rate: number; depth: number };
    jitter?: number;
    attack?: number;
    release?: number;
    shape?: (t: number, dur: number) => number;
};

function glottal(phase: number): number {
    if (phase < 0.6) return 0.5 * (1 - Math.cos((Math.PI * phase) / 0.6));
    return Math.cos((Math.PI * 0.5 * (phase - 0.6)) / 0.4);
}

export function* voiceSteps(out: Float32Array, rng: Rng, layer: VoiceLayer): Generator<void, void, void> {
    const first = Math.max(0, Math.round((layer.start ?? 0) * SAMPLE_RATE));
    const count = Math.min(out.length - first, Math.round(layer.dur * SAMPLE_RATE));
    if (count <= 0) return;
    const gain = layer.gain ?? 1;
    const attack = layer.attack ?? 0.03;
    const release = layer.release ?? 0.08;
    const breath = layer.breath ?? 0.2;
    const jitter = layer.jitter ?? 0.01;
    const filters = layer.formants.map((f) => new Biquad('bp', f[0], f[1]));
    const breathFilter = new Biquad('bp', 1800, 0.6);
    const envelope = new Envelope(attack, 1e9);
    let cycle = 0;
    let previous = 0;
    let wobble = 0;
    for (let i = 0; i < count; i++) {
        const t = i / SAMPLE_RATE;
        if (i % VOICE_SLICE === VOICE_SLICE - 1) yield;
        if (i % RETUNE_INTERVAL === 0 && layer.formantScale) {
            const scale = layer.formantScale(t, layer.dur);
            for (let f = 0; f < filters.length; f++) filters[f].configure('bp', layer.formants[f][0] * scale, layer.formants[f][1]);
        }
        const f0 = layer.pitch(t, layer.dur) * (1 + wobble);
        cycle += f0 / SAMPLE_RATE;
        if (cycle >= 1) {
            cycle -= Math.floor(cycle);
            wobble = white(rng) * jitter;
        }
        const g = glottal(cycle);
        const source = (g - previous) * ((0.35 * SAMPLE_RATE) / Math.max(40, f0));
        previous = g;
        const noise = breathFilter.process(white(rng)) * breath;
        let sum = 0;
        for (let f = 0; f < filters.length; f++) sum += filters[f].process(source + noise) * layer.formants[f][2];
        let amp = envelope.next();
        const fadeStart = layer.dur - release;
        if (t > fadeStart) amp *= Math.max(0, 1 - (t - fadeStart) / release);
        if (layer.shape) amp *= layer.shape(t, layer.dur);
        if (layer.rough) amp *= 1 - layer.rough.depth * (0.5 + 0.5 * Math.sin(TAU * layer.rough.rate * t));
        out[first + i] += sum * amp * gain;
    }
}

export function addVoice(out: Float32Array, rng: Rng, layer: VoiceLayer): void {
    const steps = voiceSteps(out, rng, layer);
    while (!steps.next().done) continue;
}

export function peakOf(buffer: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
        const v = Math.abs(buffer[i]);
        if (v > peak) peak = v;
    }
    return peak;
}

export function normalize(buffer: Float32Array, target: number): void {
    const peak = peakOf(buffer);
    if (peak < 1e-9) return;
    const k = target / peak;
    for (let i = 0; i < buffer.length; i++) buffer[i] *= k;
}

export function highpassInPlace(buffer: Float32Array, freq: number): void {
    const filter = new Biquad('hp', freq, 0.7071);
    for (let i = 0; i < buffer.length; i++) buffer[i] = filter.process(buffer[i]);
}

export function lowpassInPlace(buffer: Float32Array, freq: number): void {
    const filter = new Biquad('lp', freq, 0.7071);
    for (let i = 0; i < buffer.length; i++) buffer[i] = filter.process(buffer[i]);
}

export function softClip(buffer: Float32Array, drive: number): void {
    const norm = 1 / Math.tanh(drive);
    for (let i = 0; i < buffer.length; i++) buffer[i] = Math.tanh(buffer[i] * drive) * norm;
}

export function fadeEdges(buffer: Float32Array, fadeIn: number, fadeOut: number): void {
    const inCount = Math.min(buffer.length, Math.round(fadeIn * SAMPLE_RATE));
    const outCount = Math.min(buffer.length, Math.round(fadeOut * SAMPLE_RATE));
    for (let i = 0; i < inCount; i++) buffer[i] *= i / inCount;
    for (let i = 0; i < outCount; i++) buffer[buffer.length - 1 - i] *= i / outCount;
}

export function trimTail(buffer: Float32Array, threshold: number, minimumSeconds: number): Float32Array {
    let end = buffer.length;
    while (end > 1 && Math.abs(buffer[end - 1]) < threshold) end--;
    end = Math.max(end, Math.round(minimumSeconds * SAMPLE_RATE));
    end = Math.min(end, buffer.length);
    return end === buffer.length ? buffer : buffer.slice(0, end);
}

export function makeLoop(buffer: Float32Array, overlapSeconds: number): Float32Array {
    const overlap = Math.min(Math.round(overlapSeconds * SAMPLE_RATE), buffer.length >> 1);
    const length = buffer.length - overlap;
    const loop = buffer.slice(0, length);
    for (let i = 0; i < overlap; i++) {
        const u = (i / overlap) * Math.PI * 0.5;
        loop[i] = buffer[i] * Math.sin(u) + buffer[length + i] * Math.cos(u);
    }
    return loop;
}