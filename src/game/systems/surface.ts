import { WATER_LEVEL } from '../data/constants.ts';
import { buildings } from './footprints.ts';
import { floorKindOf } from './floorKinds.ts';
import { isInStairZone } from './obstacles.ts';
import { createBiome, sampleBiome, trailMask } from './terrain.ts';
import { wrapCoord } from './wrap.ts';

export type Surface =
    | 'grass'
    | 'leaves'
    | 'dirt'
    | 'mud'
    | 'gravel'
    | 'asphalt'
    | 'pavement'
    | 'concrete'
    | 'wood'
    | 'carpet'
    | 'tile'
    | 'stairs'
    | 'shallow'
    | 'deep'
    | 'debris';

const DEEP_DEPTH = 0.7;
const SHALLOW_DEPTH = 0.05;
const MUD_LIFT = 0.55;

const biome = createBiome();

export function outdoorSurface(x: number, z: number): Surface {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    const b = sampleBiome(wx, wz, biome);
    if (b.water > DEEP_DEPTH) return 'deep';
    if (b.water > SHALLOW_DEPTH) return 'shallow';
    if (b.height - WATER_LEVEL < MUD_LIFT) return 'mud';
    if (b.road > 0.5) return 'asphalt';
    if (b.sidewalk > 0.5) return 'pavement';
    if (b.city > 0.3) return b.overgrowth > 0.62 ? 'grass' : 'pavement';
    if (b.slope > 0.75) return 'gravel';
    if (b.dirt > 0.42 || trailMask(wx, wz) > 0.55) return 'dirt';
    if (b.forest > 0.55 || b.bush > 0.7) return 'leaves';
    return 'grass';
}

export function indoorSurface(x: number, z: number, buildingIndex: number, floor: number): Surface {
    const building = buildings[buildingIndex];
    if (!building) return 'concrete';
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    if (isInStairZone(wx, wz)) return 'stairs';
    const level = floor < 0 ? 0 : floor >= building.rooms.length ? building.rooms.length - 1 : floor;
    const rooms = building.rooms[level];
    if (!rooms) return 'concrete';
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        if (wx < room.minX || wx > room.maxX || wz < room.minZ || wz > room.maxZ) continue;
        const kind = floorKindOf(building.plan, room, level);
        return kind === 'tileBig' ? 'tile' : kind;
    }
    return 'concrete';
}

export function surfaceAt(x: number, z: number, buildingIndex: number, floor: number): Surface {
    return buildingIndex >= 0 ? indoorSurface(x, z, buildingIndex, floor) : outdoorSurface(x, z);
}

export function buildingDecay(buildingIndex: number): number {
    return buildings[buildingIndex]?.decay ?? 0;
}