import {tiny, defs} from '../examples/common.js';
import {detectTrackCollision} from "../collision/collision-handling.js";
import { getFrame, getTimeOnCurve} from "../track/track-generate.js";

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

function are_colliding(p1, p2) {
    if (p1 === p2)
        return false;
    const dist = p1.pos.minus(p2.pos).norm();
    return dist <= p1.scale_factors[0] + p2.scale_factors[0];
}

export class Particle {
    constructor() {
        this.mass = 0;
        this.pos = vec3(0, 0, 0);
        this.vel = vec3(0, 0, 0);
        this.acc = vec3(0, 0, 0);
        this.ext_force = vec3(0, 0, 0);
        //this.forward_dir = vec3(0, 0, 0);
        this.valid = false;
        this.scale_factors = vec3(0, 0, 0);
        this.delta_pos = vec3(0, 0, 0);
        this.max_speed = 0;
    }

    update(sim, dt) {
        if (!this.valid)
            throw "Not initialized"
        // forward euler
        // if (sim.integ_tech === 1) {
        //     this.acc = this.ext_force.times(1.0 / this.mass);
        //     this.pos = this.pos.plus(this.vel.times(dt));
        //     this.vel = this.vel.plus(this.acc.times(dt));
        //     if (this.vel.norm() > 30)
        //         this.vel = this.vel.normalized().times(30);
        // }
        // else if (sim.integ_tech === 2) {
        const old_pos = this.pos;

        this.acc = this.ext_force.times(1.0 / this.mass);
        this.vel = this.vel.plus(this.acc.times(dt));
        if (this.vel.norm() > this.max_speed)
            this.vel = this.vel.normalized().times(this.max_speed);
        this.pos = this.pos.plus(this.vel.times(dt));
        // }
        // else if (sim.integ_tech === 3) {
        //     this.pos = this.pos.plus(this.vel.times(dt)).plus(this.acc.times(dt**2 / 2));
        //     const new_acc = this.ext_force.times(1.0 / this.mass);
        //     this.vel = this.vel.plus(this.acc.plus(new_acc).times(dt / 2));
        //     if (this.vel.norm() > 30)
        //         this.vel = this.vel.normalized().times(30);
        //     this.acc = new_acc;
        // }
        if (this.pos[1] < 0)
            this.pos[1] = 0;
        this.delta_pos = this.pos.minus(old_pos);
        //console.log(this.pos)
        // if (this.vel[0] !== 0 || this.vel[2] !== 0) {
        //     const vel_zx = this.vel.normalized();
        //     //vel_zx[1] = 0;
        //     if (this.forward_dir.dot(vel_zx) > 0)
        //         this.forward_dir = vel_zx;
        // }
        // console.log(this.vel.norm())
    }

    handle_inputs(sim) {
        // add gravity
        //this.ext_force = sim.g_acc.times(this.mass);
        // add ground collision and damping
        // calculate collision with other particles
        // let next_pos = this.pos.plus(this.vel.times(dt));
        // if (next_pos[1] < 0) {
        //     const unit_nor = vec3(0, 1, 0);
        //     const collision_dt = (p.pos[1] / (p.pos[1] - next_pos[1])) * dt;
        //     const collision_pos = p.pos.plus(p.vel.times(collision_dt));
        //     let deflected_vec = next_pos.minus(collision_pos);
        //     deflected_vec[1] = -deflected_vec[1];
        //     //const exit_pos = next_pos.plus(deflected_vec);
        //     const nor_force = unit_nor.times(this.ground_ks * (deflected_vec.dot(unit_nor))).minus(
        //         unit_nor.times(this.ground_kd * (p.vel.dot(unit_nor))));
        //     console.log(p.ext_force)
        //     p.ext_force.add_by(nor_force);
        //     console.log(p.ext_force)
        // }

        //let vel_zx = this.vel;
        //vel_zx[1] = 0;
        this.ext_force = vec3(0, 0, 0);
        const vel_unit = this.vel.normalized();

        const norm_force = sim.g_acc.times(-this.mass);
        //this.ext_force.add_by(norm_force);
        //console.log(p.ext_force)
        //console.log(p.vel)
        const kin_friction = norm_force.norm() * sim.u_kinetic;
        if (this.delta_pos.norm() > 0.00001)
            this.ext_force.add_by(vel_unit.times(-kin_friction));

        //console.log(this.delta_pos);
    }

    handle_collision(sim) {
        //let next_pos = this.pos.plus(this.vel.times(dt));
        for (const p of sim.particles) {
            if (are_colliding(this, p)) {
                const total_vel = this.vel.plus(p.vel).norm();
                //console.log(total_vel);
                let this_to_p = p.pos.minus(this.pos);
                this_to_p[1] = 0;
                this_to_p.normalize();
                this.ext_force.add_by(this_to_p.times(-(total_vel ** 2)))
                p.ext_force.add_by(this_to_p.times(total_vel ** 2));
            }
        }
    }

    get_rotation() { // gives rotation of particle relative to x-axis in zx plane
        return 0;
    }
}

export class Car extends Particle {
    constructor() {
        super();
        this.forward_dir = vec3(0, 0, 0); // need to initialize
        this.collided = false;
        const turning_scale = 2.0/1000;
        this.left_turn_matrix = Mat4.rotation(turning_scale, 0, 1, 0);
        this.right_turn_matrix = Mat4.rotation(-turning_scale, 0, 1, 0);
    }
    update(sim, dt) {
        super.update(sim, dt);
        if (sim.left_pressed)
            this.forward_dir = this.left_turn_matrix.times(this.forward_dir.to4(1)).to3();
        if (sim.right_pressed)
            this.forward_dir = this.right_turn_matrix.times(this.forward_dir.to4(1)).to3();


        // if (this.vel[0] !== 0 || this.vel[2] !== 0) {
        //     const vel_zx = this.vel.normalized();
        //     //vel_zx[1] = 0;
        //     //if (this.forward_dir.dot(vel_zx) > 0)
        //     this.forward_dir = vel_zx;
        //     // console.log("VEL", this.vel)
        //     // console.log("FORWARD", this.forward_dir)
        // }
        // // console.log(this.vel.norm())
        // // console.log(this.ext_force)
    }

    handle_inputs(sim) {
        super.handle_inputs(sim);
        const norm_force = sim.g_acc.times(this.mass).times(-1);
        let stat_friction = norm_force.norm() * sim.u_static * this.vel.norm() ** 2 / 50.0;

        if (!sim.accel_pressed && !sim.brake_pressed && !sim.left_pressed && !sim.right_pressed){
            if (this.delta_pos.norm() < 0.00001)
                this.vel = vec3(0, 0, 0)
            return;
        }

        if (sim.accel_pressed) 
            this.ext_force.add_by(this.forward_dir.times(12.0));
        if (sim.brake_pressed)
            this.ext_force.subtract_by(this.forward_dir.times(10));
        if (sim.right_pressed)
            this.ext_force.add_by(this.forward_dir.cross(vec3(0, 1, 0)).times(stat_friction));
        if (sim.left_pressed)
            this.ext_force.subtract_by(this.forward_dir.cross(vec3(0, 1, 0)).times(stat_friction));

        // collision detection with wall (doesn't work)
        // detectCollisionOnTrack(this, sim.track_fn, sim.track_width, this.scale_factors[0] * 2);

        // console.log(p.ext_force)
    }

    get_rotation() {
        let theta = Math.acos(this.forward_dir.dot(vec3(1, 0, 0)));
        // if z < 0, then forward_dir is more than 180 degrees ccw of x-axis
        if (this.forward_dir[2] < 0)
            theta = (2 * Math.PI - theta);
        return theta;
    }
}

export class Enemy extends Particle {
    constructor() {
        super();
        this.path_fn = null;
    }

    handle_inputs(sim) {
        super.handle_inputs(sim);
        const frame = getFrame(this.pos, this.path_fn);
        const vel_dir = frame[0];
        const hor_dir = frame[2];
        const spline_pos = frame[3];
        const pos_to_spline = spline_pos.minus(this.pos);
        this.ext_force.add_by(vel_dir.times(12));

        const hor_acc = hor_dir.times(pos_to_spline.dot(hor_dir));
        if (hor_acc.norm() !== 0)
            this.ext_force.add_by(hor_acc.normalized().times(this.vel.norm() * 1.2));


    }
}