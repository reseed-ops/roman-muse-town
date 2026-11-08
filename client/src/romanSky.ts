// Rome's true sky (Task 37): where the stars, the moon and the planets
// really are over Rome at a given moment, for the scene to draw. Pure
// functions; astronomy-engine (MIT, https://github.com/cosinekitty/astronomy)
// supplies sidereal time and the moon and planet positions, and the Yale
// Bright Star Catalogue (brightStars.ts) the stars.
//
// Angles follow the scene's own convention (townScene dirFromAngles, the
// same as the sun's solarAngles): elevation in degrees above the horizon,
// azimuth in degrees from north through east.
import * as Astronomy from "astronomy-engine";
import { BRIGHT_STARS_PACKED } from "./brightStars";

/** Rome, the Forum: about 41.89 N, 12.49 E, a little above sea level. */
export const ROME = { latitude: 41.8925, longitude: 12.4853, height: 30 } as const;
const observer = new Astronomy.Observer(ROME.latitude, ROME.longitude, ROME.height);

export type CatalogStar = { ra: number; dec: number; mag: number; kelvin: number };
export type SkyPoint = { elev: number; azim: number };

let parsed: CatalogStar[] | null = null;
/** The catalogue, parsed once: RA and Dec in degrees (J2000), V magnitude, colour temperature. */
export function brightStars(): CatalogStar[] {
  if (parsed) return parsed;
  parsed = BRIGHT_STARS_PACKED.split(";").map((row) => {
    const [ra, dec, mag, k] = row.split(",").map(Number);
    return { ra: ra! / 100, dec: dec! / 100, mag: mag! / 100, kelvin: k! * 100 };
  });
  return parsed;
}

const RAD = Math.PI / 180;

/** Local sidereal time at Rome, in degrees. */
export function romeSiderealDeg(date: Date): number {
  const gast = Astronomy.SiderealTime(date); // hours
  return (((gast * 15 + ROME.longitude) % 360) + 360) % 360;
}

/** One star's place in Rome's sky, from its RA/Dec (degrees) and the local sidereal time. */
export function starHorizon(raDeg: number, decDeg: number, lstDeg: number): SkyPoint {
  const ha = (lstDeg - raDeg) * RAD;
  const dec = decDeg * RAD;
  const lat = ROME.latitude * RAD;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  // Azimuth from north through east.
  const y = -Math.cos(dec) * Math.sin(ha);
  const x = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(ha);
  const az = (Math.atan2(y, x) / RAD + 360) % 360;
  return { elev: alt / RAD, azim: az };
}

/** A body (the moon, a planet) in Rome's sky, refraction included. */
function bodyHorizon(body: Astronomy.Body, date: Date): SkyPoint {
  const eq = Astronomy.Equator(body, date, observer, true, true);
  const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, "normal");
  return { elev: hor.altitude, azim: hor.azimuth };
}

export type MoonState = SkyPoint & {
  /** 0 (new) to 1 (full): the lit fraction of the disc. */
  illuminated: number;
  /** True while the lit side grows (the lit limb faces the setting sun's side). */
  waxing: boolean;
};

export function romeMoon(date: Date): MoonState {
  const at = bodyHorizon(Astronomy.Body.Moon, date);
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const phase = Astronomy.MoonPhase(date); // 0 new, 90 first quarter, 180 full, 270 last quarter
  return { ...at, illuminated: illum.phase_fraction, waxing: phase < 180 };
}

export type PlanetState = SkyPoint & { name: string; mag: number };
const PLANETS: [string, Astronomy.Body][] = [
  ["Mercury", Astronomy.Body.Mercury],
  ["Venus", Astronomy.Body.Venus],
  ["Mars", Astronomy.Body.Mars],
  ["Jupiter", Astronomy.Body.Jupiter],
  ["Saturn", Astronomy.Body.Saturn],
];

/** The five planets the Romans knew, where they truly are, with their brightness. */
export function romePlanets(date: Date): PlanetState[] {
  return PLANETS.map(([name, body]) => ({ name, ...bodyHorizon(body, date), mag: Astronomy.Illumination(body, date).mag }));
}

/** An approximate star colour from its temperature (kelvin), for a point's tint. */
export function starTint(kelvin: number): [number, number, number] {
  if (kelvin >= 9500) return [0.78, 0.86, 1];
  if (kelvin >= 7300) return [0.9, 0.94, 1];
  if (kelvin >= 6000) return [1, 1, 0.97];
  if (kelvin >= 5000) return [1, 0.93, 0.8];
  if (kelvin >= 4000) return [1, 0.83, 0.62];
  return [1, 0.72, 0.5];
}
