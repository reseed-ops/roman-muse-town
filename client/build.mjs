// Client bundle for the space.
//
// Bundling is owned by the SDK so every space produces an identical
// production-mode React bundle. See @hatch/space-sdk/build for the
// canonical Bun.build() configuration (entrypoint, outdir, NODE_ENV
// define, asset naming, tailwind plugin).

import { buildClient } from "@hatch/space-sdk/build";

await buildClient();

// Build Gemma's inference worker as its own browser module so model loading
// and token generation never run on the game and UI thread.
const workerBuild = await Bun.build({
  entrypoints: ["./src/aeliaLocalChat.worker.ts"],
  outfile: "./dist/aeliaLocalChat.worker.js",
  target: "browser",
  format: "esm",
  minify: true,
});
if (!workerBuild.success) {
  throw new Error(workerBuild.logs.map((log) => log.message).join("\n"));
}
