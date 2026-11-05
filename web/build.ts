// The web build (Task 8): the town's client, its service worker and
// manifest, and the server, into web/dist. Run from the repository
// root: `bun run web/build.ts` (bun run build:web).
//
// The client build is this file's own Bun.build, not the SDK's
// buildClient: the artifact build (client/build.mjs) stays untouched,
// and here the two SDK packages are aliased to the shims in web/shim.
// Everything the client is, it stays: client/src is read, never edited,
// and the one addition is the meta tag that tells it it is hosted.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { drawIcon } from "./icon";
import { buildPacks } from "./assetPack";
import { relative, sep } from "node:path";

// The Tailwind plugin carries a native module. On a machine whose
// checkout sits on a mount that cannot map shared objects (an Android
// dev box, say), point MUSE_TAILWIND_PLUGIN at a copy of
// node_modules/bun-plugin-tailwind/index.js elsewhere; Railway needs
// nothing of the kind.
const tailwind: import("bun").BunPlugin = (await import(process.env.MUSE_TAILWIND_PLUGIN || "bun-plugin-tailwind")).default;

const ROOT = resolve(import.meta.dir, "..");
const OUT = join(ROOT, "web", "dist");
const CLIENT_OUT = join(OUT, "client");
const ASSETS_DIR = join(ROOT, "client", "src", "assets");
/** Files larger than this are cached on first use, not at install. */
const PRECACHE_MAX_BYTES = 3 * 1024 * 1024;
const ASSET_LOADERS = Object.fromEntries([".vrm", ".fbx", ".glb", ".gltf", ".png", ".jpg", ".jpeg", ".webp", ".mp3", ".ogg", ".wav", ".wasm", ".bin", ".onnx"].map((ext) => [ext, "file" as const]));

const alias = (map: Record<string, string>): import("bun").BunPlugin => ({
  name: "alias",
  setup(build) {
    for (const [from, to] of Object.entries(map)) {
      const filter = new RegExp(`^${from.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`);
      build.onResolve({ filter }, () => ({ path: to }));
    }
  },
});

/** The licensed assets never leave the build as files (Task 14): every
 *  import under client/src/assets becomes a "pack:<path>" string in the
 *  bundle, and the files themselves go into a few packs written after
 *  the bundle (see web/assetPack.ts and client/src/assetPack.ts). */
const assetPack = (packed: Map<string, string>): import("bun").BunPlugin => ({
  name: "asset-pack",
  setup(build) {
    build.onLoad({ filter: /[\\/]client[\\/]src[\\/]assets[\\/].+\.(vrm|fbx|glb|gltf|png|jpg|jpeg|webp|mp3|ogg|wav)$/i }, (args) => {
      const rel = relative(ASSETS_DIR, args.path).split(sep).join("/");
      packed.set(rel, args.path);
      return { contents: `export default ${JSON.stringify(`pack:${rel}`)};`, loader: "js" };
    });
  },
});

const fail = (logs: { message: string }[]): never => {
  throw new Error(logs.map((log) => log.message).join("\n"));
};

/** index.html for the web: the artifact's shell with the built names,
 *  the hosted meta tag, the manifest and the service worker. */
export function renderIndexHtml(template: string, parts: { script: string; styles: string[]; version: string }): string {
  const head = [
    `    <meta name="muse-town-hosted" content="${parts.version}" />`,
    `    <meta name="theme-color" content="#22332b" />`,
    `    <meta name="mobile-web-app-capable" content="yes" />`,
    `    <meta name="apple-mobile-web-app-capable" content="yes" />`,
    `    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`,
    `    <link rel="manifest" href="./manifest.webmanifest" />`,
    `    <link rel="apple-touch-icon" href="./icon-192.png" />`,
    ...parts.styles.map((href) => `    <link rel="stylesheet" href="./${href}" />`),
    `    <script src="./${parts.script}" type="module"></script>`,
    `    <script>if ("serviceWorker" in navigator) addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function () {}); });</script>`,
  ].join("\n");
  const scriptTag = /^\s*<script src="\.\/src\/main\.tsx" type="module"><\/script>\s*$/m;
  if (!scriptTag.test(template)) throw new Error("client/index.html: the main script tag was not where the web build expects it");
  return template.replace(scriptTag, head);
}

export function manifest(): string {
  return JSON.stringify({
    name: "Muse Town",
    short_name: "Muse Town",
    description: "A small Roman district, and someone in it who is glad you came.",
    start_url: "./",
    scope: "./",
    display: "fullscreen",
    orientation: "any",
    background_color: "#a8d4ee",
    theme_color: "#22332b",
    icons: [
      { src: "./icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "./icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "./icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }, null, 2);
}

/** What the worker precaches: the shell and every small built file. */
export function precacheList(files: { path: string; bytes: number }[]): string[] {
  const list = ["/"];
  for (const file of files) {
    if (file.path === "index.html" || file.path === "sw.js") continue;
    // Packs are cached on first use, never at install, whatever their size.
    if (file.path.startsWith("packs/")) continue;
    if (file.bytes > PRECACHE_MAX_BYTES) continue;
    list.push(`/${file.path}`);
  }
  return list;
}

async function buildClient(): Promise<{ files: { path: string; bytes: number }[]; script: string; styles: string[]; packs: number; packedFiles: number }> {
  const packed = new Map<string, string>();
  const result = await Bun.build({
    entrypoints: [join(ROOT, "client", "src", "main.tsx")],
    outdir: CLIENT_OUT,
    target: "browser",
    format: "esm",
    minify: true,
    sourcemap: "none",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    naming: { entry: "[name]-[hash].[ext]", chunk: "[name]-[hash].[ext]", asset: "assets/[name]-[hash].[ext]" },
    loader: ASSET_LOADERS,
    plugins: [assetPack(packed), tailwind, alias({ "@hatch/space-sdk/client": join(ROOT, "web", "shim", "spaceSdkClient.ts") })],
  });
  if (!result.success) fail(result.logs);
  const built = buildPacks(
    [...packed].map(([rel, abs]) => ({ rel, bytes: new Uint8Array(readFileSync(abs)) })),
    (bytes) => createHash("sha256").update(bytes).digest("hex"),
  );
  mkdirSync(join(CLIENT_OUT, "packs"), { recursive: true });
  for (const pack of built.packs) writeFileSync(join(CLIENT_OUT, pack.file), pack.bytes);
  writeFileSync(join(CLIENT_OUT, "packs", "manifest.json"), JSON.stringify(built.manifest));
  const packFiles = [...built.packs.map((pack) => pack.file), "packs/manifest.json"].map((path) => ({ path, bytes: statSync(join(CLIENT_OUT, path)).size }));
  const worker = await Bun.build({
    entrypoints: [join(ROOT, "client", "src", "aeliaLocalChat.worker.ts")],
    outdir: CLIENT_OUT,
    naming: "[name].[ext]",
    target: "browser",
    format: "esm",
    minify: true,
    sourcemap: "none",
    loader: ASSET_LOADERS,
  });
  if (!worker.success) fail(worker.logs);
  const files = [...[...result.outputs, ...worker.outputs].map((output) => ({ path: output.path.slice(CLIENT_OUT.length + 1), bytes: statSync(output.path).size })), ...packFiles];
  const script = files.find((file) => /^main-[0-9a-z]+\.js$/i.test(file.path))?.path;
  if (!script) throw new Error("the client build produced no main bundle");
  const styles = files.filter((file) => file.path.endsWith(".css")).map((file) => file.path);
  return { files, script, styles, packs: built.packs.length, packedFiles: packed.size };
}

async function buildServiceWorker(precache: string[], version: string): Promise<void> {
  const result = await Bun.build({
    entrypoints: [join(ROOT, "web", "sw.ts")],
    outdir: CLIENT_OUT,
    naming: "[name].[ext]",
    target: "browser",
    format: "esm",
    minify: true,
    define: { __PRECACHE__: JSON.stringify(precache), __VERSION__: JSON.stringify(version) },
  });
  if (!result.success) fail(result.logs);
}

async function buildServer(): Promise<void> {
  const result = await Bun.build({
    entrypoints: [join(ROOT, "web", "src", "main.ts")],
    outdir: OUT,
    naming: "server.[ext]",
    target: "bun",
    format: "esm",
    sourcemap: "linked",
    plugins: [alias({ "@hatch/space-sdk": join(ROOT, "web", "shim", "spaceSdkServer.ts") })],
  });
  if (!result.success) fail(result.logs);
}

export async function buildWeb(): Promise<{ version: string; files: string[]; packs: number; packedFiles: number }> {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(CLIENT_OUT, { recursive: true });
  const client = await buildClient();
  for (const [name, size, maskable] of [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["icon-maskable-512.png", 512, true]] as const) {
    writeFileSync(join(CLIENT_OUT, name), drawIcon(size, maskable));
  }
  writeFileSync(join(CLIENT_OUT, "manifest.webmanifest"), manifest());
  const hash = createHash("sha256");
  for (const file of [...client.files].sort((a, b) => a.path.localeCompare(b.path))) hash.update(`${file.path}:${file.bytes}\n`);
  const version = hash.digest("hex").slice(0, 12);
  const html = renderIndexHtml(readFileSync(join(ROOT, "client", "index.html"), "utf8"), { script: client.script, styles: client.styles, version });
  writeFileSync(join(CLIENT_OUT, "index.html"), html);
  const files = [
    ...client.files,
    ...["icon-192.png", "icon-512.png", "icon-maskable-512.png", "manifest.webmanifest", "index.html"].map((path) => ({ path, bytes: statSync(join(CLIENT_OUT, path)).size })),
  ];
  await buildServiceWorker(precacheList(files), version);
  await buildServer();
  return { version, files: files.map((file) => file.path), packs: client.packs, packedFiles: client.packedFiles };
}

if (import.meta.main) {
  const built = await buildWeb();
  const total = built.files.length;
  console.log(`web build ${built.version}: ${total} client files in ${CLIENT_OUT} (${built.packedFiles} assets in ${built.packs} packs), server at ${join(OUT, "server.js")}`);
  console.log(`main: ${basename(built.files.find((file) => file.startsWith("main-")) ?? "?")}`);
}
