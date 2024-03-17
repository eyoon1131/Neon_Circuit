import { tiny, defs } from '../examples/common.js';
// Pull these names into this module's scope for convenience:
const {
    vec3,
    vec4,
    vec,
    color,
    Mat4,
    Shape,
    Material,
    Shader,
    Texture,
    Component } = tiny;

/* Adopted from ../examples/obj-file-demo.js; credits to original author */
/* Slight modifications are mare */
export class CarShape extends Shape {
    constructor(textureName) {
        super("position", "normal", "texture_coord");
        this.phase = Math.random();
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file('/assets/car/car.obj');
        this.material = {
            shader: new defs.Textured_Phong(1), color: color(.5, .5, .5, 1),
            ambient: .3, diffusivity: 0.1, specularity: 1,
            texture: new Texture(`/assets/car/${textureName}`)
        };
    }

    load_file(filename) {                             // Request the external file and wait for it to load.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => { throw "OBJ file loader:  OBJ file either not found or is of unsupported format." })
    }

    parse_into_mesh(data) {                           // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = []; unpacked.norms = []; unpacked.textures = [];
        unpacked.hashindices = {}; unpacked.indices = []; unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/; var NORMAL_RE = /^vn\s/; var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/; var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) { j = 2; quad = true; }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const { verts, norms, textures } = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(caller, uniforms, model_transform) {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        
        if (!this.ready) return;
        let t = uniforms.animation_time/1000.0;
        model_transform.pre_multiply(Mat4.translation(0,0.33 + 
            Math.sin((2+this.phase/2)*Math.PI*t + this.phase)/48 // realistic hover
            ,0));
       // model_transform = model_transform.times(Mat4.scale(1.3,1.3,1.3));
        super.draw(caller, uniforms, model_transform, this.material);
    }

}