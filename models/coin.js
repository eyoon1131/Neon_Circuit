import { tiny} from '../examples/common.js';
import { TexturedModel } from '../models/textured-model.js';
// Pull these names into this module's scope for convenience:
const { Mat4 } = tiny;

/* Adopted from ../examples/obj-file-demo.js; credits to original author */
/* The reason for doing this is to avoid referencing Examples */
export class CoinShape extends TexturedModel {
    constructor(textureName) {
        super('/assets/coin.obj','/assets/coin.png',{ ambient: 0.4, diffusivity: 0.3});
        this.phase = Math.random();
    }
    draw(caller, uniforms, model_transform) {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        
        if (!this.ready) return;
        let t = uniforms.animation_time/1000.0;
        
        model_transform.pre_multiply(Mat4.translation(0,0.4 + 
            Math.sin((2+this.phase/2)*Math.PI*t + this.phase)/4 // realistic hover
            ,0));
        model_transform = model_transform.times(Mat4.rotation(t,0,1,0));
        model_transform = model_transform.times(Mat4.scale(2,2,2));
        super.draw(caller, uniforms, model_transform);
    }
}