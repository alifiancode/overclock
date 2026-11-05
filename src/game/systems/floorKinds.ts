import type { BuildingPlan } from './buildingGen.ts';
import type { RoomType } from './floorPlans.ts';
import { hash2 } from './bldCommon.ts';

export type FloorKind = 'wood' | 'carpet' | 'tile' | 'tileBig' | 'concrete';

export function floorKindOf(plan: BuildingPlan, room: { id: number; type: RoomType }, f: number): FloorKind {
    const h = hash2(plan.seed + room.id * 31, f * 7 + 1);
    switch (room.type) {
        case 'bathroom':
        case 'entry':
            return 'tile';
        case 'kitchen':
            return h < 0.55 ? 'tile' : 'wood';
        case 'bedroom':
            return h < 0.6 ? 'carpet' : 'wood';
        case 'living':
            return h < 0.5 ? 'wood' : 'carpet';
        case 'dining':
            return 'wood';
        case 'hall':
            return h < 0.5 ? 'wood' : 'tile';
        case 'office':
            return plan.usage === 'office' || h < 0.5 ? 'carpet' : 'wood';
        case 'shop':
            return 'tileBig';
        case 'storage':
        case 'utility':
        case 'warehouse':
            return 'concrete';
    }
}