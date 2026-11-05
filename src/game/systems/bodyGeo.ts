import { BoxGeometry, BufferGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Pair = readonly [number, number];

export type LimbSpec = {
    length: number;
    radii: readonly Pair[];
    rings?: number;
    sides?: number;
    topCap?: number;
    bottomCap?: number;
    width?: number;
    depth?: number;
    capSteps?: number;
};

function sampleProfile(points: readonly Pair[], s: number): number {
    const last = points.length - 1;
    if (s <= points[0][0]) return points[0][1];
    if (s >= points[last][0]) return points[last][1];
    let i = 0;
    while (i < last - 1 && s > points[i + 1][0]) i++;
    const x0 = points[i][0];
    const x1 = points[i + 1][0];
    const y0 = points[i][1];
    const y1 = points[i + 1][1];
    const span = x1 - x0;
    const m0 = i === 0 ? (y1 - y0) / span : (points[i + 1][1] - points[i - 1][1]) / (points[i + 1][0] - points[i - 1][0]);
    const m1 = i + 1 === last ? (y1 - y0) / span : (points[i + 2][1] - points[i][1]) / (points[i + 2][0] - points[i][0]);
    const t = (s - x0) / span;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * span * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * span * m1;
}

export function limbGeometry(spec: LimbSpec): BufferGeometry {
    const rings = spec.rings ?? 8;
    const sides = spec.sides ?? 12;
    const topCap = spec.topCap ?? 1;
    const bottomCap = spec.bottomCap ?? 1;
    const topRadius = sampleProfile(spec.radii, 0);
    const bottomRadius = sampleProfile(spec.radii, 1);
    const capSteps = spec.capSteps ?? 4;
    const points: Vector2[] = [];
    for (let i = 0; i < capSteps; i++) {
        const a = (Math.PI / 2) * (1 - i / capSteps);
        points.push(new Vector2(bottomRadius * Math.cos(a), -spec.length - bottomRadius * bottomCap * Math.sin(a)));
    }
    for (let i = 0; i <= rings; i++) {
        const s = 1 - i / rings;
        points.push(new Vector2(Math.max(0.0005, sampleProfile(spec.radii, s)), -spec.length * s));
    }
    for (let i = 1; i <= capSteps; i++) {
        const a = (Math.PI / 2) * (i / capSteps);
        points.push(new Vector2(topRadius * Math.cos(a), topRadius * topCap * Math.sin(a)));
    }
    const geometry = new LatheGeometry(points, sides);
    if (spec.width !== undefined || spec.depth !== undefined) geometry.scale(spec.width ?? 1, 1, spec.depth ?? 1);
    return geometry;
}

export function revolve(points: readonly Pair[], sides: number, width = 1, depth = 1): BufferGeometry {
    const geometry = new LatheGeometry(
        points.map((p) => new Vector2(Math.max(0.0005, p[0]), p[1])),
        sides
    );
    if (width !== 1 || depth !== 1) geometry.scale(width, 1, depth);
    return geometry;
}

export function ellipsoid(rx: number, ry: number, rz: number, widthSegments = 14, heightSegments = 10): BufferGeometry {
    const geometry = new SphereGeometry(1, widthSegments, heightSegments);
    geometry.scale(rx, ry, rz);
    return geometry;
}

export function slab(sx: number, sy: number, sz: number): BufferGeometry {
    return new BoxGeometry(sx, sy, sz);
}

export function drum(rx: number, height: number, rz: number, sides = 16): BufferGeometry {
    const geometry = new CylinderGeometry(1, 1, height, sides);
    geometry.scale(rx, 1, rz);
    return geometry;
}

export function tube(radiusTop: number, radiusBottom: number, length: number, sides = 8): BufferGeometry {
    return new CylinderGeometry(radiusTop, radiusBottom, length, sides);
}

export function place(geometry: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry {
    if (rx !== 0) geometry.rotateX(rx);
    if (ry !== 0) geometry.rotateY(ry);
    if (rz !== 0) geometry.rotateZ(rz);
    geometry.translate(x, y, z);
    return geometry;
}

export function fuse(list: readonly BufferGeometry[]): BufferGeometry {
    const merged = mergeGeometries(list as BufferGeometry[], false);
    if (!merged) throw new Error('geometry merge failed');
    for (let i = 0; i < list.length; i++) list[i].dispose();
    return merged;
}

export function mirrorX(geometry: BufferGeometry): BufferGeometry {
    const copy = geometry.clone();
    copy.scale(-1, 1, 1);
    const index = copy.getIndex();
    if (index) {
        const array = index.array as Uint16Array | Uint32Array;
        for (let i = 0; i < array.length; i += 3) {
            const t = array[i + 1];
            array[i + 1] = array[i + 2];
            array[i + 2] = t;
        }
        index.needsUpdate = true;
    }
    return copy;
}