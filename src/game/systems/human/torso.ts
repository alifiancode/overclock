import { Mesher, smoothstep, surfaceOf, wrapPi, type Bump, type PaintFn, type Rgb, type SkinFn } from './mesher.ts';
import { MAT, extent, mirrorRoute, profile, route, sample, scaleBumps, torsoBumps, type Ctx } from './anatomy.ts';
import { mix, tone } from './look.ts';

export function skinPaint(ctx: Ctx): PaintFn {
    const { skin, skinWarm, skinCool } = ctx.look;
    return (x, y, z) => {
        const n = 0.5 + 0.5 * Math.sin(x * 23 + y * 17 + Math.sin(z * 19) * 2);
        const m = 0.5 + 0.5 * Math.sin(y * 31 - x * 11 + z * 13);
        return mix(mix(skin, skinWarm, n * 0.6), skinCool, m * 0.3);
    };
}

function fabric(base: Rgb, amount = 0.06): PaintFn {
    return (x, y, z) => tone(base, 1 - amount + amount * 2 * (0.5 + 0.5 * Math.sin(x * 190 + y * 150 + z * 170)));
}

export function buildTorso(ctx: Ctx, out: Mesher): void {
    const { H, C, P, topY, rows, id, fem } = ctx;
    const torsoSkin: SkinFn = (_x, y) => [id.pelvis, id.chest, smoothstep(H - 0.02, C + 0.075, y)];
    const bumps = torsoBumps(ctx);
    out.loft({ sections: sample(rows, H, H - 0.11, topY, 64), seg: 60, rings: 64, bumps, skin: torsoSkin, paint: skinPaint(ctx), mat: MAT.skin, capLow: 0.01 });

    const neckR = fem ? 0.05 : 0.059;
    const neckSkin: SkinFn = (_x, y) => [id.chest, id.head, smoothstep(topY - 0.02, P + 0.01, y)];
    const neckBumps: Bump[] = [
        { y: topY + 0.03, a: 0.95, sy: 0.035, sa: 0.5, amp: fem ? 0.003 : 0.006 },
        { y: topY + 0.03, a: -0.95, sy: 0.035, sa: 0.5, amp: fem ? 0.003 : 0.006 },
    ];
    if (!fem) neckBumps.push({ y: P - 0.035, a: 0, sy: 0.014, sa: 0.12, amp: 0.005 });
    out.loft({
        sections: [
            { y: topY - 0.03, rx: neckR + 0.004, rf: neckR, rb: neckR + 0.005, cz: -0.004 },
            { y: topY + 0.02, rx: neckR + 0.001, rf: neckR - 0.003, rb: neckR + 0.004, cz: -0.002 },
            { y: P - 0.005, rx: neckR - 0.002, rf: neckR - 0.004, rb: neckR + 0.004, cz: 0.002 },
            { y: P + 0.03, rx: neckR - 0.002, rf: neckR - 0.004, rb: neckR + 0.004, cz: 0.004 },
        ],
        seg: 20,
        rings: 9,
        bumps: neckBumps,
        skin: neckSkin,
        paint: skinPaint(ctx),
        mat: MAT.skin,
    });

    if (fem) femaleClothes(ctx, out, torsoSkin, bumps);
    else maleClothes(ctx, out, torsoSkin, bumps);
}

function strap(out: Mesher, ctx: Ctx, surface: ReturnType<typeof surfaceOf>, points: [number, number][], width: number, lift: number, paint: PaintFn | Rgb, mat: number, skin: SkinFn, steps = 28) {
    out.strip({ surface, path: route(points), width: () => width, steps, lift, paint, skin, mat });
    out.strip({ surface, path: route(mirrorRoute(points)), width: () => width, steps, lift, paint, skin, mat });
    void ctx;
}

function maleClothes(ctx: Ctx, out: Mesher, torsoSkin: SkinFn, bumps: Bump[]) {
    const { H, topY, rows, look, P } = ctx;
    const shirtBumps = scaleBumps(bumps, 0.8);
    const shirtSections = sample(rows, H, H - 0.014, topY, 52);
    out.loft({ sections: shirtSections, seg: 60, rings: 52, offset: 0.005, bumps: shirtBumps, skin: torsoSkin, paint: fabric(look.top), mat: MAT.cloth, capLow: 0.004, open: true });
    out.loft({
        sections: [
            { y: topY - 0.012, rx: 0.07, rf: 0.064, rb: 0.07, cz: -0.004 },
            { y: topY + 0.02, rx: 0.066, rf: 0.06, rb: 0.066, cz: -0.003 },
            { y: topY + 0.044, rx: 0.065, rf: 0.059, rb: 0.065, cz: -0.002 },
        ],
        seg: 28,
        rings: 5,
        skin: (_x, y) => [ctx.id.chest, ctx.id.head, smoothstep(topY - 0.02, P + 0.01, y)],
        paint: look.topDark,
        mat: MAT.cloth,
        open: true,
    });

    const vestLo = profile([
        [0, H + 0.13],
        [1.2, H + 0.13],
        [Math.PI, H + 0.136],
    ]);
    const vestHi = profile([
        [0, H + 0.445],
        [0.45, H + 0.455],
        [0.62, H + 0.5],
        [1.0, H + 0.5],
        [1.22, H + 0.36],
        [1.57, H + 0.335],
        [1.95, H + 0.35],
        [2.12, H + 0.5],
        [2.62, H + 0.5],
        [2.82, H + 0.44],
        [Math.PI, H + 0.44],
    ]);
    const [vy0, vy1] = extent(vestLo, vestHi);
    const vestBumps: Bump[] = [...scaleBumps(bumps, 0.5), { y: H + 0.3, a: 0, sy: 0.09, sa: 0.55, amp: 0.011 }, { y: H + 0.3, a: Math.PI, sy: 0.09, sa: 0.55, amp: 0.011 }];
    const webbing = mix(look.vest, lin3(0.2, 0.21, 0.19), 0.55);
    const vestPaint: PaintFn = (x, y, z, a) => {
        const f = Math.abs(wrapPi(a));
        const phase = (((y - (H + 0.16)) / 0.026) % 1 + 1) % 1;
        if (f < 0.72 && y > H + 0.17 && y < H + 0.4 && phase < 0.2) return webbing;
        return fabric(look.vest, 0.05)(x, y, z, a);
    };
    const vestSections = sample(rows, H, vy0, vy1, 44);
    out.loft({ sections: vestSections, seg: 64, rings: 30, offset: 0.017, bumps: vestBumps, lo: vestLo, hi: vestHi, skin: torsoSkin, paint: vestPaint, mat: MAT.cloth, open: true });
    const vestSurface = surfaceOf({ sections: vestSections, bumps: vestBumps, offset: 0.017 });
    strap(out, ctx, vestSurface, [[H + 0.498, 0.99], [H + 0.512, 1.3], [H + 0.514, 1.6], [H + 0.512, 1.85], [H + 0.498, 2.13]], 0.05, 0.002, fabric(look.vest, 0.05), MAT.cloth, torsoSkin);

    const pantsHi = () => H + 0.1;
    const pantsSections = sample(rows, H, H - 0.11, H + 0.1, 24);
    out.loft({
        sections: pantsSections,
        seg: 60,
        rings: 24,
        offset: 0.007,
        bumps: [
            { y: H - 0.03, a: Math.PI - 0.45, sy: 0.07, sa: 0.5, amp: 0.016 },
            { y: H - 0.03, a: Math.PI + 0.45, sy: 0.07, sa: 0.5, amp: 0.016 },
        ],
        hi: pantsHi,
        skin: torsoSkin,
        paint: fabric(look.pants, 0.07),
        mat: MAT.cloth,
        capLow: 0.012,
        open: true,
    });
    const beltSections = sample(rows, H, H + 0.04, H + 0.09, 6);
    out.loft({ sections: beltSections, seg: 60, rings: 6, offset: 0.0125, skin: torsoSkin, paint: look.belt, mat: MAT.leather, open: true });
    const beltSurface = surfaceOf({ sections: beltSections, offset: 0.0125 });
    const buckle = beltSurface(H + 0.065, 0);
    out.ellipsoid(buckle[0], buckle[1], buckle[2] + 0.002, 0.022, 0.016, 0.006, 12, 8, torsoSkin, look.metal, undefined, undefined, MAT.metal);
}

function lin3(r: number, g: number, b: number): Rgb {
    return [r * r, g * g, b * b];
}

function femaleClothes(ctx: Ctx, out: Mesher, torsoSkin: SkinFn, bumps: Bump[]) {
    const { H, topY, rows, look } = ctx;
    const topHi = profile([
        [0, H + 0.345],
        [0.22, H + 0.36],
        [0.42, H + 0.395],
        [0.62, H + 0.385],
        [0.95, H + 0.35],
        [1.57, H + 0.335],
        [2.1, H + 0.35],
        [2.6, H + 0.41],
        [Math.PI, H + 0.425],
    ]);
    const topLo = profile([
        [0, H + 0.248],
        [1.2, H + 0.252],
        [2.2, H + 0.265],
        [Math.PI, H + 0.28],
    ]);
    const [ty0, ty1] = extent(topLo, topHi);
    const topSections = sample(rows, H, ty0, ty1, 40);
    const trim = look.strap;
    void topY;
    const topPaint: PaintFn = (x, y, z, a) => {
        if (y - topLo(a) < 0.009) return trim;
        return fabric(look.top, 0.05)(x, y, z, a);
    };
    out.loft({ sections: topSections, seg: 72, rings: 26, offset: 0.0045, bumps, lo: topLo, hi: topHi, skin: torsoSkin, paint: topPaint, mat: MAT.cloth, open: true });
    const topSurface = surfaceOf({ sections: topSections, bumps, offset: 0.0045 });
    strap(out, ctx, topSurface, [[H + 0.39, 0.56], [H + 0.455, 0.85], [H + 0.49, 1.25], [H + 0.495, 1.7], [H + 0.46, 2.1], [H + 0.415, 2.5]], 0.024, 0.0015, fabric(look.top, 0.05), MAT.cloth, torsoSkin);

    const pantsHi = profile([
        [0, H + 0.066],
        [1.0, H + 0.074],
        [2.0, H + 0.086],
        [Math.PI, H + 0.095],
    ]);
    const [py0, py1] = extent(() => H - 0.11, pantsHi);
    const pantsSections = sample(rows, H, py0, py1, 26);
    out.loft({
        sections: pantsSections,
        seg: 72,
        rings: 26,
        offset: 0.0035,
        bumps,
        hi: pantsHi,
        skin: torsoSkin,
        paint: fabric(look.pants, 0.05),
        mat: MAT.cloth,
        capLow: 0.012,
        open: true,
    });
    const beltSections = sample(rows, H, H + 0.045, H + 0.088, 6);
    const beltHi = pantsHi;
    void beltHi;
    out.loft({ sections: beltSections, seg: 72, rings: 6, offset: 0.0105, bumps, skin: torsoSkin, paint: look.belt, mat: MAT.leather, open: true });
    const beltSurface = surfaceOf({ sections: beltSections, bumps, offset: 0.0105 });
    const buckle = beltSurface(H + 0.066, 0);
    out.ellipsoid(buckle[0], buckle[1], buckle[2] + 0.002, 0.02, 0.014, 0.006, 12, 8, torsoSkin, look.metal, undefined, undefined, MAT.metal);

    strap(out, ctx, topSurface, [[H + 0.45, 0.95], [H + 0.5, 1.3], [H + 0.5, 1.75], [H + 0.45, 2.15], [H + 0.33, 2.35]], 0.03, 0.006, look.strap, MAT.leather, torsoSkin);
    out.strip({
        surface: topSurface,
        path: route([[H + 0.352, 1.02], [H + 0.352, 0.4], [H + 0.352, 0], [H + 0.352, -0.4], [H + 0.352, -1.02]]),
        width: () => 0.02,
        steps: 30,
        lift: 0.0055,
        paint: look.strap,
        skin: torsoSkin,
        mat: MAT.leather,
    });
}