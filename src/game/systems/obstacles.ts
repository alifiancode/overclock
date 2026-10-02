import { PLAYABLE_RADIUS, FLOOR_HEIGHT, FLOOR_COUNT, DOOR_WIDTH, WALL_THICKNESS } from '../data/constants.ts';
import { spawnStaticLoot } from './pickups.ts';
import { WEAPON_ORDER, STARTING_WEAPON, type WeaponId } from '../data/weapons.ts';
import { getTerrainHeight, getOvergrowth, registerFlattenZone } from './terrain.ts';
import {
    buildRandomFootprint,
    translateFootprint,
    polygonToWalls,
    isPointInPolygon,
    placeStairwell,
    type WallSegment,
    type ZoneRect,
    type Point2,
    type StairwellRect,
} from './buildingShapes.ts';
import { buildFloorPlan, furnishRoom, type FurniturePiece, type FloorPlan } from './floorPlans.ts';

export type { WallSegment } from './buildingShapes.ts';
export type { FurniturePiece } from './floorPlans.ts';

export type LightSource = { position: [number, number, number]; color: string; kind: 'torch' | 'lamp' | 'barrel'; seed: number };
export type GrassClump = { position: [number, number, number]; rotationY: number; scale: number; seed: number; variant: number };
export type FlowerCluster = { position: [number, number, number]; rotationY: number; scale: number; seed: number; colorIndex: number };

export const GRASS_VARIANT_COUNT = 3;
export const FLOWER_COLOR_COUNT = 5;

export type PropDef = {
    position: [number, number, number];
    rotationY: number;
    scale: [number, number, number];
    collisionRadius: number;
};

export type StairFlight = { x: number; halfWidth: number; z1: number; z2: number; fromFloor: number; toFloor: number };

export type BuildingDef = {
    position: [number, number, number];
    width: number;
    depth: number;
    bounds: ZoneRect;
    polygon: Point2[];
    zones: ZoneRect[];
    hullColor: string;
    windowColor: string;
    trimColor: string;
    roofStyle: 'flat' | 'broken' | 'stepped';
    hasFireEscape: boolean;
    collisionRadius: number;
    walls: WallSegment[];
    interiorWalls: { seg: WallSegment; floor: number }[];
    stairs: StairFlight[];
    stairwell: ZoneRect;
    furniture: FurniturePiece[];
};

const PROP_COUNT = 170;
const PROP_CLEAR_RADIUS = 9;
const TARGET_BUILDING_COUNT = 26;
const SPAWN_CLEAR_RADIUS = 16;
const STAIR_WIDTH = 2.4;
const STAIR_DEPTH = 7.2;
const STAIR_FLIGHT_LEN = 3.2;
const NON_STARTING_WEAPONS: WeaponId[] = WEAPON_ORDER.filter((id) => id !== STARTING_WEAPON);
const BUILDING_PALETTE: { hull: string; window: string; trim: string }[] = [
    { hull: '#6b5a48', window: '#ffd27a', trim: '#3d3226' },
    { hull: '#4a5f6b', window: '#ffcf8a', trim: '#2a3840' },
    { hull: '#5f4a52', window: '#ffb86a', trim: '#382a30' },
    { hull: '#5a6b4a', window: '#ffe090', trim: '#333d28' },
    { hull: '#6b5540', window: '#ffcf70', trim: '#3d2f20' },
    { hull: '#4f5a5f', window: '#a8e0ff', trim: '#2c3438' },
    { hull: '#6b4a4a', window: '#ffb090', trim: '#3d2828' },
    { hull: '#565a48', window: '#d0ffa0', trim: '#303428' },
];

function buildProps(clearOfBuildings: { x: number; z: number; r: number }[]): PropDef[] {
    const props: PropDef[] = [];
    let attempts = 0;
    while (props.length < PROP_COUNT && attempts < PROP_COUNT * 6) {
        attempts++;
        const x = (Math.random() - 0.5) * (PLAYABLE_RADIUS - 4) * 2;
        const z = (Math.random() - 0.5) * (PLAYABLE_RADIUS - 4) * 2;
        if (Math.hypot(x, z) < PROP_CLEAR_RADIUS || Math.hypot(x, z) > PLAYABLE_RADIUS - 2) continue;
        if (clearOfBuildings.some((b) => Math.hypot(x - b.x, z - b.z) < b.r + 1.5)) continue;
        const height = 0.4 + Math.random() * 0.9;
        const footprint = 0.5 + Math.random() * 0.7;
        const groundY = getTerrainHeight(x, z);
        props.push({
            position: [x, groundY + height / 2, z],
            rotationY: Math.random() * Math.PI * 2,
            scale: [footprint, height, footprint],
            collisionRadius: footprint * 0.6,
        });
    }
    return props;
}

const GRASS_PATCH_COUNT = 380;
const GRASS_PATCH_RADIUS = 2.6;
const FLOWER_PATCH_COUNT = 150;
const FLOWER_PATCH_RADIUS = 2.2;
const PATCH_ATTEMPT_MULTIPLIER = 24;

function buildGrass(clearOfBuildings: { x: number; z: number; r: number }[]): GrassClump[] {
    const clumps: GrassClump[] = [];
    let patchAttempts = 0;
    let patchesPlaced = 0;
    while (patchesPlaced < GRASS_PATCH_COUNT && patchAttempts < GRASS_PATCH_COUNT * PATCH_ATTEMPT_MULTIPLIER) {
        patchAttempts++;
        const px = (Math.random() - 0.5) * (PLAYABLE_RADIUS - 4) * 2;
        const pz = (Math.random() - 0.5) * (PLAYABLE_RADIUS - 4) * 2;
        if (Math.hypot(px, pz) < PROP_CLEAR_RADIUS - 3 || Math.hypot(px, pz) > PLAYABLE_RADIUS - GRASS_PATCH_RADIUS - 1) continue;
        if (clearOfBuildings.some((b) => Math.hypot(px - b.x, pz - b.z) < b.r + 0.5)) continue;
        if (Math.random() > 0.14 + getOvergrowth(px, pz) * 0.86) continue;
        patchesPlaced++;
        const bladeCount = 5 + Math.floor(Math.random() * 6);
        for (let i = 0; i < bladeCount; i++) {
            const x = px + (Math.random() - 0.5) * 2 * GRASS_PATCH_RADIUS;
            const z = pz + (Math.random() - 0.5) * 2 * GRASS_PATCH_RADIUS;
            if (Math.hypot(x, z) < PROP_CLEAR_RADIUS - 4 || Math.hypot(x, z) > PLAYABLE_RADIUS - 1) continue;
            if (clearOfBuildings.some((b) => Math.hypot(x - b.x, z - b.z) < b.r)) continue;
            clumps.push({
                position: [x, getTerrainHeight(x, z), z],
                rotationY: Math.random() * Math.PI * 2,
                scale: 0.8 + Math.random() * 0.9,
                seed: Math.random() * 100,
                variant: Math.floor(Math.random() * GRASS_VARIANT_COUNT),
            });
        }
    }
    return clumps;
}

function buildFlowers(clearOfBuildings: { x: number; z: number; r: number }[]): FlowerCluster[] {
    const flowers: FlowerCluster[] = [];
    let patchAttempts = 0;
    let patchesPlaced = 0;
    while (patchesPlaced < FLOWER_PATCH_COUNT && patchAttempts < FLOWER_PATCH_COUNT * PATCH_ATTEMPT_MULTIPLIER) {
        patchAttempts++;
        const px = (Math.random() - 0.5) * (PLAYABLE_RADIUS - 4) * 2;
        const pz = (Math.random() - 0.5) * (PLAYABLE_RADIUS - 4) * 2;
        if (Math.hypot(px, pz) < PROP_CLEAR_RADIUS - 2 || Math.hypot(px, pz) > PLAYABLE_RADIUS - FLOWER_PATCH_RADIUS - 1) continue;
        if (clearOfBuildings.some((b) => Math.hypot(px - b.x, pz - b.z) < b.r + 0.5)) continue;
        if (Math.random() > 0.06 + Math.pow(getOvergrowth(px, pz), 1.3) * 0.94) continue;
        patchesPlaced++;
        const flowerCount = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < flowerCount; i++) {
            const x = px + (Math.random() - 0.5) * 2 * FLOWER_PATCH_RADIUS;
            const z = pz + (Math.random() - 0.5) * 2 * FLOWER_PATCH_RADIUS;
            if (Math.hypot(x, z) < PROP_CLEAR_RADIUS - 3 || Math.hypot(x, z) > PLAYABLE_RADIUS - 1) continue;
            if (clearOfBuildings.some((b) => Math.hypot(x - b.x, z - b.z) < b.r)) continue;
            flowers.push({
                position: [x, getTerrainHeight(x, z), z],
                rotationY: Math.random() * Math.PI * 2,
                scale: 0.85 + Math.random() * 0.6,
                seed: Math.random() * 100,
                colorIndex: Math.floor(Math.random() * FLOWER_COLOR_COUNT),
            });
        }
    }
    return flowers;
}

function randomPointAvoidingStair(room: ZoneRect, stair: StairwellRect): Point2 | null {
    const w = room.maxX - room.minX;
    const d = room.maxZ - room.minZ;
    if (w <= 0.4 || d <= 0.4) return null;
    for (let i = 0; i < 8; i++) {
        const x = room.minX + Math.random() * w;
        const z = room.minZ + Math.random() * d;
        if (x > stair.minX - 0.5 && x < stair.maxX + 0.5 && z > stair.minZ - 0.5 && z < stair.maxZ + 0.5) continue;
        return { x, z };
    }
    return null;
}

function buildBuildings(): { buildings: BuildingDef[]; lightSources: LightSource[] } {
    const buildings: BuildingDef[] = [];
    const lightSources: LightSource[] = [];
    const placed: { x: number; z: number; r: number }[] = [];

    registerFlattenZone(0, 0, 15, 24, 0);

    let placementAttempts = 0;
    const MAX_PLACEMENT_ATTEMPTS = 4000;
    while (buildings.length < TARGET_BUILDING_COUNT && placementAttempts < MAX_PLACEMENT_ATTEMPTS) {
        placementAttempts++;
        const angle = Math.random() * Math.PI * 2;
        const dist = SPAWN_CLEAR_RADIUS + Math.random() * (PLAYABLE_RADIUS - 9 - SPAWN_CLEAR_RADIUS);
        const cx = Math.cos(angle) * dist;
        const cz = Math.sin(angle) * dist;

        const mainW = 11 + Math.random() * 4;
        const mainD = 14 + Math.random() * 5;
        const localFootprint = buildRandomFootprint(mainW, mainD);
        const lb = localFootprint.bounds;

        const boundsCenterX = cx + (lb.minX + lb.maxX) / 2;
        const boundsCenterZ = cz + (lb.minZ + lb.maxZ) / 2;
        const placementRadius = Math.hypot(lb.maxX - lb.minX, lb.maxZ - lb.minZ) / 2 + 3;
        if (placed.some((p) => Math.hypot(p.x - boundsCenterX, p.z - boundsCenterZ) < p.r + placementRadius)) continue;
        placed.push({ x: boundsCenterX, z: boundsCenterZ, r: placementRadius });

        const footprintRadius =
            Math.max(Math.hypot(lb.minX, lb.minZ), Math.hypot(lb.minX, lb.maxZ), Math.hypot(lb.maxX, lb.minZ), Math.hypot(lb.maxX, lb.maxZ)) + 2;

        const foundationY = getTerrainHeight(cx, cz);
        registerFlattenZone(cx, cz, footprintRadius - 1, footprintRadius + 6, foundationY);

        const footprint = translateFootprint(localFootprint, cx, cz);
        const walls = polygonToWalls(footprint.polygon, DOOR_WIDTH);

        const localStair = placeStairwell(localFootprint, STAIR_WIDTH, STAIR_DEPTH);
        const stairwell: ZoneRect = { minX: localStair.minX + cx, maxX: localStair.maxX + cx, minZ: localStair.minZ + cz, maxZ: localStair.maxZ + cz };
        const stairCenterX = (stairwell.minX + stairwell.maxX) / 2;
        const stairHalfWidth = (stairwell.maxX - stairwell.minX) / 2 - 0.2;
        const stairs: StairFlight[] = [
            { x: stairCenterX, halfWidth: stairHalfWidth, z1: stairwell.minZ, z2: stairwell.minZ + STAIR_FLIGHT_LEN, fromFloor: 0, toFloor: 1 },
            { x: stairCenterX, halfWidth: stairHalfWidth, z1: stairwell.maxZ - STAIR_FLIGHT_LEN, z2: stairwell.maxZ, fromFloor: 1, toFloor: 2 },
        ];

        const plans: FloorPlan[] = [];
        const interiorWalls: { seg: WallSegment; floor: number }[] = [];
        const furniture: FurniturePiece[] = [];
        for (let floor = 0; floor < FLOOR_COUNT; floor++) {
            const plan = buildFloorPlan(localFootprint, localStair, floor);
            plans.push(plan);
            for (const seg of plan.interiorWalls) {
                interiorWalls.push({ seg: { x1: seg.x1 + cx, z1: seg.z1 + cz, x2: seg.x2 + cx, z2: seg.z2 + cz }, floor });
            }
            for (const room of plan.rooms) {
                const pieces = furnishRoom(room, floor, localStair, localFootprint.zones[0].minZ);
                for (const p of pieces) furniture.push({ ...p, x: p.x + cx, z: p.z + cz });
            }
            const lampRoom = plan.rooms[Math.floor(Math.random() * plan.rooms.length)];
            if (lampRoom) {
                lightSources.push({
                    position: [cx + (lampRoom.minX + lampRoom.maxX) / 2, foundationY + floor * FLOOR_HEIGHT + 1.7, cz + (lampRoom.minZ + lampRoom.maxZ) / 2],
                    color: '#ffcf7a',
                    kind: 'lamp',
                    seed: Math.random() * 100,
                });
            }
        }

        const doorZ = walls[0].z1;
        lightSources.push({ position: [walls[0].x2 - 0.35, foundationY, doorZ - 0.3], color: '#ff8a3a', kind: 'torch', seed: Math.random() * 100 });
        lightSources.push({ position: [walls[1].x1 + 0.35, foundationY, doorZ - 0.3], color: '#ff8a3a', kind: 'torch', seed: Math.random() * 100 });

        const palette = BUILDING_PALETTE[buildings.length % BUILDING_PALETTE.length];
        const roofRoll = Math.random();
        buildings.push({
            position: [cx, foundationY, cz],
            width: lb.maxX - lb.minX,
            depth: lb.maxZ - lb.minZ,
            bounds: { minX: lb.minX + cx, maxX: lb.maxX + cx, minZ: lb.minZ + cz, maxZ: lb.maxZ + cz },
            polygon: footprint.polygon,
            zones: footprint.zones,
            hullColor: palette.hull,
            windowColor: palette.window,
            trimColor: palette.trim,
            roofStyle: roofRoll < 0.4 ? 'flat' : roofRoll < 0.75 ? 'broken' : 'stepped',
            hasFireEscape: Math.random() < 0.5,
            collisionRadius: footprintRadius,
            walls,
            interiorWalls,
            stairs,
            stairwell,
            furniture,
        });

        const groundRooms = plans[0].rooms;
        const groundRoom = groundRooms[Math.floor(Math.random() * groundRooms.length)] ?? localFootprint.zones[0];
        const lootLocal = randomPointAvoidingStair(groundRoom, localStair);
        if (lootLocal && Math.random() < 0.6) {
            const ammoWeaponId = WEAPON_ORDER[Math.floor(Math.random() * WEAPON_ORDER.length)];
            spawnStaticLoot(cx + lootLocal.x, cz + lootLocal.z, `ammo_${ammoWeaponId}`, 6 + Math.floor(Math.random() * 8));
        }
        const weaponIndex = buildings.length - 1;
        if (weaponIndex < NON_STARTING_WEAPONS.length) {

            spawnStaticLoot(cx, cz + (Math.random() - 0.5) * 2, `weapon_${NON_STARTING_WEAPONS[weaponIndex]}`, 1);
        }
    }

    let streetAttempts = 0;
    let streetPlaced = 0;
    const TARGET_STREET_TORCHES = 26;
    while (streetPlaced < TARGET_STREET_TORCHES && streetAttempts < TARGET_STREET_TORCHES * 15) {
        streetAttempts++;
        const x = (Math.random() - 0.5) * (PLAYABLE_RADIUS - 6) * 2;
        const z = (Math.random() - 0.5) * (PLAYABLE_RADIUS - 6) * 2;
        if (Math.hypot(x, z) < SPAWN_CLEAR_RADIUS || Math.hypot(x, z) > PLAYABLE_RADIUS - 6) continue;
        if (buildings.some((b) => Math.hypot(x - b.position[0], z - b.position[2]) < b.collisionRadius + 3)) continue;
        lightSources.push({ position: [x, getTerrainHeight(x, z), z], color: '#ff8a3a', kind: Math.random() < 0.4 ? 'barrel' : 'torch', seed: Math.random() * 100 });
        streetPlaced++;
    }

    return { buildings, lightSources };
}

const generated = buildBuildings();
export const buildings: BuildingDef[] = generated.buildings;
export const lightSources: LightSource[] = generated.lightSources;
const buildingClearance = buildings.map((b) => ({ x: b.position[0], z: b.position[2], r: b.collisionRadius }));
export const props: PropDef[] = buildProps(buildingClearance);
export const grassClumps: GrassClump[] = buildGrass(buildingClearance);
export const flowerClusters: FlowerCluster[] = buildFlowers(buildingClearance);

const PLAYER_COLLISION_RADIUS = 0.3;

function isInsideBuilding(b: BuildingDef, x: number, z: number): boolean {
    return isPointInPolygon(x, z, b.polygon);
}

export function resolveFloor(x: number, z: number, currentFloor: number): { y: number; floor: number; buildingIndex: number } {
    for (let bi = 0; bi < buildings.length; bi++) {
        const b = buildings[bi];
        if (!isInsideBuilding(b, x, z)) continue;
        const baseY = b.position[1];
        for (const stair of b.stairs) {
            if (Math.abs(x - stair.x) > stair.halfWidth) continue;
            const zMin = Math.min(stair.z1, stair.z2);
            const zMax = Math.max(stair.z1, stair.z2);
            if (z < zMin || z > zMax) continue;
            const t = stair.z1 <= stair.z2 ? (z - stair.z1) / (stair.z2 - stair.z1) : (stair.z1 - z) / (stair.z1 - stair.z2);
            const y = baseY + (stair.fromFloor + (stair.toFloor - stair.fromFloor) * Math.max(0, Math.min(1, t))) * FLOOR_HEIGHT;
            return { y, floor: t > 0.5 ? stair.toFloor : stair.fromFloor, buildingIndex: bi };
        }
        return { y: baseY + currentFloor * FLOOR_HEIGHT, floor: currentFloor, buildingIndex: bi };
    }
    return { y: getTerrainHeight(x, z), floor: 0, buildingIndex: -1 };
}

export function isInStairZone(x: number, z: number): boolean {
    for (const b of buildings) {
        for (const stair of b.stairs) {
            if (Math.abs(x - stair.x) > stair.halfWidth) continue;
            const zMin = Math.min(stair.z1, stair.z2);
            const zMax = Math.max(stair.z1, stair.z2);
            if (z >= zMin && z <= zMax) return true;
        }
    }
    return false;
}

function closestPointOnSegment(px: number, pz: number, seg: WallSegment): { x: number; z: number } {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.0001) return { x: seg.x1, z: seg.z1 };
    let t = ((px - seg.x1) * dx + (pz - seg.z1) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: seg.x1 + dx * t, z: seg.z1 + dz * t };
}

function pushOutFromSegment(x: number, z: number, seg: WallSegment, minDist: number): { x: number; z: number } {
    const closest = closestPointOnSegment(x, z, seg);
    const dx = x - closest.x;
    const dz = z - closest.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = (minDist - dist) / dist;
        return { x: x + dx * push, z: z + dz * push };
    }
    return { x, z };
}

export function resolvePropCollision(x: number, z: number, floor: number): { x: number; z: number } {
    let resolvedX = x;
    let resolvedZ = z;
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        const dx = resolvedX - prop.position[0];
        const dz = resolvedZ - prop.position[2];
        const minDist = prop.collisionRadius + PLAYER_COLLISION_RADIUS;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const push = (minDist - dist) / dist;
            resolvedX += dx * push;
            resolvedZ += dz * push;
        }
    }
    const wallMinDist = WALL_THICKNESS / 2 + PLAYER_COLLISION_RADIUS;
    for (let bi = 0; bi < buildings.length; bi++) {
        const b = buildings[bi];
        const bdx = resolvedX - b.position[0];
        const bdz = resolvedZ - b.position[2];
        if (bdx * bdx + bdz * bdz > (b.collisionRadius + 2) * (b.collisionRadius + 2)) continue;
        for (const seg of b.walls) {
            const r = pushOutFromSegment(resolvedX, resolvedZ, seg, wallMinDist);
            resolvedX = r.x;
            resolvedZ = r.z;
        }
        for (const iw of b.interiorWalls) {
            if (iw.floor !== floor) continue;
            const r = pushOutFromSegment(resolvedX, resolvedZ, iw.seg, wallMinDist);
            resolvedX = r.x;
            resolvedZ = r.z;
        }
    }
    return { x: resolvedX, z: resolvedZ };
}
