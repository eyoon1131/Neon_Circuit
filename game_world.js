import { tiny, defs } from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// TODO: you should implement the required classes here or in another file.

class Curve_Shape extends Shape {
    // curve_function: (t) => vec3
    constructor(curve_function, sample_count, curve_color = color(1, 0, 0, 1)) {
        super("position", "normal");

        this.material = { shader: new defs.Phong_Shader(), ambient: 1.0, color: curve_color }
        this.sample_count = sample_count;

        if (curve_function && this.sample_count) {
            for (let i = 0; i < this.sample_count + 1; i++) {
                let t = i / this.sample_count;
                this.arrays.position.push(curve_function(t));
                this.arrays.normal.push(vec3(0, 0, 0)); // have to add normal to make Phong shader work.
            }
        }
    }

    draw(webgl_manager, uniforms) {
        // call super with "LINE_STRIP" mode
        super.draw(webgl_manager, uniforms, Mat4.identity(), this.material, "LINE_STRIP");
    }

    update(webgl_manager, uniforms, curve_function) {
        if (curve_function && this.sample_count) {
            for (let i = 0; i < this.sample_count + 1; i++) {
                let t = 1.0 * i / this.sample_count;
                this.arrays.position[i] = curve_function(t);
            }
        }
        // this.arrays.position.forEach((v, i) => v = curve_function(i / this.sample_count));
        this.copy_onto_graphics_card(webgl_manager.context);
        // Note: vertex count is not changed.
        // not tested if possible to change the vertex count.
    }
}

class Spline {
    constructor() {
        this.points = [];
        this.tangents = [];
        this.scaled_tangents = [];
        this.size = 0;
    }

    add_point(x, y, z, tx, ty, tz) {
        this.points.push(vec3(x, y, z));
        this.tangents.push(vec3(tx, ty, tz));
        this.scaled_tangents.push(vec3(0, 0, 0));
        this.size += 1;
        this.scale_tangents();
    }

    scale_tangents() {
        for (let i = 0; i < this.size; i++) {
            this.scaled_tangents[i] = this.tangents[i].times(1 / (this.size - 1));
        }
    }

    get_position(t) {
        if (this.size < 2) { return vec3(0, 0, 0); }

        const A = Math.floor(t * (this.size - 1)); // A = T(i)
        const B = Math.ceil(t * (this.size - 1)); // B = T(i + 1)
        const s = (t * (this.size - 1)) % 1.0 // T - T(i)

        let a = this.points[A].copy();
        let b = this.points[B].copy();
        let ta = this.scaled_tangents[A].copy();
        let tb = this.scaled_tangents[B].copy();

        return a.times(2 * (s ** 3) - 3 * (s ** 2) + 1)
            .plus(b.times(-2 * (s ** 3) + 3 * (s ** 2)))
            .plus(ta.times((s ** 3) - 2 * (s ** 2) + s))
            .plus(tb.times((s ** 3) - (s ** 2)))
    }
}

class Particle {
    constructor() {
        this.mass = 0;
        this.pos = vec3(0, 0, 0);
        this.vel = vec3(0, 0, 0);
        this.acc = vec3(0, 0, 0);
        this.ext_force = vec3(0, 0, 0);
        this.valid = false;
    }

    update(sim, dt) {
        if (!this.valid)
            throw "Not initialized"
        // forward euler
        if (sim.integ_tech === 1) {
            this.acc = this.ext_force.times(1.0 / this.mass);
            this.pos = this.pos.plus(this.vel.times(dt));
            this.vel = this.vel.plus(this.acc.times(dt));
        }
        else if (sim.integ_tech === 2) {
            this.acc = this.ext_force.times(1.0 / this.mass);
            this.vel = this.vel.plus(this.acc.times(dt));
            this.pos = this.pos.plus(this.vel.times(dt));
        }
        else if (sim.integ_tech === 3) {
            this.pos = this.pos.plus(this.vel.times(dt)).plus(this.acc.times(dt ** 2 / 2));
            const new_acc = this.ext_force.times(1.0 / this.mass);
            this.vel = this.vel.plus(this.acc.plus(new_acc).times(dt / 2));
            this.acc = new_acc;
        }
    }
}

class Spring {
    constructor() {
        this.particle1 = null;
        this.particle2 = null;
        this.ks = 0;
        this.kd = 0;
        this.rest_length = 0;
        this.valid = false;
    }

    update() {
        if (!this.valid)
            throw "Not initialized"
        const d_ij_vec = this.particle2.pos.minus(this.particle1.pos);
        const d_ij = d_ij_vec.norm();
        const d_ij_unit = d_ij_vec.times(1.0 / d_ij);
        const v_ij_vec = this.particle2.vel.minus(this.particle1.vel);
        const fs_ij = d_ij_unit.times(this.ks * (d_ij - this.rest_length));
        const fd_ij = d_ij_unit.times(this.kd * v_ij_vec.dot(d_ij_unit));
        const fe_ij = fs_ij.plus(fd_ij);
        this.particle1.ext_force.add_by(fe_ij);
        this.particle2.ext_force.subtract_by(fe_ij);
    }
}

class Simulation {
    constructor() {
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
    }

    update(dt) {
        for (const p of this.particles) {
            // add gravity
            p.ext_force = this.g_acc.times(p.mass);
            // add ground collision and damping
            // calculate ground forces
            let next_pos = p.pos.plus(p.vel.times(dt));
            if (next_pos[1] < 0) {
                const unit_nor = vec3(0, 1, 0);
                const collision_dt = (p.pos[1] / (p.pos[1] - next_pos[1])) * dt;
                const collision_pos = p.pos.plus(p.vel.times(collision_dt));
                let deflected_vec = next_pos.minus(collision_pos);
                deflected_vec[1] = -deflected_vec[1];
                //const exit_pos = next_pos.plus(deflected_vec);
                const nor_force = unit_nor.times(this.ground_ks * (deflected_vec.dot(unit_nor))).minus(
                    unit_nor.times(this.ground_kd * (p.vel.dot(unit_nor))));
                p.ext_force.add_by(nor_force);
            }
            if (this.accel_pressed)
                p.ext_force.add_by(vec3(0, 0, 1));
            if (this.brake_pressed)
                p.ext_force.add_by(vec3(0, 0, -1));
            if (this.left_pressed)
                p.ext_force.add_by(vec3(1, 0, 0));
            if (this.right_pressed)
                p.ext_force.add_by(vec3(-1, 0, 0));

        }
        for (const s of this.springs) {
            s.update();
        }
        for (const p of this.particles) {
            p.update(this, dt);
        }
    }
}

import { HermiteFactory, Track } from './track/track-generate.js';

export
    const game_world_base = defs.game_world_base =
        class game_world_base extends Component {                                          // **My_Demo_Base** is a Scene that can be added to any display canvas.
            // This particular scene is broken up into two pieces for easier understanding.
            // The piece here is the base class, which sets up the machinery to draw a simple
            // scene demonstrating a few concepts.  A subclass of it, Part_one_hermite,
            // exposes only the display() method, which actually places and draws the shapes,
            // isolating that code so it can be experimented with on its own.
            init() {
                console.log("init")

                // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
                this.hover = this.swarm = false;
                // At the beginning of our program, load one of each of these shape
                // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
                // would be redundant to tell it again.  You should just re-use the
                // one called "box" more than once in display() to draw multiple cubes.
                // Don't define more than one blueprint for the same thing here.
                this.shapes = {
                    'box': new defs.Cube(),
                    'ball': new defs.Subdivision_Sphere(4),
                    'axis': new defs.Axis_Arrows()
                };

                // *** Materials: ***  A "material" used on individual shapes specifies all fields
                // that a Shader queries to light/color it properly.  Here we use a Phong shader.
                // We can now tweak the scalar coefficients from the Phong lighting formulas.
                // Expected values can be found listed in Phong_Shader::update_GPU().
                const phong = new defs.Phong_Shader();
                const tex_phong = new defs.Textured_Phong();
                this.materials = {};
                this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color(.9, .5, .9, 1) }
                this.materials.metal = { shader: phong, ambient: .2, diffusivity: 1, specularity: 1, color: color(.9, .5, .9, 1) }
                this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture("assets/rgb.jpg") }

                this.ball_location = vec3(1, 1, 1);
                this.ball_radius = 0.25;

                // TODO: you should create the necessary shapes
                this.spline = new Spline();
                this.spline.add_point(-5, 2, 0, 10, 0, 0);
                this.spline.add_point(0, 2, 0, 10, 0, 0);
                this.spline.add_point(5, 2, 0, 10, 0, 0);
                const curve_fn = (t) => this.spline.get_position(t);
                this.curve = new Curve_Shape(curve_fn, 1000);
                this.simulation = new Simulation();
                this.simulation.particles.push(new Particle());
                this.simulation.particles[0].mass = 1.0;
                this.simulation.particles[0].pos = vec3(0, 0, 0.0);
                this.simulation.particles[0].vel = vec3(0, 0.0, 0.0);
                this.simulation.particles[0].valid = true;
                this.simulation.g_acc = vec3(0, -9.8, 0);
                this.simulation.ground_ks = 15000;
                this.simulation.ground_kd = 2000;
                this.simulation.integ_tech = 2;
                this.simulation.timestep = 0.001;

                // prepare the track
                const hermiteCurvePoints = [
                    vec3(-5, -0.1, -5),
                    vec3(-5, 0.5, 5),
                    vec3(5, 0.5, 5),
                    vec3(5, 0.5, -5),
                    vec3(-5, -0.1, -5)
                ], hermiteCurveTangents = [
                    vec3(-20, 0, 20),
                    vec3(20, 0, 20),
                    vec3(20, 0, -20),
                    vec3(-20, 0, -20),
                    vec3(-20, 0, 20)
                ];
                const hermiteFunction =
                    HermiteFactory(hermiteCurvePoints, hermiteCurveTangents);
                this.shapes.track = new Track(2, 0.8, 0.4, 0.1, hermiteFunction, 64);
            }

            render_animation(caller) {                                                // display():  Called once per frame of animation.  We'll isolate out
                // the code that actually draws things into Part_one_hermite, a
                // subclass of this Scene.  Here, the base class's display only does
                // some initial setup.

                // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
                if (!caller.controls) {
                    this.animated_children.push(caller.controls = new defs.Movement_Controls({ uniforms: this.uniforms }));
                    caller.controls.add_mouse_controls(caller.canvas);

                    // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
                    // matrix follows the usual format for transforms, but with opposite values (cameras exist as
                    // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
                    // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
                    // orthographic() automatically generate valid matrices for one.  The input arguments of
                    // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

                    // !!! Camera changed here
                    Shader.assign_camera(Mat4.look_at(
                        this.simulation.particles[0].pos.minus(vec3(0, -5, 10)), this.simulation.particles[0].pos, vec3(0, 1, 0)), this.uniforms);
                }
                this.uniforms.projection_transform = Mat4.perspective(Math.PI / 4, caller.width / caller.height, 1, 100);

                // *** Lights: *** Values of vector or point lights.  They'll be consulted by
                // the shader when coloring shapes.  See Light's class definition for inputs.
                const t = this.t = this.uniforms.animation_time / 1000;
                const angle = Math.sin(t);

                // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
                // !!! Light changed here
                const light_position = vec4(20 * Math.cos(angle), 20, 20 * Math.sin(angle), 1.0);
                this.uniforms.lights = [defs.Phong_Shader.light_source(light_position, color(1, 1, 1, 1), 1000000)];

                // draw axis arrows.
                this.shapes.axis.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb);

                //this.curve = new Curve_Shape(this.spline.get_position(t), 1000);
            }
        }


export class game_world extends game_world_base {                                                    // **Part_one_hermite** is a Scene object that can be added to any display canvas.
    // This particular scene is broken up into two pieces for easier understanding.
    // See the other piece, My_Demo_Base, if you need to see the setup code.
    // The piece here exposes only the display() method, which actually places and draws
    // the shapes.  We isolate that code so it can be experimented with on its own.
    // This gives you a very small code sandbox for editing a simple scene, and for
    // experimenting with matrix transformations.
    render_animation(caller) {                                                // display():  Called once per frame of animation.  For each shape that you want to
        // appear onscreen, place a .draw() call for it inside.  Each time, pass in a
        // different matrix value to control where the shape appears.

        // Variables that are in scope for you to use:
        // this.shapes.box:   A vertex array object defining a 2x2x2 cube.
        // this.shapes.ball:  A vertex array object defining a 2x2x2 spherical surface.
        // this.materials.metal:    Selects a shader and draws with a shiny surface.
        // this.materials.plastic:  Selects a shader and draws a more matte surface.
        // this.lights:  A pre-made collection of Light objects.
        // this.hover:  A boolean variable that changes when the user presses a button.
        // shared_uniforms:  Information the shader needs for drawing.  Pass to draw().
        // caller:  Wraps the WebGL rendering context shown onscreen.  Pass to draw().

        // Call the setup code that we left inside the base class:
        super.render_animation(caller);

        /**********************************
         Start coding down here!!!!
         **********************************/
        // From here on down it's just some example shapes drawn for you -- freely
        // replace them with your own!  Notice the usage of the Mat4 functions
        // translation(), scale(), and rotation() to generate matrices, and the
        // function times(), which generates products of matrices.

        const blue = color(0, 0, 1, 1), yellow = color(0.7, 1, 0, 1), red = color(1, 0, 0, 1);

        const t = this.t = this.uniforms.animation_time / 1000;
        let t_step = t;
        let dt = this.dt = Math.min(1 / 30, this.uniforms.animation_delta_time / 1000);

        let part_vel_xz = this.simulation.particles[0].vel;
        //part_vel_xz[1] =
        Shader.assign_camera(Mat4.look_at(
            this.simulation.particles[0].pos.plus(vec3(0, 5, -10)), this.simulation.particles[0].pos, vec3(0, 1, 0)), this.uniforms);

        // !!! Draw ground
        let floor_transform = Mat4.translation(0, -1, 0).times(Mat4.scale(10, 0.01, 10));
        this.shapes.box.draw(caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow });

        // !!! Draw ball (for reference)
        let ball_transform = Mat4.translation(this.ball_location[0], this.ball_location[1], this.ball_location[2])
            .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
        this.shapes.ball.draw(caller, this.uniforms, ball_transform, { ...this.materials.metal, color: blue });

        // TODO: you should draw spline here.
        this.curve.draw(caller, this.uniforms);

        const t_next = t_step + dt;
        while (t_step < t_next) {
            this.simulation.update(this.simulation.timestep);
            //this.simulation.particles[0].pos = this.spline.get_position(Math.sin(t / 4) ** 2);
            //console.log(Math.sin(t / 50) ** 2);
            t_step += this.simulation.timestep;
        }
        // from discussion slides
        for (const p of this.simulation.particles) {
            const pos = p.pos;
            let model_transform = Mat4.scale(0.2, 0.2, 0.2);
            model_transform.pre_multiply(Mat4.translation(pos[0], pos[1], pos[2]));
            this.shapes.ball.draw(caller, this.uniforms, model_transform, { ...this.materials.plastic, color: blue });
        }
        for (const s of this.simulation.springs) {
            const p1 = s.particle1.pos;
            const p2 = s.particle2.pos;
            const len = p2.minus(p1).norm();
            const center = p1.plus(p2).times(0.5);
            let model_transform = Mat4.scale(0.05, len / 2, 0.05);

            const p = p1.minus(p2).normalized();
            let v = vec3(0, 1, 0);
            if (Math.abs(v.cross(p).norm()) < 0.1) {
                v = vec3(0, 0, 1);
                model_transform = Mat4.scale(0.05, 0.05, len / 2);
            }
            const w = v.cross(p).normalized();

            const theta = Math.acos(v.dot(p));
            model_transform.pre_multiply(Mat4.rotation(theta, w[0], w[1], w[2]));
            model_transform.pre_multiply(Mat4.translation(center[0], center[1], center[2]));
            this.shapes.box.draw(caller, this.uniforms, model_transform, { ...this.materials.metal, color: red });

        }
        // render the track with some debug info
        this.shapes.track.draw(caller, this.uniforms, Mat4.identity(), { ...this.materials.plastic, color: color(0.6,0.6,0.6,0.99) });
        for (let p of this.shapes.track.arrays.position) {
            let model_transform = Mat4.scale(0.05, 0.05, 0.05);
            model_transform.pre_multiply(Mat4.translation(p[0], p[1], p[2]));
            this.shapes.ball.draw(caller, this.uniforms, model_transform, { ...this.materials.plastic, color: red });
        }
        for (let [p, bs] of this.shapes.track.pb) {
            let model_transform = Mat4.scale(0.1, 0.1, 0.1);
            model_transform.pre_multiply(Mat4.from([
                [bs[0][0], bs[1][0], bs[2][0], 0],
                [bs[0][1], bs[1][1], bs[2][1], 0],
                [bs[0][2], bs[1][2], bs[2][2], 0],
                [0, 0, 0, 1],
            ]));
            model_transform.pre_multiply(Mat4.translation(p[0], p[1], p[2]));
            this.shapes.axis.draw(caller, this.uniforms, model_transform,  { ...this.materials.plastic, color: color(0,1,0,1) });
        }
    }

    render_controls() {                                 // render_controls(): Sets up a panel of interactive HTML elements, including
        // buttons with key bindings for affecting this scene, and live info readouts.
        this.control_panel.innerHTML += "Part Three: (no buttons)";
        this.new_line();

        this.key_triggered_button("Accelerate", ["i"],
            () => this.simulation.accel_pressed = true, "#6E6460",
            () => this.simulation.accel_pressed = false);
        this.key_triggered_button("Brake", ["k"],
            () => this.simulation.brake_pressed = true, "#6E6460",
            () => this.simulation.brake_pressed = false);
        this.new_line();
        this.key_triggered_button("Left", ["j"],
            () => this.simulation.left_pressed = true, "#6E6460",
            () => this.simulation.left_pressed = false);
        this.new_line();
        this.key_triggered_button("Right", ["l"],
            () => this.simulation.right_pressed = true, "#6E6460",
            () => this.simulation.right_pressed = false);


        /* Some code for your reference
        this.key_triggered_button( "Copy input", [ "c" ], function() {
          let text = document.getElementById("input").value;
          console.log(text);
          document.getElementById("output").value = text;
        } );
        this.new_line();
        this.key_triggered_button( "Relocate", [ "r" ], function() {
          let text = document.getElementById("input").value;
          const words = text.split(' ');
          if (words.length >= 3) {
            const x = parseFloat(words[0]);
            const y = parseFloat(words[1]);
            const z = parseFloat(words[2]);
            this.ball_location = vec3(x, y, z)
            document.getElementById("output").value = "success";
          }
          else {
            document.getElementById("output").value = "invalid input";
          }
        } );
         */
    }

    parse_commands() {
        document.getElementById("output").value = "parse_commands";
        //TODO
    }

    start() { // callback for Run button
        document.getElementById("output").value = "start";
        //TODO
    }
}
