import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SceneBuildError, describeSceneError } from "./sceneBuildError";
import { SceneRuntime } from "./sceneRuntime";
import * as THREE from "three";

describe("Task 42: the phone scene build", () => {
  function fakeRenderer() {
    const ratios: number[] = [];
    return {
      ratios,
      renderer: {
        setPixelRatio: (r: number) => ratios.push(r),
        getPixelRatio: () => ratios.at(-1) ?? 1,
        shadowMap: { enabled: true },
        info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } },
      } as unknown as THREE.WebGLRenderer,
    };
  }

  test("a phone's runtime starts light without calling back into the half-built scene", () => {
    const { renderer, ratios } = fakeRenderer();
    // The scene's resize touches its camera, which does not exist yet
    // while the runtime is built: a call here is the Nov 8 phone failure.
    const resize = () => {
      throw new ReferenceError("Cannot access 'viewAspect' before initialization");
    };
    const runtime = new SceneRuntime(renderer, new THREE.Scene(), 1, false, resize, true);
    expect(runtime.tier).toBe(1);
    expect(ratios.at(-1)).toBe(1);
    expect(renderer.shadowMap.enabled).toBe(false);
  });

  test("a desktop runtime is unchanged", () => {
    const { renderer, ratios } = fakeRenderer();
    let resized = 0;
    const runtime = new SceneRuntime(renderer, new THREE.Scene(), 1.5, false, () => resized++, false);
    expect(runtime.tier).toBe(2);
    expect(resized).toBe(0);
    expect(ratios).toEqual([]);
  });

  test("the scene ignores resize requests until its own first resize", () => {
    const src = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    expect(src).toMatch(/if \(sceneSized\) resize\(\);/);
    const first = src.indexOf("\n  resize();\n  sceneSized = true;");
    expect(first).toBeGreaterThan(src.indexOf("let viewAspect"));
    expect(first).toBeGreaterThan(src.indexOf("const camera = new THREE.PerspectiveCamera"));
  });

  test("the shell retries at the safest settings before the overlay", () => {
    const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
    expect(app).toContain("createTownScene(canvas, { ...sceneOpts, safeMode: true })");
    expect(app).toContain("setWebglError(detail)");
    expect(app).toContain("Copy the error");
    expect(app).not.toContain("WebGL seems unavailable");
  });
});

describe("describeSceneError", () => {
  test("names the error type and message", () => {
    expect(describeSceneError(new ReferenceError("Cannot access 'viewAspect' before initialization"))).toBe(
      "ReferenceError: Cannot access 'viewAspect' before initialization",
    );
    expect(describeSceneError(new Error("Error creating WebGL context."))).toBe("Error creating WebGL context.");
  });
  test("names both tries when the retry failed", () => {
    const err = new SceneBuildError(new TypeError("x is undefined"), new Error("Error creating WebGL context."));
    expect(describeSceneError(err)).toBe("TypeError: x is undefined; at the safest settings: Error creating WebGL context.");
  });
  test("survives odd throws and caps the length", () => {
    expect(describeSceneError(undefined)).toBe("undefined");
    expect(describeSceneError("lost")).toBe("lost");
    expect(describeSceneError(new Error("a".repeat(1000))).length).toBe(400);
  });
});
