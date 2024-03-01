import { tiny } from '../tiny-graphics.js';

// Pull these names into this module's scope for convenience:
const { Vector3, Vector4, vec3, vec4, color, Matrix, Mat4, Shape, Shader, Component } = tiny;

const TINY_STEP = 1e-6;
const SCAN_POINTS = 128.0;
function _curveDerivative(curveFunction, t) {
    return curveFunction(t + TINY_STEP)
        .minus(curveFunction(t))
        .times(TINY_STEP);
}

export function getTimeOnCurve(position, curveFunction) {
    // simple scan-point approach
    const step = (x) => (x / SCAN_POINTS);
    let ans = 0, minPoint = null;
    for (let i = 0; i <= SCAN_POINTS; i++) {
        let currentPoint = curveFunction(step(i));
        if (!minPoint || // found a point that's closer
            position.minus(currentPoint).norm() <
            minPoint.minus(currentPoint).norm()) {

            ans = step(i);
            minPoint = currentPoint;
        }
    }
    return ans;
}

// returns frame [tangent, normal, horizontal]
export function getFrame(position, curveFunction) {
    let t = getTimeOnCurve(position, curveFunction);
    let point = curveFunction(t);
    const tangent = _curveDerivative(curveFunction, t).normalized();
    const horizontal = tangent.cross(vec3(0, 1, 0)).normalized();
    const normal = horizontal.cross(tangent).normalized();
    return [tangent, normal, horizontal, point];
}

function getFrameFromT(t, curveFunction) {

    const point = curveFunction(t);
    console.log('t = ', t, 'p = ', point);
    const tangent = _curveDerivative(curveFunction, t).normalized();
    const horizontal = tangent.cross(vec3(0, 1, 0)).normalized();
    const normal = horizontal.cross(tangent).normalized();
    return [point, [tangent, normal, horizontal]];
}

// the Curve class below adopts the Assignment 1 code.
export class Curve extends Shape {
    constructor(generator, samples) {
        super('position', 'normal');
        this.material = {
            shader: new defs.Phong_Shader(),
            ambient: 1.0,
            color: color(1, 0, 0, 1)
        };
        this.samples = samples;
        this.curveFunction = generator[0];
        this.P = generator[1]; this.T = generator[2];
        if (this.curveFunction && this.samples) {
            for (let i = 0; i <= this.samples; i++) {
                let t = i / this.samples;
                this.arrays.position.push(this.curveFunction(t));
                this.arrays.normal.push(vec3(0, 0, 0));
            }
        }
    }
    draw(webglManager, uniforms) {
        super.draw(
            webglManager,
            uniforms,
            Mat4.identity(),
            this.material,
            'LINE_STRIP'
        );
    }
}

// the Curve class below adopts the Assignment 1 code.
export function HermiteFactory(controlPoints, tangents) {
    return ((ex) => {
        if (ex > 1) ex = 1; // hard clip
        const x = (k) => parseFloat(k / (controlPoints.length - 1));
        if (controlPoints.length !== tangents.length)
            throw "P and tangents must share the same length!";
        let k = 0;
        for (k = 0; k < controlPoints.length; k++)
            if (x(k) <= ex && ex <= x(k + 1))
                break;
        let t = (ex - x(k)) / (x(k + 1) - x(k));
        let one = controlPoints[k].times(2 * (t ** 3) - 3 * (t ** 2) + 1);
        let two = tangents[k]
            .times((t ** 3) - 2 * (t ** 2) + t)
            .times(x(k + 1) - x(k));
        let three = controlPoints[k + 1].times(-2 * (t ** 3) + 3 * (t ** 2));
        let four = tangents[k + 1]
            .times(t ** 3 - t ** 2)
            .times(x(k + 1) - x(k));
        return one.plus(two).plus(three).plus(four);
    });
}

export class Track extends Shape {
    constructor(width, wallWidth, wallHeight, thickness, curveFunction, slices) {
        super("position", "normal", "color");
        // build basic points for further duplication
        this.sliceBase = [    
            vec3(0, -thickness, -wallWidth - 0.5 * width),
            vec3(0, wallHeight, -wallWidth - 0.5 * width),
            vec3(0, wallHeight, - 0.5 * width),
            vec3(0, 0, -0.5 * width),
            vec3(0, 0, 0.5 * width),
            vec3(0, wallHeight, 0.5 * width),
            vec3(0, wallHeight, wallWidth + 0.5 * width),
            vec3(0, -thickness, wallWidth + 0.5 * width),
        ];
        this.baseNormals = [
            vec3(0,-1,-1),
            vec3(0,1,-1),
            vec3(0,1,1),
            vec3(0,1,1),
            vec3(0,1,-1),
            vec3(0,1,-1),
            vec3(0,1,1),
            vec3(0,-1,-1),
        ];
        this.pb = [];
        const step = (x) => (x / slices);
        // 8 is the length of this.sliceBase
        const mapIndex = (slice, index) => (slice % slices) * 8 + (index % 8);
        const pushToPosition = (slice) => {
            const [position, basis] = getFrameFromT(step(slice), curveFunction);
            this.pb.push([position,basis]);
        
            const sliceTransform = Mat4.identity();
            sliceTransform.pre_multiply(Mat4.from([
                [basis[0][0], basis[1][0], basis[2][0], 0],
                [basis[0][1], basis[1][1], basis[2][1], 0],
                [basis[0][2], basis[1][2], basis[2][2], 0],
                [0, 0, 0, 1],
            ]));
            sliceTransform.pre_multiply(Mat4.translation(position[0], position[1], position[2]));

            for (let newVec3 of this.sliceBase) {
                let v4 = sliceTransform.times(vec4(newVec3[0], newVec3[1], newVec3[2], 1));
                this.arrays.position.push(vec3(v4[0], v4[1], v4[2]));
            }
            for (let newVec3 of this.baseNormals) {
                let v4 = sliceTransform.times(vec4(newVec3[0], newVec3[1], newVec3[2], 1));
                this.arrays.normal.push(vec3(v4[0], v4[1], v4[2]));
            }
        };

        pushToPosition(0);
        for (let slice = 1; slice <= slices; slice++) {
            if (slice < slices) pushToPosition(slice);
            // build triangles from indices
            for (let i = 0; i < 8; i++) {
                this.indices.push(
                    mapIndex(slice - 1, i),
                    mapIndex(slice - 1, i + 1),
                    mapIndex(slice, i), // beautiful triangles :D
                    mapIndex(slice - 1, i + 1),
                    mapIndex(slice, i + 1),
                    mapIndex(slice, i),
                );
            }
        }
        for (let _ of this.arrays.position) {
            this.arrays.normal.push(vec3(0.5, 0.5, 0.5));
        }
    }
}