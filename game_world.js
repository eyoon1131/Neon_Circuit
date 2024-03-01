import {tiny, defs} from './examples/common.js';
import {Car, Particle} from "./new_scripts/particle.js";
import {Spring} from "./new_scripts/spring.js";
import {Simulation} from "./new_scripts/simulation.js";
import {Curve_Shape} from "./new_scripts/shapes.js";
import {Spline} from "./new_scripts/spline.js";

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// TODO: you should implement the required classes here or in another file.

// class Car extends Particle {
//     constructor() {
//         super();
//         this.forward_dir = vec3(0, 0, 0);
//     }
//     update(sim, dt) {
//         super.update(sim, dt);
//         if (this.vel[0] !== 0 || this.vel[2] !== 0) {
//             const vel_zx = this.vel.normalized();
//             //vel_zx[1] = 0;
//             if (this.forward_dir.dot(vel_zx) > 0)
//                 this.forward_dir = vel_zx;
//         }
//         console.log(this.vel.norm())
//     }
// }

export
const game_world_base = defs.game_world_base =
    class game_world_base extends Component
    {                                          // **My_Demo_Base** is a Scene that can be added to any display canvas.
                                               // This particular scene is broken up into two pieces for easier understanding.
                                               // The piece here is the base class, which sets up the machinery to draw a simple
                                               // scene demonstrating a few concepts.  A subclass of it, Part_one_hermite,
                                               // exposes only the display() method, which actually places and draws the shapes,
                                               // isolating that code so it can be experimented with on its own.
        init()
        {
            console.log("init")

            // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
            this.hover = this.swarm = false;
            // At the beginning of our program, load one of each of these shape
            // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
            // would be redundant to tell it again.  You should just re-use the
            // one called "box" more than once in display() to draw multiple cubes.
            // Don't define more than one blueprint for the same thing here.
            this.shapes = { 'box'  : new defs.Cube(),
                'ball' : new defs.Subdivision_Sphere( 4 ),
                'axis' : new defs.Axis_Arrows() };

            // *** Materials: ***  A "material" used on individual shapes specifies all fields
            // that a Shader queries to light/color it properly.  Here we use a Phong shader.
            // We can now tweak the scalar coefficients from the Phong lighting formulas.
            // Expected values can be found listed in Phong_Shader::update_GPU().
            const phong = new defs.Phong_Shader();
            const tex_phong = new defs.Textured_Phong();
            this.materials = {};
            this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
            this.materials.metal   = { shader: phong, ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) }
            this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) }

            this.ball_location = vec3(1, 1, 1);
            this.ball_radius = 0.25;

            // TODO: you should create the necessary shapes
            // track setup
            this.spline = new Spline();
            this.spline.add_point(0, 0, 50,-200, 0, 0);
            this.spline.add_point(-50, 0, 0, 0, 0, -200);
            this.spline.add_point(0, 0, -50, 200, 0, 0);
            this.spline.add_point(50, 0, 0, 0, 0, 200);
            this.spline.add_point(0, 0, 50, -200, 0, 0);
            const curve_fn = (t) => this.spline.get_position(t);
            this.curve = new Curve_Shape(curve_fn, 1000);
            this.simulation = new Simulation();

            // car setup
            this.simulation.particles.push(new Car());
            let car = this.simulation.particles[0];
            car.mass = 1.0;
            car.pos = vec3(0, 0, 50);
            car.vel = vec3(0, 0.0, 0.0);
            car.valid = true;
            car.forward_dir = vec3(-1, 0, 0);
            car.scale_factors = vec3(0.2, 0.2, 0.2);

            this.simulation.g_acc = vec3(0, -9.8, 0);
            this.simulation.ground_ks = 5000;
            this.simulation.ground_kd = 10;
            //this.simulation.integ_tech = 2;
            this.simulation.timestep = 0.001;
            this.simulation.u_kinetic = 0.8;
            this.simulation.u_static = 0.6;
            this.simulation.track_fn = curve_fn;
            this.simulation.track_width = 10;
        }

        render_animation( caller )
        {                                                // display():  Called once per frame of animation.  We'll isolate out
            // the code that actually draws things into Part_one_hermite, a
            // subclass of this Scene.  Here, the base class's display only does
            // some initial setup.

            // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
            if( !caller.controls )
            { this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
                caller.controls.add_mouse_controls( caller.canvas );

                // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
                // matrix follows the usual format for transforms, but with opposite values (cameras exist as
                // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
                // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
                // orthographic() automatically generate valid matrices for one.  The input arguments of
                // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

                // !!! Camera changed here
                const car = this.simulation.particles[0];
                const at = car.pos;
                //const eye = at.minus(car.forward_dir)
                const eye_to_at = car.forward_dir.times(10).plus(vec3(0, -5, 0));
                Shader.assign_camera( Mat4.look_at (
                    at.minus(eye_to_at), at, vec3 (0, 1, 0)), this.uniforms );
            }
            this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 1, 100 );

            // *** Lights: *** Values of vector or point lights.  They'll be consulted by
            // the shader when coloring shapes.  See Light's class definition for inputs.
            const t = this.t = this.uniforms.animation_time/1000;
            const angle = Math.sin( t );

            // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
            // !!! Light changed here
            const light_position = vec4(20 * Math.cos(angle), 20,  20 * Math.sin(angle), 1.0);
            this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];

            // draw axis arrows.
            this.shapes.axis.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb);

            //this.curve = new Curve_Shape(this.spline.get_position(t), 1000);
        }
    }


export class game_world extends game_world_base
{                                                    // **Part_one_hermite** is a Scene object that can be added to any display canvas.
                                                     // This particular scene is broken up into two pieces for easier understanding.
                                                     // See the other piece, My_Demo_Base, if you need to see the setup code.
                                                     // The piece here exposes only the display() method, which actually places and draws
                                                     // the shapes.  We isolate that code so it can be experimented with on its own.
                                                     // This gives you a very small code sandbox for editing a simple scene, and for
                                                     // experimenting with matrix transformations.
    render_animation( caller )
    {                                                // display():  Called once per frame of animation.  For each shape that you want to
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
        super.render_animation( caller );

        /**********************************
         Start coding down here!!!!
         **********************************/
            // From here on down it's just some example shapes drawn for you -- freely
            // replace them with your own!  Notice the usage of the Mat4 functions
            // translation(), scale(), and rotation() to generate matrices, and the
            // function times(), which generates products of matrices.

        const blue = color( 0,0,1,1 ), yellow = color( 0.7,1,0,1 ), red = color(1, 0, 0, 1);

        const t = this.t = this.uniforms.animation_time/1000;
        let t_step = t;
        let dt = this.dt = Math.min(1 / 30, this.uniforms.animation_delta_time / 1000);

        //let part_vel_xz = this.simulation.particles[0].vel;
        //part_vel_xz[1] =
        const car = this.simulation.particles[0];
        const at = car.pos;
        //const eye = at.minus(car.forward_dir)
        const eye_to_at = car.forward_dir.times(10).plus(vec3(0, -5, 0));
        //console.log(this.simulation.particles[0].pos.minus(this.simulation.particles[0].pos.minus(vec3(10, -5, 0))))
        Shader.assign_camera( Mat4.look_at (
            at.minus(eye_to_at), at, vec3 (0, 1, 0)), this.uniforms );

        // !!! Draw ground
        let floor_transform = Mat4.translation(0, -0.2, 0).times(Mat4.scale(100, 0.01, 100));
        this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );

        // !!! Draw ball (for reference)
        let ball_transform = Mat4.translation(this.ball_location[0], this.ball_location[1], this.ball_location[2])
            .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
        this.shapes.ball.draw( caller, this.uniforms, ball_transform, { ...this.materials.metal, color: blue } );

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
        //console.log("render");
        for (const p of this.simulation.particles) {
            const pos = p.pos;
            const scale = p.scale_factors;
            let model_transform = Mat4.scale(scale[0], scale[1], scale[2]);
            let theta = p.get_rotation();
            model_transform.pre_multiply(Mat4.rotation(-theta, 0, 1, 0));
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
    }

    render_controls()
    {                                 // render_controls(): Sets up a panel of interactive HTML elements, including
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
