import { Color } from 'three';
import type { PaintFn, Rgb } from './mesher.ts';
import type { Gender } from './skeleton.ts';

export const lin = (hex: string): Rgb => {
    const c = new Color(hex);
    return [c.r, c.g, c.b];
};

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const tone = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];

export type Look = {
    skin: Rgb;
    skinWarm: Rgb;
    skinCool: Rgb;
    lips: Rgb;
    blush: Rgb;
    hair: Rgb;
    hairHi: Rgb;
    brow: Rgb;
    iris: Rgb;
    sclera: Rgb;
    nail: Rgb;
    top: Rgb;
    topDark: Rgb;
    vest: Rgb;
    vestTrim: Rgb;
    pants: Rgb;
    pantsDark: Rgb;
    belt: Rgb;
    boots: Rgb;
    sole: Rgb;
    lace: Rgb;
    accent: Rgb;
    metal: Rgb;
    strap: Rgb;
    pack: Rgb;
};

export function lookFor(gender: Gender): Look {
    if (gender === 'female') {
        return {
            skin: lin('#e2ae90'),
            skinWarm: lin('#ebb89b'),
            skinCool: lin('#d6a083'),
            lips: lin('#b8364d'),
            blush: lin('#e8978a'),
            hair: lin('#4a2518'),
            hairHi: lin('#7d4528'),
            brow: lin('#3a1e14'),
            iris: lin('#3f5b4e'),
            sclera: lin('#eee9e2'),
            nail: lin('#9e1f2f'),
            top: lin('#141418'),
            topDark: lin('#0b0b0e'),
            vest: lin('#141418'),
            vestTrim: lin('#0b0b0e'),
            pants: lin('#25252c'),
            pantsDark: lin('#17171c'),
            belt: lin('#6d1624'),
            boots: lin('#17171b'),
            sole: lin('#0c0c0e'),
            lace: lin('#a01c30'),
            accent: lin('#ff4f6a'),
            metal: lin('#b4b7bd'),
            strap: lin('#7a1626'),
            pack: lin('#1e1e24'),
        };
    }
    return {
        skin: lin('#c99a76'),
        skinWarm: lin('#d6a27d'),
        skinCool: lin('#be8e6e'),
        lips: lin('#a5685a'),
        blush: lin('#cf8a74'),
        hair: lin('#231913'),
        hairHi: lin('#3a2b20'),
        brow: lin('#2a1f18'),
        iris: lin('#4b3a2a'),
        sclera: lin('#e6e2da'),
        nail: lin('#d9b9a1'),
        top: lin('#59603f'),
        topDark: lin('#454b30'),
        vest: lin('#2b2e31'),
        vestTrim: lin('#1c1e20'),
        pants: lin('#5d5a47'),
        pantsDark: lin('#47453a'),
        belt: lin('#1b1b1d'),
        boots: lin('#2b221c'),
        sole: lin('#12100e'),
        lace: lin('#16161a'),
        accent: lin('#ff9d4d'),
        metal: lin('#8c8f94'),
        strap: lin('#232527'),
        pack: lin('#67644e'),
    };
}

export function fabricPaint(base: Rgb, amount = 0.06): PaintFn {
    return (x, y, z) => tone(base, 1 - amount + amount * 2 * (0.5 + 0.5 * Math.sin(x * 190 + y * 150 + z * 170)));
}