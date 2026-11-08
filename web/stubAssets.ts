// CI only: empty stand-ins for the licensed assets, so the web build can
// be proven on a clean clone that (rightly) holds none of them. Every
// "./assets/..." import in the client gets a zero-byte file where none
// exists; a real file is never touched. Never run this in a checkout
// you deploy from: the build would ship empty models (CLAUDE.md,
// "the trap"). It refuses to run unless CI=true or --force is given.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SRC = join(ROOT, "client", "src");
if (process.env.CI !== "true" && !process.argv.includes("--force")) {
  console.error("stubAssets: refusing outside CI (set CI=true or pass --force); a deploy must carry the real assets.");
  process.exit(1);
}
const wanted = new Set<string>();
for (const name of readdirSync(SRC)) {
  if (!/\.(ts|tsx)$/.test(name) || name.endsWith(".test.ts")) continue;
  for (const m of readFileSync(join(SRC, name), "utf8").matchAll(/["']\.\/assets\/([^"']+)["']/g)) wanted.add(m[1]!);
}
let made = 0;
for (const rel of wanted) {
  const path = join(SRC, "assets", rel);
  if (existsSync(path)) continue;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, new Uint8Array(0));
  made += 1;
}
console.log(`stubAssets: ${wanted.size} assets imported, ${made} stand-ins written`);
