import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export function Effects() {
    return (
        <EffectComposer multisampling={4}>
            <Bloom mipmapBlur luminanceThreshold={0.8} luminanceSmoothing={0.25} intensity={0.85} />
            <Vignette offset={0.32} darkness={0.4} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
    );
}