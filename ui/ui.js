import {defs, tiny} from '../examples/common.js';
import {Scene2Texture, SceneDrawer} from "./scene2texture.js";

const {
    Vector, Vector3, vec, vec3, vec4, color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

const YELLOW = color(1, 0.7, 0.2, 1);

/**
 * need to keep time string length fixed to avoid problems with text rendering
 * */
function formatTime(seconds) {
    var minutes = Math.floor(seconds / 60);
    var remainingSeconds = Math.floor(seconds % 60);
    var milliseconds = Math.floor((seconds - Math.floor(seconds)) * 1000);
    
    // Ensure each component has two digits
    minutes = minutes < 10 ? ' ' + minutes : minutes;
    remainingSeconds = remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds;
    milliseconds = milliseconds < 10 ? '00' + milliseconds : (milliseconds < 100 ? '0' + milliseconds : milliseconds);
    
    return `${minutes}:${remainingSeconds}:${milliseconds}`;
}

/** 
* @param {Integer} num input number
* @param {Integer} digits
* @returns padd number with spaces so output string is fixed len.
*/
function format(num, digits) {
    var str = num.toString();
    return ' '.repeat(digits - str.length) + str;
}

function format_leaderboard_entry(entry) {
    return `${entry[0]}: ${formatTime(entry[1])}`;
}



/**
 * UI is the base class for all 2D UI elements.
 */
export class UI {
    static camera_transform = Mat4.identity();
    static camera_inverse = Mat4.identity();
    static turn = 0;

    constructor() {
        this.projection_inverse = Mat4.identity();
    }
    /**
     * Update camera transform. Must be called before draw each time the camera is moved.
     * @param look_at The current camera transform of the scene.
     */
    static update_camera(look_at) {
        UI.camera_transform = look_at;
        // console.log(look_at, Mat4.inverse(look_at))
        UI.camera_inverse = Mat4.inverse(look_at);
    }

    /**
     * Calculate the transform of the UI given the camera transform.
     * @param x_offset The x offset of the UI.
     * @param y_offset The y offset of the UI.
     * @param width The width of the UI.
     * @param height The height of the UI.
     */
    get_transform(x_offset, y_offset, width, height) {
        return this.get_transform_custom_cam_projection(x_offset, y_offset, width, height, UI.camera_inverse, this.projection_inverse);
    }

    get_transform_custom_cam_projection(x_offset, y_offset, width, height, camera_inverse, projection_inverse) {
        // First, get the transform of the UI in camera space.
        let transform = Mat4.identity();
        //console.log("0", transform, Mat4.identity(), camera_inverse, projection_inverse)
        transform.post_multiply(camera_inverse);
        //console.log("1", transform, Mat4.identity().post_multiply(camera_inverse))
        transform.post_multiply(projection_inverse);
        //console.log("2", transform,  Mat4.identity().post_multiply(camera_inverse).post_multiply(projection_inverse))

        // Then, properly scale and translate the UI.
        transform.post_multiply(Mat4.translation(x_offset, y_offset, 0));
        //console.log("3", transform)

        transform.post_multiply(Mat4.scale(width, height, 1));
        //console.log("4", transform, Mat4.identity().post_multiply(camera_inverse).post_multiply(projection_inverse).post_multiply(Mat4.translation(x_offset, y_offset, 0)).post_multiply(Mat4.scale(width, height, 1)))


        return transform;
    }

    draw(caller, uniforms) {
        this.projection_inverse = Mat4.inverse(uniforms.projection_transform);
    }
}


/**
 * Displays top banner of game name.
 */
export class TopBanner extends UI {
    constructor() {
        super();

        // const background_color = color("#f6f7dc", 0.65);
        // const background_fade_color = color("#2e4354", 0.7);
        // const text_color = color("#ffffff");
        // const text_border_color = color("#2e4354", 1);

        const background_color = color(0.15, 0.22, 0.28, 0.8);
        const background_fade_color = color(0.27, 0.27, 0.3, 0.6);
        const text_color = color(1, 1, 1, 1);
        const text_border_color = color(0.15, 0.29, 0.35, 1);

        this.shapes = {
            square: new defs.Square(),
        };

        this.materials = {
            background_fade: {
                shader: new FadeShader(background_fade_color, 0.5, 0.8), 
                ambient: 1,
                diffusivity: 0,
                specularity: 0,
                color: background_color,
            },
            background: {
                shader: new defs.Phong_Shader(), 
                ambient: 1,
                diffusivity: 0,
                specularity: 0,
                color: background_color,
            }
        };

        this.text = new TextLine('Untitled Marble Racer', "gentleman", text_color, text_border_color);
        this.text.set_position(0, .99, 0.002);
        this.text.set_extra_space(2.5);

        this._enabled = true;

        this.laps_completed = new TextLine('Laps Completed', "roboto-regular", text_color, text_border_color)
        this.laps_completed.set_position(-0.6, 0.8, 0.001);
        this.laps_completed.set_extra_space(2.5);


        this.race_time = 0;
        this.time_text1 = new TextLine('Time', "roboto-regular", text_color, text_border_color)
        this.time_text1.set_position(0.5, 0.8, 0.001);
        this.time_text1.set_extra_space(2.5);
        this.time_text = new TextLine('0', "roboto-regular", text_color, text_border_color)
        this.time_text.set_position(0.7, 0.8, 0.001);
        this.time_text.set_extra_space(2.5);
    }

    update_time(time) {
        this.race_time = time;
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
    }

    draw(caller, uniforms) {
        super.draw(caller, uniforms);

        if (!this._enabled) return;

        // Draw background.
        const bg_transform = super.get_transform(0, 1.13, 1, 0.3);
        bg_transform.post_multiply(Mat4.translation(0, 0, 0.01));
        this.shapes.square.draw(caller, uniforms, bg_transform, this.materials.background_fade);

        // Draw text.
        this.text.text = `Untitled Marble Racer`;
        this.text.draw(caller, uniforms);

        this.laps_completed.text = `Laps Completed: ${format(caller.laps_completed, 3)}`;
        this.laps_completed.draw(caller, uniforms);

        this.time_text1.draw(caller, uniforms);

        this.time_text.text = formatTime(this.race_time)
        this.time_text.draw(caller, uniforms);


    }
}
export class CarAvatar extends UI {
    constructor(car_shapes) {
        super();
        // Register sub-scene drawers
        this.car_drawers = [];
        this.car_shapes = car_shapes;
        this.shapes = {
            circle: new defs.Regular_2D_Polygon(1, 30)
        }
        this.car_materials = {}
        this.car_positions = [-1, -1, -1, -1]
        for (let i = 0; i < 4; i++) {
            this.car_drawers.push(new SceneDrawer(256, 256, ((c, p) => this.draw_car(c, p, i)).bind(this)));
            Scene2Texture.register(this.car_drawers[i]);
            this.car_materials[i] = {
                shader: new defs.Textured_Phong(1),
                ambient: 1,
                texture: this.car_drawers[i].texture,
            }
            console.log(this.car_drawers[i].texture)
        }
        this._enabled = false;
    }

    enable() {
        this._enabled = true;
    }

    update_positions(leaderboard_stats) {
        for (let i = 0; i < 4; i++) {
            if (i < leaderboard_stats.length)
                this.car_positions[i] = leaderboard_stats[i][0]-1;
            else
                this.car_positions[i] = -1;
        }
    }
    // use this to draw car as texture
    draw_car(caller, uniforms, i) {
        uniforms.projection_transform = Mat4.perspective(Math.PI / 4, caller.width / caller.height, 1, 10000);

        // Camera and lighting rotation.
        const rotate_r = 3.8;
        let cam_x = 0;
        let cam_y = rotate_r;

        uniforms.camera_inverse = Mat4.look_at(vec3(cam_x, 1, cam_y), vec3(0, 0, 0), vec3(0, 1, 0));

        // Display object
        let obj_tr = Mat4.identity();
        obj_tr.post_multiply(Mat4.rotation(2*Math.PI/3, 0, -1, 0));

        this.car_shapes[(i+1).toString()].draw(caller, uniforms, obj_tr);
    }

    draw(caller, uniforms) {
        super.draw(caller, uniforms);
        const aspect_ratio = caller.width / caller.height;

        // Draw player avatars
        const avatar_scale = 0.6;
        const avatar_width = 0.1 * avatar_scale;
        const avatar_height = avatar_width * aspect_ratio;
        for (let i = 0; i < 4; i++) {
            const avatar_transform = super.get_transform(
                0.6,
                0.4 - i*2*avatar_height,
                avatar_width, 
                avatar_height
            );
            avatar_transform.post_multiply(Mat4.scale(avatar_scale, avatar_scale, 1));
            // console.log(this.car_materials[i])
            // console.log(this.car_positions[i])
            if (this.car_positions[i] !== -1)
                this.shapes.circle.draw(caller, uniforms, avatar_transform, this.car_materials[this.car_positions[i]]);
        }
    }
}

export class Leaderboard extends UI {
    constructor(num_entries = 4) {
        super();

        const LEADERBOARD_HOFFSET = 0.7;
        const LEADERBOARD_VOFFSET = 0.6;
        const background_color = color(0.15, 0.22, 0.28, 0.8);
        const background_fade_color = color(0.27, 0.27, 0.3, 0.6);
        const text_color = color(1, 1, 1, 1);
        const text_border_color = color(0.15, 0.29, 0.35, 1);

        this.shapes = {
            square: new defs.Square(),
        };

        this.materials = {
            background_fade: {
                shader: new FadeShader(background_fade_color, 0.5, 0.8), 
                ambient: 1,
                diffusivity: 0,
                specularity: 0,
                color: background_color,
            },
            background: {
                shader: new defs.Phong_Shader(), 
                ambient: 1,
                diffusivity: 0,
                specularity: 0,
                color: background_color,
            }
        };

        this.text = new TextLine('Leaderboard', "gentleman", text_color, text_border_color);
        this.text.set_position(LEADERBOARD_HOFFSET, LEADERBOARD_VOFFSET, 0.0015);
        this.text.set_extra_space(2.5);

        this.num_entries = num_entries;
        this.leaderboard_stats = [];
        for (let i = 0; i < num_entries; i++) {
            this.leaderboard_stats.push(new TextLine(' '.repeat(12), "roboto-regular", text_color, text_border_color));
            this.leaderboard_stats[i].set_position(LEADERBOARD_HOFFSET, LEADERBOARD_VOFFSET - 0.2 - 0.1 * i, 0.001);
            this.leaderboard_stats[i].set_extra_space(2.5);
        }

        this._enabled = true;
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
    }

    update(leaderboard_stats) {
        for (let i = 0; i < this.num_entries; i++) {
            if (i < leaderboard_stats.length) {
                this.leaderboard_stats[i].text = format_leaderboard_entry(leaderboard_stats[i]);
            } else {
                this.leaderboard_stats[i].text = ' '.repeat(12);
            }
        }
    }

    draw(caller, uniforms) {
        super.draw(caller, uniforms);

        if (!this._enabled) return;

        // // Draw background.
        // const bg_transform = super.get_transform(0, 0.9, 1, 0.3);
        // bg_transform.post_multiply(Mat4.translation(0, 0, 0.01));
        // this.shapes.square.draw(caller, uniforms, bg_transform, this.materials.background_fade);

        // Draw text.
        this.text.draw(caller, uniforms);
        for (let i = 0; i < this.num_entries; i++) {
            this.leaderboard_stats[i].draw(caller, uniforms);
        }
    }



}

/**
 * Super class for UI Animations
 */
export class UIAnimation extends UI {
    constructor() {
        super();

        this.start_time = 0;
        this.started = false;
    }

    start() {
        this.start_time = this.time_now ? this.time_now : 0;
        this.started = true;
    }

    end() {
        this.started = false;
    }

    draw(caller, uniforms) {
        super.draw(caller, uniforms);
        this.time_now = uniforms.animation_time / 1000;
    }
}


/**
 * Animates the start of race
 */
export class StartAnimation extends UIAnimation {
    constructor() {
        super();
        this.text = new TextLine(' 3 ', 'gentleman', YELLOW, color(1, 1, 1, 1));
    }

    draw(caller, uniforms) {
        super.draw(caller, uniforms);
        // console.log(this.time_now)

        if (!this.started) return;

        const dt = this.time_now - this.start_time;
        // console.log("Race start draw", dt)

        const ease_func = (x) => 1.5 * Math.pow(2, -5 * x) + 0.5;

        const end_time = 1;

        let scale;
        if (dt < 3 ) {
            scale = 0.1 + 0.9 * ease_func((dt / end_time)%1.0);
        } else {
            scale = 1 + Math.sin((dt - end_time) * 3) * 0.02;
        }

        if (dt > 1) {
            this.text.text = " 2 ";
        }
        if (dt > 2) {
            this.text.text = " 1 ";
        }
        if (dt > 3) {
            this.text.text = "Go!";
        }

        this.text.set_position(0, 0.25, 0.005 * scale);
        this.text.draw(caller, uniforms);
    }
}

export class LapAnimation extends UIAnimation {
    constructor() {
        super();

        const font = "roboto-blackItalic";

        this.text = new TextLine("Lap!", font, YELLOW, color(1, 1, 1, 1));
        this.text.set_extra_space(0.5);

        this.parallelogram = new defs.Parallelogram(0.01);
        this.bg_material = {shader: new defs.Phong_Shader(), 
            ambient: 1,
            color: color(1,1,1,1)
        };

        this.ended = false;
    }

    final_lap(leaderboard_stats) {
        let i = 0;
        for (const entry of leaderboard_stats) {
            if (entry[0] === 1) {
                switch(i) {
                    case 0:
                        this.text.text = "1st Place!";
                        break;
                    case 1:
                        this.text.text = "2nd Place!";
                        break;
                    case 2:
                        this.text.text = "3rd Place!";
                        break;
                    default:
                        this.text.text = `${i+1}th Place!`;
                }
            }
            i++;
        }
    }

    update(lap_number, goal_laps) {
        this.text.text = `Lap ${lap_number}/ ${goal_laps} !`;
    }

    draw(caller, uniforms) {
        super.draw(caller, uniforms);
        if (!this.started) return;

        const t = this.time_now - this.start_time;
        console.log("Lap draw", t)

        // Helper functions
        const prefix_sum = (arr, i) => arr.slice(0, i + 1).reduce((a, b) => a + b, 0);
        const ease_in = (x) => 1.07 * (1 - Math.pow(1 - 0.6 * x, 3));
        const ease_out = (x) => Math.pow(0.6 * x + 0.4, 3);

        // Configure animation
        const timeline_pos = [
            0.5,  // Move in
            1,    // Slides to right
            0.5,  // Move out
        ];
        const timeline_alpha = [
            0.3,  // Fade in
            1.4,  // Keep
            0.3,  // Fade out
        ];
        const low_alpha = 0;
        const factor = 0.3;
        const factor_banner = 1

        let left_text = -0.4 * factor;
        let slide_left_text = -0.1 * factor;
        let left_banner = -2.2 * factor_banner;
        let slide_left_banner = -0 * factor_banner;

        this.ended = false;

        // Calculate pos
        let text_pos, upper_banners_pos, lower_banners_pos;
        if (t < prefix_sum(timeline_pos, 0)) {
            text_pos = left_text + (slide_left_text - left_text) * ease_in(t / prefix_sum(timeline_pos, 0));
            upper_banners_pos = left_banner + (slide_left_banner - left_banner) * ease_in(t / prefix_sum(timeline_pos, 0));
            lower_banners_pos = -upper_banners_pos;
        } else if (t < prefix_sum(timeline_pos, 1)) {
            let dist = -2 * slide_left_text + 0.02 * factor;
            text_pos = slide_left_text + dist * (t - prefix_sum(timeline_pos, 0)) / timeline_pos[1];
            let dist2 = -2 * slide_left_banner + 0.02 * factor_banner;
            upper_banners_pos = slide_left_banner + dist2 * (t - prefix_sum(timeline_pos, 0)) / timeline_pos[1];
            lower_banners_pos = -upper_banners_pos;
        } else if (t < prefix_sum(timeline_pos, 2)) {
            text_pos = -slide_left_text + (-left_text + slide_left_text) * (ease_out((t - prefix_sum(timeline_pos, 1)) / timeline_pos[2]));
            upper_banners_pos = -slide_left_banner + (-left_banner + slide_left_banner) * (ease_out((t - prefix_sum(timeline_pos, 1)) / timeline_pos[2]));
            lower_banners_pos = -upper_banners_pos;
        } else {
            this.ended = true;
            return;
        }

        // Calculate alpha
        let alpha;
        if (t < prefix_sum(timeline_alpha, 0)) {
            alpha = low_alpha + (1 - low_alpha) * ease_in(t / prefix_sum(timeline_alpha, 0));
        } else if (t < prefix_sum(timeline_alpha, 1)) {
            alpha = 1;
        } else if (t < prefix_sum(timeline_alpha, 2)) {
            alpha = 1 - (1 - low_alpha) * ease_out((t - prefix_sum(timeline_alpha, 1)) / timeline_alpha[2]);
        } else {
            this.ended = true;
            return;
        }

        const text = this.text;
        text.set_alpha(alpha);
        text.set_position(text_pos, 0.08, 0.002);
        text.draw(caller, uniforms);

        let tr = super.get_transform(upper_banners_pos, 0.18, 1.2, .06);
        this.parallelogram.draw(caller, uniforms, tr, {...this.bg_material, color: color(1, 0.9, 0, 1)});
        tr = super.get_transform(lower_banners_pos, -0.18, 1.2, .06);
        this.parallelogram.draw(caller, uniforms, tr, {...this.bg_material, color: color(1, 0.9, 0, 1)});
        tr = super.get_transform(0, 0, 1.2, .12);
        this.parallelogram.draw(caller, uniforms, tr, {...this.bg_material, color: color(1, 1, 1, alpha)});
    }
}

/**
 * TextLine is a wrapper for TextShape object for drawing 2d text on the screen.
 */
export class TextLine extends UI {
    /**
     * @param text -- The text to draw
     * @param font -- The name of the font. "font.json" and "font.png" must be in the assets/fonts folder.
     * @param text_color -- The color of the text
     * @param background_color -- The color of the background
     */
    constructor(text, font, text_color = color(1, 1, 1, 1), background_color = color(0, 0, 0, 0)) {
        super();
        this.text = text;
        this.color = text_color;
        this.extra_space = 0;

        this.shader = new SdfFontShader(background_color);

        // Load font description json
        fetch(`assets/fonts/${font}.json`)
            .then(res => res.json())
            .then(data => {
                this.text_shape = new TextShape(data);
                this.text_texture = {
                    shader: this.shader, 
                    texture: new Texture(`assets/fonts/${font}.png`),
                };
            });
    }
    /**
     * Set the position and scale of the text.
     * @param x -- The x position of the text
     * @param y -- The y position of the text
     * @param size -- The size of the text
     */
    set_position(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
    }

    /**
     * Set the color of the text.
     * @param color -- The color of the text
     */
    set_color(color) {
        this.color = color;
    }

    /**
     * Set background color of the text.
     * @param color -- The color of the background
     */
    set_bg_color(color) {
        this.shader.bg_color = color;
    }

    /**
     * Set alpha of the text.
     * @param alpha -- The alpha of the text
     */
    set_alpha(alpha) {
        this.color[3] = alpha;
        this.shader.bg_color[3] = alpha;
    }



    /**
     * Set extra spacing between characters.
     * @param extra_space -- The extra spacing between characters
     */
    set_extra_space(extra_space) {
        this.extra_space = extra_space;
    }

    /**
     * Call this function per frame.
     */
    draw(caller, uniforms) {
        super.draw(caller, uniforms);

        // Skip if any of the required data is not loaded or given yet
        if (this.x === undefined || this.y === undefined || this.size === undefined || !this.text_shape) return;

        this.text_shape.set_string(this.text, caller.context, this.extra_space);

        const aspect_ratio = caller.width / caller.height;
        let left_shift = this.text_shape.text_width / 2 * this.size;
        const transform = super.get_transform(this.x - left_shift, this.y, this.size, this.size * aspect_ratio);

        this.text_shape.draw(caller, uniforms, transform, {...this.text_texture, color: this.color});
    }
}

/**
 * TestShape is a 2d shape object that can draw texts with various fonts.
 */
class TextShape extends Shape {
    /**
     * @param desc -- The font description object of the sdf texture.
     */
    constructor(desc) {
        super("position", "normal", "texture_coord");

        this.set_desc(desc);
    }

    set_desc(desc) {
        this.desc = desc;
        this.texture_width = desc.common.scaleW;
        this.texture_height = desc.common.scaleH;
        this.string = "";
    }

    /**
     * Set the string to be drawed.
     * @param string -- The string to be drawed.
     * @param caller -- The canvas caller.
     * @param extra_space -- The extra space between characters.
     */
    set_string(string, caller, extra_space = 0) {
        // Only update if the string is different.
        if (string === this.string) return;
        this.string = string;

        // Clear the old vertices and indices.
        this.arrays.position = [];
        this.arrays.normal = [];
        this.arrays.texture_coord = [];
        this.indices = [];

        let last_id = null; // The id of the last character.
        let last_x = 0;     // The x position of the end of last character.
        let count = 0;      // The number of characters so far.

        for (const ch of string) {
            const desc = this.get_char_desc(ch);

            // Record the length of the texture coord length for trimming later.
            const tc_length = this.arrays.texture_coord.length;

            // Fetch description values.
            let id = desc.id,
                x = desc.x,
                y = desc.y,
                width = desc.width,
                height = desc.height,
                xoffset = desc.xoffset,
                yoffset = desc.yoffset,
                xadvance = desc.xadvance;

            if (last_id !== null) {
                // Apply kerning
                xoffset += this.get_kerning(last_id, id);
                xoffset += extra_space;
            }
            last_id = id;

            // Construct transformation matrix of current character
            const transform = Mat4.identity();
            // Render later characters on top of earlier ones
            transform.post_multiply(Mat4.translation(0, 0, -0.001 * count++));
            // Scale to character size
            transform.post_multiply(Mat4.scale(width / 2, height / 2, 1));
            // Move top-left corner to origin
            transform.post_multiply(Mat4.translation(1, -1, 0));
            // Move to character position
            transform.post_multiply(Mat4.translation((last_x + xoffset) / width * 2, -yoffset / height * 2, 0));

            // Create square and insert into this
            // Note: this step inserts 4 extra vertices into texture array, so we need to trim it.
            defs.Square.insert_transformed_copy_into(this, [], transform);
            this.arrays.texture_coord = this.arrays.texture_coord.slice(0, tc_length)

            // Record x position of next character
            last_x += xadvance + xoffset;
            this.text_width = last_x;

            // Construct texture coordinates
            const left = x / this.texture_width, right = (x + width) / this.texture_width;
            const top = y / this.texture_height, bottom = (y + height) / this.texture_height;
            this.arrays.texture_coord.push(...Vector.cast([left, 1 - bottom], [right, 1 - bottom],
                [left, 1 - top], [right, 1 - top]));
        }

        this.copy_onto_graphics_card(caller);
    }

    /**
     * Get the character description object of a character.
     * @param ch -- The character. If not found, return the description of "?".
     * @returns {Object} -- The character description object.
     */
    get_char_desc(ch) {
        const res = this.desc.chars.find((c) => c.char === ch);
        if (res === undefined) {
            return this.get_char_desc('?');
        }
        return res;
    }

    /**
     * Get the kerning value of two characters. If not found, return 0.
     * @param id1 -- The id of the first character.
     * @param id2 -- The id of the second character.
     * @returns {number}
     */
    get_kerning(id1, id2) {
        const res = this.desc.kernings.find((k) => k.first === id1 && k.second === id2);
        if (res === undefined) {
            return 0;
        }
        return res.amount;
    }
}


/**
 * Customized Phong shader for SDF text rendering. Supports overwriting the color of the text.
 */
class SdfFontShader extends defs.Textured_Phong {
    constructor(bg_color = color(0, 0, 0, 0)) {
        super();

        this.bg_color = bg_color;
    }

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                uniform sampler2D texture;
                uniform vec4 bg_color;
        
                void main() {
                    // Sample the texture image in the correct place:
                    vec4 tex_color = texture2D( texture, f_tex_coord );
                    if (tex_color.a < 0.01) discard;
                    
                    // Calculate the correct color of SDF text.
                    float alpha = smoothstep(0., 1., tex_color.a);
                    if (tex_color.a < 0.45) 
                        alpha = 0.0;
                    
//                    gl_FragColor = mix(bg_color, vec4(shape_color.rgb, 1.), alpha);
                    if (tex_color.a < .5)
                        gl_FragColor = mix(bg_color, vec4(shape_color.rgb, 1.), alpha);
                    else
                        gl_FragColor = shape_color;
                  } `;
    }

    update_GPU(caller, gpu_addresses, gpu_state, model_transform, material) {
        super.update_GPU(caller, gpu_addresses, gpu_state, model_transform, material);

        // Send bg_color to GPU
        caller.uniform4fv(gpu_addresses.bg_color, this.bg_color);
    }
}


class FadeShader extends Shader {
    constructor(mix_color, pos_percent = 0.4, max_percent = 0.8) {
        super();

        this.pos_percent = pos_percent;
        this.mix_color = mix_color;
        this.max_percent = max_percent;
    }

    shared_glsl_code() {
        return `
            precision mediump float;
            varying vec4 point_position;
            varying vec4 center;
        `;
    }

    vertex_glsl_code() {
        return this.shared_glsl_code() + `
            attribute vec3 position;
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
            
            void main(){
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                point_position = model_transform * vec4(position, 1.0);
                center = model_transform * vec4(0, 0, 0, 1); 
            }`;
    }

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            uniform vec4 shape_color;
            uniform vec4 mix_color;
            uniform float pos_percent;
            uniform float max_percent;
    
            void main(){
                float dist = distance(point_position, center);
                vec4 color = shape_color;
                if (dist > pos_percent) {
                    color = mix(shape_color, mix_color, (dist - pos_percent) / (max_percent - pos_percent));
                }
                gl_FragColor = color;
            }`;
    }

    update_GPU(caller, gpu_addresses, gpu_state, model_transform, material) {
        super.update_GPU(caller, gpu_addresses, gpu_state, model_transform, material);

        // Send info to GPU
        caller.uniform1f(gpu_addresses.pos_percent, this.pos_percent);
        caller.uniform1f(gpu_addresses.max_percent, this.max_percent);

        // Send proj_cam matrix
        const [P, C, M] = [gpu_state.projection_transform, gpu_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        caller.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        caller.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Send color
        caller.uniform4fv(gpu_addresses.shape_color, material.color);
        caller.uniform4fv(gpu_addresses.mix_color, this.mix_color);
    }
}