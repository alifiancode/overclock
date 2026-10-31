import { FH, tag, type BuildCtx } from './bldCommon.ts';
import type { FurnitureKind, FurniturePiece } from './furniture.ts';
import type { Pen } from './furnCommon.ts';
import { HOME_KINDS } from './furnHome.ts';
import { UTILITY_KINDS } from './furnUtility.ts';

const DRAWERS: Record<FurnitureKind, (p: Pen) => void> = { ...HOME_KINDS, ...UTILITY_KINDS };

export function drawFurniture(ctx: BuildCtx, piece: FurniturePiece, floor: number) {
    const pen: Pen = {
        mb: ctx.solid,
        leaf: ctx.leaf,
        rng: ctx.rng,
        style: ctx.plan.style.floorStyles[floor],
        floor,
        decay: ctx.plan.decay,
        piece,
        v: piece.variant,
    };
    const y = floor * FH;
    ctx.solid.push();
    ctx.leaf.push();
    ctx.solid.translate(piece.x, y, piece.z);
    ctx.leaf.translate(piece.x, y, piece.z);
    ctx.solid.rotateY(piece.rot);
    ctx.leaf.rotateY(piece.rot);
    tag(ctx.solid, 0, floor);
    tag(ctx.leaf, 0, floor);
    ctx.solid.jitter = 0.04;
    DRAWERS[piece.kind](pen);
    ctx.solid.jitter = 0;
    ctx.solid.pop();
    ctx.leaf.pop();
}
