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
        this.timestep = 0;
        this.accel_pressed = false;
        this.brake_pressed = false;
        this.left_pressed = false;
        this.right_pressed = false;
        this.u_static = 0;
        this.u_kinetic = 0;
        this.collision_funcs = [];
        this.elapsed_time = 0;
        this.finish_line = vec3(0, 0, 0);
        this.finish_line_slope = 0;
        this.lap_goal = 0;
        this.leaderboard = [];
    }

    update(dt, elapsed_time) {
        this.elapsed_time = elapsed_time;
        //console.log(this.elapsed_time);
        if (this.elapsed_time < 0)
            return;
        for (const p of this.particles) {
            if (!p.valid)
                continue;
            p.handle_inputs(this);
            if (p.is_car)
                p.handle_collision(this);
        }
        for (const collision_func of this.collision_funcs) {
            collision_func(this);
        }
        for (const s of this.springs) {
            s.update();
        }
        for (const p of this.particles) {
            if (!p.valid)
                continue;
            p.update(this, dt);
        }
        //console.log(this.leaderboard);

    }
}