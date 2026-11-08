import { expect, test } from "bun:test";
import * as Astronomy from "astronomy-engine";
import { brightStars, romeMoon, romePlanets, romeSiderealDeg, ROME, starHorizon } from "./romanSky";

// Rome's true sky, checked against independent references.

const at = (iso: string) => new Date(iso);
const star = (name: { ra: number; dec: number }, date: Date) => starHorizon(name.ra, name.dec, romeSiderealDeg(date));

test("the catalogue: naked-eye stars, Sirius brightest at its true place", () => {
  const stars = brightStars();
  expect(stars.length).toBeGreaterThan(2500);
  expect(stars[0]!.mag).toBeCloseTo(-1.46, 2);
  expect(stars[0]!.ra).toBeCloseTo(101.29, 1);
  expect(stars[0]!.dec).toBeCloseTo(-16.72, 1);
});

test("Polaris stands at about Rome's latitude, due north, at any hour", () => {
  // Polaris, J2000: RA 2h 31m 49s, Dec +89 15' 51".
  const polaris = { ra: (2 + 31 / 60 + 49 / 3600) * 15, dec: 89 + 15 / 60 + 51 / 3600 };
  for (const iso of ["2026-01-15T22:00:00Z", "2026-07-01T03:00:00Z", "2026-11-08T19:30:00Z"]) {
    const p = star(polaris, at(iso));
    expect(Math.abs(p.elev - ROME.latitude)).toBeLessThan(1.2);
    expect(Math.min(p.azim, 360 - p.azim)).toBeLessThan(1.5);
  }
});

test("Sirius culminates low in the south over Rome, at 90 - 41.9 - 16.7 = about 31 degrees", () => {
  const sirius = brightStars()[0]!;
  // Find its highest point over one night in January.
  let best = { elev: -90, azim: 0 };
  for (let m = 0; m < 24 * 60; m += 5) {
    const p = star(sirius, new Date(Date.UTC(2026, 0, 15, 12) + m * 60_000));
    if (p.elev > best.elev) best = p;
  }
  expect(best.elev).toBeGreaterThan(30);
  expect(best.elev).toBeLessThan(32);
  expect(Math.abs(best.azim - 180)).toBeLessThan(2);
});

test("our star placement agrees with astronomy-engine's own horizon conversion", () => {
  const date = at("2026-11-08T21:00:00Z");
  const observer = new Astronomy.Observer(ROME.latitude, ROME.longitude, ROME.height);
  for (const s of brightStars().slice(0, 20)) {
    const ours = star(s, date);
    const ref = Astronomy.Horizon(date, observer, s.ra / 15, s.dec, undefined);
    expect(Math.abs(ours.elev - ref.altitude)).toBeLessThan(0.6);
    const dAz = Math.abs(((ours.azim - ref.azimuth + 540) % 360) - 180);
    if (ref.altitude < 85) expect(dAz).toBeLessThan(0.8);
  }
});

test("the moon: full near 2026-11-24, new near 2026-11-09, and placed in Rome's sky", () => {
  // Near the November 2026 new moon (the 9th) and full moon (the 24th), as the engine computes them.
  expect(romeMoon(at("2026-11-24T15:00:00Z")).illuminated).toBeGreaterThan(0.98);
  expect(romeMoon(at("2026-11-09T07:00:00Z")).illuminated).toBeLessThan(0.02);
  expect(romeMoon(at("2026-11-12T12:00:00Z")).waxing).toBe(true);
  const m = romeMoon(at("2026-11-24T23:00:00Z"));
  expect(m.elev).toBeGreaterThan(40); // a full moon near midnight stands high
});

test("the five planets come back with places and magnitudes", () => {
  const planets = romePlanets(at("2026-11-08T19:00:00Z"));
  expect(planets.map((p) => p.name)).toEqual(["Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);
  for (const p of planets) {
    expect(p.elev).toBeGreaterThanOrEqual(-90);
    expect(p.elev).toBeLessThanOrEqual(90);
    expect(Number.isFinite(p.mag)).toBe(true);
  }
});
