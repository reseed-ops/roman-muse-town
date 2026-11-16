// The sea's waves (Task 102): the one place the wave math lives. Pure
// numbers, no Three.js, no WebGL, so the same functions serve the ships
// (bob and pitch), the swimmer's camera, the tests, and, through
// `seaWaveGLSL()`, the sea mesh's vertex shader (seaSurface.ts), and will
// port to WebGPU as one item (Task 101).
//
// WHAT THIS IS, PLAINLY: four cascades of Gerstner waves, two waves per
// cascade (eight in all), not a spectral FFT. A cascade is a band of wave
// sizes (long swell, mid swell, short sea, chop), the layering a four
// cascade FFT ocean has; each band here is two travelling Gerstner waves
// instead of an inverse FFT of a spectrum. Eight waves cost eight sine
// evaluations a vertex and nothing per pixel, which a phone's GPU does not
// notice; an FFT needs render targets and several passes a frame, which
// the town's renderer does not have (Task 101). The deep-water dispersion
// (omega = sqrt(g k)) is the FFT ocean's own, so long waves travel faster.
//
// Shape of one wave, rest position p0 = (x0, z0), direction d (unit),
// wavenumber k = 2 pi / wavelength, amplitude A, steepness Q (0..1):
//   theta = k (d . p0) - omega t + phi
//   displacement  D = (Q A d.x cos theta, A sin theta, Q A d.z cos theta)
// The surface point is p0 + D. Heights are metres above the sea's level
// (SEA_Y); the mean is zero.

export const GRAVITY = 9.81;

export interface Wave {
  /** Which cascade (size band) the wave belongs to, 0 = longest. */
  cascade: number;
  /** Unit direction of travel in (x, z). */
  dx: number;
  dz: number;
  /** Crest to crest, metres. */
  wavelength: number;
  /** Half the crest-to-trough height, metres. */
  amp: number;
  /** Gerstner steepness 0..1: how much the crests sharpen and lean. */
  steep: number;
  /** Phase offset, radians. */
  phase: number;
  /** Wavenumber and angular speed, derived. */
  k: number;
  omega: number;
}

const dir = (deg: number): [number, number] => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];

/** [cascade, bearing the wave travels toward (0 = north, toward the shore), wavelength, amplitude, steepness, phase]. */
const TABLE: readonly (readonly [number, number, number, number, number, number])[] = [
  // Cascade 0: the long swell, rolling in from the south and south-west.
  [0, 12, 78, 0.26, 0.55, 0.4],
  [0, -23, 61, 0.2, 0.55, 2.1],
  // Cascade 1: the mid swell, a little more crossed.
  [1, 31, 34, 0.12, 0.6, 4.2],
  [1, -41, 27, 0.09, 0.6, 1.3],
  // Cascade 2: the short sea.
  [2, 55, 15, 0.05, 0.6, 5.5],
  [2, -62, 12, 0.04, 0.6, 3.1],
  // Cascade 3: the chop, which breaks the glassy look.
  [3, 78, 6.5, 0.02, 0.5, 0.9],
  [3, -85, 5.2, 0.015, 0.5, 2.7],
];

export const WAVES: readonly Wave[] = TABLE.map(([cascade, bearing, wavelength, amp, steep, phase]) => {
  const [dx, dz] = dir(bearing);
  const k = (2 * Math.PI) / wavelength;
  return { cascade, dx, dz, wavelength, amp, steep, phase, k, omega: Math.sqrt(GRAVITY * k) };
});

export const CASCADES = 4;

/** The most the surface can rise or fall from the sea's level. */
export const MAX_HEIGHT = WAVES.reduce((s, w) => s + w.amp, 0);

/** The horizontal shove of the surface point that rests at (x0, z0), at time t. */
export function seaDisplacement(x0: number, z0: number, t: number): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (const w of WAVES) {
    const c = Math.cos(w.k * (w.dx * x0 + w.dz * z0) - w.omega * t + w.phase);
    x += w.steep * w.amp * w.dx * c;
    z += w.steep * w.amp * w.dz * c;
  }
  return { x, z };
}

/** The height of the surface point that rests at (x0, z0) (the Gerstner's own parameter space). */
function heightAtRest(x0: number, z0: number, t: number): number {
  let h = 0;
  for (const w of WAVES) h += w.amp * Math.sin(w.k * (w.dx * x0 + w.dz * z0) - w.omega * t + w.phase);
  return h;
}

/**
 * The surface's height above the sea's level at the world position (x, z), time t seconds.
 * Defined and smooth everywhere. Exact for the displaced mesh: the rest position that lands on (x, z)
 * is found by fixed point iteration (the shove is small next to the wavelengths, so it settles fast).
 */
export function seaHeight(x: number, z: number, t: number): number {
  let x0 = x;
  let z0 = z;
  for (let i = 0; i < 4; i++) {
    const d = seaDisplacement(x0, z0, t);
    x0 = x - d.x;
    z0 = z - d.z;
  }
  return heightAtRest(x0, z0, t);
}

/** The surface normal (unit, y up) at the world position (x, z). */
export function seaNormal(x: number, z: number, t: number): [number, number, number] {
  let x0 = x;
  let z0 = z;
  for (let i = 0; i < 4; i++) {
    const d = seaDisplacement(x0, z0, t);
    x0 = x - d.x;
    z0 = z - d.z;
  }
  let nx = 0;
  let nz = 0;
  let ny = 1;
  for (const w of WAVES) {
    const th = w.k * (w.dx * x0 + w.dz * z0) - w.omega * t + w.phase;
    nx -= w.dx * w.k * w.amp * Math.cos(th);
    nz -= w.dz * w.k * w.amp * Math.cos(th);
    ny -= w.steep * w.k * w.amp * Math.sin(th);
  }
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}

export interface Ride {
  /** Height of the hull's reference point above the sea's level. */
  dy: number;
  /** Rotation about the hull's own Z axis (bow +X): positive lifts the bow. */
  pitch: number;
  /** Rotation about the hull's own X axis: positive lowers the +Z (starboard-of-heading) side. */
  roll: number;
}

/**
 * How a hull of `length` metres (bow on +X, heading h as `rotation.y`, beam a
 * quarter of the length) sits on the waves at (x, z): its height is the mean of
 * the surface under bow, stern and both sides, its pitch the slope bow to stern,
 * its roll the slope side to side. Apply with Euler order "YZX".
 */
export function shipRide(x: number, z: number, heading: number, length: number, t: number): Ride {
  const fx = Math.cos(heading);
  const fz = -Math.sin(heading);
  const sx = Math.sin(heading);
  const sz = Math.cos(heading);
  const half = length / 2;
  const beam = length * 0.25;
  const hb = seaHeight(x + fx * half, z + fz * half, t);
  const hs = seaHeight(x - fx * half, z - fz * half, t);
  const hp = seaHeight(x - sx * beam / 2, z - sz * beam / 2, t);
  const hq = seaHeight(x + sx * beam / 2, z + sz * beam / 2, t);
  return {
    dy: (hb + hs + hp + hq) / 4,
    pitch: Math.atan2(hb - hs, length),
    roll: Math.atan2(hp - hq, beam),
  };
}

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : n.toPrecision(9));

/**
 * The same eight waves as GLSL: `void seaWave(vec2 p, float t, out vec3 disp, out vec3 nrm)` gives
 * the displacement of the surface point resting at p (x, y up, z) and its unit normal. The waves are
 * written into the source as literals, so this table is the only copy of them.
 */
export function seaWaveGLSL(): string {
  const lines = WAVES.map(
    (w) => `  th = ${f(w.k)} * (${f(w.dx)} * p.x + ${f(w.dz)} * p.y) - ${f(w.omega)} * t + ${f(w.phase)};
  c = cos(th); s = sin(th);
  disp += vec3(${f(w.steep * w.amp * w.dx)} * c, ${f(w.amp)} * s, ${f(w.steep * w.amp * w.dz)} * c);
  nrm += vec3(${f(-w.dx * w.k * w.amp)} * c, ${f(-w.steep * w.k * w.amp)} * s, ${f(-w.dz * w.k * w.amp)} * c);`,
  );
  return `void seaWave(vec2 p, float t, out vec3 disp, out vec3 nrm) {
  disp = vec3(0.0);
  nrm = vec3(0.0, 1.0, 0.0);
  float th; float c; float s;
${lines.join("\n")}
  nrm = normalize(nrm);
}`;
}
