import {tiny, defs} from '../examples/common.js';
import {detectTrackCollision} from "../collision/collision-handling.js";
import { getFrame, getTimeOnCurve} from "../track/track-generate.js";

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

const SAFE_EDGE = 0.1;
export function are_colliding(p1, p2) {
    if (p1 === p2)
        return false;
    const p1_zx = vec3(p1.pos[0], 0, p1.pos[2]);
    const p2_zx = vec3(p2.pos[0], 0, p2.pos[2]);
    const dist = p1_zx.minus(p2_zx).norm();
    return dist <= p1.scale_factors[0] + p2.scale_factors[0] + SAFE_EDGE;
}

export class Particle {
    constructor() {
        this.mass = 0;
        this.pos = vec3(0, 0, 0);
        this.vel = vec3(0, 0, 0);
        this.acc = vec3(0, 0, 0);
        this.ext_force = vec3(0, 0, 0);
        this.max_speed = 0;
        this.valid = false;
        this.scale_factors = vec3(0, 0, 0);
        this.color = null;
        this.is_car = false;
    }

    update(sim, dt) {
        if (!this.valid)
            return;

        this.acc = this.ext_force.times(1.0 / this.mass);
        this.vel = this.vel.plus(this.acc.times(dt));
        this.pos = this.pos.plus(this.vel.times(dt));
    }

    handle_inputs(sim) {
        this.ext_force = vec3(0, 0, 0);
    }

    handle_collision(sim) {
        //let next_pos = this.pos.plus(this.vel.times(dt));
        for (const p of sim.particles) {
            if (p.valid && are_colliding(this, p)) {
                if (p.is_car) {
                    const total_vel = this.vel.plus(p.vel).norm();
                    //console.log(total_vel);
                    let this_to_p = p.pos.minus(this.pos);
                    this_to_p[1] = 0;
                    this_to_p.normalize();
                    this.ext_force.add_by(this_to_p.times(-(total_vel ** 2)))
                    p.ext_force.add_by(this_to_p.times(total_vel ** 2));
                }
                else {
                    if (p.effect === 1)
                        this.max_speed += 1;
                    else if (p.effect === 2)
                        this.max_speed -= 1;
                    p.valid = false;
                }
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
        this.id = 0;
        this.laps = 0;
        this.delta_pos = vec3(0, 0, 0);
        this.is_finished = false;
        this.angle_from_finish = 0;
        this.forward_dir = vec3(0, 0, 0); // need to initialize
        this.is_car = true;
    }
    update(sim, dt) {
        if (!this.valid)
            throw "Not initialized"

        const old_pos = this.pos;
        const old_angle_from_finish = this.angle_from_finish;

        this.acc = this.ext_force.times(1.0 / this.mass);
        this.vel = this.vel.plus(this.acc.times(dt));
        if (this.vel.norm() > this.max_speed)
            this.vel = this.vel.normalized().times(this.max_speed);
        this.pos = this.pos.plus(this.vel.times(dt));

        this.delta_pos = this.pos.minus(old_pos);

        if (this.is_finished)
            return;

        const pos_zx = vec3(this.pos[0], 0, this.pos[2]);
        const finish_zx = vec3(sim.finish_line[0], 0, sim.finish_line[2]);
        let cos_pf = pos_zx.normalized().dot(finish_zx.normalized());
        if (cos_pf > 1)
            cos_pf = 1;
        else if (cos_pf < -1)
            cos_pf = -1;
        this.angle_from_finish = Math.acos(cos_pf);
        // angle_from_finish is angle from finish line to position vector
        // cars travel ccw in zx plane
        // if finish line is in +z half, if x pos of car is below finish line, then car is behind finish line
        // if finish line is in -z half, if x pos of car is above finish line, then car is behind finish line
        if (sim.finish_line[2] > 0 && this.pos[0] < sim.finish_line_slope * this.pos[2])
            this.angle_from_finish = (2 * Math.PI - this.angle_from_finish);
        else if (sim.finish_line[2] < 0 && this.pos[0] > sim.finish_line_slope * this.pos[2])
            this.angle_from_finish = (2 * Math.PI - this.angle_from_finish);
        const delta_angle = this.angle_from_finish - old_angle_from_finish;

        if (delta_angle < -6)
            this.laps++;
        if (this.laps === sim.lap_goal) {
            this.is_finished = true;
            sim.leaderboard.push([this.id, sim.elapsed_time]);
            return;
        }
        if (delta_angle > 6)
            this.laps--;
    }

    handle_inputs(sim) {
        super.handle_inputs(sim);
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

    get_rotation() {
        let theta = Math.acos(this.forward_dir.dot(vec3(1, 0, 0)));
        // if z < 0, then forward_dir is more than 180 degrees ccw of x-axis
        if (this.forward_dir[2] < 0)
            theta = (2 * Math.PI - theta);
        return theta;
    }
}

export class User extends Car {
    constructor() {
        super();
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

    }

}

export class Enemy extends Car {
    constructor() {
        super();
        this.path_fn = null;
    }

    update(sim, dt) {
        super.update(sim, dt);
        if (this.vel.norm() !== 0)
            this.forward_dir = this.vel.normalized();
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

export class Item extends Particle {
    constructor() {
        super();
        this.effect = 0;
        this.spring_anchor = null;
        this.spring = null;
    }

    handle_inputs(sim) {
        super.handle_inputs(sim);
        this.spring.update();
    }
}