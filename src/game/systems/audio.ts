import { SAMPLE_RATE } from './dsp.ts';
import { isLooping, pickVariant, startGeneration, type SoundId } from './soundBank.ts';
import { wrapDelta } from './wrap.ts';

export type BusName = 'sfx' | 'step' | 'voice' | 'amb' | 'ui';

export type PlayOptions = {
    volume?: number;
    rate?: number;
    bus?: BusName;
    x?: number;
    z?: number;
    maxDistance?: number;
    muffle?: number;
    delay?: number;
    variant?: number;
    pan?: number;
    throttle?: number;
    priority?: number;
    building?: number;
    floor?: number;
};

export type Handle = { stop: (fade?: number) => void };
export type Loop = { setVolume: (volume: number, smoothing?: number) => void; stop: () => void };

type Engine = {
    ctx: AudioContext;
    master: GainNode;
    buses: Record<BusName, GainNode>;
    sends: Record<'sfx' | 'step' | 'voice', GainNode>;
    buffers: Map<string, AudioBuffer>;
};

const STORAGE_KEY = 'overclock-audio';
const BUS_LEVEL: Record<BusName, number> = { sfx: 1, step: 0.75, voice: 0.95, amb: 0.7, ui: 0.8 };
const REVERB_SECONDS = 1.3;
const MAX_VOICES = 30;
const MAX_VOICES_PRIORITY = 44;
const DEFAULT_DISTANCE = 42;
const NEAR_FILTER_DISTANCE = 5;

const settings = { muted: false, volume: 0.8 };
const listener = { x: 0, z: 0, rightX: 1, rightZ: 0, building: -1, floor: 0 };
const lastPlayed = new Map<SoundId, number>();

let engine: Engine | null = null;
let voices = 0;
let installed = false;
let environmentWet = 0.08;

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { muted?: boolean; volume?: number };
        if (typeof parsed.muted === 'boolean') settings.muted = parsed.muted;
        if (typeof parsed.volume === 'number') settings.volume = Math.min(1, Math.max(0, parsed.volume));
    } catch {
        settings.muted = false;
    }
}

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        return;
    }
}

function buildImpulse(ctx: AudioContext): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * REVERB_SECONDS);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        let smooth = 0;
        for (let i = 0; i < length; i++) {
            const t = i / rate;
            const envelope = Math.exp(-t / 0.3) * (1 - Math.exp(-t / 0.006));
            const damping = 0.7 * Math.exp(-t / 0.35) + 0.06;
            smooth += (Math.random() * 2 - 1 - smooth) * damping;
            data[i] = smooth * envelope;
        }
    }
    return impulse;
}

function createEngine(): Engine | null {
    const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) return null;
    const ctx = new Constructor({ latencyHint: 'interactive' });
    const master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : settings.volume;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 8;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    master.connect(limiter);
    limiter.connect(ctx.destination);

    const convolver = ctx.createConvolver();
    convolver.buffer = buildImpulse(ctx);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.9;
    convolver.connect(reverbReturn);
    reverbReturn.connect(master);

    const names: BusName[] = ['sfx', 'step', 'voice', 'amb', 'ui'];
    const buses = {} as Record<BusName, GainNode>;
    for (const name of names) {
        const bus = ctx.createGain();
        bus.gain.value = BUS_LEVEL[name];
        bus.connect(master);
        buses[name] = bus;
    }
    const sends = {} as Record<'sfx' | 'step' | 'voice', GainNode>;
    for (const name of ['sfx', 'step', 'voice'] as const) {
        const send = ctx.createGain();
        send.gain.value = environmentWet;
        buses[name].connect(send);
        send.connect(convolver);
        sends[name] = send;
    }
    return { ctx, master, buses, sends, buffers: new Map() };
}

function ensureEngine(): Engine | null {
    if (engine) return engine;
    if (typeof window === 'undefined') return null;
    try {
        engine = createEngine();
    } catch {
        engine = null;
    }
    return engine;
}

export function unlockAudio() {
    const e = ensureEngine();
    if (!e) return;
    if (e.ctx.state !== 'running') void e.ctx.resume().catch(() => undefined);
}

function applyMaster() {
    if (!engine) return;
    engine.master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, engine.ctx.currentTime, 0.04);
}

export function setMuted(muted: boolean) {
    settings.muted = muted;
    applyMaster();
    saveSettings();
}

export function toggleMuted(): boolean {
    setMuted(!settings.muted);
    return settings.muted;
}

export function setMasterVolume(volume: number) {
    settings.volume = Math.min(1, Math.max(0, volume));
    applyMaster();
    saveSettings();
}

export function audioState(): { muted: boolean; volume: number; ready: boolean } {
    return { muted: settings.muted, volume: settings.volume, ready: engine !== null && engine.ctx.state === 'running' };
}

export function installAudio() {
    if (installed || typeof window === 'undefined') return;
    installed = true;
    loadSettings();
    startGeneration();
    window.addEventListener(
        'pointerdown',
        (event) => {
            unlockAudio();
            const target = event.target as Element | null;
            if (target && typeof target.closest === 'function' && target.closest('button')) play('ui_click', { bus: 'ui' });
        },
        true
    );
    window.addEventListener(
        'keydown',
        (event) => {
            unlockAudio();
            if (event.code === 'KeyM' && !event.repeat) toggleMuted();
        },
        true
    );
    document.addEventListener('visibilitychange', () => {
        if (!engine) return;
        if (document.hidden) void engine.ctx.suspend().catch(() => undefined);
        else void engine.ctx.resume().catch(() => undefined);
    });
}

export function setListener(x: number, z: number, cameraAngle: number, building: number, floor: number) {
    listener.x = x;
    listener.z = z;
    listener.building = building;
    listener.floor = floor;
    listener.rightX = Math.sin(cameraAngle);
    listener.rightZ = -Math.cos(cameraAngle);
}

export function setEnvironment(indoor: number) {
    environmentWet = 0.07 + indoor * 0.3;
    if (!engine) return;
    const t = engine.ctx.currentTime;
    engine.sends.sfx.gain.setTargetAtTime(environmentWet, t, 0.3);
    engine.sends.step.gain.setTargetAtTime(environmentWet * 1.1, t, 0.3);
    engine.sends.voice.gain.setTargetAtTime(environmentWet * 0.9, t, 0.3);
}

function bufferFor(e: Engine, id: SoundId, forced: number): AudioBuffer | null {
    const picked = pickVariant(id, forced);
    if (!picked) return null;
    const key = `${id}:${picked.index}`;
    let buffer = e.buffers.get(key);
    if (!buffer) {
        buffer = e.ctx.createBuffer(1, picked.data.length, SAMPLE_RATE);
        buffer.getChannelData(0).set(picked.data);
        e.buffers.set(key, buffer);
    }
    return buffer;
}

export function isRunning(): boolean {
    return engine !== null && engine.ctx.state === 'running' && !settings.muted;
}

export function play(id: SoundId, options: PlayOptions = {}): Handle | null {
    const e = engine;
    if (!e || e.ctx.state !== 'running' || settings.muted) return null;
    const ctx = e.ctx;
    const now = ctx.currentTime;
    if (options.throttle) {
        const last = lastPlayed.get(id) ?? -10;
        if (now - last < options.throttle) return null;
    }
    const limit = (options.priority ?? 1) >= 2 ? MAX_VOICES_PRIORITY : MAX_VOICES;
    if (voices >= limit) return null;

    let volume = options.volume ?? 1;
    let pan = options.pan ?? 0;
    let cutoff = 0;
    const positional = options.x !== undefined && options.z !== undefined;
    if (positional) {
        const dx = wrapDelta((options.x as number) - listener.x);
        const dz = wrapDelta((options.z as number) - listener.z);
        const distance = Math.sqrt(dx * dx + dz * dz);
        const reach = options.maxDistance ?? DEFAULT_DISTANCE;
        if (distance >= reach) return null;
        const falloff = 1 - distance / reach;
        volume *= falloff * falloff;
        if (volume < 0.004) return null;
        pan = Math.max(-0.9, Math.min(0.9, ((dx * listener.rightX + dz * listener.rightZ) / Math.max(distance, 4)) * 1.1));
        if (distance > NEAR_FILTER_DISTANCE) cutoff = 2400 + 16000 * falloff * falloff;
    }
    let muffle = options.muffle ?? 0;
    if (options.building !== undefined && (options.building !== listener.building || (options.floor ?? 0) !== listener.floor)) {
        muffle = Math.max(muffle, options.building === listener.building ? 0.55 : 0.8);
    }
    if (muffle > 0) {
        volume *= 1 - 0.55 * muffle;
        cutoff = cutoff > 0 ? Math.min(cutoff, 7000 - 6200 * muffle) : 7000 - 6200 * muffle;
    }

    const buffer = bufferFor(e, id, options.variant ?? -1);
    if (!buffer) return null;
    lastPlayed.set(id, now);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    let tail: AudioNode = gain;
    source.connect(gain);
    const nodes: AudioNode[] = [source, gain];
    if (cutoff > 0) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;
        filter.Q.value = 0.5;
        tail.connect(filter);
        tail = filter;
        nodes.push(filter);
    }
    if (pan !== 0) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        tail.connect(panner);
        tail = panner;
        nodes.push(panner);
    }
    tail.connect(e.buses[options.bus ?? 'sfx']);

    voices++;
    source.onended = () => {
        voices--;
        for (let i = 0; i < nodes.length; i++) nodes[i].disconnect();
    };
    source.start(ctx.currentTime + (options.delay ?? 0));
    return {
        stop: (fade = 0.05) => {
            const t = ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setTargetAtTime(0, t, fade * 0.35);
            try {
                source.stop(t + fade * 2);
            } catch {
                return;
            }
        },
    };
}

export function startLoop(id: SoundId, bus: BusName = 'amb'): Loop | null {
    const e = engine;
    if (!e || !isLooping(id)) return null;
    const buffer = bufferFor(e, id, 0);
    if (!buffer) return null;
    const ctx = e.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(e.buses[bus]);
    source.start();
    return {
        setVolume: (volume, smoothing = 0.5) => {
            gain.gain.setTargetAtTime(volume, ctx.currentTime, smoothing);
        },
        stop: () => {
            const t = ctx.currentTime;
            gain.gain.setTargetAtTime(0, t, 0.15);
            try {
                source.stop(t + 0.8);
            } catch {
                return;
            }
            source.onended = () => {
                source.disconnect();
                gain.disconnect();
            };
        },
    };
}