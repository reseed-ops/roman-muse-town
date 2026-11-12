import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { packNameFor } from "../../web/assetPack";
import {
  ATHENA_STATUE, AUGUSTUS_HEIGHT, AUGUSTUS_PODEST_HEIGHT, AUGUSTUS_RADIUS, AUGUSTUS_SPOT, BOOTH_CANOPY_Y, BOOTH_HALF, CRATE_TOP,
  DRESSING_BUDGET, DRESSING_FILES, DRESSING_PIECES, STALL_CRATES, boothPoint, dressingFootprints, type DressingAsset,
} from "./idyllicDressing";
import { pushOutOf } from "./collision";
import { buildHomeHouse } from "./homeHouse";
import { OPEN_SKY, PERISTYLE_POOL, PERISTYLE_PUTTO, ROOMS, inRect } from "./homePlan";
import { MARKET_BOOTHS, VILLA } from "./layout";
import { WEDDING_PIECES } from "./romanWedding";
import { ATHENA_SEAT, ATHENA_TEMPLE, HOME, LUCRETIA, PLACES, SEEK_SPOTS, streetDistance, terrainHeight } from "./town";

const ASSETS = join(import.meta.dir, "assets");
const parse = (file: string) => {
  const b = readFileSync(join(ASSETS, file));
  const jsonLen = b.readUInt32LE(12);
  return { bytes: b.length, json: JSON.parse(b.subarray(20, 20 + jsonLen).toString("utf8")) as GltfJson };
};
interface GltfJson {
  accessors: { count: number; type: string; min?: number[]; max?: number[] }[];
  meshes: { primitives: { indices?: number; attributes: Record<string, number> }[] }[];
  materials?: { pbrMetallicRoughness?: { baseColorTexture?: unknown } }[];
}
const triangles = (j: GltfJson) =>
  j.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + (p.indices !== undefined ? j.accessors[p.indices]!.count : j.accessors[p.attributes.POSITION!]!.count) / 3, 0);
/** The model's own height (glTF is Y-up), from its position accessors. */
const modelHeight = (j: GltfJson) => {
  const pos = j.accessors.filter((a) => a.type === "VEC3" && a.min && a.max);
  return Math.max(...pos.map((a) => a.max![1]!)) - Math.min(...pos.map((a) => a.min![1]!));
};
// absent on a clean clone, and an empty stand-in (web/stubAssets.ts) is not the file either
const present = Object.values(DRESSING_FILES).every((f) => existsSync(join(ASSETS, f)) && statSync(join(ASSETS, f)).size > 1000);

const piece = (id: string) => DRESSING_PIECES.find((p) => p.id === id)!;
const STATUES: DressingAsset[] = ["athena", "augustus"];

describe("Idyllic Rome statues and market dressing (Task 86)", () => {
  test("every piece names a file the layout lists, in the statuary or market folder and never the Colosseum's pack", () => {
    expect(new Set(Object.values(DRESSING_FILES)).size).toBe(Object.keys(DRESSING_FILES).length);
    for (const p of DRESSING_PIECES) expect(DRESSING_FILES[p.asset]).toMatch(/^(statuary|market)\/.+\.glb$/);
    for (const f of Object.values(DRESSING_FILES)) expect(["statuary", "market"]).toContain(packNameFor(f));
    expect(packNameFor("idyllic/colosseum.glb")).toBe("idyllic");
  });

  test.skipIf(!present)("each GLB loads, stays inside its budget and carries the pack's textures", () => {
    let statuary = 0, market = 0;
    for (const [asset, file] of Object.entries(DRESSING_FILES)) {
      const { bytes, json } = parse(file);
      if (file.startsWith("statuary/")) statuary += bytes; else market += bytes;
      const tris = triangles(json);
      expect(tris).toBeGreaterThan(100);
      expect(tris).toBeLessThanOrEqual(STATUES.includes(asset as DressingAsset) ? DRESSING_BUDGET.statueTriangles : asset === "putto" ? DRESSING_BUDGET.puttoTriangles : DRESSING_BUDGET.propTriangles);
      expect((json.materials ?? []).some((m) => m.pbrMetallicRoughness?.baseColorTexture)).toBe(true); // textured, not flat grey
    }
    expect(statuary).toBeLessThanOrEqual(DRESSING_BUDGET.statuaryBytes);
    expect(market).toBeLessThanOrEqual(DRESSING_BUDGET.marketBytes);
  });

  test.skipIf(!present)("the statues' natural heights match what the placement scales from", () => {
    expect(modelHeight(parse(DRESSING_FILES.athena).json)).toBeGreaterThan(1.8);
    expect(modelHeight(parse(DRESSING_FILES.athena).json)).toBeLessThan(2.0);
    expect(modelHeight(parse(DRESSING_FILES.augustus).json)).toBeGreaterThan(1.7);
    expect(modelHeight(parse(DRESSING_FILES.augustus).json)).toBeLessThan(1.9);
  });

  describe("Athena's temple", () => {
    const a = piece("athena");
    const [tx, tz] = ATHENA_TEMPLE.position;
    const local = a.x - tx;

    const C = ATHENA_TEMPLE.cella;
    const DEPTH = 0.62; // her natural depth (z -0.09..0.56 native, scaled 1.8/1.896)

    test("she stands inside the cella, on the axis, against the back wall, on the podium's floor", () => {
      expect(local - DEPTH / 2).toBeGreaterThan(C.x0 + C.wall); // her back is clear of the wall's inner face
      expect(local - DEPTH / 2).toBeLessThan(C.x0 + C.wall + 0.3); // and within a hand or two of it: against the back wall
      expect(local + DEPTH / 2).toBeLessThan(C.x1 - C.wall - 0.8); // well back from the door
      expect(a.z).toBe(tz);
      expect(a.lift).toBe(ATHENA_TEMPLE.podiumY);
      expect(a.groundAt).toEqual([tx, tz]); // the temple's own ground, as the temple is built
    });

    test("she looks east, out of the doorway, down the steps toward Lucretia", () => {
      expect(Math.sin(a.rotY)).toBeCloseTo(1); // the model's front is local +z
      expect(LUCRETIA.position[0]).toBeGreaterThan(tx);
    });

    test("she stands inside the podium's collision box, so nothing new blocks the ground", () => {
      expect(Math.abs(local)).toBeLessThan(ATHENA_TEMPLE.halfX);
      expect(Math.abs(a.z - tz)).toBeLessThan(ATHENA_TEMPLE.halfZ);
      expect(dressingFootprints().some((f) => f.id === "athena")).toBe(false);
    });

    test("the seat on the step is unchanged and she is on its axis, through the doorway", () => {
      expect(ATHENA_SEAT.x - (tx + local)).toBeGreaterThan(3); // out on the step, a room and a portico away
      expect(ATHENA_SEAT.x).toBeGreaterThan(tx + ATHENA_TEMPLE.halfX); // the step, not the podium
      expect(Math.abs(ATHENA_SEAT.z - a.z)).toBeLessThan(0.01);
    });

    test("the doorway is a real opening the statue shows through, from the bench", () => {
      expect(C.doorHalf * 2).toBeGreaterThanOrEqual(1.2); // wide enough for her (0.76 across) and a walker's eye
      expect(C.doorH).toBeGreaterThan(1.9);
      expect(C.doorH).toBeLessThan(C.height); // a lintel above it
      // the sightline from a sitter's eye (bench z axis) to her head passes the door's plane inside the opening, under the lintel
      const eyeX = ATHENA_SEAT.x - tx, eyeY = ATHENA_TEMPLE.stepY + 1.0; // above the step, in local y
      const headY = a.lift! + a.height!, headX = local;
      const doorX = C.x1;
      const yAtDoor = eyeY + ((headY - eyeY) * (eyeX - doorX)) / (eyeX - headX);
      expect(yAtDoor).toBeGreaterThan(ATHENA_TEMPLE.podiumY); // over the sill
      expect(yAtDoor).toBeLessThan(ATHENA_TEMPLE.podiumY + C.doorH); // under the lintel
      // the middle two columns (z +-0.45, capital 0.36) leave a clear slot on the axis
      expect(0.45 - 0.18).toBeGreaterThan(0.25);
    });

    test("she clears the ceiling by well over a hand's breadth, and the walls hold her", () => {
      const top = a.lift! + a.height!;
      const ceiling = ATHENA_TEMPLE.podiumY + C.height; // the entablature's underside
      expect(ceiling - top).toBeGreaterThanOrEqual(0.15);
      expect(C.height).toBe(2.3); // the cella and so the ridge are as built in Task 55
      expect(C.halfZ - C.wall).toBeGreaterThan(0.76 / 2 + 0.3); // she is narrower than the room
    });

    test("the roofline and the phoenix's perch are where they were, above her", () => {
      const top = a.lift! + a.height!;
      const perch = ATHENA_TEMPLE.podiumY + 2.3 + 0.32 + 0.75 - 0.35; // townScene's perch, above the terrain
      expect(perch - top).toBeGreaterThan(1.2);
      const scene = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");
      expect(scene).toContain("terrainHeight(ATHENA_TEMPLE.position[0], ATHENA_TEMPLE.position[1]) + 0.9 + 2.3 + 0.32 + 0.75 - 0.35");
    });

    test("a walker cannot enter: the podium and step stay one solid collider, so no one clips into the cella", () => {
      const scene = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");
      expect(scene).toContain("ATHENA_TEMPLE.halfX + ATHENA_TEMPLE.stepDepth / 2, ATHENA_TEMPLE.halfZ, 0), // Athena's temple, podium and step");
      // the collider's footprint covers every wall and the whole floor
      expect(C.x0).toBeGreaterThanOrEqual(-ATHENA_TEMPLE.halfX);
      expect(C.x1).toBeLessThanOrEqual(ATHENA_TEMPLE.halfX);
      expect(C.halfZ).toBeLessThanOrEqual(ATHENA_TEMPLE.halfZ);
      expect(ATHENA_TEMPLE.podiumY).toBeGreaterThan(0.6); // a floor a metre up, with no stair: a threshold to look over, not to walk
    });

    test("her height suits the cella and the town", () => {
      expect(ATHENA_STATUE.height).toBeGreaterThan(1.6);
      expect(ATHENA_STATUE.height).toBeLessThan(2.1);
    });
  });

  describe("Augustus in the forum", () => {
    const [x, z] = AUGUSTUS_SPOT;
    const dist = (px: number, pz: number) => Math.hypot(x - px, z - pz);

    test("he stands on a podest, with a collision circle that covers it", () => {
      const pod = piece("augustus-podest"), st = piece("augustus");
      expect([pod.x, pod.z]).toEqual([st.x, st.z]);
      expect(st.lift).toBe(AUGUSTUS_PODEST_HEIGHT);
      expect(pod.height).toBe(AUGUSTUS_PODEST_HEIGHT);
      expect(AUGUSTUS_RADIUS).toBeGreaterThanOrEqual(0.33 + 0.1); // the podest's half-width (1.0 m tall: 0.66 wide) and the margin Lucretia's plinth gets
      expect(dressingFootprints()).toEqual([{ id: "augustus-podest", x, z, r: AUGUSTUS_RADIUS }]);
      expect(AUGUSTUS_PODEST_HEIGHT + AUGUSTUS_HEIGHT).toBeLessThan(3.2); // a statue, not a monument: under the colonnade's 4.5 m
    });

    test("he is inside the forum's colonnade and faces the Town Tree", () => {
      expect(Math.abs(x)).toBeLessThan(VILLA.peristyle.halfX - 2);
      expect(Math.abs(z)).toBeLessThan(VILLA.peristyle.halfZ - 2);
      const f = { x: Math.sin(piece("augustus").rotY), z: Math.cos(piece("augustus").rotY) }; // front is local +z
      const toTree = { x: -x / Math.hypot(x, z), z: -z / Math.hypot(x, z) };
      expect(f.x * toTree.x + f.z * toTree.z).toBeGreaterThan(0.999);
    });

    test("he does not crowd Lucretia, the market booths, the bench, the table or the tree", () => {
      expect(dist(LUCRETIA.position[0], LUCRETIA.position[1])).toBeGreaterThan(12);
      for (const [bx, bz] of MARKET_BOOTHS) expect(dist(bx, bz)).toBeGreaterThan(20);
      expect(dist(8.8, 4.6)).toBeGreaterThan(3); // the stone bench
      expect(dist(8.8, -5.2)).toBeGreaterThan(8); // the east bay's table
      expect(dist(0, 0)).toBeGreaterThan(2.45 + AUGUSTUS_RADIUS + 3); // the tree's stone ring, with room to walk round
      expect(dist(-3.8, 4.6)).toBeGreaterThan(8); // the forum's history tablet
    });

    test("he blocks no street, no walk through the colonnade, and no quest or seek spot", () => {
      expect(streetDistance(x, z)).toBeGreaterThan(AUGUSTUS_RADIUS + 1.6 + 1); // a visitor can walk round him on both sides
      for (const cx of [4, 8, 12]) expect(dist(cx, VILLA.peristyle.halfZ)).toBeGreaterThan(2); // the colonnade's southern row
      for (const s of SEEK_SPOTS) expect(dist(s.x, s.z)).toBeGreaterThan(3);
      for (const p of PLACES) expect(dist(p.position[0], p.position[1])).toBeGreaterThan(8);
    });

    test("he stands clear of the wedding's arch, tables and banquet", () => {
      for (const w of WEDDING_PIECES) expect(dist(w.x, w.z)).toBeGreaterThan(6);
    });
  });

  describe("the domus garden's putto", () => {
    const U = PERISTYLE_PUTTO;
    const world = (lx: number, lz: number): [number, number] => {
      const [hx, hz] = HOME.position;
      return [hx + lx * Math.cos(HOME.facing) + lz * Math.sin(HOME.facing), hz - lx * Math.sin(HOME.facing) + lz * Math.cos(HOME.facing)];
    };
    const p = piece("putto");

    test("it is in the domus's own frame, on its plinth, inside the garden court by the round pool", () => {
      expect(p.frame).toBe("home");
      expect([p.x, p.z]).toEqual([U.x, U.z]);
      expect(inRect(ROOMS.garden, U.x - U.plinthHalf, U.z - U.plinthHalf)).toBe(true);
      expect(inRect(ROOMS.garden, U.x + U.plinthHalf, U.z + U.plinthHalf)).toBe(true);
      const toPool = Math.hypot(U.x - PERISTYLE_POOL.x, U.z - PERISTYLE_POOL.z);
      expect(toPool).toBeGreaterThan(PERISTYLE_POOL.r + 0.1 + U.plinthHalf); // outside the pool's rim
      expect(toPool).toBeLessThan(1.2); // by it
      expect(p.lift).toBeGreaterThan(U.plinth); // the child stands on the plinth's top
    });

    test("it faces the pool", () => {
      const f = { x: Math.sin(U.rotY), z: Math.cos(U.rotY) };
      const to = { x: PERISTYLE_POOL.x - U.x, z: PERISTYLE_POOL.z - U.z };
      expect((f.x * to.x + f.z * to.z) / Math.hypot(to.x, to.z)).toBeGreaterThan(0.99);
    });

    test("the stepping stones, the gallery walk and the planters keep their room", () => {
      const west = U.x - U.plinthHalf - 0.03;
      expect(west).toBeGreaterThan(0.12 + 0.25 + 0.4); // the stones span x -0.1..0.52 (homeHouse.ts); a body's width beyond them
      expect(U.z + U.plinthHalf + 0.03).toBeLessThan(ROOMS.gallery.z0 - 0.4); // well south of the gallery walk (z from -3.2)
      expect(west).toBeGreaterThan(PERISTYLE_POOL.x + PERISTYLE_POOL.r + 0.1); // the pool's rim
      expect(U.x + U.plinthHalf + 0.03).toBeLessThan(2.4); // the east planters start at x 2.4 (2.55)
    });

    test("it adds one small collider to the house, and the stepping stones and the gallery walk stay free of it", () => {
      const house = buildHomeHouse(terrainHeight);
      const [wx, wz] = world(U.x, U.z);
      const mine = house.colliders.filter((c) => c.kind === "obb" && Math.hypot(c.x - wx, c.z - wz) < 1e-6);
      expect(mine).toHaveLength(1);
      const m = mine[0]! as { halfW: number; halfD: number };
      expect(m.halfW).toBeLessThan(0.3);
      expect(m.halfD).toBeLessThan(0.3);
      // a walker on the stones (homeHouse.ts: x 0.15 / 0.27, z -3.35 to -4.19) and along the gallery is not pushed by it
      const walk: [number, number][] = [[0.15, -3.35], [0.27, -3.63], [0.15, -3.91], [0.27, -4.19], [0.5, -2.8], [1.2, -2.8], [2.1, -2.8], [3.0, -2.8], [2.1, -3.2]];
      for (const [lx, lz] of walk) {
        const [px, pz] = world(lx, lz);
        const pushed = pushOutOf(mine[0]!, px, pz, 0.3);
        expect(Math.hypot(pushed.x - px, pushed.z - pz)).toBe(0);
      }
    });

    test("the court stays open to the sky over it, and the plinth is inside the walls", () => {
      const house = buildHomeHouse(terrainHeight);
      expect(OPEN_SKY.some((r) => inRect(r, U.x, U.z))).toBe(true);
      const [wx, wz] = world(U.x, U.z);
      expect(house.inside(wx, wz)).toBe(true);
      expect(house.sheltered(wx, wz)).toBe(false);
    });
  });

  describe("the market", () => {
    const market = DRESSING_PIECES.filter((q) => q.site === "market");
    // a piece's position in its stall's own frame
    const inStall = (q: (typeof market)[number]) => {
      const [bx, bz, rot] = MARKET_BOOTHS[q.booth!]!;
      const dx = q.x - bx, dz = q.z - bz;
      return { lx: dx * Math.cos(rot) - dz * Math.sin(rot), lz: dx * Math.sin(rot) + dz * Math.cos(rot) };
    };

    test("the stalls stand where they stood", () => {
      expect(MARKET_BOOTHS).toEqual([[8.5, 33.6, -Math.PI / 2], [-8.5, 33.6, Math.PI / 2], [8.5, 38.4, -Math.PI / 2]]);
    });

    test("every stall carries vases or amphorae, a basket and hanging cloth, from the pack's variety", () => {
      for (let b = 0; b < MARKET_BOOTHS.length; b++) {
        const here = market.filter((q) => q.booth === b).map((q) => q.asset);
        expect(here.some((a) => a.startsWith("vase") || a.startsWith("amphora"))).toBe(true);
        expect(here.some((a) => a.startsWith("basket"))).toBe(true);
        expect(here.filter((a) => a.startsWith("cloth")).length).toBeGreaterThanOrEqual(2);
      }
      const used = new Set(market.map((q) => q.asset));
      for (const a of ["vase_a", "vase_b", "vase_c", "amphora_a", "amphora_b", "amphora_c", "basket_fruit", "basket_grain", "bread", "cloth_a", "cloth_b", "cloth_c"] as const) expect(used.has(a)).toBe(true);
    });

    test("everything stands inside its stall's own box, so the avenue and its walkers lose nothing", () => {
      for (const q of market) {
        const { lx, lz } = inStall(q);
        expect(Math.abs(lx)).toBeLessThan(BOOTH_HALF.x - 0.1);
        expect(Math.abs(lz)).toBeLessThan(BOOTH_HALF.z - 0.05);
        expect(Math.abs(q.x)).toBeGreaterThan(7.2); // behind the stalls' front face (x 7.64 east, -7.64 west), nothing on the lane
        expect(streetDistance(q.x, q.z)).toBeGreaterThan(2);
      }
      for (const c of STALL_CRATES) {
        const [x] = boothPoint(c.booth, c.lx, c.lz);
        expect(Math.abs(x)).toBeGreaterThan(7.2);
      }
    });

    test("boothPoint is the inverse of the stall frame", () => {
      const [x, z] = boothPoint(1, 0.5, 0.3);
      expect(inStall({ ...market[0]!, booth: 1, x, z })).toEqual({ lx: expect.closeTo(0.5, 6), lz: expect.closeTo(0.3, 6) });
    });

    test("the goods keep the market's hours; the cloth is the canopy's and stays", () => {
      for (const q of market) expect(q.goods).toBe(!q.asset.startsWith("cloth"));
      const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
      expect(scene).toContain("if (piece.goods) layOutGoods(placing);");
      expect(scene).toContain("layOutGoods(placeWorld(crateUrl, { x, z, rotY: MARKET_BOOTHS[c.booth]![2] + c.rot");
      // the market's own opening and closing code is untouched
      expect(scene).toContain("goods.visible = marketOpen;");
      expect(scene).toContain("const boards = new THREE.Mesh(");
    });

    test("the cloth hangs from the canopy's front edge and ends above head height; goods stand on the floor or on the crate", () => {
      for (const q of market) {
        if (q.asset.startsWith("cloth")) {
          expect(q.lift! + q.height!).toBeCloseTo(BOOTH_CANOPY_Y, 6);
          expect(q.lift!).toBeGreaterThan(0.8);
          expect(inStall(q).lz).toBeGreaterThan(0.5); // at the front, over the opening, not the back wall
        } else {
          expect(q.lift ?? 0).toBeLessThanOrEqual(CRATE_TOP);
          expect(q.groundAt).toEqual([MARKET_BOOTHS[q.booth!]![0], MARKET_BOOTHS[q.booth!]![1]]); // the stall's floor
        }
      }
      const bread = market.find((q) => q.asset === "bread")!;
      expect(bread.lift).toBe(CRATE_TOP);
      const c = STALL_CRATES.find((k) => k.booth === bread.booth)!;
      expect(boothPoint(c.booth, c.lx, c.lz)).toEqual([bread.x, bread.z]);
    });

    test("goods stand clear of one another", () => {
      const goods = market.filter((q) => q.goods);
      for (let i = 0; i < goods.length; i++) for (let j = i + 1; j < goods.length; j++) {
        if (goods[i]!.booth !== goods[j]!.booth) continue;
        const a = goods[i]!, b = goods[j]!;
        if (a.asset === "bread" || b.asset === "bread") continue; // on the crate it stands on
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.45);
      }
    });
  });

  test("townScene places every piece from this data, parents the putto to the domus and adds only Augustus's collider", () => {
    const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    expect(scene).toContain("for (const piece of DRESSING_PIECES)");
    expect(scene).toContain("placeModel(url, homeHouse.group,");
    expect(scene).toContain("...dressingFootprints().map((f) => circ(f.x, f.z, f.r))");
    for (const f of Object.values(DRESSING_FILES)) expect(scene).toContain(`"./assets/${f}"`);
  });
});
