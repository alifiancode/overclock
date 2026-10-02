import { Canvas } from '@react-three/fiber';
import { Stats, Sky } from '@react-three/drei';
import { Player } from '../entities/Player.tsx';
import { CameraRig } from './CameraRig.tsx';
import { Enemies } from '../entities/Enemies.tsx';
import { Bot } from '../entities/Bot.tsx';
import { Effects } from './Effects.tsx';
import { Ground } from './Ground.tsx';
import { ArenaDressing } from './ArenaDressing.tsx';
import { Buildings } from './Buildings.tsx';
import { Lighting } from '../entities/Lighting.tsx';
import { Pickups } from '../entities/Pickups.tsx';
import { Projectiles } from '../entities/Projectiles.tsx';

export function Scene() {
    return (
        <Canvas shadows dpr={1} gl={{ antialias: false }} camera={{ position: [10, 12, 10], fov: 40 }}>
            <fog attach="fog" args={['#6b7080', 45, 165]} />
            <ambientLight intensity={0.62} color="#9a96a8" />
            <directionalLight position={[8, 15, 5]} intensity={1.35} color="#d8caa0" castShadow shadow-mapSize={[1024, 1024]} />
            <hemisphereLight args={['#8fa8c8', '#4a4030', 0.45]} />
            <Sky sunPosition={[8, 15, 5]} turbidity={10} rayleigh={2} mieCoefficient={0.01} mieDirectionalG={0.9} />

            <Ground />
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
            <Stats />
        </Canvas>
    );
}