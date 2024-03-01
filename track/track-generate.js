import { math } from '..//tiny-graphics-math.js';

export const tiny = { ...math, math };

// Pull these names into this module's scope for convenience:
const { Vector3, vec3, color, Matrix, Mat4 } = tiny;

const TINY_STEP = 1e-6;
const SCAN_POINTS = 64.0;
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
    const horizontal = tangent.cross(vec3(0,1,0)).normalized();
    const normal = tangent.cross(horizontal).normalized();
    return [tangent, normal, horizontal, point];
}
