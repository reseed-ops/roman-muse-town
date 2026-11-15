// Search the asset inventory: bun tools/assets/search.ts [--kind K] [--pack P] [--unused|--used] [--json] [words...]
// Every word must match somewhere in the file name, kind, pack, source file, place or note (case-insensitive).
// Add --packs to search the pack pieces the town does not use instead (what is available to pull in).
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Asset { file: string; kind: string; pack: string; madeFrom?: string; bytes: number; triangles?: number; image?: string; status: string; where: string[]; note: string }
interface Inv { assets: Asset[]; packs: { name: string; source: string; notInTown: string[] }[] }

export function search(inv: Inv, args: string[]): Asset[] {
  const words: string[] = [];
  let kind = "", pack = "", status = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--kind") kind = (args[++i] ?? "").toLowerCase();
    else if (a === "--pack") pack = (args[++i] ?? "").toLowerCase();
    else if (a === "--unused") status = "unused";
    else if (a === "--used") status = "used";
    else if (!a.startsWith("--")) words.push(a.toLowerCase());
  }
  return inv.assets.filter((a) => {
    if (kind && a.kind !== kind) return false;
    if (pack && !a.pack.toLowerCase().includes(pack)) return false;
    if (status && a.status !== status) return false;
    const hay = [a.file, a.kind, a.pack, a.madeFrom ?? "", a.status, ...a.where, a.note].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const inv: Inv = JSON.parse(readFileSync(join(import.meta.dir, "INVENTORY.json"), "utf8"));
  if (args.includes("--packs")) {
    const words = args.filter((a) => !a.startsWith("--")).map((w) => w.toLowerCase());
    for (const p of inv.packs) {
      const hits = p.notInTown.filter((m) => words.every((w) => m.toLowerCase().includes(w)));
      if (hits.length) console.log(`${p.name}\n  (${p.source})\n  ${hits.join(", ")}\n`);
    }
  } else {
    const hits = search(inv, args);
    if (args.includes("--json")) console.log(JSON.stringify(hits, null, 1));
    else {
      for (const a of hits) {
        console.log(`${a.file}  [${a.kind}, ${a.status}]  ${Math.round(a.bytes / 1024)} KB${a.triangles ? `, ${a.triangles} tris` : ""}${a.image ? `, ${a.image}` : ""}`);
        console.log(`  ${a.pack}${a.madeFrom ? ` <- ${a.madeFrom}` : ""}`);
        for (const w of a.where.slice(0, 4)) console.log(`  at ${w}`);
        if (a.where.length > 4) console.log(`  (+${a.where.length - 4} more places in INVENTORY.json)`);
      }
      console.log(`${hits.length} match${hits.length === 1 ? "" : "es"}`);
    }
  }
}
