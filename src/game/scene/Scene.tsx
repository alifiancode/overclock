import { useEffect, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import type { PerspectiveCamera } from 'three';
import { Player } from '../entities/Player.tsx';
import { CameraRig } from './CameraRig.tsx';
import { Enemies } from '../entities/Enemies.tsx';
import { Bot } from '../entities/Bot.tsx';
import { Effects } from './Effects.tsx';
import { Ground, Water } from './Ground.tsx';
import { ArenaDressing } from './ArenaDressing.tsx';
import { Buildings } from './Buildings.tsx';
import { Lighting, SceneLights } from '../entities/Lighting.tsx';
import { Pickups } from '../entities/Pickups.tsx';
import { Projectiles } from '../entities/Projectiles.tsx';
import { pendingTaskCount, runTasks } from '../systems/buildQueue.ts';
import { resetFx, updateFx } from '../systems/fxState.ts';

const FOG_COLOR = '#6c8470';
const FOG_NEAR = 30;
const FOG_FAR = 92;
const SLOW_FRAME = 0.03;
const BUSY_QUEUE = 30;
const BUDGET_SLOW = 0.6;
const BUDGET_BUSY = 3.2;
const BUDGET_NORMAL = 2.2;

function BuildDriver() {
    useFrame((_, delta) => {
        const pending = pendingTaskCount();
        if (pending === 0) return;
        runTasks(delta > SLOW_FRAME ? BUDGET_SLOW : pending > BUSY_QUEUE ? BUDGET_BUSY : BUDGET_NORMAL);
    });
    return null;
}

function FxDriver() {
    const width = useThree((state) => state.size.width);
    const height = useThree((state) => state.size.height);
    const dpr = useThree((state) => state.viewport.dpr);

    useLayoutEffect(() => {
        resetFx();
        return () => resetFx();
    }, []);

    useFrame(({ camera, clock }, delta) => {
        camera.updateMatrixWorld();
        updateFx(camera as PerspectiveCamera, width * dpr, height * dpr, clock.elapsedTime, delta);
    });
    return null;
}

function Warmup() {
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);

    useEffect(() => {
        let cancelled = false;
        const id = requestAnimationFrame(() => {
            if (cancelled) return;
            void gl.compileAsync(scene, camera).catch(() => undefined);
        });
        return () => {
            cancelled = true;
            cancelAnimationFrame(id);
        };
    }, [gl, scene, camera]);
    return null;
}

export function Scene() {
    return (
        <Canvas shadows dpr={1} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ position: [10, 12, 10], fov: 40, near: 0.5, far: 260 }}>
            <color attach="background" args={[FOG_COLOR]} />
            <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />
            <SceneLights />

            <Ground />
            <Water />
            <ArenaDressing />
            <Buildings />
            <Lighting />

            <Player />
            <CameraRig />
            <Enemies />
            <Pickups />
            <Projectiles />
            <Bot />
            <Effects />
            <BuildDriver />
            <FxDriver />
            <Warmup />
            <Stats />
        </Canvas>
    );
}