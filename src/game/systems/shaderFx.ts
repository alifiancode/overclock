import { Material, MeshLambertMaterial, MeshStandardMaterial, ShaderChunk, Vector2, Vector3, Vector4 } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { FLOOR_HEIGHT, ROAD_HALF_WIDTH, SIDEWALK_WIDTH, STREET_PITCH } from '../data/constants.ts';

export const SEE_COUNT = 8;

export const fx = {
    uTime: { value: 0 },
    uPlayer: { value: new Vector3() },
    uCamDir: { value: new Vector2(1, 0) },
    uIndoor: { value: 0 },
    uReveal: { value: new Vector2(4.8, 10.5) },
    uCut: { value: new Vector4(1, 1, -1, -1) },
    uCutY: { value: new Vector3(500, 500, 500) },
    uSee: { value: Array.from({ length: SEE_COUNT }, () => new Vector4(0, 0, 1, 0)) },
};

export type FxFlags = {
    fxSway?: number;
    fxCut?: boolean;
    fxSee?: boolean;
    fxGround?: boolean;
    fxNoDark?: boolean;
    fxNoFlip?: boolean;
    fxGrime?: boolean;
};

const VERTEX_DECLS = `
uniform float uTime;
uniform vec3 uPlayer;
uniform vec2 uCamDir;
uniform vec4 uCut;
uniform vec3 uCutY;
varying vec3 vFxWorld;
#if defined(FX_SWAY) || defined(FX_CUT)
attribute float aExtra;
#endif
#ifdef FX_CUT
varying float vFxEmit;
#endif
#ifdef FX_GROUND
attribute vec2 aStreet;
varying vec2 vFxStreet;
#endif
`;

const VERTEX_DISPLACE = `
#ifdef FX_SWAY
{
    vec4 fxw0 = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
    fxw0 = instanceMatrix * fxw0;
    #endif
    fxw0 = modelMatrix * fxw0;
    float fxPhase = fxw0.x * 0.35 + fxw0.z * 0.27;
    float fxAmp = aExtra * FX_SWAY;
    transformed.x += sin(uTime * 1.6 + fxPhase) * fxAmp + sin(uTime * 3.1 + fxPhase * 2.1) * fxAmp * 0.3;
    transformed.z += cos(uTime * 1.3 + fxPhase * 1.2) * fxAmp * 0.7;
    transformed.y += sin(uTime * 2.2 + fxPhase * 1.7) * fxAmp * 0.12;
}
#endif
#ifdef FX_CUT
{
    vec4 fxw1 = vec4(transformed, 1.0);
    vec4 fxo = vec4(0.0, 0.0, 0.0, 1.0);
    #ifdef USE_INSTANCING
    fxw1 = instanceMatrix * fxw1;
    fxo = instanceMatrix * fxo;
    #endif
    fxw1 = modelMatrix * fxw1;
    fxo = modelMatrix * fxo;
    if (fxo.x > uCut.x && fxo.x < uCut.z && fxo.z > uCut.y && fxo.z < uCut.w) {
        float fxE = floor(aExtra * 0.01 + 0.001);
        float fxR = aExtra - fxE * 100.0;
        float fxF = floor(fxR * 0.1 + 0.001);
        float fxK = fxR - fxF * 10.0;
        float fxBaseY = modelMatrix[3][1];
        #ifdef USE_INSTANCING
        fxBaseY += instanceMatrix[3][1];
        #endif
        float fxFloorY = fxBaseY + fxF * FX_FLOOR_H;
        if (fxFloorY > uCutY.z) {
            transformed = vec3(0.0, -80.0, 0.0);
        } else if (fxK > 0.5) {
            vec2 fxRel = fxw1.xz - uPlayer.xz;
            float fxSide = smoothstep(-0.6, 2.2, dot(fxRel, uCamDir));
            if (fxK > 1.5) fxSide *= 1.0 - smoothstep(4.2, 8.0, length(fxRel));
            float fxClamp = mix(uCutY.x, uCutY.y, fxSide);
            transformed.y -= max(0.0, fxw1.y - fxClamp);
        }
    }
}
#endif
`;

const VERTEX_WORLD = `
{
    vec4 fxWp = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
    fxWp = instanceMatrix * fxWp;
    #endif
    vFxWorld = (modelMatrix * fxWp).xyz;
    #ifdef FX_GROUND
    vFxStreet = aStreet;
    #endif
    #ifdef FX_CUT
    vFxEmit = floor(aExtra * 0.01 + 0.001);
    #endif
}
`;

const FRAGMENT_DECLS = `
uniform vec3 uPlayer;
uniform float uIndoor;
uniform vec2 uReveal;
uniform vec4 uSee[FX_SEE_COUNT];
varying vec3 vFxWorld;
#ifdef FX_GROUND
varying vec2 vFxStreet;
#endif
#ifdef FX_CUT
varying float vFxEmit;
#endif
float fxHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float fxNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = fxHash(i);
    float b = fxHash(i + vec2(1.0, 0.0));
    float c = fxHash(i + vec2(0.0, 1.0));
    float d = fxHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

const FRAGMENT_SEE = `
#ifdef FX_SEE
if (vFxWorld.y > uPlayer.y + 1.2) {
    float fxCamD = length(vFxWorld - cameraPosition);
    for (int fxI = 0; fxI < FX_SEE_COUNT; fxI++) {
        vec4 fxS = uSee[fxI];
        if (fxS.w > 0.5 && fxCamD < fxS.w - 1.1) {
            float fxR = length(gl_FragCoord.xy - fxS.xy) / fxS.z;
            if (fxR < 1.0) {
                float fxN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
                if (fxN > smoothstep(0.15, 1.0, fxR)) discard;
            }
        }
    }
}
#endif
`;

const FRAGMENT_DETAIL = `
#ifdef FX_GRIME
{
    vec3 fxQ = vFxWorld;
    float fxGA = fxNoise(fxQ.xz * 0.5 + fxQ.y * 0.8);
    float fxGB = fxNoise(fxQ.xz * 2.2 + fxQ.y * 3.1);
    float fxGC = fxNoise(vec2(fxQ.x + fxQ.z, fxQ.y * 0.6) * 1.3 + 7.0);
    diffuseColor.rgb *= 0.78 + 0.2 * fxGA + 0.14 * fxGB + 0.1 * fxGC;
}
#endif
#ifdef FX_GROUND
{
    vec2 fxP = vFxWorld.xz;
    float fxBig = fxNoise(fxP * 0.35);
    float fxMid = fxNoise(fxP * 1.7);
    float fxFine = fxNoise(fxP * 6.5);
    float fxGrain = fxNoise(fxP * 15.0 + 5.0);
    diffuseColor.rgb *= 0.7 + 0.16 * fxBig + 0.22 * fxMid + 0.16 * fxFine + 0.12 * fxGrain;
    vec2 fxM = abs(mod(fxP + FX_PITCH * 0.5, FX_PITCH) - FX_PITCH * 0.5);
    float fxRoadD = min(fxM.x, fxM.y);
    if (vFxStreet.x > 0.01 && fxRoadD < FX_OUTER + 0.6) {
        float fxAA = max(fwidth(fxP.x), fwidth(fxP.y)) + 0.02;
        float fxRoad = (1.0 - smoothstep(FX_ROAD - fxAA, FX_ROAD + fxAA, fxRoadD)) * vFxStreet.x;
        float fxOuter = (1.0 - smoothstep(FX_OUTER - fxAA, FX_OUTER + fxAA, fxRoadD)) * vFxStreet.x;
        float fxSideM = clamp(fxOuter - fxRoad, 0.0, 1.0);
        float fxG1 = fxNoise(fxP * 7.0 + 2.0);
        float fxG2 = fxNoise(fxP * 2.3 + 11.0);
        float fxMoss = smoothstep(0.35, 0.85, vFxStreet.y + (fxNoise(fxP * 0.5 + 3.0) - 0.5) * 0.9);
        float fxCrackN = abs(fxNoise(fxP * vec2(1.1, 0.9) + 21.0) - 0.5);
        float fxCrack = (1.0 - smoothstep(0.0, 0.025 + fxAA * 0.12, fxCrackN)) * smoothstep(0.42, 0.7, fxNoise(fxP * 0.22 + 9.0));
        vec3 fxMossCol = vec3(0.05, 0.14, 0.03) * (0.7 + 0.8 * fxG1);
        vec3 fxAsphalt = vec3(0.05, 0.052, 0.06) * (0.75 + 0.5 * fxG1 + 0.35 * fxG2);
        fxAsphalt *= 1.0 - 0.55 * fxCrack;
        float fxMossAmt = clamp(fxMoss * 0.5 + fxCrack * vFxStreet.y * 0.85, 0.0, 0.9);
        fxAsphalt = mix(fxAsphalt, fxMossCol, fxMossAmt);
        float fxDashV = (1.0 - smoothstep(0.08, 0.08 + fxAA, fxM.x)) * step(fract(fxP.y / 6.0), 0.55) * step(FX_ROAD + 1.0, fxM.y);
        float fxDashH = (1.0 - smoothstep(0.08, 0.08 + fxAA, fxM.y)) * step(fract(fxP.x / 6.0), 0.55) * step(FX_ROAD + 1.0, fxM.x);
        float fxZebraV = step(FX_ROAD + 1.0, fxM.y) * step(fxM.y, FX_ROAD + 3.0) * step(fxM.x, FX_ROAD - 0.6) * step(0.5, fract(fxP.x / 1.1));
        float fxZebraH = step(FX_ROAD + 1.0, fxM.x) * step(fxM.x, FX_ROAD + 3.0) * step(fxM.y, FX_ROAD - 0.6) * step(0.5, fract(fxP.y / 1.1));
        float fxMark = clamp(fxDashV + fxDashH + (fxZebraV + fxZebraH) * 0.75, 0.0, 1.0) * (1.0 - fxMossAmt) * smoothstep(0.2, 0.6, fxG2 + 0.25);
        fxAsphalt = mix(fxAsphalt, vec3(0.3, 0.28, 0.2), fxMark * 0.8);
        float fxKerb = smoothstep(FX_ROAD - 0.3, FX_ROAD - 0.05, fxRoadD) * (1.0 - smoothstep(FX_ROAD - 0.05, FX_ROAD + 0.02, fxRoadD));
        fxAsphalt = mix(fxAsphalt, vec3(0.2, 0.2, 0.19), fxKerb * 0.7);
        vec3 fxConc = vec3(0.3, 0.3, 0.27) * (0.8 + 0.4 * fxG1 + 0.3 * fxG2);
        float fxJointC = fxM.x < fxM.y ? fxP.y : fxP.x;
        float fxJoint = smoothstep(0.455 - fxAA * 0.5, 0.5, abs(fract(fxJointC / 1.6) - 0.5));
        fxConc *= 1.0 - 0.45 * fxJoint;
        fxConc = mix(fxConc, fxMossCol * 1.2, clamp(fxMoss * 0.45 + fxJoint * vFxStreet.y * 0.8 + fxCrack * 0.4 * vFxStreet.y, 0.0, 0.85));
        diffuseColor.rgb = mix(diffuseColor.rgb, fxConc, fxSideM);
        diffuseColor.rgb = mix(diffuseColor.rgb, fxAsphalt, fxRoad);
    }
}
#endif
`;

const FRAGMENT_LIT = `
float fxLit = 1.0;
#ifdef FX_DARK
{
    float fxD = length(vFxWorld - uPlayer);
    float fxReveal = 1.0 - smoothstep(uReveal.x, uReveal.y, fxD);
    fxLit = mix(1.0, fxReveal, uIndoor);
}
#endif
#ifdef FX_CUT
totalEmissiveRadiance += diffuseColor.rgb * vFxEmit * 1.35;
#endif
`;

function flagsOf(material: Material): FxFlags {
    return material.userData as FxFlags;
}

function fxKey(material: Material): string {
    const f = flagsOf(material);
    return `fx${f.fxNoDark ? 0 : 1}${f.fxSway ? Math.round(f.fxSway * 100) : 0}${f.fxCut ? 1 : 0}${f.fxSee ? 1 : 0}${f.fxGround ? 1 : 0}${f.fxNoFlip ? 1 : 0}${f.fxGrime ? 1 : 0}`;
}

function patch(this: Material, shader: WebGLProgramParametersWithUniforms) {
    const f = flagsOf(this);
    shader.uniforms.uTime = fx.uTime;
    shader.uniforms.uPlayer = fx.uPlayer;
    shader.uniforms.uCamDir = fx.uCamDir;
    shader.uniforms.uIndoor = fx.uIndoor;
    shader.uniforms.uReveal = fx.uReveal;
    shader.uniforms.uCut = fx.uCut;
    shader.uniforms.uCutY = fx.uCutY;
    shader.uniforms.uSee = fx.uSee;

    let defs = `#define FX_SEE_COUNT ${SEE_COUNT}\n#define FX_FLOOR_H ${FLOOR_HEIGHT.toFixed(2)}\n`;
    if (!f.fxNoDark) defs += '#define FX_DARK\n';
    if (f.fxSway) defs += `#define FX_SWAY ${f.fxSway.toFixed(3)}\n`;
    if (f.fxCut) defs += '#define FX_CUT\n';
    if (f.fxSee) defs += '#define FX_SEE\n';
    if (f.fxGrime) defs += '#define FX_GRIME\n';
    if (f.fxGround) defs += `#define FX_GROUND\n#define FX_PITCH ${STREET_PITCH.toFixed(2)}\n#define FX_ROAD ${ROAD_HALF_WIDTH.toFixed(2)}\n#define FX_OUTER ${(ROAD_HALF_WIDTH + SIDEWALK_WIDTH).toFixed(2)}\n`;

    shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${defs}${VERTEX_DECLS}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_DISPLACE}`)
        .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_WORLD}`);

    let frag = shader.fragmentShader.replace('#include <common>', `#include <common>\n${defs}${FRAGMENT_DECLS}`);
    frag = frag.replace('void main() {', `void main() {\n${FRAGMENT_SEE}`);
    frag = frag.replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_DETAIL}`);
    frag = frag.replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', `${FRAGMENT_LIT}\n\tvec3 outgoingLight = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * fxLit + totalEmissiveRadiance;`);
    frag = frag.replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;', `${FRAGMENT_LIT}\n\tvec3 outgoingLight = (totalDiffuse + totalSpecular) * fxLit + totalEmissiveRadiance;`);
    if (f.fxNoFlip) frag = frag.replace('#include <normal_fragment_begin>', ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    shader.fragmentShader = frag;
}

let installed = false;

export function installShaderFx() {
    if (installed) return;
    installed = true;
    for (const proto of [MeshLambertMaterial.prototype, MeshStandardMaterial.prototype]) {
        proto.onBeforeCompile = patch;
        proto.customProgramCacheKey = function (this: Material) {
            return fxKey(this);
        };
    }
}

installShaderFx();

