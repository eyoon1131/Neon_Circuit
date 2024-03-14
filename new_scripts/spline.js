import {tiny, defs} from '../examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export class Spline {
    constructor() {
        this.points = [];
        this.tangents = [];
        this.scaled_tangents = [];
        this.size = 0;
    }

    add_point(x, y, z, tx, ty, tz) {
        this.points.push(vec3(x, y, z));
        this.tangents.push(vec3(tx, ty, tz));
        this.scaled_tangents.push(vec3(0, 0, 0));
        this.size += 1;
        this.scale_tangents();
    }

    scale_tangents() {
        for (let i = 0; i < this.size; i++) {
            this.scaled_tangents[i] = this.tangents[i].times(1 / (this.size - 1));
        }
    }

    get_position(t) {
        if (this.size < 2) {return vec3(0, 0, 0);}

        const A = Math.floor(t * (this.size - 1)); // A = T(i)
        const B = Math.ceil(t * (this.size - 1)); // B = T(i + 1)
        const s = (t * (this.size - 1)) % 1.0 // T - T(i)

        let a = this.points[A].copy();
        let b = this.points[B].copy();
        let ta = this.scaled_tangents[A].copy();
        let tb = this.scaled_tangents[B].copy();

        return a.times(2 * (s ** 3) - 3 * (s ** 2) + 1)
            .plus(b.times(-2 * (s ** 3) + 3 * (s ** 2)))
            .plus(ta.times((s ** 3) - 2 * (s ** 2) + s))
            .plus(tb.times((s ** 3) - (s ** 2)))
    }
}