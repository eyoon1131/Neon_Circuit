import {tiny, defs} from '../examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export class Spring {
    constructor() {
        this.particle1 = null;
        this.particle2 = null;
        this.ks = 0;
        this.kd = 0;
        this.rest_length = 0;
        this.valid = false;
    }

    update() {
        if (!this.valid)
            throw "Not initialized"
        const d_ij_vec = this.particle2.pos.minus(this.particle1.pos);
        const d_ij = d_ij_vec.norm();
        const d_ij_unit = d_ij_vec.times(1.0 / d_ij);
        const v_ij_vec = this.particle2.vel.minus(this.particle1.vel);
        const fs_ij = d_ij_unit.times(this.ks * (d_ij - this.rest_length));
        const fd_ij = d_ij_unit.times(this.kd * v_ij_vec.dot(d_ij_unit));
        const fe_ij = fs_ij.plus(fd_ij);
        this.particle1.ext_force.add_by(fe_ij);
        this.particle2.ext_force.subtract_by(fe_ij);
    }
}