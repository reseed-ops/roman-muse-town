// Rome's true sky, drawn (Task 37): the naked-eye stars of the Yale
// Bright Star Catalogue in their true places over Rome, tinted by
// colour and sized by brightness; the five planets the Romans knew;
// and the moon where the true moon is, at its true phase. Positions
// come from romanSky.ts and are recomputed every SKY_REFRESH_S seconds
// (the sky turns a quarter of a degree a minute). The town's own
// constellation, the Two Lanterns, is drawn elsewhere, laid over this
// sky as the town's story.
import * as THREE from "three";
import { brightStars, romeMoon, romePlanets, romeSiderealDeg, starHorizon, starTint, type MoonState } from "./romanSky";

export const SKY_RADIUS = 150;
export const MOON_DISTANCE = 128;
export const SKY_REFRESH_S = 20;

/** The scene's direction for an elevation and azimuth (north -Z, east +X), as dirFromAngles. */
export function skyDirection(elevDeg: number, azimDeg: number, out = new THREE.Vector3()): THREE.Vector3 {
  const el = (elevDeg * Math.PI) / 180;
  const az = (azimDeg * Math.PI) / 180;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/** Magnitude bands: brighter stars draw larger. */
const BANDS: { upTo: number; size: number }[] = [
  { upTo: 1.0, size: 3.6 },
  { upTo: 2.2, size: 2.7 },
  { upTo: 3.4, size: 2.0 },
  { upTo: 4.4, size: 1.5 },
  { upTo: 99, size: 1.15 },
];

export type TrueSky = {
  /** Night fade and weather, 0..1, for every point of light. */
  setOpacity(o: number): void;
  /** Recompute every place for this moment (call on a slow cadence). */
  update(date: Date): void;
  /** The true moon, as last computed. */
  moon(): MoonState;
  /** The moon's sprite material, for its own fade. */
  moonMaterial: THREE.SpriteMaterial;
};

/** Draw the moon's disc at its phase: lit fraction, waxing lit on the right (as seen from the north). */
export function drawMoonPhase(ctx: CanvasRenderingContext2D, size: number, illuminated: number, waxing: boolean): void {
  const c = size / 2;
  const r = size * 0.3;
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";
  const glow = ctx.createRadialGradient(c, c, r * 0.9, c, c, c);
  glow.addColorStop(0, `rgba(200,215,245,${0.25 + 0.35 * illuminated})`);
  glow.addColorStop(1, "rgba(200,215,245,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(242,246,255,1)";
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  // Erase the unlit part: the dark half, and the terminator's ellipse.
  const f = Math.min(1, Math.max(0, illuminated));
  ctx.save();
  ctx.translate(c, c);
  if (!waxing) ctx.scale(-1, 1);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, true); // the dark (left) half
  ctx.ellipse(0, 0, r * Math.abs(1 - 2 * f), r, 0, Math.PI / 2, -Math.PI / 2, f < 0.5);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.92)";
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

export function createTrueSky(parent: THREE.Object3D, starTexture: THREE.Texture): TrueSky {
  const stars = brightStars();
  const layers = BANDS.map((band, i) => {
    const lo = i === 0 ? -99 : BANDS[i - 1]!.upTo;
    const members = stars.filter((s) => s.mag > lo && s.mag <= band.upTo);
    const positions = new Float32Array(members.length * 3);
    const colors = new Float32Array(members.length * 3);
    members.forEach((s, j) => {
      const [r, g, b] = starTint(s.kelvin);
      // Fainter stars dim a little within the band, so the field has depth.
      const dim = Math.max(0.55, 1 - (s.mag - lo) * 0.12);
      colors.set([r * dim, g * dim, b * dim], j * 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: band.size,
      map: starTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: false,
      fog: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    parent.add(points);
    return { members, positions, geo, mat };
  });
  // The planets: steady, warm points, a size by brightness.
  const planetPositions = new Float32Array(5 * 3);
  const planetGeo = new THREE.BufferGeometry();
  planetGeo.setAttribute("position", new THREE.BufferAttribute(planetPositions, 3));
  const planetColors = new Float32Array([0.95, 0.9, 0.8, 1, 0.98, 0.9, 1, 0.72, 0.55, 1, 0.95, 0.85, 0.98, 0.9, 0.72]);
  planetGeo.setAttribute("color", new THREE.BufferAttribute(planetColors, 3));
  const planetMat = new THREE.PointsMaterial({ size: 3.4, map: starTexture, transparent: true, opacity: 0, depthWrite: false, vertexColors: true, sizeAttenuation: false, fog: false });
  const planets = new THREE.Points(planetGeo, planetMat);
  planets.frustumCulled = false;
  parent.add(planets);
  // The moon, a sprite whose disc is redrawn when its phase moves on.
  const moonCanvas = document.createElement("canvas");
  moonCanvas.width = 128;
  moonCanvas.height = 128;
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moonMaterial = new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const moonSprite = new THREE.Sprite(moonMaterial);
  moonSprite.scale.set(13, 13, 1);
  parent.add(moonSprite);
  let moon: MoonState = { elev: -90, azim: 0, illuminated: 0, waxing: true };
  let drawnPhase = -1;
  const dir = new THREE.Vector3();
  const BELOW = -1e5;
  return {
    moonMaterial,
    moon: () => moon,
    setOpacity(o) {
      for (const l of layers) l.mat.opacity = o;
      planetMat.opacity = o;
    },
    update(date) {
      const lst = romeSiderealDeg(date);
      for (const l of layers) {
        l.members.forEach((s, j) => {
          const p = starHorizon(s.ra, s.dec, lst);
          if (p.elev < -0.5) {
            l.positions.set([0, BELOW, 0], j * 3);
            return;
          }
          skyDirection(p.elev, p.azim, dir).multiplyScalar(SKY_RADIUS);
          l.positions.set([dir.x, dir.y, dir.z], j * 3);
        });
        (l.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
      romePlanets(date).forEach((p, i) => {
        if (p.elev < -0.5) planetPositions.set([0, BELOW, 0], i * 3);
        else {
          skyDirection(p.elev, p.azim, dir).multiplyScalar(SKY_RADIUS - 2);
          planetPositions.set([dir.x, dir.y, dir.z], i * 3);
        }
      });
      (planetGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      moon = romeMoon(date);
      skyDirection(moon.elev, moon.azim, dir).multiplyScalar(MOON_DISTANCE);
      moonSprite.position.copy(dir);
      moonSprite.visible = moon.elev > -2;
      const phaseKey = Math.round(moon.illuminated * 50) * (moon.waxing ? 1 : -1);
      if (phaseKey !== drawnPhase) {
        drawnPhase = phaseKey;
        const ctx = moonCanvas.getContext("2d");
        if (ctx) {
          drawMoonPhase(ctx, 128, moon.illuminated, moon.waxing);
          moonTex.needsUpdate = true;
        }
      }
    },
  };
}
