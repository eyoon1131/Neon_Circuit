import { math } from '../tiny-graphics-math.js';
import { getFrame, getTimeOnCurve } from '../track/track-generate.js';
export const tiny = { ...math, math };

const KS = 5000;
const KD = 100;


// assumption: track is closed loop with fixed width
export function detectTrackCollision(particle, track_function, track_width, car_width){
    const position = particle.pos;
    let frame = getFrame(position, track_function );
    let track_tangent = frame[0];
    let track_normal = frame[1]; // up
    let track_horizontal = frame[2];

    let track_center = frame[3];

    // only need to change xz coordinates
    // let track_left = math.vec3(track_center[0] - track_width/2 * track_horizontal[0], track_center[1], track_center[2] - track_width/2 * track_horizontal[2]);
    //let track_right = math.vec3(track_center[0] + track_width/2 * track_horizontal[0], track_center[1], track_center[2] + track_width/2 * track_horizontal[2]);

    // distance of car from track center
    // let distance = math.dot(math.subtract(position, track_center), track_horizontal).norm();
    const center_to_pos = position.minus(track_center);
    const center_to_wall = track_horizontal.times(track_width / 2);
    const distance = Math.abs(center_to_pos.dot(center_to_wall) / (track_width / 2));


    // check if car is outside track
    // let collision = false;
    if (distance + (car_width / 2) >= track_width / 2){
        console.log("collision");
        handleTrackCollision(particle, track_center, track_horizontal, track_width, car_width, distance)
        // collision = true;
    }
    // return collision;
}

function handleTrackCollision(particle, track_center, track_horizontal, track_width, car_width, distance){
    const position = particle.pos;
    //let distance = math.dot(math.subtract(position, track_center), track_horizontal).norm();
    let direction = position.minus(track_center).normalized();
    let left = direction.dot(track_horizontal) < 0;
    let wall_pos = track_center.plus(track_horizontal.times((track_width / 2) * (left ? -1 : 1)));
    let wall_normal = track_horizontal.times(left ? -1 : 1);
    let car_collision_point = position.plus(wall_normal.times(car_width / 2));
    // want to find the point on the wall that is closest to the car
    let wall_collision_point = wall_pos.plus(math.vec3(0, car_width / 2, 0));
    const fs_ig = calculate_spring_force(car_collision_point, wall_collision_point, KS, 0);
    const fd_ig = calculate_damping_force(car_collision_point, wall_collision_point, particle.vel, math.vec3(0,0,0), KD);
    particle.ext_force.add_by(fs_ig.plus(fd_ig));
}


function calculate_spring_force(xi, xj, ks, length) {
    let d_vec = xj.minus(xi);
    let d = d_vec.norm();
    let d_hat = d_vec.normalized();
    let fs_ij = d_hat.times(ks * (d - length));
    return fs_ij;
  }

function calculate_damping_force(xi, xj, vi, vj, kd) { 
let v_vec = vj.minus(vi);
let d_vec = xj.minus(xi);
let d = d_vec.norm();
let d_hat = d_vec.normalized();
let fd_ij = d_hat.times(kd * v_vec.dot(d_hat));
return fd_ij;
}
