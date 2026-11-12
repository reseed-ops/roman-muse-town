import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface LampUpdate {
  /** A nearby lamp crossed its ignition threshold this frame. */
  ignitedNear: boolean;
  /** Quiet flame-bed volume, already attenuated by distance. */
  crackle: number;
}

export interface LampUpdateOptions {
  t: number;
  lampLevel: number;
  wetness: number;
  fog: boolean;
  rain: number;
  wind: number;
  season: "spring" | "summer" | "autumn" | "winter";
  tier: number;
  camera: THREE.Camera;
  listener: THREE.Vector3;
  reducedMotion: boolean;
  falseDream: boolean;
}

export interface CageOptions {
  /** Vertical distance from the cage centre to the surface below it. */
  groundOffset?: number;
  /** Street lamps cast wet reflections; small decorative lamps usually do not. */
  reflects?: boolean;
  /** Lower numbers catch first as dusk travels away from the forum. */
  ignitionOrder?: number;
}

export interface PostOptions {
  /** Local X direction of the road: the hanging lantern reaches this way. */
  inward?: -1 | 1;
  variant?: 0 | 1;
  ignitionOrder?: number;
}

interface Fixture {
  anchor: THREE.Group;
  flame: THREE.MeshBasicMaterial;
  halo: THREE.SpriteMaterial;
  groundOffset: number;
  reflects: boolean;
  phase: number;
  ignitionOrder: number;
  level: number;
  /** Latched: true from the ignition crossing until the level falls below the reset. */
  lit: boolean;
  position: THREE.Vector3;
}

export interface StreetLampSystem {
  buildCage: (scale?: number, opts?: CageOptions) => THREE.Group;
  buildPost: (opts?: PostOptions) => THREE.Group;
  update: (opts: LampUpdateOptions) => LampUpdate;
}

/** Heights (post-local, metres) the festival bunting and the arm share. */
export const LAMP_CAGE_Y = 2.26;
export const LAMP_CAGE_REACH = 0.51;
export const LAMP_ARM_Y = 2.8;
/** The bunting ropes are tied to the cleat on top of each plaza post here. */
export const LAMP_BUNTING_Y = 2.95;
/** Hard capacity of pool/reflection instances. */
export const LAMP_MAX_FIXTURES = 32;
/** A latched flame ignites once its level passes this, and resets below the second. */
export const LAMP_IGNITE_AT = 0.32;
export const LAMP_RESET_BELOW = 0.12;

/** The small dusk overlap keeps lamps from popping during a slow sky blend. */
export function lampIgnition(level: number, order: number): number {
  const start = 0.08 + THREE.MathUtils.clamp(order, 0, 1) * 0.32;
  return THREE.MathUtils.smoothstep(level, start, start + 0.22);
}

/** Local lights are the expensive part. Emissive flames and pools remain at every tier. */
export function lampLightBudget(tier: number): number {
  return tier >= 2 ? 4 : tier >= 1 ? 2 : 1;
}

function visibleThroughParents(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function radialTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const c = canvas.getContext("2d")!;
  const g = c.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, "rgba(255,210,124,1)");
  g.addColorStop(0.3, "rgba(255,177,72,.55)");
  g.addColorStop(1, "rgba(255,145,38,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The town's Roman-fantasy oil lights. The post is a stone-and-bronze
 * standard with a lantern hanging over the road, not a Victorian gas lamp.
 * Geometry and materials are shared between every fixture; only the tiny
 * flame and halo materials differ so each light can breathe independently.
 */
export function createStreetLampSystem(scene: THREE.Scene, world: THREE.Group): StreetLampSystem {
  const fixtures: Fixture[] = [];
  const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.62, metalness: 0.38 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8f8371, roughness: 0.94 });
  const terracotta = new THREE.MeshStandardMaterial({ color: 0x8f4d2f, roughness: 0.82, side: THREE.DoubleSide });
  const oilMaterial = new THREE.MeshStandardMaterial({ color: 0x3b2209, roughness: 0.15, metalness: 0 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x796c58,
    roughness: 0.22,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Shared geometries: no post allocates its own cylinders, bars or panes.
  // The masonry foot is taller than before but stays inside the old 0.3 collider radius.
  const octagonalBaseGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.5, 8);
  const squareBaseGeo = new THREE.BoxGeometry(0.44, 0.5, 0.44);
  const plinthGeo = new THREE.CylinderGeometry(0.13, 0.18, 0.13, 8);
  const shaftGeo = new THREE.CylinderGeometry(0.045, 0.065, 2.245, 8);
  const collarGeo = new THREE.CylinderGeometry(0.078, 0.078, 0.07, 8);
  const capitalGeo = new THREE.CylinderGeometry(0.075, 0.12, 0.13, 8);
  const armGeo = new THREE.BoxGeometry(0.62, 0.055, 0.055);
  const braceGeo = new THREE.BoxGeometry(0.38, 0.035, 0.035);
  const chainLinkGeo = new THREE.TorusGeometry(0.022, 0.0055, 5, 8);
  const hangRingGeo = new THREE.TorusGeometry(0.035, 0.008, 5, 10);
  const bossGeo = new THREE.CylinderGeometry(0.02, 0.026, 0.04, 6);
  const stalkGeo = new THREE.CylinderGeometry(0.014, 0.018, 0.075, 6);
  const cleatGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6);
  const cagePlateGeo = new THREE.BoxGeometry(0.4, 0.045, 0.4);
  const cageBarGeo = new THREE.BoxGeometry(0.035, 0.42, 0.035);
  const cageRoofGeo = new THREE.CylinderGeometry(0.12, 0.31, 0.13, 4);
  const cageGlassGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.36, 4, 1, true);
  const wickGeo = new THREE.CylinderGeometry(0.013, 0.017, 0.07, 6);
  const flameGeo = new THREE.ConeGeometry(0.052, 0.16, 7);

  const CAGE_SCALE_0 = 0.88;
  const CAGE_SCALE_1 = 0.82;
  const BRONZE = new THREE.Color(0x66503a);
  const TIMBER = new THREE.Color(0x5b4128);
  const WICK = new THREE.Color(0x5a4a30);
  // Cage-local oil lamp layout (before the cage scale).
  const HANG_RING_Y = 0.425;
  const HANG_RING_TOP = HANG_RING_Y + 0.043;
  const BOWL_R = 0.085;
  const BOWL_X = -0.015;
  const VESSEL_RIM_Y = -0.13;
  const OIL_FILL_Y = VESSEL_RIM_Y - 0.01;
  const WICK_X = 0.09;
  const DARK_BRONZE = new THREE.Color(0x302820);
  const transformed = (
    source: THREE.BufferGeometry,
    color: THREE.Color,
    position: [number, number, number],
    rotationZ = 0,
    rotationY = 0,
    rotationX = 0,
  ): THREE.BufferGeometry => {
    const geometry = source.clone();
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, rotationY, rotationZ)),
      new THREE.Vector3(1, 1, 1),
    );
    geometry.applyMatrix4(matrix);
    const colors = new Float32Array(geometry.attributes.position!.count * 3);
    for (let i = 0; i < geometry.attributes.position!.count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  };
  const mergeColored = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
    const merged = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (!merged) throw new Error("street lamp geometry could not be merged");
    return merged;
  };
  const cageMetalGeo = mergeColored([
    transformed(cagePlateGeo, BRONZE, [0, -0.22, 0]),
    transformed(cagePlateGeo, BRONZE, [0, 0.22, 0]),
    ...[-0.15, 0.15].flatMap((x) => [-0.15, 0.15].map((z) => transformed(cageBarGeo, DARK_BRONZE, [x, 0, z]))),
    transformed(cageRoofGeo, DARK_BRONZE, [0, 0.31, 0], 0, Math.PI / 4),
    // A boss and a ring stand clear of the roof: the chain hooks the ring, not the roof.
    transformed(bossGeo, DARK_BRONZE, [0, 0.395, 0]),
    transformed(hangRingGeo, BRONZE, [0, HANG_RING_Y, 0]),
    // The wick stands in the spout tip of the oil vessel.
    transformed(wickGeo, WICK, [WICK_X, -0.09, 0]),
  ]);
  // The squat terracotta oil lamp: a lower-hemisphere bowl opening upward, a
  // spout toward +x, and a dark oil surface just under the rim.
  const bowlGeo = new THREE.SphereGeometry(BOWL_R, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bowlGeo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(BOWL_X, VESSEL_RIM_Y, 0),
    new THREE.Quaternion(),
    new THREE.Vector3(1, 0.75, 1),
  ));
  const spoutGeo = new THREE.CylinderGeometry(0.016, 0.03, 0.07, 6);
  spoutGeo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(0.06, VESSEL_RIM_Y + 0.005, 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)),
    new THREE.Vector3(1, 1, 1),
  ));
  const oilVesselGeo = mergeGeometries([bowlGeo, spoutGeo], false);
  if (!oilVesselGeo) throw new Error("oil vessel geometry could not be merged");
  bowlGeo.dispose();
  spoutGeo.dispose();
  const oilFillGeo = new THREE.CircleGeometry(0.07, 12);
  oilFillGeo.rotateX(-Math.PI / 2);
  oilFillGeo.translate(BOWL_X, OIL_FILL_Y, 0);
  const postMetalGeometries = new Map<string, THREE.BufferGeometry>();
  const postMetalGeometry = (inward: -1 | 1, variant: 0 | 1): THREE.BufferGeometry => {
    const key = `${inward}:${variant}`;
    const cached = postMetalGeometries.get(key);
    if (cached) return cached;
    const collars = (variant === 0 ? [0.85, 1.8] : [1.05, 2.05]).map((y) =>
      transformed(collarGeo, BRONZE, [0, y, 0]));
    // Chain links run from the ring on the cage roof up to the timber arm,
    // alternating planes so they read as interlocked links.
    const cageScale = variant === 0 ? CAGE_SCALE_0 : CAGE_SCALE_1;
    const ringTop = LAMP_CAGE_Y + HANG_RING_TOP * cageScale;
    const armUnderside = LAMP_ARM_Y - 0.0275;
    const span = armUnderside - ringTop;
    const linkCount = Math.max(2, Math.round(span / 0.034));
    const links = Array.from({ length: linkCount }, (_, i) =>
      transformed(chainLinkGeo, DARK_BRONZE, [inward * LAMP_CAGE_REACH, ringTop + ((i + 0.5) * span) / linkCount, 0], 0, i % 2 === 0 ? Math.PI / 2 : 0));
    const geometry = mergeColored([
      transformed(plinthGeo, BRONZE, [0, 0.565, 0]),
      transformed(shaftGeo, DARK_BRONZE, [0, 1.6225, 0]),
      ...collars,
      transformed(capitalGeo, BRONZE, [0, 2.81, 0]),
      // The bunting cleat: a stalk and a cross-bar whose centre is the rope end.
      transformed(stalkGeo, DARK_BRONZE, [0, 2.9125, 0]),
      transformed(cleatGeo, BRONZE, [0, LAMP_BUNTING_Y, 0], Math.PI / 2),
      transformed(armGeo, TIMBER, [inward * 0.27, LAMP_ARM_Y, 0]),
      transformed(braceGeo, TIMBER, [inward * 0.2, 2.64, 0], inward * 0.72),
      ...links,
    ]);
    postMetalGeometries.set(key, geometry);
    return geometry;
  };

  const glowTexture = radialTexture();
  const poolMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: 0xffb65c,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const reflectionMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: 0xff9f48,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const MAX_FIXTURES = LAMP_MAX_FIXTURES;
  const poolInstances = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMaterial, MAX_FIXTURES);
  const reflectionInstances = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), reflectionMaterial, MAX_FIXTURES);
  poolInstances.frustumCulled = false;
  reflectionInstances.frustumCulled = false;
  poolInstances.renderOrder = 1;
  reflectionInstances.renderOrder = 1;
  world.add(poolInstances, reflectionInstances);

  // A pool of real lights follows the nearest fixtures. This costs at most four
  // lights even when the upgraded avenue and every decorative lantern are seen.
  const localLights = Array.from({ length: 4 }, () => {
    const light = new THREE.PointLight(0xffb86b, 0, 7.5, 2);
    light.castShadow = false;
    light.visible = false;
    scene.add(light);
    return light;
  });

  // One Points draw call for the occasional summer moths.
  const MOTH_COUNT = 12;
  const mothPositions = new Float32Array(MOTH_COUNT * 3);
  const mothGeo = new THREE.BufferGeometry();
  mothGeo.setAttribute("position", new THREE.BufferAttribute(mothPositions, 3));
  mothGeo.setDrawRange(0, 0);
  const mothMat = new THREE.PointsMaterial({
    color: 0xffdf9b,
    size: 0.075,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const moths = new THREE.Points(mothGeo, mothMat);
  moths.frustumCulled = false;
  world.add(moths);

  const makeCage = (scale = 1, opts: CageOptions = {}): THREE.Group => {
    const cage = new THREE.Group();
    const cageFrame = new THREE.Mesh(cageMetalGeo, metal);
    cageFrame.castShadow = true;
    cage.add(cageFrame);
    const panes = new THREE.Mesh(cageGlassGeo, glass);
    panes.rotation.y = Math.PI / 4;
    cage.add(panes);

    // The squat terracotta oil lamp: an open bowl with dark oil, a spout and a
    // wick, legible even while unlit by day.
    const vessel = new THREE.Mesh(oilVesselGeo, terracotta);
    vessel.name = "oil-vessel";
    cage.add(vessel);
    const oil = new THREE.Mesh(oilFillGeo, oilMaterial);
    oil.name = "oil-fill";
    cage.add(oil);
    const flameMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc66d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const flame = new THREE.Mesh(flameGeo, flameMaterial);
    flame.name = "flame";
    flame.position.set(WICK_X, 0.03, 0);
    cage.add(flame);
    const haloMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffb45b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const halo = new THREE.Sprite(haloMaterial);
    halo.scale.set(0.72, 0.72, 0.72);
    halo.name = "halo";
    halo.position.set(0.05, 0.04, 0);
    cage.add(halo);
    cage.scale.setScalar(scale);

    fixtures.push({
      anchor: cage,
      flame: flameMaterial,
      halo: haloMaterial,
      groundOffset: opts.groundOffset ?? 1.6,
      reflects: opts.reflects ?? false,
      phase: fixtures.length * 1.731 + 0.41,
      ignitionOrder: opts.ignitionOrder ?? 0.35,
      level: 0,
      lit: false,
      position: new THREE.Vector3(),
    });
    return cage;
  };

  const makePost = (opts: PostOptions = {}): THREE.Group => {
    const inward = opts.inward ?? 1;
    const variant = opts.variant ?? 0;
    const post = new THREE.Group();
    const base = new THREE.Mesh(variant === 0 ? octagonalBaseGeo : squareBaseGeo, stone);
    base.position.y = 0.25;
    base.rotation.y = variant ? Math.PI / 4 : 0;
    base.receiveShadow = true;
    post.add(base);
    const postMetal = new THREE.Mesh(postMetalGeometry(inward, variant), metal);
    postMetal.castShadow = true;
    post.add(postMetal);
    const cage = makeCage(variant === 0 ? CAGE_SCALE_0 : CAGE_SCALE_1, {
      groundOffset: LAMP_CAGE_Y,
      reflects: true,
      ignitionOrder: opts.ignitionOrder,
    });
    cage.position.set(inward * LAMP_CAGE_REACH, LAMP_CAGE_Y, 0);
    post.add(cage);
    return post;
  };

  const dummy = new THREE.Object3D();
  const cameraPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  let initiallySettled = false;

  const update = (opts: LampUpdateOptions): LampUpdate => {
    opts.camera.getWorldPosition(cameraPosition);
    opts.camera.getWorldDirection(cameraDirection);
    let ignitedNear = false;
    let nearestLit = Infinity;
    const candidates: { fixture: Fixture; distance: number; light: number }[] = [];
    let instanceCount = 0;

    for (const fixture of fixtures) {
      const shown = visibleThroughParents(fixture.anchor);
      fixture.anchor.getWorldPosition(fixture.position);
      const order = fixture.ignitionOrder;
      const ignition = shown ? lampIgnition(opts.falseDream ? 1 : opts.lampLevel, order) : 0;
      const flicker = opts.reducedMotion
        ? 1
        : 0.975 + Math.sin(opts.t * 1.7 + fixture.phase) * 0.018 + Math.sin(opts.t * 4.1 + fixture.phase * 1.9) * 0.009;
      const windDip = opts.reducedMotion ? 1 : 1 - opts.wind * (0.015 + 0.02 * Math.max(0, Math.sin(opts.t * 2.3 + fixture.phase)));
      const level = THREE.MathUtils.clamp(ignition * flicker * windDip, 0, 1.05);
      // Ignition is a latch, not a frame-to-frame jump: it sets when the
      // (unflickered) ignition crosses LAMP_IGNITE_AT and resets only once it
      // falls below LAMP_RESET_BELOW, so a slow dusk ramp fires exactly once.
      // A hidden fixture tracks the latch silently, so revealing a lamp that is
      // already burning (an upgrade bought at night) makes no sound.
      const rawIgnition = lampIgnition(opts.falseDream ? 1 : opts.lampLevel, order);
      if (!fixture.lit && rawIgnition >= LAMP_IGNITE_AT) {
        fixture.lit = true;
        if (shown && initiallySettled && fixture.position.distanceTo(opts.listener) < 14) ignitedNear = true;
      } else if (fixture.lit && rawIgnition < LAMP_RESET_BELOW) {
        fixture.lit = false;
      }
      fixture.level = level;

      fixture.flame.color.setHex(opts.falseDream ? 0xff672e : 0xffca73);
      fixture.flame.opacity = level;
      fixture.halo.color.setHex(opts.falseDream ? 0xff5f28 : 0xffb45b);
      fixture.halo.opacity = level * (opts.fog ? 0.72 : 0.4) * (1 + opts.rain * 0.16);

      const listenerDistance = Math.hypot(fixture.position.x - opts.listener.x, fixture.position.z - opts.listener.z);
      if (level > 0.04) nearestLit = Math.min(nearestLit, listenerDistance);
      const distance = fixture.position.distanceTo(cameraPosition);
      if (level > 0.05 && distance < 55) candidates.push({ fixture, distance, light: level });

      if (instanceCount < MAX_FIXTURES) {
        const groundY = fixture.position.y - fixture.groundOffset + 0.025;
        const poolScale = shown ? level * (fixture.reflects ? 4.2 : 2.8) : 0;
        dummy.position.set(fixture.position.x, groundY, fixture.position.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(poolScale, poolScale, 1);
        dummy.updateMatrix();
        poolInstances.setMatrixAt(instanceCount, shown ? dummy.matrix : hiddenMatrix);

        if (shown && fixture.reflects && opts.wetness > 0.02) {
          const yaw = Math.atan2(cameraPosition.x - fixture.position.x, cameraPosition.z - fixture.position.z);
          dummy.position.y += 0.012;
          // The plane begins in XY. Tilt it onto the ground, then turn
          // around its now-vertical local Z axis toward the viewer.
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.rotateZ(yaw);
          dummy.scale.set(level * 1.15, level * (3.4 + opts.wetness * 2.2), 1);
          dummy.updateMatrix();
          reflectionInstances.setMatrixAt(instanceCount, dummy.matrix);
        } else {
          reflectionInstances.setMatrixAt(instanceCount, hiddenMatrix);
        }
        instanceCount += 1;
      }
    }
    initiallySettled = true;

    poolInstances.count = instanceCount;
    reflectionInstances.count = instanceCount;
    poolInstances.instanceMatrix.needsUpdate = true;
    reflectionInstances.instanceMatrix.needsUpdate = true;
    poolMaterial.color.setHex(opts.falseDream ? 0xff7138 : 0xffb65c);
    reflectionMaterial.color.setHex(opts.falseDream ? 0xff642f : 0xff9f48);
    reflectionMaterial.opacity = opts.wetness * (opts.fog ? 0.19 : 0.28);

    candidates.sort((a, b) => a.distance - b.distance);
    // Unused slots are made invisible, so the renderer's light setup (and the
    // shader's point-light loop) really holds only as many lights as are lit.
    // Three caches one program per count, so at most five variants ever compile
    // (0..4), and the count changes only when the tier or the set of lit
    // candidates near the camera changes.
    const active = Math.min(lampLightBudget(opts.tier), candidates.length);
    for (let i = 0; i < localLights.length; i++) {
      const light = localLights[i]!;
      const candidate = i < active ? candidates[i] : undefined;
      if (!candidate) {
        light.intensity = 0;
        light.visible = false;
        continue;
      }
      light.visible = true;
      light.position.copy(candidate.fixture.position);
      light.color.setHex(opts.falseDream ? 0xff672f : 0xffb86b);
      light.intensity = candidate.light * (opts.fog ? 38 : 50);
      light.distance = opts.fog ? 6.4 : 7.8;
    }

    const mothSeason = opts.season === "spring" || opts.season === "summer";
    // Reduced motion hides the moths: their orbit would be continuous motion.
    let mothCount = 0;
    if (mothSeason && !opts.reducedMotion && opts.lampLevel > 0.5 && opts.rain < 0.2 && !opts.fog && fixtures.length) {
      const lit = fixtures.filter((fixture) => fixture.level > 0.45 && visibleThroughParents(fixture.anchor));
      for (let i = 0; i < MOTH_COUNT && lit.length; i++) {
        const fixture = lit[(i * 5 + 1) % lit.length]!;
        const phase = i * 2.399 + fixture.phase;
        const speed = 0.45 + (i % 4) * 0.09;
        const radius = 0.22 + (i % 3) * 0.1;
        const a = opts.t * speed + phase;
        mothPositions[mothCount * 3] = fixture.position.x + Math.cos(a) * radius;
        mothPositions[mothCount * 3 + 1] = fixture.position.y + Math.sin(a * 1.7) * 0.2;
        mothPositions[mothCount * 3 + 2] = fixture.position.z + Math.sin(a) * radius;
        mothCount += 1;
      }
    }
    mothGeo.setDrawRange(0, mothCount);
    const mothAttr = mothGeo.attributes.position;
    if (mothAttr) mothAttr.needsUpdate = mothCount > 0;

    const crackle = Number.isFinite(nearestLit)
      ? THREE.MathUtils.smoothstep(12 - nearestLit, 0, 10) * Math.max(0, opts.lampLevel)
      : 0;
    return { ignitedNear, crackle };
  };

  return { buildCage: makeCage, buildPost: makePost, update };
}
