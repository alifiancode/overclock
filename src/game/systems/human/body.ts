import { Mesher } from './mesher.ts';
import { makeCtx, type Ctx } from './anatomy.ts';
import { buildTorso } from './torso.ts';
import { buildArm, buildLeg } from './limbs.ts';
import { buildHead } from './head.ts';
import { MIRROR, type Gender } from './skeleton.ts';
import type { Cap } from './mesher.ts';

export const MATERIAL_COUNT = 6;

function occluders(ctx: Ctx): Cap[] {
    const { H, S, P, E, K, b, fem } = ctx;
    const caps: Cap[] = [
        { a: [0, P + 0.09, 0.01], b: [0, P + 0.11, 0.01], r: 0.1 },
        { a: [0, H + 0.1, 0], b: [0, H + 0.45, 0], r: 0.19 },
    ];
    for (const s of [1, -1]) {
        caps.push({ a: [s * b.hipX, H - 0.02, 0], b: [s * b.hipX, K, 0], r: 0.1 });
        caps.push({ a: [s * (b.shoulderX - 0.02), S - 0.04, 0.0], b: [s * (b.shoulderX - 0.02), S - 0.1, 0], r: 0.045 });
        caps.push({ a: [s * b.shoulderX, S, 0], b: [s * b.shoulderX, E, 0], r: 0.055 });
        if (fem) caps.push({ a: [s * 0.052, H + 0.318, 0.1], b: [s * 0.052, H + 0.318, 0.1], r: 0.085 });
    }
    return caps;
}

export function buildBody(gender: Gender): Mesher {
    const ctx = makeCtx(gender);
    const out = new Mesher();
    const left = new Mesher();
    buildTorso(ctx, out);
    buildHead(ctx, out);
    left.merge(buildArm(ctx));
    left.merge(buildLeg(ctx));
    out.merge(left);
    out.merge(left, MIRROR, true);
    out.occlude(occluders(ctx), 0.55, 0.5);
    return out;
}

const cache: Partial<Record<Gender, Mesher>> = {};

export function bodyMesher(gender: Gender): Mesher {
    let m = cache[gender];
    if (!m) {
        m = buildBody(gender);
        cache[gender] = m;
    }
    return m;
}