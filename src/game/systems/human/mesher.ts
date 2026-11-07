import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';

export type Rgb = readonly [number, number, number];
export type SkinFn = (x: number, y: number, z: number) => readonly [number, number, number];
export type PaintFn = (x: number, y: number, z: number, a: number) => Rgb;
export type Section = { y: number; rx: number; rf?: number; rb?: number; cx?: number; cz?: number; n?: number };
export type Bump = { y: number; a: number; sy: number; sa: number; amp: number };
export type Xf = readonly number[];

export type LoftSpec = {
    sections: Section[];
    seg: number;
    rings?: number;
    ys?: number[];
    bumps?: Bump[];
    skin: SkinFn;
    paint: PaintFn | Rgb;
    capLow?: number;
    capHigh?: number;
    offset?: number;
    xf?: Xf;
    open?: boolean;
    lo?: (a: number) => number;
    drop?: (x: number, y: number, z: number, a: number) => boolean;
};

export function smoothstep(a: number, b: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

export function wrapPi(a: number): number {
    let v = a % (Math.PI * 2);
    if (v > Math.PI) v -= Math.PI * 2;
    if (v < -Math.PI) v += Math.PI * 2;
    return v;
}

export function curve(xs: number[], ys: number[]): (x: number) => number {
    const n = xs.length;
    const d = new Array<number>(n).fill(0);
    const h: number[] = [];
    const s: number[] = [];
    for (let i = 0; i < n - 1; i++) {
        h.push(xs[i + 1] - xs[i]);
        s.push((ys[i + 1] - ys[i]) / h[i]);
    }
    if (n === 2) {
        d[0] = s[0];
        d[1] = s[0];
    } else {
        for (let i = 1; i < n - 1; i++) {
            if (s[i - 1] * s[i] <= 0) d[i] = 0;
            else {
                const w1 = 2 * h[i] + h[i - 1];
                const w2 = h[i] + 2 * h[i - 1];
                d[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]);
            }
        }
        d[0] = ((2 * h[0] + h[1]) * s[0] - h[0] * s[1]) / (h[0] + h[1]);
        if (d[0] * s[0] <= 0) d[0] = 0;
        else if (s[0] * s[1] <= 0 && Math.abs(d[0]) > 3 * Math.abs(s[0])) d[0] = 3 * s[0];
        const m = n - 2;
        d[n - 1] = ((2 * h[m] + h[m - 1]) * s[m] - h[m] * s[m - 1]) / (h[m] + h[m - 1]);
        if (d[n - 1] * s[m] <= 0) d[n - 1] = 0;
        else if (s[m] * s[m - 1] <= 0 && Math.abs(d[n - 1]) > 3 * Math.abs(s[m])) d[n - 1] = 3 * s[m];
    }
    return (x: number) => {
        if (x <= xs[0]) return ys[0];
        if (x >= xs[n - 1]) return ys[n - 1];
        let i = 0;
        while (i < n - 2 && x > xs[i + 1]) i++;
        const t = (x - xs[i]) / h[i];
        const t2 = t * t;
        const t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * d[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * d[i + 1];
    };
}

export function xfIdentity(): number[] {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
}

export function xfMul(a: Xf, b: Xf): number[] {
    const o = new Array<number>(12).fill(0);
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c];
        o[r * 4 + 3] = a[r * 4] * b[3] + a[r * 4 + 1] * b[7] + a[r * 4 + 2] * b[11] + a[r * 4 + 3];
    }
    return o;
}

export function xfMove(x: number, y: number, z: number): number[] {
    return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
}

export function xfScale(x: number, y: number, z: number): number[] {
    return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0];
}

export function xfRotX(a: number): number[] {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
}

export function xfRotY(a: number): number[] {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0];
}

export function xfRotZ(a: number): number[] {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0];
}

function det3(m: Xf): number {
    return m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]);
}

export class Mesher {
    pos: number[] = [];
    col: number[] = [];
    sk: number[] = [];
    sw: number[] = [];
    idx: number[] = [];

    get count(): number {
        return this.pos.length / 3;
    }

    private push(x: number, y: number, z: number, c: Rgb, bone: readonly [number, number, number], xf: Xf | undefined) {
        let px = x;
        let py = y;
        let pz = z;
        if (xf) {
            px = xf[0] * x + xf[1] * y + xf[2] * z + xf[3];
            py = xf[4] * x + xf[5] * y + xf[6] * z + xf[7];
            pz = xf[8] * x + xf[9] * y + xf[10] * z + xf[11];
        }
        this.pos.push(px, py, pz);
        this.col.push(c[0], c[1], c[2]);
        const w = bone[2];
        if (w <= 0.0005) {
            this.sk.push(bone[0], 0, 0, 0);
            this.sw.push(1, 0, 0, 0);
        } else if (w >= 0.9995) {
            this.sk.push(bone[1], 0, 0, 0);
            this.sw.push(1, 0, 0, 0);
        } else {
            this.sk.push(bone[0], bone[1], 0, 0);
            this.sw.push(1 - w, w, 0, 0);
        }
    }

    loft(spec: LoftSpec): void {
        const secs = spec.sections.slice().sort((a, b) => a.y - b.y);
        const ys = secs.map((s) => s.y);
        const cRx = curve(ys, secs.map((s) => s.rx));
        const cRf = curve(ys, secs.map((s) => s.rf ?? s.rx));
        const cRb = curve(ys, secs.map((s) => s.rb ?? s.rf ?? s.rx));
        const cCx = curve(ys, secs.map((s) => s.cx ?? 0));
        const cCz = curve(ys, secs.map((s) => s.cz ?? 0));
        const cN = curve(ys, secs.map((s) => s.n ?? 2));
        const y0 = ys[0];
        const y1 = ys[ys.length - 1];
        const rings: number[] = spec.ys ? spec.ys.slice().sort((a, b) => a - b) : [];
        if (!spec.ys) {
            const count = Math.max(2, spec.rings ?? 12);
            for (let i = 0; i < count; i++) rings.push(y0 + ((y1 - y0) * i) / (count - 1));
        }
        const seg = spec.seg;
        const bumps = spec.bumps ?? [];
        const offset = spec.offset ?? 0;
        const paintFn: PaintFn = typeof spec.paint === 'function' ? spec.paint : ((c: Rgb) => () => c)(spec.paint);
        const flip = spec.xf ? det3(spec.xf) < 0 : false;
        const base = this.count;
        const rows: { y: number; k: number }[] = [];
        const capSteps = 4;
        if (spec.capLow) {
            for (let i = capSteps; i >= 1; i--) {
                const phi = (i / capSteps) * (Math.PI / 2);
                rows.push({ y: y0 - spec.capLow * Math.sin(phi), k: Math.cos(phi) });
            }
        }
        for (const y of rings) rows.push({ y, k: 1 });
        if (spec.capHigh) {
            for (let i = 1; i <= capSteps; i++) {
                const phi = (i / capSteps) * (Math.PI / 2);
                rows.push({ y: y1 + spec.capHigh * Math.sin(phi), k: Math.cos(phi) });
            }
        }
        const kept: boolean[] = [];
        for (const row of rows) {
            for (let j = 0; j < seg; j++) {
                const a = (j / seg) * Math.PI * 2;
                const yv = spec.lo ? spec.lo(a) + (y1 - spec.lo(a)) * ((row.y - y0) / (y1 - y0)) : row.y;
                const yy = Math.min(y1, Math.max(y0, yv));
                const rx = cRx(yy);
                const rf = cRf(yy);
                const rb = cRb(yy);
                const cx = cCx(yy);
                const cz = cCz(yy);
                const e = 2 / cN(yy);
                const s = Math.sin(a);
                const c = Math.cos(a);
                const ps = Math.sign(s) * Math.pow(Math.abs(s), e);
                const pc = Math.sign(c) * Math.pow(Math.abs(c), e);
                let ox = rx * ps;
                let oz = (c >= 0 ? rf : rb) * pc;
                const len = Math.hypot(ox, oz) || 1;
                let r = 0;
                for (const b of bumps) {
                    const da = wrapPi(a - b.a);
                    const dy = (yy - b.y) / b.sy;
                    const g = (da / b.sa) * (da / b.sa) + dy * dy;
                    if (g < 9) r += b.amp * Math.exp(-g);
                }
                r += offset;
                ox += (ox / len) * r;
                oz += (oz / len) * r;
                const x = cx + ox * row.k;
                const z = cz + oz * row.k;
                const col = paintFn(x, yv, z, a);
                const bone = spec.skin(x, yv, z);
                this.push(x, yv, z, col, bone, spec.xf);
                kept.push(spec.drop ? !spec.drop(x, yv, z, a) : true);
            }
        }
        const nRows = rows.length;
        for (let k = 0; k < nRows - 1; k++) {
            for (let j = 0; j < seg; j++) {
                const j2 = (j + 1) % seg;
                const a = base + k * seg + j;
                const b = base + k * seg + j2;
                const c = base + (k + 1) * seg + j2;
                const d = base + (k + 1) * seg + j;
                if (spec.drop && !(kept[k * seg + j] || kept[k * seg + j2] || kept[(k + 1) * seg + j2] || kept[(k + 1) * seg + j])) continue;
                if (flip) this.idx.push(a, c, b, a, d, c);
                else this.idx.push(a, b, c, a, c, d);
            }
        }
        if (!spec.open) {
            const fan = (rowIndex: number, top: boolean) => {
                let cx = 0;
                let cy = 0;
                let cz = 0;
                for (let j = 0; j < seg; j++) {
                    const o = (base + rowIndex * seg + j) * 3;
                    cx += this.pos[o];
                    cy += this.pos[o + 1];
                    cz += this.pos[o + 2];
                }
                const ci = this.count;
                const sample = base + rowIndex * seg;
                this.pos.push(cx / seg, cy / seg, cz / seg);
                this.col.push(this.col[sample * 3], this.col[sample * 3 + 1], this.col[sample * 3 + 2]);
                this.sk.push(this.sk[sample * 4], this.sk[sample * 4 + 1], this.sk[sample * 4 + 2], this.sk[sample * 4 + 3]);
                this.sw.push(this.sw[sample * 4], this.sw[sample * 4 + 1], this.sw[sample * 4 + 2], this.sw[sample * 4 + 3]);
                for (let j = 0; j < seg; j++) {
                    const a = base + rowIndex * seg + j;
                    const b = base + rowIndex * seg + ((j + 1) % seg);
                    const up = top !== flip;
                    if (up) this.idx.push(ci, a, b);
                    else this.idx.push(ci, b, a);
                }
            };
            fan(0, false);
            fan(nRows - 1, true);
        }
    }

    ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, seg: number, rings: number, skin: SkinFn, paint: PaintFn | Rgb, xf?: Xf, bumps?: Bump[]): void {
        const sections: Section[] = [];
        const n = 10;
        for (let i = 0; i <= n; i++) {
            const t = -1 + (2 * i) / n;
            const k = Math.sqrt(Math.max(0, 1 - t * t));
            sections.push({ y: cy + ry * t, rx: Math.max(0.0001, rx * k), rf: Math.max(0.0001, rz * k), rb: Math.max(0.0001, rz * k), cx, cz });
        }
        this.loft({ sections, seg, rings, skin, paint, xf, bumps });
    }

    merge(other: Mesher, boneMap?: readonly number[], mirror = false): void {
        const base = this.count;
        const n = other.count;
        for (let i = 0; i < n; i++) {
            this.pos.push(mirror ? -other.pos[i * 3] : other.pos[i * 3], other.pos[i * 3 + 1], other.pos[i * 3 + 2]);
            this.col.push(other.col[i * 3], other.col[i * 3 + 1], other.col[i * 3 + 2]);
            for (let k = 0; k < 4; k++) {
                const w = other.sw[i * 4 + k];
                const b = other.sk[i * 4 + k];
                this.sk.push(boneMap && w > 0 ? boneMap[b] : b);
                this.sw.push(w);
            }
        }
        for (let i = 0; i < other.idx.length; i += 3) {
            const a = other.idx[i] + base;
            const b = other.idx[i + 1] + base;
            const c = other.idx[i + 2] + base;
            if (mirror) this.idx.push(a, c, b);
            else this.idx.push(a, b, c);
        }
    }

    toGeometry(): BufferGeometry {
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
        g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
        g.setAttribute('skinIndex', new Uint16BufferAttribute(this.sk, 4));
        g.setAttribute('skinWeight', new Float32BufferAttribute(this.sw, 4));
        g.setIndex(this.idx);
        g.computeVertexNormals();
        return g;
    }
}