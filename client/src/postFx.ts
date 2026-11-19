// Task 110: the town's post-processing pipeline and its bloom.
//
// Chain (three 0.187, three/examples/jsm/postprocessing):
//   RenderPass    scene -> half-float HDR target (linear, no tone mapping; three skips it for targets)
//   UnrealBloomPass  bright parts blurred (at half resolution, mips below) and added back in HDR
//   OutputPass    owns ACES, exposure, the Task 109 grade and sRGB, exactly as the in-shader path did
//
// Three things keep the picture the same as the direct render:
//   1. The output shader is the stock OutputShader with the Task 109 grade (mtGrade) put in front of
//      ACES, from the same chunk the materials use, so the grade has one source (atmosphere.ts).
//   2. The sky dome is a raw ShaderMaterial that never went through tone mapping. It writes alpha 0 and
//      every tone-mapped surface writes alpha 1 (opaque) or its coverage (blended), so alpha is a "this pixel
//      is tone-mapped" mask: the output shader leaves mask-0 pixels as they are and the bloom ignores them.
//   3. The two speech-bubble plates are toneMapped:false (the white must stay white). They live on
//      OVERLAY_LAYER, are left out of the HDR pass and drawn straight to the screen after it, only while a
//      bubble is showing.
// With bloom off (low graphics, software GL, a light tier) the town renders directly as before and no
// target is allocated at all.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/** Every bloom knob, in one place. Ask for more glow by raising strength; for a wider glow, radius; for
 *  fewer things glowing, raise the threshold. Values are linear HDR (1.0 = a white surface in full sun). */
export const BLOOM = {
  /** How much glow is added back (0 = none). */
  strength: 0.32,
  /** How far it spreads (0 tight .. 1 wide). */
  radius: 0.35,
  /** Linear luminance above which a pixel starts to glow, by day and by night. The night value is lower
   *  because the lamps, the moon and the stars are dim in absolute terms but the brightest things in the frame. */
  thresholdDay: 1.1,
  thresholdNight: 0.95,
  /** At night the glow is a touch stronger so the lamps read as pools of light. */
  strengthNight: 0.35,
  /** How soft the threshold edge is (0 hard). */
  smoothWidth: 0.35,
  /** The most light one pixel may feed the bloom (linear), so a source far over the threshold (a lamp halo
   *  right at the camera) glows like a bright one rather than flooding the frame. */
  ceiling: 1.6,
} as const;

/** Objects on this layer are drawn straight to the screen after the HDR chain (the speech-bubble plates). */
export const OVERLAY_LAYER = 1;

/** The bloom parameters for a given darkness (0 day .. 1 night): the single place the look is computed. */
export function bloomLook(nightMix: number, look: typeof BLOOM = BLOOM): { strength: number; threshold: number; radius: number } {
  const k = Math.min(1, Math.max(0, nightMix));
  return {
    strength: look.strength + (look.strengthNight - look.strength) * k,
    threshold: look.thresholdDay + (look.thresholdNight - look.thresholdDay) * k,
    radius: look.radius,
  };
}

/** The stock OutputShader fragment, with the grade in front of ACES and the tone-mapped mask applied. */
export function patchOutputShader(fragment: string): string {
  const aces = "ACESFilmicToneMapping( gl_FragColor.rgb )";
  if (!fragment.includes(aces) || !fragment.includes("gl_FragColor = texture2D( tDiffuse, vUv );")) {
    throw new Error("OutputShader changed: update patchOutputShader");
  }
  return fragment
    .replace("gl_FragColor = texture2D( tDiffuse, vUv );", "gl_FragColor = texture2D( tDiffuse, vUv );\n\t\t\tvec3 mtRaw = gl_FragColor.rgb;\n\t\t\tfloat mtMask = clamp( gl_FragColor.a, 0.0, 1.0 );")
    .replace(aces, "ACESFilmicToneMapping( mtGrade( gl_FragColor.rgb ) )")
    .replace(/\}\s*$/, "\n\t\t\tgl_FragColor = vec4( mix( mtRaw, gl_FragColor.rgb, mtMask ), 1.0 );\n\t\t}");
}

/** Bright pass that ignores pixels the output will not tone-map (the sky dome). */
export function patchHighPass(fragment: string, ceiling: number = BLOOM.ceiling): string {
  const lum = "float v = luminance( texel.xyz );";
  if (!fragment.includes(lum)) throw new Error("LuminosityHighPassShader changed: update patchHighPass");
  return fragment.replace(lum, `float v = luminance( texel.xyz ) * texel.a;\n\t\t\ttexel.rgb = min( texel.rgb, vec3( ${ceiling.toFixed(3)} ) );`);
}

export interface PostFxOptions {
  /** MSAA samples for the HDR target (0 on phones, which also render without antialiasing). */
  samples: number;
  look?: typeof BLOOM;
}

export class PostFx {
  readonly composer: EffectComposer;
  readonly renderPass: RenderPass;
  readonly bloomPass: UnrealBloomPass;
  readonly outputPass: OutputPass;
  /** Set by the scene: is a layer-1 object (a bubble plate) showing right now? */
  overlayActive: () => boolean = () => false;
  private look: typeof BLOOM;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.Camera, opts: PostFxOptions) {
    this.look = opts.look ?? BLOOM;
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x * pr), Math.max(1, size.y * pr), {
      type: THREE.HalfFloatType,
      samples: opts.samples,
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(size.x, size.y);
    this.renderPass = new RenderPass(scene, camera);
    // The bloom pass halves whatever it is given for its first mip, so a full-size composer gives it half
    // resolution; the lower mips halve again.
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x * pr, size.y * pr), this.look.strength, this.look.radius, this.look.thresholdDay);
    this.bloomPass.materialHighPassFilter.fragmentShader = patchHighPass(this.bloomPass.materialHighPassFilter.fragmentShader);
    (this.bloomPass.highPassUniforms as { smoothWidth: { value: number } }).smoothWidth.value = this.look.smoothWidth;
    // Add light to the colour, leave the tone-mapped mask (alpha) alone.
    const blend = this.bloomPass.blendMaterial;
    blend.blending = THREE.CustomBlending;
    blend.blendEquation = THREE.AddEquation;
    blend.blendSrc = THREE.OneFactor;
    blend.blendDst = THREE.OneFactor;
    blend.blendSrcAlpha = THREE.ZeroFactor;
    blend.blendDstAlpha = THREE.OneFactor;
    this.outputPass = new OutputPass();
    this.outputPass.material.fragmentShader = patchOutputShader(this.outputPass.material.fragmentShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
  }

  /** Canvas size in CSS pixels plus the renderer's current pixel ratio. */
  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  /** Bloom on or off while the chain stays built (the "pipeline only" state used to compare against the direct render). */
  setBloomEnabled(on: boolean): void {
    this.bloomPass.enabled = on;
  }

  /** nightMix 0 (day) .. 1 (night). */
  setLook(nightMix: number): void {
    const l = bloomLook(nightMix, this.look);
    this.bloomPass.strength = l.strength;
    this.bloomPass.threshold = l.threshold;
    this.bloomPass.radius = l.radius;
  }

  render(dt: number): void {
    const r = this.renderer;
    // The chain makes several renderer.render calls; keep the frame's draw-call count whole for the perf line.
    r.info.autoReset = false;
    r.info.reset();
    this.camera.layers.disable(OVERLAY_LAYER);
    this.composer.render(dt);
    if (this.overlayActive()) {
      const mask = this.camera.layers.mask;
      const auto = r.autoClear;
      const shadows = r.shadowMap.autoUpdate;
      // A colour background forces a clear whatever autoClear says: take it away for this pass.
      const background = this.scene.background;
      this.scene.background = null;
      this.camera.layers.set(OVERLAY_LAYER);
      r.autoClear = false;
      r.shadowMap.autoUpdate = false;
      r.setRenderTarget(null);
      r.render(this.scene, this.camera);
      this.scene.background = background;
      r.shadowMap.autoUpdate = shadows;
      r.autoClear = auto;
      this.camera.layers.mask = mask;
    }
    r.info.autoReset = true;
  }

  dispose(): void {
    this.composer.dispose();
    this.renderPass.dispose();
    this.bloomPass.dispose();
    this.outputPass.dispose();
  }
}
