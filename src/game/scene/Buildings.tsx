import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, DoubleSide, Path, RepeatWrapping, Shape, ShapeGeometry, SRGBColorSpace } from 'three';
import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { buildings, type BuildingDef, type WallSegment, type FurniturePiece } from '../systems/obstacles.ts';
import { zoneWidth, zoneDepth, zoneCenterX, zoneCenterZ, isPointInPolygon } from '../systems/buildingShapes.ts';
import { doorStates, getDoorGeom } from '../systems/doors.ts';
import { FLOOR_HEIGHT, FLOOR_COUNT, WALL_THICKNESS, WALL_HEIGHT } from '../data/constants.ts';
import { world } from '../state/world.ts';

const DARK_WINDOW = '#22201c';
const LIT_CHANCE = 0.32;
const STEP_COUNT = 9;
const FADE_LERP = 0.18;
const INTERIOR_WALL_HEIGHT = FLOOR_HEIGHT - 0.4;
const TILE_WORLD_SIZE = 1.8;

function lerpOpacity(mat: MeshStandardMaterial | undefined, target: number) {
    if (!mat) return;
    mat.opacity += (target - mat.opacity) * FADE_LERP;
}

function shadeColor(hex: string, lightnessDelta: number): string {
    const c = new Color(hex);
    c.offsetHSL(0, 0, lightnessDelta);
    return `#${c.getHexString()}`;
}

function hash01(x: number, y: number): number {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
}

const floorTextureCache = new Map<string, CanvasTexture>();

function buildFloorTexture(kind: 'tile' | 'plank', baseColor: string): CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    if (kind === 'tile') {
        const cells = 4;
        const cellSize = size / cells;
        for (let ty = 0; ty < cells; ty++) {
            for (let tx = 0; tx < cells; tx++) {
                const variation = (hash01(tx + 0.5, ty + 0.5) - 0.5) * 0.1;
                ctx.fillStyle = shadeColor(baseColor, variation);
                ctx.fillRect(tx * cellSize + 1.5, ty * cellSize + 1.5, cellSize - 3, cellSize - 3);
            }
        }
        ctx.strokeStyle = shadeColor(baseColor, -0.18);
        ctx.lineWidth = 2;
        for (let i = 0; i <= cells; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(size, i * cellSize);
            ctx.stroke();
        }
    } else {
        const planks = 6;
        const plankSize = size / planks;
        for (let i = 0; i < planks; i++) {
            const variation = (hash01(i + 0.5, 3.7) - 0.5) * 0.12;
            ctx.fillStyle = shadeColor(baseColor, variation);
            ctx.fillRect(0, i * plankSize + 1, size, plankSize - 2);
        }
        ctx.strokeStyle = shadeColor(baseColor, -0.2);
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= planks; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * plankSize);
            ctx.lineTo(size, i * plankSize);
            ctx.stroke();
        }
        for (let i = 0; i < planks; i++) {
            const seamX = ((hash01(i + 1.3, 9.1) * 3) | 0) * (size / 3) + size / 6;
            ctx.beginPath();
            ctx.moveTo(seamX, i * plankSize);
            ctx.lineTo(seamX, (i + 1) * plankSize);
            ctx.stroke();
        }
    }

    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

function getFloorTexture(kind: 'tile' | 'plank', baseColor: string): CanvasTexture {
    const key = `${kind}:${baseColor}`;
    let tex = floorTextureCache.get(key);
    if (!tex) {
        tex = buildFloorTexture(kind, baseColor);
        floorTextureCache.set(key, tex);
    }
    return tex;
}

function Wall({
    seg,
    color,
    matRef,
    height = WALL_HEIGHT,
    baseY = 0,
}: {
    seg: WallSegment;
    color: string;
    matRef: (m: MeshStandardMaterial | null) => void;
    height?: number;
    baseY?: number;
}) {
    const length = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    const angle = Math.atan2(seg.x2 - seg.x1, seg.z2 - seg.z1);
    const midX = (seg.x1 + seg.x2) / 2;
    const midZ = (seg.z1 + seg.z2) / 2;
    return (
        <mesh position={[midX, baseY + height / 2, midZ]} rotation={[0, angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, height, length]} />
            <meshStandardMaterial ref={matRef} color={color} roughness={0.95} transparent opacity={1} />
        </mesh>
    );
}

function useSlabGeometry(building: BuildingDef, withHole: boolean) {
    return useMemo(() => {
        const shape = new Shape();
        building.polygon.forEach((p, i) => {
            if (i === 0) shape.moveTo(p.x, p.z);
            else shape.lineTo(p.x, p.z);
        });
        shape.closePath();
        if (withHole) {
            const hole = new Path();
            const s = building.stairwell;
            hole.moveTo(s.minX, s.minZ);
            hole.lineTo(s.maxX, s.minZ);
            hole.lineTo(s.maxX, s.maxZ);
            hole.lineTo(s.minX, s.maxZ);
            hole.closePath();
            shape.holes.push(hole);
        }
        const geometry = new ShapeGeometry(shape);
        geometry.rotateX(Math.PI / 2);
        return geometry;
    }, [building, withHole]);
}

function FloorSlab({ building, slabMatRefs }: { building: BuildingDef; slabMatRefs: (floor: number, mat: MeshStandardMaterial | null) => void }) {
    const groundGeometry = useSlabGeometry(building, false);
    const upperGeometry = useSlabGeometry(building, true);
    const repeatX = (building.bounds.maxX - building.bounds.minX) / TILE_WORLD_SIZE;
    const repeatZ = (building.bounds.maxZ - building.bounds.minZ) / TILE_WORLD_SIZE;

    const groundTex = useMemo(() => {
        const t = getFloorTexture('tile', building.trimColor);
        t.repeat.set(repeatX, repeatZ);
        return t;
    }, [building.trimColor, repeatX, repeatZ]);
    const upperTex = useMemo(() => {
        const t = getFloorTexture('plank', building.trimColor);
        t.repeat.set(repeatX, repeatZ);
        return t;
    }, [building.trimColor, repeatX, repeatZ]);

    return (
        <>
            <mesh geometry={groundGeometry} position={[0, 0.02, 0]} receiveShadow>
                <meshStandardMaterial map={groundTex} color={building.trimColor} roughness={0.88} side={DoubleSide} />
            </mesh>
            {[1, 2].map((floor) => (
                <mesh key={floor} geometry={upperGeometry} position={[0, floor * FLOOR_HEIGHT, 0]} receiveShadow castShadow>
                    <meshStandardMaterial
                        ref={(m) => slabMatRefs(floor, m)}
                        map={upperTex}
                        color={building.trimColor}
                        roughness={0.85}
                        side={DoubleSide}
                        transparent
                        opacity={1}
                    />
                </mesh>
            ))}
        </>
    );
}

function Stairs({ building }: { building: BuildingDef }) {
    return (
        <>
            {building.stairs.map((flight, fi) => {
                const steps = [];
                for (let i = 0; i < STEP_COUNT; i++) {
                    const t = (i + 0.5) / STEP_COUNT;
                    const z = flight.z1 + (flight.z2 - flight.z1) * t;
                    const y = (flight.fromFloor + (flight.toFloor - flight.fromFloor) * t) * FLOOR_HEIGHT;
                    steps.push(
                        <mesh key={i} position={[flight.x, y, z]} castShadow receiveShadow>
                            <boxGeometry args={[flight.halfWidth * 2, 0.18, Math.abs(flight.z2 - flight.z1) / STEP_COUNT + 0.05]} />
                            <meshStandardMaterial color="#3a3630" roughness={0.9} />
                        </mesh>
                    );
                }
                return <group key={fi}>{steps}</group>;
            })}
        </>
    );
}

function FurnitureContent({ kind }: { kind: FurniturePiece['kind'] }) {
    if (kind === 'table') {
        return (
            <>
                <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.2, 0.07, 0.7]} />
                    <meshStandardMaterial color="#5a4a38" roughness={0.8} />
                </mesh>
                {[[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]].map(([lx, lz], i) => (
                    <mesh key={i} position={[lx, 0.25, lz]} castShadow>
                        <cylinderGeometry args={[0.03, 0.03, 0.5, 5]} />
                        <meshStandardMaterial color="#3a3028" />
                    </mesh>
                ))}
            </>
        );
    }
    if (kind === 'shelf') {
        return (
            <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.9, 1.8, 0.32]} />
                <meshStandardMaterial color="#4a4038" roughness={0.85} />
            </mesh>
        );
    }
    if (kind === 'bed') {
        return (
            <>
                <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1, 0.35, 1.9]} />
                    <meshStandardMaterial color="#3f4a45" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.42, -0.75]}>
                    <boxGeometry args={[0.8, 0.15, 0.35]} />
                    <meshStandardMaterial color="#5a5a52" roughness={0.9} />
                </mesh>
            </>
        );
    }
    if (kind === 'couch') {
        return (
            <>
                <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.6, 0.4, 0.7]} />
                    <meshStandardMaterial color="#4a3f45" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.5, -0.28]} castShadow>
                    <boxGeometry args={[1.6, 0.35, 0.15]} />
                    <meshStandardMaterial color="#4a3f45" roughness={0.9} />
                </mesh>
            </>
        );
    }
    if (kind === 'counter') {
        return (
            <>
                <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.4, 0.75, 0.55]} />
                    <meshStandardMaterial color="#5a5248" roughness={0.75} />
                </mesh>
                <mesh position={[0, 0.79, 0]} castShadow>
                    <boxGeometry args={[1.44, 0.04, 0.58]} />
                    <meshStandardMaterial color="#8a8478" roughness={0.4} metalness={0.2} />
                </mesh>
            </>
        );
    }
    if (kind === 'stove') {
        return (
            <>
                <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.55, 0.7, 0.55]} />
                    <meshStandardMaterial color="#3a3a3a" roughness={0.6} metalness={0.4} />
                </mesh>
                {[[-0.13, -0.1], [0.13, -0.1], [-0.13, 0.13], [0.13, 0.13]].map(([lx, lz], i) => (
                    <mesh key={i} position={[lx, 0.71, lz]}>
                        <cylinderGeometry args={[0.08, 0.08, 0.02, 10]} />
                        <meshStandardMaterial color="#111111" roughness={0.5} />
                    </mesh>
                ))}
            </>
        );
    }
    if (kind === 'sink') {
        return (
            <>
                <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.5, 0.5, 0.42]} />
                    <meshStandardMaterial color="#dcdcd4" roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.68, -0.16]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.22, 6]} />
                    <meshStandardMaterial color="#8a8a82" roughness={0.3} metalness={0.6} />
                </mesh>
            </>
        );
    }
    if (kind === 'desk') {
        return (
            <>
                <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.1, 0.06, 0.6]} />
                    <meshStandardMaterial color="#4a3f30" roughness={0.8} />
                </mesh>
                {[[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]].map(([lx, lz], i) => (
                    <mesh key={i} position={[lx, 0.22, lz]}>
                        <boxGeometry args={[0.05, 0.44, 0.05]} />
                        <meshStandardMaterial color="#332a20" />
                    </mesh>
                ))}
                <mesh position={[0.25, 0.58, -0.15]} rotation={[-0.1, 0, 0]}>
                    <boxGeometry args={[0.32, 0.22, 0.02]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
                </mesh>
            </>
        );
    }
    if (kind === 'cratestack') {
        return (
            <>
                <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.55, 0.55, 0.55]} />
                    <meshStandardMaterial color="#544838" roughness={0.9} />
                </mesh>
                <mesh position={[0.08, 0.83, 0.05]} rotation={[0, 0.3, 0]} castShadow>
                    <boxGeometry args={[0.5, 0.5, 0.5]} />
                    <meshStandardMaterial color="#5c4c3a" roughness={0.9} />
                </mesh>
            </>
        );
    }
    return (
        <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.55, 0.55, 0.55]} />
            <meshStandardMaterial color="#544838" roughness={0.9} />
        </mesh>
    );
}

function Furniture({ piece, visRef }: { piece: FurniturePiece; visRef: (g: Group | null) => void }) {
    const y = piece.floor * FLOOR_HEIGHT;
    return (
        <group ref={visRef} position={[piece.x, y, piece.z]} rotation={[0, piece.rotationY, 0]}>
            <FurnitureContent kind={piece.kind} />
        </group>
    );
}

function FireEscape({ building, visRef }: { building: BuildingDef; visRef: (g: Group | null) => void }) {
    const buildingHeight = FLOOR_COUNT * FLOOR_HEIGHT;
    const main = building.zones[0];
    const hasLeftLobe = building.zones.some((z, i) => i > 0 && z.maxX <= main.minX + 0.01);
    const hasRightLobe = building.zones.some((z, i) => i > 0 && z.minX >= main.maxX - 0.01);
    const attachLeft = hasRightLobe && !hasLeftLobe;
    const x = attachLeft ? main.minX - 0.15 : main.maxX + 0.15;
    const cz = main.minZ + zoneDepth(main) * 0.32;
    const platforms = [];
    for (let f = 1; f <= FLOOR_COUNT; f++) {
        platforms.push(
            <mesh key={f} position={[x, f * FLOOR_HEIGHT - 0.5, cz + (f % 2 === 0 ? 1.3 : -1.3)]} castShadow>
                <boxGeometry args={[1, 0.06, 1.6]} />
                <meshStandardMaterial color="#3a3530" roughness={0.9} metalness={0.3} />
            </mesh>
        );
    }
    return (
        <group ref={visRef}>
            {platforms}
            <mesh position={[x, buildingHeight / 2, cz]}>
                <boxGeometry args={[0.08, buildingHeight, 0.08]} />
                <meshStandardMaterial color="#2c2825" roughness={0.9} metalness={0.3} />
            </mesh>
        </group>
    );
}

function windowsForWall(seg: WallSegment) {
    const length = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    if (length < 2) return [];
    const angle = Math.atan2(seg.x2 - seg.x1, seg.z2 - seg.z1);
    const count = Math.max(1, Math.floor(length / 2.2));
    const windows: { x: number; y: number; z: number; lit: boolean; seed: number; floor: number }[] = [];
    for (let floor = 0; floor < FLOOR_COUNT; floor++) {
        for (let i = 0; i < count; i++) {
            if (Math.random() < 0.25) continue;
            const t = (i + 0.5) / count;
            windows.push({
                x: seg.x1 + (seg.x2 - seg.x1) * t + Math.sin(angle) * 0.03,
                z: seg.z1 + (seg.z2 - seg.z1) * t + Math.cos(angle) * 0.03,
                y: floor * FLOOR_HEIGHT + 1.4,
                lit: Math.random() < LIT_CHANCE,
                seed: Math.random() * 100,
                floor,
            });
        }
    }
    return windows.map((w) => ({ ...w, angle }));
}

function Door({ buildingIndex }: { buildingIndex: number }) {
    const groupRef = useRef<Group>(null!);
    const geom = getDoorGeom(buildingIndex);

    useFrame(() => {
        const amount = doorStates[buildingIndex].openAmount;
        groupRef.current.rotation.y = amount * (Math.PI * 0.55);
    });

    return (
        <group ref={groupRef} position={[geom.centerX - geom.halfWidth, 0, geom.z]}>
            <mesh position={[geom.halfWidth, 1.15, 0]} castShadow receiveShadow>
                <boxGeometry args={[geom.halfWidth * 2, 2.3, 0.08]} />
                <meshStandardMaterial color="#3a3128" roughness={0.85} metalness={0.2} />
            </mesh>
            <mesh position={[geom.halfWidth * 1.7, 1.15, 0.05]}>
                <boxGeometry args={[0.06, 0.06, 0.06]} />
                <meshStandardMaterial color="#8a8072" roughness={0.4} metalness={0.7} />
            </mesh>
        </group>
    );
}

function Roof({ building, registerRoofMat }: { building: BuildingDef; registerRoofMat: (i: number) => (m: MeshStandardMaterial | null) => void }) {
    const buildingHeight = FLOOR_COUNT * FLOOR_HEIGHT;
    const margin = 1.1;
    const main = building.zones[0];

    if (building.roofStyle === 'broken') {
        const cx = zoneCenterX(main) + zoneWidth(main) * 0.12;
        const cz = zoneCenterZ(main) + zoneDepth(main) * 0.08;
        return (
            <mesh position={[cx, buildingHeight + 0.15, cz]} castShadow>
                <boxGeometry args={[zoneWidth(main) * 0.5, 0.4, zoneDepth(main) * 0.45]} />
                <meshStandardMaterial ref={registerRoofMat(0)} color={building.hullColor} roughness={0.95} transparent opacity={1} />
            </mesh>
        );
    }

    return (
        <>
            {building.zones.map((z, i) => (
                <mesh key={i} position={[zoneCenterX(z), buildingHeight + 0.15, zoneCenterZ(z)]} castShadow>
                    <boxGeometry args={[Math.max(1, zoneWidth(z) - margin), 0.3, Math.max(1, zoneDepth(z) - margin)]} />
                    <meshStandardMaterial ref={registerRoofMat(i)} color={building.hullColor} roughness={0.95} transparent opacity={1} />
                </mesh>
            ))}
            {building.roofStyle === 'stepped' && (
                <mesh position={[zoneCenterX(main), buildingHeight + 0.65, zoneCenterZ(main) - zoneDepth(main) * 0.15]} castShadow>
                    <boxGeometry args={[zoneWidth(main) * 0.45, 0.6, zoneDepth(main) * 0.35]} />
                    <meshStandardMaterial ref={registerRoofMat(building.zones.length)} color={building.trimColor} roughness={0.95} transparent opacity={1} />
                </mesh>
            )}
        </>
    );
}

const EXTERIOR_FADE_OPACITY = 0.55;

function Building({ building, index }: { building: BuildingDef; index: number }) {
    const windows = useMemo(() => building.walls.flatMap((seg) => windowsForWall(seg)), [building]);
    const litRefs = useRef<Array<Mesh | null>>([]);
    const windowMatRefs = useRef<Array<MeshStandardMaterial | null>>([]);
    const wallFloorMatRefs = useRef<Array<MeshStandardMaterial | null>>([]);
    const interiorWallMatRefs = useRef<Array<MeshStandardMaterial | null>>([]);
    const furnitureVisRefs = useRef<Array<Group | null>>([]);
    const slabMatRefs = useRef<Record<number, MeshStandardMaterial[]>>({ 1: [], 2: [] });
    const roofMatRefs = useRef<Array<MeshStandardMaterial | null>>([]);
    const fireEscapeRef = useRef<Group | null>(null);
    const antennaMatRef = useRef<MeshStandardMaterial | null>(null);
    const buildingHeight = FLOOR_COUNT * FLOOR_HEIGHT;
    const main = building.zones[0];

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        windows.forEach((w, i) => {
            if (!w.lit) return;
            const mesh = litRefs.current[i];
            if (!mesh) return;
            const flicker = Math.sin(t * 9 + w.seed) > -0.7 ? 1 : 0.15;
            (mesh.material as MeshStandardMaterial).emissiveIntensity = flicker * 1.4;
        });

        const px = world.player.position.x;
        const pz = world.player.position.z;
        const inside = isPointInPolygon(px, pz, building.polygon);
        const playerFloor = world.player.currentFloor;

        building.walls.forEach((_, segIdx) => {
            for (let floor = 0; floor < FLOOR_COUNT; floor++) {
                const mat = wallFloorMatRefs.current[segIdx * FLOOR_COUNT + floor];
                let target = 1;
                if (inside) target = floor === playerFloor ? EXTERIOR_FADE_OPACITY : 0;
                lerpOpacity(mat ?? undefined, target);
            }
        });
        roofMatRefs.current.forEach((mat) => lerpOpacity(mat ?? undefined, inside ? 0 : 1));
        lerpOpacity(antennaMatRef.current ?? undefined, inside ? 0 : 1);
        if (fireEscapeRef.current) fireEscapeRef.current.visible = !inside;

        [1, 2].forEach((floor) => {
            const shouldHide = inside && playerFloor < floor;
            slabMatRefs.current[floor]?.forEach((mat) => lerpOpacity(mat, shouldHide ? 0 : 1));
        });

        building.interiorWalls.forEach((iw, i) => {
            const mat = interiorWallMatRefs.current[i];
            const onCurrentFloor = inside && iw.floor === playerFloor;
            lerpOpacity(mat ?? undefined, onCurrentFloor ? 1 : 0);
        });
        building.furniture.forEach((piece, i) => {
            const group = furnitureVisRefs.current[i];
            if (group) group.visible = inside && piece.floor === playerFloor;
        });
        windows.forEach((w, i) => {
            const mat = windowMatRefs.current[i];
            const hidden = inside && w.floor !== playerFloor;
            lerpOpacity(mat ?? undefined, hidden ? 0 : 1);
        });
    });

    const registerInteriorWallMat = (i: number) => (m: MeshStandardMaterial | null) => {
        interiorWallMatRefs.current[i] = m;
    };
    const registerSlabMat = (floor: number, m: MeshStandardMaterial | null) => {
        if (!m) return;
        if (!slabMatRefs.current[floor].includes(m)) slabMatRefs.current[floor].push(m);
    };
    const registerRoofMat = (i: number) => (m: MeshStandardMaterial | null) => {
        roofMatRefs.current[i] = m;
    };

    return (
        <group position={[0, building.position[1], 0]}>
            {building.walls.map((seg, segIdx) => (
                <group key={`ext-${segIdx}`}>
                    {[0, 1, 2].map((floor) => (
                        <Wall
                            key={floor}
                            seg={seg}
                            color={building.hullColor}
                            matRef={(m) => {
                                wallFloorMatRefs.current[segIdx * FLOOR_COUNT + floor] = m;
                            }}
                            height={floor === FLOOR_COUNT - 1 ? FLOOR_HEIGHT - 0.3 : FLOOR_HEIGHT}
                            baseY={floor * FLOOR_HEIGHT}
                        />
                    ))}
                </group>
            ))}
            {building.interiorWalls.map((iw, i) => (
                <Wall
                    key={`int-${i}`}
                    seg={iw.seg}
                    color={building.trimColor}
                    matRef={registerInteriorWallMat(i)}
                    height={INTERIOR_WALL_HEIGHT}
                    baseY={iw.floor * FLOOR_HEIGHT}
                />
            ))}
            <FloorSlab building={building} slabMatRefs={registerSlabMat} />
            <Stairs building={building} />
            {building.furniture.map((piece, i) => (
                <Furniture
                    key={i}
                    piece={piece}
                    visRef={(g) => {
                        furnitureVisRefs.current[i] = g;
                    }}
                />
            ))}
            {building.hasFireEscape && (
                <FireEscape
                    building={building}
                    visRef={(g) => {
                        fireEscapeRef.current = g;
                    }}
                />
            )}
            <Door buildingIndex={index} />

            <Roof building={building} registerRoofMat={registerRoofMat} />
            <mesh
                position={[zoneCenterX(main) + zoneWidth(main) * 0.2, buildingHeight + 0.5, zoneCenterZ(main) - zoneDepth(main) * 0.1]}
                rotation={[0, 0, 0.3]}
            >
                <cylinderGeometry args={[0.025, 0.025, 0.9, 5]} />
                <meshStandardMaterial
                    ref={(m) => {
                        antennaMatRef.current = m;
                    }}
                    color="#22201d"
                    transparent
                    opacity={1}
                />
            </mesh>

            {windows.map((w, i) => (
                <mesh
                    key={i}
                    ref={(el) => {
                        litRefs.current[i] = el;
                    }}
                    position={[w.x, w.y, w.z]}
                    rotation={[0, w.angle, 0]}
                >
                    <boxGeometry args={[0.32, 0.5, 0.03]} />
                    <meshStandardMaterial
                        ref={(m) => {
                            windowMatRefs.current[i] = m;
                        }}
                        color={w.lit ? building.windowColor : DARK_WINDOW}
                        emissive={w.lit ? building.windowColor : '#000000'}
                        emissiveIntensity={w.lit ? 1.4 : 0}
                        toneMapped={false}
                        roughness={0.4}
                        transparent
                        opacity={1}
                    />
                </mesh>
            ))}
        </group>
    );
}

export function Buildings() {
    return (
        <>
            {buildings.map((building, i) => (
                <Building key={i} building={building} index={i} />
            ))}
        </>
    );
}
