import { math } from '../tiny-graphics-math.js';
import { getFrame, getTimeOnCurve } from '../track/track-generate.js';
export const tiny = { ...math, math };

const KS = 5;
const KD = 0.1;


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
    let center_to_pos = position.minus(track_center); // track center to car
    center_to_pos[1] = 0;
    let center_to_wall = track_horizontal.times(track_width / 2); // track center to wall
    center_to_wall[1] = 0;
    const distance = Math.abs(center_to_wall.norm() - center_to_pos.norm());


    // check if car is outside track
    // let collision = false;
    if (distance  <=  car_width/ 2){
        console.log("track center", track_center)
        console.log("collision");
        console.log(distance, track_width / 2, car_width / 2)
        particle.collided = true;
        handleTrackCollision(particle, track_center, track_horizontal, track_width, car_width, distance)
        // collision = true;
    }
    else {
        particle.collided = false;
    }
    // return collision;
}

function handleTrackCollision(particle, track_center, track_horizontal, track_width, car_width, distance){
    const position = particle.pos;
    //let distance = math.dot(math.subtract(position, track_center), track_horizontal).norm();
    let direction = track_center.minus(position).normalized();
    console.log("direction", direction, track_horizontal)
    let track_horizontal2d = math.vec3(track_horizontal[0], 0, track_horizontal[2])
    let direction2d = math.vec3(direction[0], 0, direction[2])
    console.log("left", direction2d.dot(track_horizontal2d))
    console.log("track_horizontal", track_horizontal2d)
    let left = direction2d.dot(track_horizontal2d) > 0;
    let wall_pos = track_center.plus(track_horizontal2d.times((track_width / 2) * (left ? 1 : -1)));
    console.log("wall pos", wall_pos, "pos", position)
    let wall_normal = track_horizontal2d.times(left ? -1 : 1);
    let car_collision_point = position.plus(wall_normal.times(car_width / 2).times(-1));
    // want to find the point on the wall that is closest to the car
    let wall_collision_point = wall_pos.plus(math.vec3(0, car_width / 2, 0));
    const fs_ig = calculate_spring_force(car_collision_point, wall_collision_point, KS, 0);
    const fd_ig = calculate_damping_force(car_collision_point, wall_collision_point, particle.vel, math.vec3(0,0,0), KD);
    console.log("spring force", fs_ig, fd_ig);
    particle.ext_force.add_by(fs_ig.plus(fd_ig).times(left ? -1 : 1));
    console.log("ext force", particle.ext_force);
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
