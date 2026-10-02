import { EffectComposer, Bloom, Vignette, ToneMapping} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export function Effects() {
    return (
        <EffectComposer enableNormalPass>
            <Bloom luminanceThreshold={0.55} luminanceSmoothing={0.9} intensity={0.9} />
            <Vignette offset={0.32} darkness={0.4} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
    );
}