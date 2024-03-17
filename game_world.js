import {defs, tiny} from './examples/common.js';
import {Curve, HermiteFactory, Track} from './track/track-generate.js';
import {Car, Enemy} from './new_scripts/particle.js';
import {Simulation} from './new_scripts/simulation.js';
import {detectTrackCollision, trackCollisionDebug} from './collision/collision-handling.js';

import {GameAnimation, TopBanner, LapAnimation, UI} from "./ui/ui.js";
import {Scene2Texture} from "./ui/scene2texture.js";

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// TODO: you should implement the required classes here or in another file.

const CAR_SCALE = 0.4;

const TRACK_WIDTH = 10;
const TRACK_HEIGHT = 0.1;
const TRACK_WALL_WIDTH = 0.8;
const TRACK_WALL_HEIGHT = 0.4;
const TRACK_DIVISIONS = 100;

const NUM_CARS = 4;


// UI
const START_ANIMATION_LENGTH = 4;

function get_start_offset(i) {
    // cars placed from -0.25 * TRACK_WIDTH to 0.25 * TRACK_WIDTH
    // user at -0.25 * TRACK_WIDTH
    //const car_num = i + 1;
    const car_spacing = TRACK_WIDTH * 0.5 / (NUM_CARS - 1);
    return -0.25 * TRACK_WIDTH + i * car_spacing;
}

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

                // simulation setup
                this.simulation = new Simulation();
                this.simulation.g_acc = vec3(0, -9.8, 0);
                this.simulation.ground_ks = 5000;
                this.simulation.ground_kd = 10;
                this.simulation.timestep = 0.001;
                this.simulation.u_kinetic = 0.8;
                this.simulation.u_static = 0.6;
                this.simulation.lap_goal = 5;
                // collision handling
                this.simulation.collision_funcs.push((sim) => detectTrackCollision(sim.particles[0], hermiteFunction, TRACK_WIDTH-TRACK_WALL_WIDTH/2, 2*car.scale_factors[0]));


                // this.simulation.track_width = 10;
                // this.simulation.integ_tech = 2;
                // this.simulation.track_fn = curve_fn;


                // prepare the track
                const hermiteCurvePoints = [
                    vec3(-15, -TRACK_HEIGHT, -15),
                    vec3(-15, -TRACK_HEIGHT, 15),
                    vec3(15, -TRACK_HEIGHT, 15),
                    vec3(15, -TRACK_HEIGHT, -15),
                    vec3(-15, -TRACK_HEIGHT, -15)
                ], hermiteCurveTangents = [
                    vec3(-100, 0, 100),
                    vec3(100, 0, 100),
                    vec3(100, 0, -100),
                    vec3(-100, 0, -100),
                    vec3(-100, 0, 100)
                ];
                const hermiteFunction=this.curve_fn =
                    HermiteFactory(hermiteCurvePoints, hermiteCurveTangents);
                this.shapes.track = new Track(
                    TRACK_WIDTH,
                    TRACK_WALL_WIDTH,
                    TRACK_WALL_HEIGHT,
                    TRACK_HEIGHT,
                    hermiteFunction,
                    TRACK_DIVISIONS
                );
                this.simulation.finish_line = hermiteCurvePoints[0];
                this.simulation.finish_line_slope = hermiteCurvePoints[0][0] / hermiteCurvePoints[0][2];

                const blue = color(0, 0, 1, 1), yellow = color(0.7, 1, 0, 1), red = color(1, 0, 0, 1), purple = color(0.5, 0, 0.5, 1);
                const colors = [blue, yellow, red, purple];

                // car setup
                this.simulation.particles.push(new Car());
                let car = this.simulation.particles[0];
                car.id = 1;
                car.mass = 1.0;
                //car.pos = vec3(hermiteCurvePoints[0][0] - 0.3 * TRACK_WIDTH, CAR_SCALE, hermiteCurvePoints[0][2] - 0.3 * TRACK_WIDTH);
                car.pos = vec3(hermiteCurvePoints[0][0] + get_start_offset(0), CAR_SCALE, hermiteCurvePoints[0][2] + get_start_offset(0));
                car.vel = vec3(0.0, 0.0, 0.0);
                car.valid = true;
                car.forward_dir = vec3(-1, 0, 1).normalized();
                car.scale_factors = vec3(CAR_SCALE, CAR_SCALE, CAR_SCALE);
                car.delta_pos = vec3(0, 0, 0);
                car.max_speed = 20;
                car.color = blue;

                this.shapes.curves = [];

                // ui
                this.game_animation = new GameAnimation();
                this.lap_animation = new LapAnimation();
                this.laps_completed = 0;
                this.top_banner = new TopBanner();
                this.ui = [this.top_banner, this.game_animation, this.lap_animation];
                for (let i = 1; i < NUM_CARS; i++) {
                    const enemyPathPoints = [
                        //hermiteCurvePoints[0].plus(vec3((i - 1) * 0.3 * TRACK_WIDTH , 0, (i - 1) * 0.3 * TRACK_WIDTH)),
                        hermiteCurvePoints[0].plus(vec3(get_start_offset(i), 0, get_start_offset(i))),
                        hermiteCurvePoints[1].plus(vec3((Math.random() - 0.5) * (TRACK_WIDTH - CAR_SCALE * 10), 0, (Math.random() - 0.5) * (TRACK_WIDTH - CAR_SCALE * 10))),
                        hermiteCurvePoints[2].plus(vec3((Math.random() - 0.5) * (TRACK_WIDTH - CAR_SCALE * 10), 0, (Math.random() - 0.5) * (TRACK_WIDTH - CAR_SCALE * 10))),
                        hermiteCurvePoints[3].plus(vec3((Math.random() - 0.5) * (TRACK_WIDTH - CAR_SCALE * 10), 0, (Math.random() - 0.5) * (TRACK_WIDTH - CAR_SCALE * 10))),
                        hermiteCurvePoints[4].plus(vec3(get_start_offset(i), 0, get_start_offset(i))),
                    ] , enemyPathTangents = [
                        hermiteCurveTangents[0],
                        hermiteCurveTangents[1],
                        hermiteCurveTangents[2],
                        hermiteCurveTangents[3],
                        hermiteCurveTangents[4]
                    ];
                    const enemyPathFunction = HermiteFactory(enemyPathPoints, enemyPathTangents);

                    // enemy 1
                    this.simulation.particles.push(new Enemy());
                    let car = this.simulation.particles[i];
                    car.id = i + 1;
                    car.mass = 1.0;
                    // car.pos = vec3(0, 0, 50);
                    car.pos = vec3(enemyPathPoints[0][0], CAR_SCALE, enemyPathPoints[0][2]);
                    car.vel = vec3(0, 0.0, 0.0);
                    car.valid = true;
                    car.scale_factors = vec3(CAR_SCALE, CAR_SCALE, CAR_SCALE);
                    car.delta_pos = vec3(0, 0, 0);
                    car.path_fn = enemyPathFunction;
                    car.max_speed = 20;
                    car.color = colors[i];

                    this.simulation.collision_funcs.push((sim) => detectTrackCollision(sim.particles[i], hermiteFunction, TRACK_WIDTH-TRACK_WALL_WIDTH/2, 2*car.scale_factors[0]));

                    //this.shapes.curve2 = new Curve([enemy2PathFunction, 0, 0], 1000);
                    this.shapes.curves.push(new Curve([enemyPathFunction, 0, 0], 1000));
                }
            }

            render_animation(caller) {                                                
                // display():  Called once per frame of animation.  We'll isolate out
                // the code that actually draws things into Part_one_hermite, a
                // subclass of this Scene.  Here, the base class's display only does
                // some initial setup.
                // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
                if (!caller.controls) {
                    //this.animated_children.push(caller.controls = new defs.Movement_Controls({ uniforms: this.uniforms }));
                    //caller.controls.add_mouse_controls(caller.canvas);

                    // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
                    // matrix follows the usual format for transforms, but with opposite values (cameras exist as
                    // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
                    // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
                    // orthographic() automatically generate valid matrices for one.  The input arguments of
                    // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

                    // // !!! Camera changed here
                    const car = this.simulation.particles[0];
                    const at = car.pos;
                    //const eye = at.minus(car.forward_dir)
                    const eye_to_at = car.forward_dir.times(10).plus(vec3(0, -5, 0));
                    Shader.assign_camera(Mat4.look_at(
                            at.minus(eye_to_at), at, vec3(0, 1, 0)), this.uniforms);
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

        const blue = color(0, 0, 1, 1), yellow = color(0.7, 1, 0, 1), red = color(1, 0, 0, 1), purple = color(0.5, 0, 0.5, 1);

        let t_step = this.t = this.uniforms.animation_time / 1000;
        let dt = this.dt = Math.min(1 / 30, this.uniforms.animation_delta_time / 1000);

        /**** UI setup *****/
        Scene2Texture.draw(caller, this.uniforms);
        if (!this.game_animation.started){
            this.game_animation.start()
        }
        this.game_animation.time_now = t_step;
        if (t_step > START_ANIMATION_LENGTH){
            this.game_animation.end()
        }
        
        if (this.simulation.particles[0].laps > this.laps_completed){
            console.log("lap completed")
            this.lap_animation.start();
            this.laps_completed = this.simulation.particles[0].laps;
        }

        if (t_step > 3){
            this.simulation.race_start = true;
            this.top_banner.update_time(t_step-3);
        }


        const car = this.simulation.particles[0];
        const at = car.pos;
        const eye_to_at = car.forward_dir.times(10).plus(vec3(0, -5, 0));
        if (!this.free_camera) {
            Shader.assign_camera(Mat4.look_at(
                at.minus(eye_to_at), at, vec3(0, 1, 0)), this.uniforms);
        }
        // !!! Draw ground
        let floor_transform = Mat4.translation(0, -1, 0).times(Mat4.scale(100, 0.01, 100));
        this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );

        const t_next = t_step + dt;
        while (t_step < t_next) {
            // handle track collision

            this.simulation.update(this.simulation.timestep);
            //this.simulation.particles[0].pos = this.spline.get_position(Math.sin(t / 4) ** 2);
            //console.log(Math.sin(t / 50) ** 2);
            t_step += this.simulation.timestep;
            // also handles it
        }
        // from discussion slides

        let i = 0;
        for (const p of this.simulation.particles) {
            const pos = p.pos;
            const scale = p.scale_factors;
            let model_transform = Mat4.scale(scale[0], scale[1], scale[2]);
            let theta = p.get_rotation();
            model_transform.pre_multiply(Mat4.rotation(-theta, 0, 1, 0));
            model_transform.pre_multiply(Mat4.translation(pos[0], pos[1], pos[2]));
            this.shapes.ball.draw(caller, this.uniforms, model_transform, { ...this.materials.plastic, color: p.color });
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

        // Collision debug section
        // let collision_debug_info = trackCollisionDebug(car, this.curve_fn, 5-0.8, 2*car.scale_factors[0]);
        // const track_center_pos = collision_debug_info.track_center;
        // const track_horizontal = collision_debug_info.track_horizontal;
        // const wall_pos = collision_debug_info.wall_pos;
        // const car_collision_point = collision_debug_info.car_collision_point;

        // let track_center_transform = Mat4.scale(0.05, 20, 0.05);
        // track_center_transform.pre_multiply(Mat4.translation(track_center_pos[0], track_center_pos[1], track_center_pos[2]));

        // let wall_transform = Mat4.scale(0.05, 20, 0.05);
        // wall_transform.pre_multiply(Mat4.translation(wall_pos[0], wall_pos[1], wall_pos[2]));

        // let car_collision_transform = Mat4.scale(0.05, 20, 0.05);
        // car_collision_transform.pre_multiply(Mat4.translation(car_collision_point[0], car_collision_point[1], car_collision_point[2]));

        // this.shapes.box.draw(caller, this.uniforms, track_center_transform, { ...this.materials.metal, color: color(0, 0, 1, 1) });
        // this.shapes.box.draw(caller, this.uniforms, wall_transform, { ...this.materials.metal, color: color(0, 1, 0, 1) });
        // this.shapes.box.draw(caller, this.uniforms, car_collision_transform, { ...this.materials.metal, color: color(1, 0, 0, 1) });

        // ui
        UI.update_camera(this.uniforms.camera_inverse);  // Only need to update camera once
        for (const i in this.ui) {
            this.ui[i].display(caller, this.uniforms);
        }
        // end ui

        for (let i = 0; i < this.shapes.curves.length; i++) {
            this.shapes.curves[i].draw(caller, this.uniforms, Mat4.identity(), { ...this.materials.plastic, color: color(0.6,0.6,0.6,0.99) });
        }

        let finish_line_transform = Mat4.scale(0.2, 0.01 , TRACK_WIDTH * 0.5);
        finish_line_transform.pre_multiply(Mat4.rotation(
            Math.atan(this.simulation.finish_line[0] / this.simulation.finish_line[2]),
            0, 1, 0
        ));
        finish_line_transform.pre_multiply(Mat4.translation(this.simulation.finish_line[0], this.simulation.finish_line[1], this.simulation.finish_line[2]));
        this.shapes.box.draw(caller, this.uniforms, finish_line_transform, { ...this.materials.metal, color: color(1, 1, 1, 1) });
    }

    render_controls() {                                 // render_controls(): Sets up a panel of interactive HTML elements, including
        // buttons with key bindings for affecting this scene, and live info readouts.
        this.control_panel.innerHTML += "Controls: <br>";

        this.key_triggered_button("Accelerate", ["w"],
            () => this.simulation.accel_pressed = true, "#6E6460",
            () => this.simulation.accel_pressed = false);
        this.key_triggered_button("Brake", ["s"],
            () => this.simulation.brake_pressed = true, "#6E6460",
            () => this.simulation.brake_pressed = false);
        this.new_line();
        this.key_triggered_button("Left",["a"],
            () => this.simulation.left_pressed = true, "#6E6460",
            () => this.simulation.left_pressed = false);
        this.key_triggered_button("Right", ["d"],
            () => this.simulation.right_pressed = true, "#6E6460",
            () => this.simulation.right_pressed = false);
        this.new_line();

        this.control_panel.innerHTML += "Alternative Controls: <br>";
        this.key_triggered_button("Accelerate", ["ArrowUp"],
            () => this.simulation.accel_pressed = true, undefined,
            () => this.simulation.accel_pressed = false);
        this.key_triggered_button("Brake", ["ArrowDown"],
            () => this.simulation.brake_pressed = true, undefined,
            () => this.simulation.brake_pressed = false);
        this.new_line();
        this.key_triggered_button("Left", ["ArrowLeft"],
            () => this.simulation.left_pressed = true, undefined,
            () => this.simulation.left_pressed = false);
        this.key_triggered_button("Right", ["ArrowRight"],
            () => this.simulation.right_pressed = true, undefined,
            () => this.simulation.right_pressed = false);
        this.new_line();

        this.control_panel.innerHTML += "Camera Controls: <br>";
        this.key_triggered_button("Attach/Detach Camera", ["Shift", "F"],
            () => this.free_camera =! this.free_camera);
        this.new_line();

        this.control_panel.innerHTML += "Game Options: <br>";
        this.key_triggered_button("Pause", ["Escape"],
            () => this.simulation.paused =! this.simulation.paused);


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
