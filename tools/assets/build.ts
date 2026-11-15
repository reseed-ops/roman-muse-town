// Task 95: build the asset inventory (tools/assets/INVENTORY.json and INVENTORY.md).
//
//   bun tools/assets/build.ts            # rewrite both files
//   bun tools/assets/build.ts --check    # exit 1 when the committed files are stale or incomplete
//
// It reads the town source (imports of client/src/assets and client/src/textures, where each
// import's name is used, the placement tables in idyllicDressing.ts and colosseumSetting.ts), the
// files themselves (bytes, GLB/VRM triangle counts, image sizes) and tools/assets/fbx-stats.json
// (FBX triangle counts, from fbx_stats.py). Nothing in the town is changed or moved.
// The licensed files are not in git: on a clone without them the script stops and says so.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { DRESSING_FILES, DRESSING_PIECES } from "../../client/src/idyllicDressing";
import { SETTING_FILES, SETTING_PIECES } from "../../client/src/colosseumSetting";

const ROOT = join(import.meta.dir, "../..");
const SRC = join(ROOT, "client/src");
const OUT_JSON = join(import.meta.dir, "INVENTORY.json");
const OUT_MD = join(import.meta.dir, "INVENTORY.md");
const HOME = process.env.HOME ?? "";

// ---------------------------------------------------------------- provenance
const HAL = "Roman Empire, Stylized Low Poly (HALBERSTRAM ART)";
const IDY = "Idyllic Rome (Unity Asset Store)";
const KI_BASIC = "Human Basic Motions (Kevin Iglesias)";
const KI_DANCE = "Human Dance Animations (Kevin Iglesias)";
const KI_OUT = "BUNDLE Outdoor Animations, FBX (Kevin Iglesias)";
const WED = "Wedding - Banquet, Cake & Characters (Absurdox Lab, RenderHub), recoloured by tools/wedding/recolour.py";

/** The pack file a converted asset was made from, where ASSETS.md records one (its tables and rebuild record). */
const MADE_FROM: Record<string, string> = {
  "idyllic/colosseum.glb": "SM_amphitheatre_rome", "idyllic/stairs.glb": "SM_staircase_01",
  "idyllic/house_a.glb": "SM_house_building_01", "idyllic/house_b.glb": "SM_house_building_02",
  "idyllic/insula.glb": "SM_insulae_building_01", "idyllic/statue_soldier.glb": "SM_sculpture_soldier",
  "idyllic/statue_general.glb": "SM_sculpture_general", "idyllic/podest.glb": "SM_podest_rome_01",
  "idyllic/banner.glb": "SM_banner_rome_01",
  "statuary/athena.glb": "SM_sculpture_athena", "statuary/augustus.glb": "SM_sculpture_augustus",
  "statuary/putto.glb": "SM_sculpture_putti_01", "statuary/podest.glb": "SM_podest_rome_01",
  "market/vase_a.glb": "SM_vase_painted_01", "market/vase_b.glb": "SM_vase_painted_02", "market/vase_c.glb": "SM_vase_painted_03",
  "market/amphora_a.glb": "SM_amphora_01", "market/amphora_b.glb": "SM_amphora_02", "market/amphora_c.glb": "SM_amphora_03",
  "market/basket_fruit.glb": "SM_basket_fruit_01", "market/basket_grain.glb": "SM_basket_grain", "market/bread.glb": "SM_bread_01",
  "market/cloth_a.glb": "SM_cloth_hanging_01", "market/cloth_b.glb": "SM_cloth_hanging_02", "market/cloth_c.glb": "SM_cloth_hanging_03",
  "wedding/flower_arch.glb": "wedding_merge_flower_05", "wedding/flammeum_stand.glb": "wedding_veil_long",
  "wedding/table_round.glb": "wedding_table_round_dressed_classic", "wedding/table_long.glb": "wedding_table_long_dressed_classic",
  "wedding/cake.glb": "wedding_cake_classic_3", "wedding/ring_box.glb": "wedding_ring_box_open",
  "roman/senate.glb": "SM_senate", "roman/annex_sidechat.glb": "SM_attachment_building_01", "roman/villa_stories.glb": "SM_villa_roman_01",
  "roman/house_sounds.glb": "SM_house_roman_01", "roman/house_garden.glb": "SM_house_roman_02", "roman/insulae_recipes.glb": "SM_insulae_building_02",
  "roman/temple.glb": "SM_temple", "roman/pavilion_stars.glb": "SM_pavillion", "roman/gladius.glb": "SM_weapon_gladius", "roman/shield_legionaire.glb": "SM_shield_legionaire",
  "roman/torch.fbx": "SM_torch", "roman/palette.png": "M_colorpalette_BaseColor", "roman/water_normal.png": "M_water_Normal",
  "greek_atlas.png": "Textures/Greek_Combined.png", "wolf.glb": "Dire_Wolf_Lite.glb (unchanged)",
};

interface Provenance { pack: string; origin: "pack" | "owner-made" | "code-built" | "ai-generated" | "cc0"; licence: string }
function provenance(file: string): Provenance {
  const EULA = "Asset Store EULA: embed only";
  if (file === "muse-avatar.vrm") return { pack: "pixiv VRoid sample model (AvatarSample_M)", origin: "pack", licence: "VRoid terms; tracked in git" };
  if (file === "centurion.vrm") return { pack: "owner-built in VRoid Studio (Gaius)", origin: "owner-made", licence: "owner's own" };
  if (file === "trees_pack.glb") return { pack: "Low Poly Trees (itch.io)", origin: "cc0", licence: "CC0; tracked in git" };
  if (file === "wolf.glb") return { pack: "Dire Wolf Lite (Literock, itch.io)", origin: "pack", licence: "free; embed only" };
  if (file.startsWith("phoenix")) return { pack: "Low Poly Legend Phoenix (PULSAR BYTES)", origin: "pack", licence: EULA };
  if (file === "stars-fall-song.mp3") return { pack: "the project's own song for the summit scene", origin: "ai-generated", licence: "AI generated for the town" };
  if (file === "greek_atlas.png" || file.startsWith("greek/")) return { pack: "Greek Low Poly pack (Unity Asset Store)", origin: "pack", licence: EULA };
  if (file.startsWith("pets/")) return { pack: "Animated Pets & Farm Animals (HONETi)", origin: "pack", licence: EULA };
  if (file.startsWith("ships/")) return { pack: "Ancient trade ship + Low-poly Greek Trireme (Alin Loghin), converted by tools/ships/", origin: "pack", licence: EULA };
  if (file.startsWith("wedding/")) return { pack: WED, origin: "pack", licence: "use and modify, never resell or share" };
  if (file.startsWith("idyllic/") || file.startsWith("statuary/") || file.startsWith("market/")) return { pack: IDY + ", slimmed by tools/idyllic/slim.py", origin: "pack", licence: EULA };
  if (file.startsWith("roman/")) return { pack: HAL, origin: "pack", licence: EULA };
  if (file.startsWith("anim/outdoor/")) return { pack: KI_OUT, origin: "pack", licence: EULA };
  if (file.startsWith("anim/")) return { pack: /dance|pose/.test(file) ? KI_DANCE : KI_BASIC, origin: "pack", licence: EULA };
  if (file.startsWith("textures/")) return { pack: "generated by loom (tools/textures/town.tx.js)", origin: "code-built", licence: "ours; tracked in git" };
  return { pack: "unknown", origin: "pack", licence: "?" };
}

// ---------------------------------------------------------------- file facts
type Kind = "building" | "prop" | "nature" | "statue" | "character" | "animation" | "animal" | "ship" | "wedding" | "texture" | "audio" | "weapon";

function kindOf(file: string): Kind {
  if (/\.(png|jpg|jpeg)$/.test(file)) return "texture";
  if (file.endsWith(".mp3")) return "audio";
  if (file.endsWith(".vrm")) return "character";
  if (file.startsWith("anim/")) return "animation";
  if (file.startsWith("pets/") || file.startsWith("wolf") || file.startsWith("phoenix")) return "animal";
  if (file.startsWith("ships/")) return "ship";
  if (file.startsWith("wedding/")) return "wedding";
  if (file.startsWith("statuary/") || /statue/.test(file)) return "statue";
  if (/gladius|shield/.test(file)) return "weapon";
  if (/tree|bush|conifer|cypress|olive|flower|grass|rock/.test(file)) return "nature";
  if (/colosseum|stairs|house|insula|senate|annex|villa|temple|pavilion|aqueduct|arch|booth|column/.test(file)) return "building";
  return "prop";
}

/** The glTF JSON of a .glb/.vrm, read straight off the file. */
function readGltf(path: string): any | null {
  const b = readFileSync(path);
  if (b.readUInt32LE(0) !== 0x46546c67) return null;
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString("utf8"));
}

function gltfStats(path: string): { triangles: number; meshes: number; materials: number; images: number } | null {
  const g = readGltf(path);
  if (!g) return null;
  let tris = 0;
  // Triangles of every mesh once per node that instances it (the town draws each instance).
  const perMesh = (g.meshes ?? []).map((m: any) => (m.primitives ?? []).reduce((n: number, p: any) => {
    if ((p.mode ?? 4) !== 4) return n;
    const acc = p.indices !== undefined ? g.accessors[p.indices] : g.accessors[p.attributes.POSITION];
    return n + Math.floor(acc.count / 3);
  }, 0));
  const used = new Set<number>();
  for (const n of g.nodes ?? []) if (n.mesh !== undefined) { tris += perMesh[n.mesh]; used.add(n.mesh); }
  return { triangles: tris, meshes: used.size, materials: (g.materials ?? []).length, images: (g.images ?? []).length };
}

function imageSize(path: string): [number, number] | null {
  const b = readFileSync(path);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1]!;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

// ---------------------------------------------------------------- source scan
interface Ref { file: string; line: number; text: string }
interface Use { importedIn: string; importLine: number; name: string; refs: Ref[]; comment: string; primary?: Ref }

const SCAN = ["townScene.ts", "App.tsx", "groundTextures.ts"];
const IMPORT_RE = /^import (\w+) from "\.\/(assets|textures)\/([^"]+)";/;

function scanImports(): Map<string, Use[]> {
  const uses = new Map<string, Use[]>();
  for (const f of SCAN) {
    const lines = readFileSync(join(SRC, f), "utf8").split("\n");
    lines.forEach((ln, i) => {
      const m = IMPORT_RE.exec(ln);
      if (!m) return;
      const [, name, dir, rel] = m;
      const key = dir === "textures" ? `textures/${rel}` : rel!;
      const re = new RegExp(`\\b${name}\\b`);
      const refs: Ref[] = [];
      lines.forEach((l2, j) => {
        if (j !== i && re.test(l2) && !IMPORT_RE.test(l2)) refs.push({ file: `client/src/${f}`, line: j + 1, text: l2.trim().slice(0, 150) });
      });
      // the comment block just above the first use is the town's own note on the place
      let comment = "";
      // the call that places it (placeWorld, placeFbx, loadAnimal, ...), not the preload lists
      const primary = refs.find((r) => /\b(place\w*|load\w*|add\w*)\(/.test(r.text)) ?? refs[refs.length - 1];
      if (primary) {
        // only a note directly above the call is the town's note on it; an older block further up may be about something else
        for (let j = primary.line - 2; j >= Math.max(0, primary.line - 8); j--) {
          const t = lines[j]!.trim();
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) comment = t.replace(/^(\/\/+|\*+\/?|\/\*+)\s?/, "") + (comment ? " " + comment : "");
          else break;
        }
      }
      const list = uses.get(key) ?? [];
      list.push({ importedIn: `client/src/${f}`, importLine: i + 1, name: name!, refs, comment: comment.slice(0, 220), primary });
      uses.set(key, list);
    });
  }
  return uses;
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** Where the data tables put a file (the placements the scene reads, not the import's call sites). */
function tablePlaces(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (file: string, s: string) => out.set(file, [...(out.get(file) ?? []), s]);
  for (const p of SETTING_PIECES) {
    add(SETTING_FILES[p.asset], `${p.id} at (${fmt(p.x)}, ${fmt(p.z)}) [colosseumSetting.ts SETTING_PIECES]`);
  }
  for (const p of DRESSING_PIECES) {
    const at = p.frame === "home" ? `domus-local (${fmt(p.x)}, ${fmt(p.z)})` : `(${fmt(p.x)}, ${fmt(p.z)})`;
    add(DRESSING_FILES[p.asset], `${p.site} ${p.id} at ${at}${p.booth !== undefined ? `, stall ${p.booth}` : ""} [idyllicDressing.ts DRESSING_PIECES]`);
  }
  return out;
}

// ---------------------------------------------------------------- pack contents (what exists but is unused)
// Pathname lists were taken from the packs on the box (the unitypackages' own `pathname` entries; see README).
// Used = the pack mesh an inventoried asset was made from (MADE_FROM) or named like it.
function readPack(name: string): string[] {
  const p = join(import.meta.dir, "packs", name);
  return existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean) : [];
}

// ---------------------------------------------------------------- build
interface Asset {
  file: string; kind: Kind; pack: string; origin: string; licence: string; madeFrom?: string;
  bytes: number; triangles?: number; image?: string; materials?: number;
  status: "used" | "unused"; where: string[]; note: string; uses: { file: string; line: number; text: string }[];
}

export function build() {
  const assetsDir = join(SRC, "assets");
  if (!existsSync(assetsDir) || walk(assetsDir).length < 150) {
    throw new Error("client/src/assets is not complete here (the licensed files are not in git); run this on the box that holds all 157.");
  }
  const fbx: Record<string, { triangles: number; materials: number }> = JSON.parse(readFileSync(join(import.meta.dir, "fbx-stats.json"), "utf8"));
  const imports = scanImports();
  const tables = tablePlaces();
  const files = [
    ...walk(assetsDir).map((p) => relative(assetsDir, p)),
    ...walk(join(SRC, "textures")).map((p) => "textures/" + relative(join(SRC, "textures"), p)),
  ].sort();

  const assets: Asset[] = files.map((file) => {
    const abs = file.startsWith("textures/") ? join(SRC, file) : join(assetsDir, file);
    const pv = provenance(file);
    const a: Asset = {
      file, kind: file.startsWith("textures/") ? "texture" : kindOf(file), pack: pv.pack, origin: pv.origin, licence: pv.licence,
      madeFrom: MADE_FROM[file], bytes: statSync(abs).size, status: "unused", where: [], note: "", uses: [],
    };
    if (/\.(glb|vrm)$/.test(file)) { const s = gltfStats(abs); if (s) { a.triangles = s.triangles; a.materials = s.materials; } }
    if (file.endsWith(".fbx") && fbx[file]) { a.triangles = fbx[file]!.triangles; a.materials = fbx[file]!.materials; }
    if (/\.(png|jpg)$/.test(file)) { const d = imageSize(abs); if (d) a.image = `${d[0]}x${d[1]}`; }
    const u = imports.get(file) ?? [];
    for (const x of u) a.uses.push(...x.refs.slice(0, 8).map((r) => ({ file: r.file, line: r.line, text: r.text })));
    if (u.length) {
      a.status = "used";
      a.note = u.find((x) => x.comment)?.comment ?? "";
      // coordinates written in the call sites: x: 8.8, z: 4.6
      for (const r of u.flatMap((x) => x.refs)) {
        const m = /x:\s*(-?[\d.]+),\s*z:\s*(-?[\d.]+)/.exec(r.text);
        if (m) a.where.push(`(${m[1]}, ${m[2]}) [${r.file.split("/").pop()}:${r.line}]`);
      }
    }
    for (const t of tables.get(file) ?? []) a.where.push(t);
    if (u.length && !a.where.length && u[0]!.primary) a.where.push(`${u[0]!.primary.file.split("/").pop()}:${u[0]!.primary.line} \`${u[0]!.primary.text.slice(0, 90)}\``);
    a.where = [...new Set(a.where)].slice(0, 14);
    return a;
  });

  // pack pieces that are NOT in the town: every mesh in the packs minus what the town was made from
  const madeFrom = new Set(Object.values(MADE_FROM).map((s) => s.replace(/\.glb.*$/, "").toLowerCase()));
  const packs = [
    { name: IDY, file: "idyllic.txt", box: "~/work/idyllic-rome/extracted (pathname per GUID folder)" },
    { name: "Wedding - Banquet, Cake & Characters (Mobile set)", file: "wedding.txt", box: "~/work/wedding-pack-x/Wedding_Banquet_Cake_Characters/Mobile" },
    { name: HAL + " (the box's unitypackage is truncated, so this list is partial)", file: "roman.txt", box: "~/work/unitypackages/Roman Empire - Stylized Low Poly.unitypackage" },
    { name: "Greek Low Poly pack", file: "greek.txt", box: "~/work/unitypackages/Greek Low Poly Pack.unitypackage" },
    { name: "Animated Pets & Farm Animals", file: "pets.txt", box: "~/work/unitypackages/Animated Pets and Farm Animals Pack.unitypackage" },
  ].map((p) => {
    const all = readPack(p.file);
    const unused = all.filter((m) => !madeFrom.has(m.toLowerCase()) && !inTownByName(m, assets));
    return { ...p, total: all.length, unused };
  });

  const summary = {
    generated: "by tools/assets/build.ts",
    totalFiles: assets.length,
    assetsFolder: assets.filter((a) => !a.file.startsWith("textures/")).length,
    used: assets.filter((a) => a.status === "used").length,
    unusedInFolder: assets.filter((a) => a.status === "unused").map((a) => a.file),
    bytes: assets.reduce((n, a) => n + a.bytes, 0),
  };
  return { summary, assets, packs: packs.map((p) => ({ name: p.name, source: p.box, meshesListed: p.total, notInTown: p.unused })) };
}

/** A pack mesh counts as in the town when an inventoried file carries its name (SM_wolf -> wolf.glb, torch, ...). */
function inTownByName(mesh: string, assets: Asset[]): boolean {
  const m = mesh.toLowerCase().replace(/^sm_/, "").replace(/\.\w+$/, "");
  return assets.some((a) => a.madeFrom?.toLowerCase().replace(/^sm_/, "").replace(/\.glb.*$/, "") === m || a.file.toLowerCase().replace(/\.\w+$/, "").split("/").pop() === m);
}

function markdown(inv: ReturnType<typeof build>): string {
  const L: string[] = [];
  const s = inv.summary;
  L.push("# Asset inventory", "",
    "Generated by `tools/assets/build.ts` from the town source and the files; do not edit by hand (run `bun tools/assets/build.ts`).",
    "Search it with `bun tools/assets/search.ts <words>` (see `tools/assets/README.md`).", "",
    `- ${s.assetsFolder} files in \`client/src/assets/\` plus ${s.totalFiles - s.assetsFolder} loom ground textures in \`client/src/textures/\` = ${s.totalFiles}.`,
    `- ${s.used} are imported by the town source; ${s.unusedInFolder.length} are in the folder but unused: ${s.unusedInFolder.map((f) => "`" + f + "`").join(", ") || "none"}.`,
    `- ${(s.bytes / 1e6).toFixed(1)} MB in all. Triangles are read from the GLB/VRM accessors (counted once per node that instances a mesh) and, for FBX, from Blender (\`fbx-stats.json\`); animation clips and images have none.`, "");
  const groups = new Map<string, Asset[]>();
  for (const a of inv.assets) { const g = a.file.includes("/") ? a.file.split("/")[0]! : "(root)"; (groups.get(g) ?? groups.set(g, []).get(g)!).push(a); }
  for (const [g, list] of [...groups].sort()) {
    L.push(`## ${g === "(root)" ? "client/src/assets/ (root)" : g + "/"}`, "", "| File | Kind | Pack / made from | KB | Tris | Status | Where it is placed |", "| --- | --- | --- | ---: | ---: | --- | --- |");
    for (const a of list) {
      const from = a.madeFrom ? `${a.pack.split(" (")[0]}: \`${a.madeFrom}\`` : a.pack;
      const where = a.status === "unused" ? "unused" : (a.where.slice(0, 3).join("; ") + (a.where.length > 3 ? ` (+${a.where.length - 3})` : "") + (a.note ? ` — ${a.note.slice(0, 110)}` : ""));
      L.push(`| \`${a.file}\` | ${a.kind} | ${from.replace(/\|/g, "/")} | ${Math.round(a.bytes / 1024)} | ${a.triangles ?? a.image ?? ""} | ${a.status} | ${where.replace(/\|/g, "/")} |`);
    }
    L.push("");
  }
  L.push("## Pack pieces the town does not use", "",
    "Meshes that exist in the packs on the box and are not in `client/src/assets/` (by pack file name). Lists are in `tools/assets/packs/`; refresh them as the README says.", "");
  for (const p of inv.packs) {
    L.push(`### ${p.name}`, "", `Source: ${p.source}. ${p.meshesListed} meshes listed, ${p.notInTown.length} not in the town.`, "",
      p.notInTown.length ? p.notInTown.map((m) => "`" + m + "`").join(", ") : "(list missing: see README)", "");
  }
  return L.join("\n");
}

if (import.meta.main) {
  const inv = build();
  const json = JSON.stringify(inv, null, 1) + "\n";
  const md = markdown(inv) + "\n";
  if (process.argv.includes("--check")) {
    const stale = !existsSync(OUT_JSON) || readFileSync(OUT_JSON, "utf8") !== json || readFileSync(OUT_MD, "utf8") !== md;
    console.log(stale ? "INVENTORY is stale: run bun tools/assets/build.ts" : "INVENTORY is current");
    process.exit(stale ? 1 : 0);
  }
  writeFileSync(OUT_JSON, json);
  writeFileSync(OUT_MD, md);
  const s = inv.summary;
  console.log(`${s.totalFiles} files (${s.assetsFolder} in assets/), ${s.used} used, unused in folder: ${s.unusedInFolder.join(", ")}`);
  void dirname; void HOME;
}
