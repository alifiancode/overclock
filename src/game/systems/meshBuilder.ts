import { BufferAttribute, BufferGeometry, Box3, Color, Sphere, Vector3 } from 'three';

export type Vec3 = readonly [number, number, number];
export type Rgb = readonly [number, number, number];

const colorCache = new Map<number, Rgb>();
const colorScratch = new Color();

export function rgb(hex: number): Rgb {
    let cached = colorCache.get(hex);
    if (!cached) {
        colorScratch.setHex(hex);
        cached = [colorScratch.r, colorScratch.g, colorScratch.b];
        colorCache.set(hex, cached);
    }
    return cached;
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function scaleRgb(c: Rgb, k: number): Rgb {
    return [c[0] * k, c[1] * k, c[2] * k];
}

export type ColorInput = number | Rgb;

function resolveColor(c: ColorInput): Rgb {
    return typeof c === 'number' ? rgb(c) : c;
}

const ICO_T = (1 + Math.sqrt(5)) / 2;
const ICO_VERTS: Vec3[] = [
    [-1, ICO_T, 0], [1, ICO_T, 0], [-1, -ICO_T, 0], [1, -ICO_T, 0],
    [0, -1, ICO_T], [0, 1, ICO_T], [0, -1, -ICO_T], [0, 1, -ICO_T],
    [ICO_T, 0, -1], [ICO_T, 0, 1], [-ICO_T, 0, -1], [-ICO_T, 0, 1],
].map((v) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l] as Vec3;
});
const ICO_FACES: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

function subdivideIco(detail: number): Vec3[][] {
    let tris: Vec3[][] = ICO_FACES.map((f) => [ICO_VERTS[f[0]], ICO_VERTS[f[1]], ICO_VERTS[f[2]]]);
    for (let d = 0; d < detail; d++) {
        const next: Vec3[][] = [];
        for (const [a, b, c] of tris) {
            const mid = (p: Vec3, q: Vec3): Vec3 => {
                const x = p[0] + q[0];
                const y = p[1] + q[1];
                const z = p[2] + q[2];
                const l = Math.hypot(x, y, z);
                return [x / l, y / l, z / l];
            };
            const ab = mid(a, b);
            const bc = mid(b, c);
            const ca = mid(c, a);
            next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
        }
        tris = next;
    }
    return tris;
}

const icoCache = new Map<number, Vec3[][]>();

function getIco(detail: number): Vec3[][] {
    let tris = icoCache.get(detail);
    if (!tris) {
        tris = subdivideIco(detail);
        icoCache.set(detail, tris);
    }
    return tris;
}

export class MeshBuilder {
    private cap: number;
    private count = 0;
    private positions: Float32Array;
    private normals: Float32Array;
    private colors: Float32Array;
    private extras: Float32Array;
    private uvs: Float32Array | null = null;
    private minX = Infinity;
    private minY = Infinity;
    private minZ = Infinity;
    private maxX = -Infinity;
    private maxY = -Infinity;
    private maxZ = -Infinity;
    private matrix = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    private stack: Float64Array[] = [];
    private depth = 0;
    private rng: () => number;
    private nrmX = 0;
    private nrmY = 1;
    private nrmZ = 0;
    jitter = 0;
    extraMode: 'const' | 'height' = 'const';
    extraValue = 0;
    extraBase = 0;
    extraScale = 0;
    withUv = false;
    uvScale = 1;
    upBlend = 0;

    constructor(rng: () => number = Math.random, capacity: number = 2048) {
        this.rng = rng;
        this.cap = capacity;
        this.positions = new Float32Array(capacity * 3);
        this.normals = new Float32Array(capacity * 3);
        this.colors = new Float32Array(capacity * 3);
        this.extras = new Float32Array(capacity);
    }

    get vertexCount(): number {
        return this.count;
    }

    private grow() {
        const cap = this.cap * 2;
        const positions = new Float32Array(cap * 3);
        positions.set(this.positions);
        const normals = new Float32Array(cap * 3);
        normals.set(this.normals);
        const colors = new Float32Array(cap * 3);
        colors.set(this.colors);
        const extras = new Float32Array(cap);
        extras.set(this.extras);
        if (this.uvs) {
            const uvs = new Float32Array(cap * 2);
            uvs.set(this.uvs);
            this.uvs = uvs;
        }
        this.positions = positions;
        this.normals = normals;
        this.colors = colors;
        this.extras = extras;
        this.cap = cap;
    }

    push() {
        if (this.depth === this.stack.length) this.stack.push(new Float64Array(16));
        this.stack[this.depth++].set(this.matrix);
    }

    pop() {
        if (this.depth > 0) this.matrix.set(this.stack[--this.depth]);
    }

    identity() {
        this.matrix.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }

    translate(x: number, y: number, z: number) {
        const m = this.matrix;
        m[12] += m[0] * x + m[4] * y + m[8] * z;
        m[13] += m[1] * x + m[5] * y + m[9] * z;
        m[14] += m[2] * x + m[6] * y + m[10] * z;
    }

    rotateY(a: number) {
        const m = this.matrix;
        const c = Math.cos(a);
        const s = Math.sin(a);
        for (let r = 0; r < 3; r++) {
            const c0 = m[r];
            const c2 = m[8 + r];
            m[r] = c * c0 - s * c2;
            m[8 + r] = s * c0 + c * c2;
        }
    }

    rotateX(a: number) {
        const m = this.matrix;
        const c = Math.cos(a);
        const s = Math.sin(a);
        for (let r = 0; r < 3; r++) {
            const c1 = m[4 + r];
            const c2 = m[8 + r];
            m[4 + r] = c * c1 + s * c2;
            m[8 + r] = -s * c1 + c * c2;
        }
    }

    rotateZ(a: number) {
        const m = this.matrix;
        const c = Math.cos(a);
        const s = Math.sin(a);
        for (let r = 0; r < 3; r++) {
            const c0 = m[r];
            const c1 = m[4 + r];
            m[r] = c * c0 + s * c1;
            m[4 + r] = -s * c0 + c * c1;
        }
    }

    scale(x: number, y: number, z: number) {
        const m = this.matrix;
        for (let r = 0; r < 3; r++) {
            m[r] *= x;
            m[4 + r] *= y;
            m[8 + r] *= z;
        }
    }

    private tint(c: Rgb): Rgb {
        if (this.jitter <= 0) return c;
        const k = 1 + (this.rng() - 0.5) * 2 * this.jitter;
        return [c[0] * k, c[1] * k, c[2] * k];
    }

    private vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: Rgb, shade: number = 1) {
        if (this.count === this.cap) this.grow();
        const m = this.matrix;
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        let tx = m[0] * nx + m[4] * ny + m[8] * nz;
        let ty = m[1] * nx + m[5] * ny + m[9] * nz;
        let tz = m[2] * nx + m[6] * ny + m[10] * nz;
        const l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        tx /= l;
        ty /= l;
        tz /= l;
        if (this.upBlend > 0) {
            const keep = 1 - this.upBlend;
            tx *= keep;
            tz *= keep;
            ty = ty * keep + this.upBlend;
            const l2 = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
            tx /= l2;
            ty /= l2;
            tz /= l2;
        }
        if (wx < this.minX) this.minX = wx;
        if (wx > this.maxX) this.maxX = wx;
        if (wy < this.minY) this.minY = wy;
        if (wy > this.maxY) this.maxY = wy;
        if (wz < this.minZ) this.minZ = wz;
        if (wz > this.maxZ) this.maxZ = wz;
        const i = this.count;
        const i3 = i * 3;
        this.positions[i3] = wx;
        this.positions[i3 + 1] = wy;
        this.positions[i3 + 2] = wz;
        this.normals[i3] = tx;
        this.normals[i3 + 1] = ty;
        this.normals[i3 + 2] = tz;
        this.colors[i3] = c[0] * shade;
        this.colors[i3 + 1] = c[1] * shade;
        this.colors[i3 + 2] = c[2] * shade;
        this.extras[i] = this.extraMode === 'const' ? this.extraValue : Math.max(0, wy - this.extraBase) * this.extraScale;
        if (this.withUv) {
            if (!this.uvs) this.uvs = new Float32Array(this.cap * 2);
            this.uvs[i * 2] = wx * this.uvScale;
            this.uvs[i * 2 + 1] = wz * this.uvScale;
        }
        this.count = i + 1;
    }

    private unit(nx: number, ny: number, nz: number) {
        const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        this.nrmX = nx / l;
        this.nrmY = ny / l;
        this.nrmZ = nz / l;
    }

    tri(a: Vec3, b: Vec3, c: Vec3, color: ColorInput, shade: number = 1) {
        const col = this.tint(resolveColor(color));
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const uz = b[2] - a[2];
        const vx = c[0] - a[0];
        const vy = c[1] - a[1];
        const vz = c[2] - a[2];
        this.unit(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        const nx = this.nrmX;
        const ny = this.nrmY;
        const nz = this.nrmZ;
        this.vertex(a[0], a[1], a[2], nx, ny, nz, col, shade);
        this.vertex(b[0], b[1], b[2], nx, ny, nz, col, shade);
        this.vertex(c[0], c[1], c[2], nx, ny, nz, col, shade);
    }

    quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: ColorInput, shadeA: number = 1, shadeB: number = shadeA) {
        const col = this.tint(resolveColor(color));
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const uz = b[2] - a[2];
        const vx = d[0] - a[0];
        const vy = d[1] - a[1];
        const vz = d[2] - a[2];
        this.unit(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        const nx = this.nrmX;
        const ny = this.nrmY;
        const nz = this.nrmZ;
        this.vertex(a[0], a[1], a[2], nx, ny, nz, col, shadeA);
        this.vertex(b[0], b[1], b[2], nx, ny, nz, col, shadeA);
        this.vertex(c[0], c[1], c[2], nx, ny, nz, col, shadeB);
        this.vertex(a[0], a[1], a[2], nx, ny, nz, col, shadeA);
        this.vertex(c[0], c[1], c[2], nx, ny, nz, col, shadeB);
        this.vertex(d[0], d[1], d[2], nx, ny, nz, col, shadeB);
    }

    private face(
        c: Rgb,
        nx: number,
        ny: number,
        nz: number,
        ax: number,
        ay: number,
        az: number,
        bx: number,
        by: number,
        bz: number,
        cx: number,
        cy: number,
        cz: number,
        dx: number,
        dy: number,
        dz: number,
        s0: number,
        s1: number,
        s2: number,
        s3: number
    ) {
        this.vertex(ax, ay, az, nx, ny, nz, c, s0);
        this.vertex(bx, by, bz, nx, ny, nz, c, s1);
        this.vertex(cx, cy, cz, nx, ny, nz, c, s2);
        this.vertex(ax, ay, az, nx, ny, nz, c, s0);
        this.vertex(cx, cy, cz, nx, ny, nz, c, s2);
        this.vertex(dx, dy, dz, nx, ny, nz, c, s3);
    }

    box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: ColorInput, faceColors?: (ColorInput | undefined)[], gradBottom: number = 1, skip: number | boolean = 0) {
        const mask = typeof skip === 'boolean' ? (skip ? 8 : 0) : skip;
        const hx = sx / 2;
        const hy = sy / 2;
        const hz = sz / 2;
        const base = this.tint(resolveColor(color));
        const x0 = cx - hx;
        const x1 = cx + hx;
        const y0 = cy - hy;
        const y1 = cy + hy;
        const z0 = cz - hz;
        const z1 = cz + hz;
        const g = gradBottom;
        let f: ColorInput | undefined;
        if (!(mask & 1)) {
            f = faceColors?.[0];
            this.face(f === undefined ? base : resolveColor(f), 1, 0, 0, x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, g, g, 1, 1);
        }
        if (!(mask & 2)) {
            f = faceColors?.[1];
            this.face(f === undefined ? base : resolveColor(f), -1, 0, 0, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, g, g, 1, 1);
        }
        if (!(mask & 4)) {
            f = faceColors?.[2];
            this.face(f === undefined ? base : resolveColor(f), 0, 1, 0, x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 1, 1, 1, 1);
        }
        if (!(mask & 8)) {
            f = faceColors?.[3];
            this.face(f === undefined ? base : resolveColor(f), 0, -1, 0, x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, g, g, g, g);
        }
        if (!(mask & 16)) {
            f = faceColors?.[4];
            this.face(f === undefined ? base : resolveColor(f), 0, 0, 1, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, g, g, 1, 1);
        }
        if (!(mask & 32)) {
            f = faceColors?.[5];
            this.face(f === undefined ? base : resolveColor(f), 0, 0, -1, x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, g, g, 1, 1);
        }
    }

    triC(a: Vec3, b: Vec3, c: Vec3, ca: Rgb, cb: Rgb, cc: Rgb) {
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const uz = b[2] - a[2];
        const vx = c[0] - a[0];
        const vy = c[1] - a[1];
        const vz = c[2] - a[2];
        this.unit(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        const nx = this.nrmX;
        const ny = this.nrmY;
        const nz = this.nrmZ;
        this.vertex(a[0], a[1], a[2], nx, ny, nz, ca);
        this.vertex(b[0], b[1], b[2], nx, ny, nz, cb);
        this.vertex(c[0], c[1], c[2], nx, ny, nz, cc);
    }

    quadC(a: Vec3, b: Vec3, c: Vec3, d: Vec3, ca: Rgb, cb: Rgb, cc: Rgb, cd: Rgb) {
        const ux = b[0] - a[0];
        const uy = b[1] - a[1];
        const uz = b[2] - a[2];
        const vx = d[0] - a[0];
        const vy = d[1] - a[1];
        const vz = d[2] - a[2];
        this.unit(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        const nx = this.nrmX;
        const ny = this.nrmY;
        const nz = this.nrmZ;
        this.vertex(a[0], a[1], a[2], nx, ny, nz, ca);
        this.vertex(b[0], b[1], b[2], nx, ny, nz, cb);
        this.vertex(c[0], c[1], c[2], nx, ny, nz, cc);
        this.vertex(a[0], a[1], a[2], nx, ny, nz, ca);
        this.vertex(c[0], c[1], c[2], nx, ny, nz, cc);
        this.vertex(d[0], d[1], d[2], nx, ny, nz, cd);
    }

    setExtra(kind: number, floor: number, emit: number = 0) {
        this.extraMode = 'const';
        this.extraValue = kind + floor * 10 + emit * 100;
    }

    overrideExtras(fromVertex: number, value: number) {
        this.extras.fill(value, fromVertex, this.count);
    }

    cylinder(cx: number, y0: number, cz: number, rBottom: number, rTop: number, height: number, segments: number, color: ColorInput, topColor?: ColorInput, capTop: boolean = true, gradBottom: number = 1) {
        const base = this.tint(resolveColor(color));
        const top = topColor === undefined ? base : resolveColor(topColor);
        const slope = rBottom - rTop;
        const cap = capTop && rTop > 0.001;
        let c0 = 1;
        let s0 = 0;
        this.unit(c0 * height, slope, s0 * height);
        let n0x = this.nrmX;
        let n0y = this.nrmY;
        let n0z = this.nrmZ;
        for (let i = 0; i < segments; i++) {
            const a1 = ((i + 1) / segments) * Math.PI * 2;
            const c1 = Math.cos(a1);
            const s1 = Math.sin(a1);
            this.unit(c1 * height, slope, s1 * height);
            const n1x = this.nrmX;
            const n1y = this.nrmY;
            const n1z = this.nrmZ;
            const p00x = cx + c0 * rBottom;
            const p00z = cz + s0 * rBottom;
            const p10x = cx + c1 * rBottom;
            const p10z = cz + s1 * rBottom;
            const p01x = cx + c0 * rTop;
            const p01z = cz + s0 * rTop;
            const p11x = cx + c1 * rTop;
            const p11z = cz + s1 * rTop;
            const yt = y0 + height;
            this.vertex(p00x, y0, p00z, n0x, n0y, n0z, base, gradBottom);
            this.vertex(p01x, yt, p01z, n0x, n0y, n0z, top);
            this.vertex(p10x, y0, p10z, n1x, n1y, n1z, base, gradBottom);
            this.vertex(p10x, y0, p10z, n1x, n1y, n1z, base, gradBottom);
            this.vertex(p01x, yt, p01z, n0x, n0y, n0z, top);
            this.vertex(p11x, yt, p11z, n1x, n1y, n1z, top);
            if (cap) {
                this.vertex(cx, yt, cz, 0, 1, 0, top);
                this.vertex(p11x, yt, p11z, 0, 1, 0, top);
                this.vertex(p01x, yt, p01z, 0, 1, 0, top);
            }
            c0 = c1;
            s0 = s1;
            n0x = n1x;
            n0y = n1y;
            n0z = n1z;
        }
    }

    disc(cx: number, y: number, cz: number, radius: number, segments: number, color: ColorInput) {
        const col = this.tint(resolveColor(color));
        for (let i = 0; i < segments; i++) {
            const a0 = (i / segments) * Math.PI * 2;
            const a1 = ((i + 1) / segments) * Math.PI * 2;
            this.vertex(cx, y, cz, 0, 1, 0, col);
            this.vertex(cx + Math.cos(a1) * radius, y, cz + Math.sin(a1) * radius, 0, 1, 0, col);
            this.vertex(cx + Math.cos(a0) * radius, y, cz + Math.sin(a0) * radius, 0, 1, 0, col);
        }
    }

    blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, detail: number, color: ColorInput, roughness: number = 0, lightFromAbove: number = 0.3, faceJitter: number = 0.05) {
        const base = this.tint(resolveColor(color));
        const tris = getIco(detail);
        const seedA = this.rng() * 100;
        const warp = (v: Vec3): Vec3 => {
            if (roughness <= 0) return v;
            const k = 1 + roughness * Math.sin(v[0] * 5.1 + seedA) * Math.cos(v[1] * 4.3 + seedA * 0.7) * Math.sin(v[2] * 4.7 + seedA * 1.3);
            return [v[0] * k, v[1] * k, v[2] * k];
        };
        for (const t of tris) {
            const a = warp(t[0]);
            const b = warp(t[1]);
            const c = warp(t[2]);
            const pax = cx + a[0] * rx;
            const pay = cy + a[1] * ry;
            const paz = cz + a[2] * rz;
            const pbx = cx + b[0] * rx;
            const pby = cy + b[1] * ry;
            const pbz = cz + b[2] * rz;
            const pcx = cx + c[0] * rx;
            const pcy = cy + c[1] * ry;
            const pcz = cz + c[2] * rz;
            const ux = pbx - pax;
            const uy = pby - pay;
            const uz = pbz - paz;
            const vx = pcx - pax;
            const vy = pcy - pay;
            const vz = pcz - paz;
            this.unit(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
            const nx = this.nrmX;
            const ny = this.nrmY;
            const nz = this.nrmZ;
            const fy = (a[1] + b[1] + c[1]) / 3;
            const shade = 1 - lightFromAbove + lightFromAbove * (fy * 0.5 + 0.5) * 1.6;
            const jit = 1 + (this.rng() - 0.5) * 2 * faceJitter;
            const col: Rgb = [base[0] * jit, base[1] * jit, base[2] * jit];
            this.vertex(pax, pay, paz, nx, ny, nz, col, shade);
            this.vertex(pbx, pby, pbz, nx, ny, nz, col, shade);
            this.vertex(pcx, pcy, pcz, nx, ny, nz, col, shade);
        }
    }

    gem(cx: number, cy: number, cz: number, r: number, color: ColorInput, lightFromAbove: number = 0.3) {
        const base = this.tint(resolveColor(color));
        for (let f = 0; f < 8; f++) {
            const sx = f & 1 ? -1 : 1;
            const sy = f & 2 ? -1 : 1;
            const sz = f & 4 ? -1 : 1;
            const flip = sx * sy * sz < 0;
            const nx = sx * 0.57735;
            const ny = sy * 0.57735;
            const nz = sz * 0.57735;
            const shade = 1 - lightFromAbove + lightFromAbove * (sy * 0.33 + 0.5) * 1.6;
            const jit = 1 + (this.rng() - 0.5) * 0.1;
            const col: Rgb = [base[0] * jit, base[1] * jit, base[2] * jit];
            this.vertex(cx + sx * r, cy, cz, nx, ny, nz, col, shade);
            if (flip) {
                this.vertex(cx, cy, cz + sz * r, nx, ny, nz, col, shade);
                this.vertex(cx, cy + sy * r, cz, nx, ny, nz, col, shade);
            } else {
                this.vertex(cx, cy + sy * r, cz, nx, ny, nz, col, shade);
                this.vertex(cx, cy, cz + sz * r, nx, ny, nz, col, shade);
            }
        }
    }

    *buildGradual(): Generator<void, BufferGeometry> {
        const n = this.count;
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(this.positions.slice(0, n * 3), 3));
        yield;
        geometry.setAttribute('normal', new BufferAttribute(this.normals.slice(0, n * 3), 3));
        yield;
        geometry.setAttribute('color', new BufferAttribute(this.colors.slice(0, n * 3), 3));
        yield;
        geometry.setAttribute('aExtra', new BufferAttribute(this.extras.slice(0, n), 1));
        if (this.withUv && this.uvs) geometry.setAttribute('uv', new BufferAttribute(this.uvs.slice(0, n * 2), 2));
        if (n > 0) {
            const box = new Box3(new Vector3(this.minX, this.minY, this.minZ), new Vector3(this.maxX, this.maxY, this.maxZ));
            geometry.boundingBox = box;
            geometry.boundingSphere = new Sphere(box.getCenter(new Vector3()), box.min.distanceTo(box.max) / 2);
        }
        return geometry;
    }

    build(): BufferGeometry {
        const n = this.count;
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(this.positions.slice(0, n * 3), 3));
        geometry.setAttribute('normal', new BufferAttribute(this.normals.slice(0, n * 3), 3));
        geometry.setAttribute('color', new BufferAttribute(this.colors.slice(0, n * 3), 3));
        geometry.setAttribute('aExtra', new BufferAttribute(this.extras.slice(0, n), 1));
        if (this.withUv && this.uvs) geometry.setAttribute('uv', new BufferAttribute(this.uvs.slice(0, n * 2), 2));
        if (n > 0) {
            const box = new Box3(new Vector3(this.minX, this.minY, this.minZ), new Vector3(this.maxX, this.maxY, this.maxZ));
            geometry.boundingBox = box;
            geometry.boundingSphere = new Sphere(box.getCenter(new Vector3()), box.min.distanceTo(box.max) / 2);
        }
        return geometry;
    }
}
