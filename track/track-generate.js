import { tiny } from '../tiny-graphics.js';
import { defs } from "../main-scene.js";


// Pull these names into this module's scope for convenience:
const { Vector3, Vector4, vec3, vec4, color, Matrix, Mat4, Shape, Shader, Component } = tiny;

const TINY_STEP = 1e-3;
const SCAN_POINTS = 128.0;

function _curveDerivative(curveFunction, t) {
    return curveFunction(t + TINY_STEP)
        .minus(curveFunction(t))
        .times(TINY_STEP);
}

function pHash(position) {
    return `${position[0]}${position[1]}${position[2]}`
}
const MEMORY = {};

export function getTimeOnCurve(position, curveFunction) {

    // simple scan-point approach
    const step = (x) => (x / SCAN_POINTS);
    let ans = 0, minPoint = null;
    for (let i = 0; i <= SCAN_POINTS; i++) {
        let currentPoint = curveFunction(step(i));
        if (!minPoint || // found a point that's closer
            position.minus(currentPoint).norm() <
            position.minus(minPoint).norm()) {

            ans = step(i);
            minPoint = currentPoint;
        }
    }
    return ans;
}

// returns frame [tangent, normal, horizontal]
export function getFrame(position, curveFunction) {
    // in reality we only have one curve function so
    if(pHash(position) in MEMORY) return MEMORY[pHash(position)];
    let t = getTimeOnCurve(position, curveFunction);
    let point = curveFunction(t);
    const tangent = _curveDerivative(curveFunction, t).normalized();
    const horizontal = tangent.cross(vec3(0, 1, 0)).normalized();
    const normal = horizontal.cross(tangent).normalized();
    return MEMORY[pHash(position)]=[tangent, normal, horizontal, point];
}

export function getFrameFromT(t, curveFunction) {

    const point = curveFunction(t);
    //console.log('t = ', t, 'p = ', point);
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

export class TrackPhong extends defs.Phong_Shader {
    constructor(num_of_lights = 2) {
        super(num_of_lights);
    }
    // adopted from the original phong shader
    shared_glsl_code() {          // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` 
      precision mediump float;
      const int N_LIGHTS = ` + this.num_lights + `;
      uniform float ambient, diffusivity, specularity, smoothness;
      uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
      uniform float light_attenuation_factors[N_LIGHTS];
    //   uniform vec4 shape_color;
      uniform vec3 squared_scale, camera_center;

      varying vec3 N, vertex_worldspace;
      varying vec4 vertex_color;
                                           // ***** PHONG SHADING HAPPENS HERE: *****
      vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace, vec4 v_color ) {
          vec3 E = normalize( camera_center - vertex_worldspace );
          vec3 result = vec3( 0.0 );
          for(int i = 0; i < N_LIGHTS; i++) {
              vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz -
                                             light_positions_or_vectors[i].w * vertex_worldspace;
              float distance_to_light = length( surface_to_light_vector );

              vec3 L = normalize( surface_to_light_vector );
              vec3 H = normalize( L + E );
              
                // Compute diffuse and specular components of Phong Reflection Model.
              float diffuse  =      max( dot( N, L ), 0.0 );
              float specular = pow( max( dot( N, H ), 0.0 ), smoothness );     // Use Blinn's "halfway vector" method.
              float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );


              vec3 light_contribution = v_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                        + light_colors[i].xyz * specularity * specular;

              result += attenuation * light_contribution;
            }
          return result;
        } `;
    }
    vertex_glsl_code() {           // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
        attribute vec3 position, normal;                            // Position is expressed in object coordinates.
        attribute vec4 color;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;

        void main() {                                                                
            gl_Position = projection_camera_model_transform * vec4( position, 1.0 );     // Move vertex to final space.
                                            // The final normal vector in screen space.
            N = normalize( mat3( model_transform ) * normal / squared_scale);

            vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
            vertex_color = color;
        } `;
    }
    fragment_glsl_code() {          // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
      void main() {                          
                                         // Compute an initial (ambient) color:
          gl_FragColor = vec4( vertex_color.xyz * ambient, vertex_color.w );
                                         // Compute the final color with contributions from lights:
          gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace, vertex_color );
        } `;
    }
}

export class Track extends Shape {
    constructor(width, wallWidth, wallHeight, thickness, curveFunction, slices, trackColor = color(1, 1, 1, 1), wallColor = color(1, 0, 0, 1)) {
        super("position", "normal", "color");
        this.trackColor = trackColor;
        this.wallColor = wallColor;
        // build basic points for further duplication
        this.sliceBase = [
            vec3(0, -thickness, -wallWidth - 0.5 * width),
            vec3(0, wallHeight, -wallWidth - 0.5 * width),
            vec3(0, wallHeight, -wallWidth - 0.5 * width),
            vec3(0, wallHeight, - 0.5 * width),
            vec3(0, wallHeight, - 0.5 * width),
            vec3(0, 0, -0.5 * width),
            vec3(0, 0, -0.5 * width),
            vec3(0, 0, 0.5 * width),
            vec3(0, 0, 0.5 * width),
            vec3(0, wallHeight, 0.5 * width),
            vec3(0, wallHeight, 0.5 * width),
            vec3(0, wallHeight, wallWidth + 0.5 * width),
            vec3(0, wallHeight, wallWidth + 0.5 * width),
            vec3(0, -thickness, wallWidth + 0.5 * width),
        ];
        this.baseNormals = [
            vec3(0, -1, -1),

            vec3(0, 0, -1),
            vec3(0, 1, 0),

            vec3(0, 1, 0),
            vec3(0, 0, 1),

            vec3(0, 0, 1),
            vec3(0, 1, 0),

            vec3(0, 1, 0),
            vec3(0, 0, -1),

            vec3(0, 0, -1),
            vec3(0, 1, 0),

            vec3(0, 1, 0),
            vec3(0, 0, 1),

            vec3(0, -1, -1),
        ];
        this.baseColors = [
            this.wallColor,

            this.wallColor,
            this.wallColor,

            this.wallColor,
            this.wallColor,

            this.wallColor,
            this.trackColor,

            this.trackColor,
            this.wallColor,

            this.wallColor,
            this.wallColor,

            this.wallColor,
            this.wallColor,

            this.wallColor,
        ];
        this.pb = [];
        const step = (x) => (x / slices);
        // 8 is the length of this.sliceBase
        const SLICE_LEN = this.sliceBase.length;
        const mapIndex = (slice, index) => (slice % slices) * SLICE_LEN + (index % SLICE_LEN);
        const pushToPosition = (slice) => {
            const [position, basis] = getFrameFromT(step(slice), curveFunction);
            this.pb.push([position, basis]);

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
                let v4 = sliceTransform.times(vec4(newVec3[0], newVec3[1], newVec3[2], 0));
                this.arrays.normal.push(vec3(v4[0], v4[1], v4[2]));
            }
            for (let color of this.baseColors) {
                this.arrays.color.push(color);
            }
        };

        pushToPosition(0);
        for (let slice = 1; slice <= slices; slice++) {
            if (slice < slices) pushToPosition(slice);
            // build triangles from indices
            for (let i = 0; i < SLICE_LEN; i++) {
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
    }
}