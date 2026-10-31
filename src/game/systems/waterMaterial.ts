import { Color, DataTexture, LinearFilter, RedFormat, RepeatWrapping, ShaderMaterial, UniformsLib, UniformsUtils, UnsignedByteType, Vector3 } from 'three';
import { WORLD_HALF, WORLD_SIZE } from '../data/constants.ts';
import { getWaterTexture } from './terrain.ts';
import { fx } from './shaderFx.ts';

const VERTEX = `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const FRAGMENT = `
uniform sampler2D uDepth;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
float wHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float wNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wave(vec2 p) {
    return wNoise(p * 0.9 + vec2(uTime * 0.22, uTime * 0.13)) + wNoise(p * 1.9 - vec2(uTime * 0.18, uTime * 0.27)) * 0.6 + wNoise(p * 4.1 + vec2(uTime * 0.4, -uTime * 0.3)) * 0.3;
}
void main() {
    vec2 uv = (vWorld.xz + ${(WORLD_HALF + 0.5).toFixed(1)}) / ${WORLD_SIZE.toFixed(1)};
    float d = texture2D(uDepth, uv).r;
    if (d < 0.003) discard;
    float e = 0.12;
    float h0 = wave(vWorld.xz);
    float hx = wave(vWorld.xz + vec2(e, 0.0));
    float hz = wave(vWorld.xz + vec2(0.0, e));
    vec3 n = normalize(vec3(-(hx - h0) * 0.9, 1.0, -(hz - h0) * 0.9));
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float depthMix = smoothstep(0.0, 0.65, d);
    vec3 col = mix(uShallow, uDeep, depthMix);
    col = mix(col, uSky, fres * 0.55);
    vec3 r = reflect(-uSun, n);
    float spec = pow(max(dot(r, v), 0.0), 90.0);
    col += vec3(1.0, 0.95, 0.8) * spec * 1.4;
    float ripple = smoothstep(0.82, 1.0, wNoise(vWorld.xz * 2.3 + uTime * 0.35));
    col += vec3(0.5, 0.65, 0.6) * ripple * 0.06;
    float foamBand = 1.0 - smoothstep(0.0, 0.05 + 0.02 * sin(uTime * 1.7 + vWorld.x * 0.8 + vWorld.z * 0.6), d);
    float foam = foamBand * (0.55 + 0.45 * wNoise(vWorld.xz * 5.0 + uTime * 0.5));
    col = mix(col, vec3(0.85, 0.95, 0.9), foam * 0.7);
    float alpha = mix(0.42, 0.93, smoothstep(0.0, 0.55, d));
    alpha = max(alpha, foam * 0.8);
    alpha *= smoothstep(0.003, 0.03, d);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;

export function createWaterMaterial(): ShaderMaterial {
    const tex = getWaterTexture();
    const texture = new DataTexture(tex.data, tex.size, tex.size, RedFormat, UnsignedByteType);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    const uniforms = UniformsUtils.merge([UniformsLib.fog]);
    uniforms.uDepth = { value: texture };
    uniforms.uTime = fx.uTime;
    uniforms.uSun = { value: new Vector3(8, 15, 5).normalize() };
    uniforms.uShallow = { value: new Color('#3f9c8a') };
    uniforms.uDeep = { value: new Color('#0d3f4a') };
    uniforms.uSky = { value: new Color('#a8cfe0') };
    const material = new ShaderMaterial({
        uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        fog: true,
    });
    return material;
}
