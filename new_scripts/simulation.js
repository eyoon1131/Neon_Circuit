import {tiny, defs} from '../examples/common.js';
// import {Particle} from "./particle.js";
// import {Spring} from "./spring.js";

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export class Simulation {
    constructor() {
        //this.car = null;
        this.particles = [];
        this.springs = [];
        this.g_acc = vec3(0, 0, 0);
        this.ground_ks = 0;
        this.ground_kd = 0;
        this.integ_tech = 0;
        this.timestep = 0;
        this.accel_pressed = false;
        this.brake_pressed = false;
        this.left_pressed = false;
        this.right_pressed = false;
        this.u_static = 0;
        this.u_kinetic = 0;
        this.track_fn = null;
        this.track_width = 0;
        this.collision_funcs = [];
        this.race_start = true;
    }

    update(dt) {
        for (const p of this.particles) {
            p.handle_inputs(this);

        }
        for (const collision_func of this.collision_funcs) {
            collision_func(this);
        }
        for (const s of this.springs) {
            s.update();
        }
        for (const p of this.particles) {
            p.update(this, dt);
        }
    }
}