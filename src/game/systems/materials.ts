import { DoubleSide, MeshLambertMaterial } from 'three';
import type { FxFlags } from './shaderFx.ts';
import './shaderFx.ts';

function lambert(flags: FxFlags, doubleSided: boolean = false): MeshLambertMaterial {
    const material = doubleSided ? new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }) : new MeshLambertMaterial({ vertexColors: true });
    Object.assign(material.userData, flags);
    return material;
}

export const groundMaterial = lambert({ fxGround: true });
export const solidVegMaterial = lambert({ fxSway: 0.12, fxSee: true });
export const leafVegMaterial = lambert({ fxSway: 0.14, fxSee: true, fxNoFlip: true }, true);
export const buildingMaterial = lambert({ fxCut: true, fxSee: true, fxGrime: true });
export const buildingLeafMaterial = lambert({ fxCut: true, fxSee: true, fxNoFlip: true }, true);
export const doorMaterial = lambert({ fxCut: true, fxGrime: true });
export const pickupMaterial = lambert({ fxCut: true });
