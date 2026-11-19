import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as THREE from "three";
import { OutputShader } from "three/examples/jsm/shaders/OutputShader.js";
import { LuminosityHighPassShader } from "three/examples/jsm/shaders/LuminosityHighPassShader.js";
import { installAtmosphere, uninstallAtmosphere } from "./atmosphere";
import { BLOOM, OVERLAY_LAYER, PostFx, bloomLook, patchHighPass, patchOutputShader } from "./postFx";
import { SceneRuntime } from "./sceneRuntime";
import { readFileSync } from "node:fs";
import { join } from "node:path";

beforeAll(() => installAtmosphere());
afterAll(() => uninstallAtmosphere());

function fakeRenderer() {
  return {
    getPixelRatio: () => 1,
    getSize: (v: THREE.Vector2) => v.set(640, 360),
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 0.92,
    outputColorSpace: THREE.SRGBColorSpace,
  } as unknown as THREE.WebGLRenderer;
}

describe("post-processing pipeline and bloom (Task 110)", () => {
  test("the chain is RenderPass, UnrealBloomPass, OutputPass, in that order, on a half-float target", () => {
    const fx = new PostFx(fakeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { samples: 0 });
    expect(fx.composer.passes.map((p) => p.constructor.name)).toEqual(["RenderPass", "UnrealBloomPass", "OutputPass"]);
    expect(fx.composer.renderTarget1.texture.type).toBe(THREE.HalfFloatType);
    fx.dispose();
  });

  test("the output shader is the stock one with the Task 109 grade in front of ACES and the tone-mapped mask", () => {
    const stock = OutputShader.fragmentShader;
    const out = patchOutputShader(stock);
    // Stock ACES call is the only thing replaced, and it now goes through the same grade the materials use.
    expect(stock).toContain("ACESFilmicToneMapping( gl_FragColor.rgb )");
    expect(out).toContain("ACESFilmicToneMapping( mtGrade( gl_FragColor.rgb ) )");
    expect(out).toContain("sRGBTransferOETF");
    expect(out).toContain("mix( mtRaw, gl_FragColor.rgb, mtMask )");
    // The grade is a function of the shared tone-mapping chunk, so it has one source (atmosphere.ts).
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toContain("vec3 mtGrade");
    expect(THREE.ShaderChunk.tonemapping_pars_fragment).toContain("ACESFilmicToneMapping");
    // The exposure is the renderer's, unchanged.
    const fx = new PostFx(fakeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { samples: 0 });
    expect(fx.outputPass.material.fragmentShader).toBe(out);
    fx.dispose();
  });

  test("the baseline: the output shader without a mask (alpha 1) is the old in-shader chain, and the sky (alpha 0) passes raw", () => {
    const out = patchOutputShader(OutputShader.fragmentShader);
    // gl_FragColor ends as mix(raw, mapped, mask): mask 1 = mapped (what the materials did), mask 0 = raw (the sky dome).
    expect(out.trim().endsWith("}")).toBe(true);
    expect(out.indexOf("mtGrade( gl_FragColor.rgb )")).toBeLessThan(out.indexOf("sRGBTransferOETF"));
    expect(out.indexOf("sRGBTransferOETF")).toBeLessThan(out.indexOf("mix( mtRaw"));
    const src = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    expect(src).toContain("gl_FragColor = vec4(mix(horizonColor, topColor, k), maskAlpha);");
    expect(src).toContain("skyUniforms.maskAlpha.value = usePost ? 0 : 1;");
    expect(src).toContain("sprite.layers.set(OVERLAY_LAYER)");
    expect(OVERLAY_LAYER).toBe(1);
  });

  test("the bloom pass ignores untone-mapped pixels and leaves the mask alone when it adds light", () => {
    expect(patchHighPass(LuminosityHighPassShader.fragmentShader)).toContain("luminance( texel.xyz ) * texel.a");
    expect(patchHighPass(LuminosityHighPassShader.fragmentShader)).toContain("min( texel.rgb, vec3( 1.600 ) )"); // one blown-out source cannot flood the frame
    const fx = new PostFx(fakeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { samples: 0 });
    const blend = fx.bloomPass.blendMaterial;
    expect(blend.blendSrc).toBe(THREE.OneFactor);
    expect(blend.blendDst).toBe(THREE.OneFactor);
    expect(blend.blendSrcAlpha).toBe(THREE.ZeroFactor);
    expect(blend.blendDstAlpha).toBe(THREE.OneFactor);
    fx.dispose();
  });

  test("the bloom glows the bright sources and spares the rest: threshold sits above a sunlit wall by day, below the lamps by night", () => {
    const day = bloomLook(0), night = bloomLook(1);
    // Linear luminance: a lit white wall at noon is about 0.9; sun disc / glow are over 1.
    expect(day.threshold).toBeGreaterThanOrEqual(0.9);
    expect(day.strength).toBeLessThan(0.6); // gentle
    expect(night.threshold).toBeLessThan(day.threshold); // the lamps, moon and stars are dim in absolute terms
    expect(night.threshold).toBeGreaterThan(0.2); // but not the whole dark town
    expect(bloomLook(0.5).threshold).toBeCloseTo((day.threshold + night.threshold) / 2, 5);
    const fx = new PostFx(fakeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { samples: 0 });
    fx.setLook(1);
    expect(fx.bloomPass.threshold).toBe(BLOOM.thresholdNight);
    expect(fx.bloomPass.strength).toBe(BLOOM.strengthNight);
    fx.setLook(0);
    expect(fx.bloomPass.threshold).toBe(BLOOM.thresholdDay);
    fx.setBloomEnabled(false);
    expect(fx.bloomPass.enabled).toBe(false);
    fx.dispose();
  });

  test("the overlay pass draws only the bubble layer, on top of the screen, without clearing it", () => {
    const src = readFileSync(join(import.meta.dir, "postFx.ts"), "utf8");
    expect(src).toContain("this.scene.background = null;"); // a colour background would clear the frame
    expect(src).toContain("this.scene.background = background;");
    expect(src).toContain("r.autoClear = false;");
    expect(src).toContain("this.camera.layers.set(OVERLAY_LAYER)");
  });

  test("bloom runs at half resolution", () => {
    const fx = new PostFx(fakeRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { samples: 0 });
    expect(fx.bloomPass.renderTargetBright.width).toBe(320);
    expect(fx.bloomPass.renderTargetBright.height).toBe(180);
    fx.setSize(800, 400, 1.5);
    expect(fx.bloomPass.renderTargetBright.width).toBe(600);
    fx.dispose();
  });

  test("the low-graphics setting, software GL and the light tiers turn the chain off", () => {
    const r = { setPixelRatio() {}, shadowMap: { enabled: true }, info: {} } as unknown as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    const full = new SceneRuntime(r, scene, 1.5, false, () => {}, false);
    full.setAutomatic(false);
    // tier 2 only comes after the adaptive state settles; the setting itself is the gate under test.
    const tierIs2 = full.tier === 2;
    expect(full.bloomOn).toBe(tierIs2);
    full.setLightGraphics(true);
    expect(full.bloomOn).toBe(false);
    full.setLightGraphics(false);
    expect(full.bloomOn).toBe(full.tier === 2);
    const soft = new SceneRuntime(r, scene, 1, true, () => {}, false);
    expect(soft.bloomOn).toBe(false);
    const phone = new SceneRuntime(r, scene, 1, false, () => {}, true);
    expect(phone.tier).toBeLessThan(2);
    expect(phone.bloomOn).toBe(false);
  });

  test("the scene renders directly when the chain is off, and every capture goes through the one render function", () => {
    const src = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    expect(src.match(/renderer\.render\(scene, camera\)/g)?.length).toBe(1); // only inside renderFrame
    expect(src).toContain("renderFrame(dt);");
    expect(src.match(/renderFrame\(0\);/g)?.length).toBe(2); // visit frame, postcard
    expect(src).toContain("post.dispose(); post = null;"); // low graphics frees the targets
    expect(src).toContain("renderer.toneMapping = THREE.ACESFilmicToneMapping;"); // direct path and OutputPass both read it
    expect(src).toContain("renderer.toneMappingExposure = TONE_EXPOSURE;");
  });
});
