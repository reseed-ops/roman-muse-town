/**
 * The Live Bridge (Task 6): entry point. Wires the channel adapter,
 * the pack loader, the cost ledger, the Anthropic mind, and the
 * director loop from the environment, and runs until stopped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createAnthropicMind } from "./anthropicMind.js";
import { readConfig } from "./config.js";
import { createCostLedger, type LedgerDay } from "./costCaps.js";
import { createDirector } from "./director.js";
import { createPackLoader, filePackSource } from "./pack.js";
import { createSeamAdapter } from "./seamAdapter.js";
import { createSlateFace } from "./slateFace.js";
import { startBridgeServer } from "./bridgeServer.js";
import { createTownChannel } from "./townChannel.js";
import type { DirectorChannel } from "./channel.js";
import { createFakeChannel } from "./fakeChannel.js";
import { createPrincipalDesk, type PrincipalDesk } from "./principal.js";
import { startPrincipalServer } from "./principalServer.js";

const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

async function main(): Promise<void> {
  const cfg = readConfig();
  if (!cfg.enabled) {
    log("DIRECTOR_ENABLED is not true: the director idles; any visit lapses by heartbeat. Set it to true to direct.");
  }
  if (cfg.enabled && !cfg.apiKey) {
    log("ANTHROPIC_API_KEY is missing; the director cannot answer. Idling.");
  }
  let channel: DirectorChannel;
  let face = "";
  let principal: PrincipalDesk | undefined;
  let principalFace = "";
  if (cfg.channel === "bridge") {
    // Adapter B (Task 7): the town client calls out to this face. With
    // no token set the face does not serve: the channel reads closed
    // and the director idles, and nothing is ever answered unauthenticated.
    const slate = createSlateFace({ lapseMs: cfg.snapshotLapseMs });
    channel = slate.channel;
    if (!cfg.bridgeToken) {
      log("BRIDGE_TOKEN is missing; the director face will not serve. Idling.");
      face = "(not serving: no BRIDGE_TOKEN)";
    } else {
      const server = await startBridgeServer({ face: slate, token: cfg.bridgeToken, port: cfg.port, allowOrigin: cfg.allowOrigin, log });
      face = `serving on :${server.port}`;
    }
  } else if (cfg.channel === "town") {
    // The hosted town's door (Task 8): this bridge directs one visitor's
    // town through the locked visit actions. Without all three settings
    // the channel reads closed and the director idles.
    if (!cfg.townUrl || !cfg.directorToken || !cfg.visitorToken) {
      log("TOWN_URL, DIRECTOR_TOKEN and VISITOR_TOKEN are all required for the town channel; the director idles.");
      channel = createFakeChannel();
      face = "(not directing: town settings missing)";
    } else {
      channel = createTownChannel({ townUrl: cfg.townUrl, directorToken: cfg.directorToken, visitorToken: cfg.visitorToken });
      face = cfg.townUrl;
      principalFace = " principal=off (no PRINCIPAL_TOKEN)";
    }
  } else {
    channel = createSeamAdapter({ baseUrl: cfg.harnessUrl });
    face = cfg.harnessUrl;
  }
  let initial: LedgerDay | null = null;
  if (cfg.ledgerPath) {
    try {
      initial = JSON.parse(readFileSync(cfg.ledgerPath, "utf8")) as LedgerDay;
    } catch {
      initial = null;
    }
  }
  const ledger = createCostLedger(
    { dailyCalls: cfg.dailyCalls, dailyOutputTokens: cfg.dailyOutputTokens, dailyFrames: cfg.dailyFrames },
    {
      initial,
      persist: (day) => {
        if (!cfg.ledgerPath) return;
        try {
          writeFileSync(cfg.ledgerPath, JSON.stringify(day));
        } catch (error) {
          log(`ledger: could not persist (${error instanceof Error ? error.message : String(error)})`);
        }
      },
    },
  );
  const pack = createPackLoader(filePackSource(cfg.packPath), { log });
  if (cfg.channel === "town" && cfg.principalToken && cfg.townUrl && cfg.directorToken && cfg.visitorToken) {
    // The principal channel (Task 22): her own door on this bridge.
    principal = createPrincipalDesk({ channel, rank: () => pack.current().rank ?? 0, claimMs: cfg.principalClaimMs, log });
    const server = await startPrincipalServer({ desk: principal, token: cfg.principalToken, markerToken: cfg.principalMarkerToken, port: cfg.port, log });
    const desk = principal;
    setInterval(() => void desk.pump(), 250).unref();
    principalFace = ` principal=serving on :${server.port} (claim lapses after ${Math.round(cfg.principalClaimMs / 1000)} s; marker token ${cfg.principalMarkerToken ? "set" : "not set"})`;
  }
  const mind = createAnthropicMind({ apiKey: cfg.apiKey ?? undefined, model: cfg.model });
  const director = createDirector({
    channel,
    mind,
    pack,
    ledger,
    log,
    ...(principal ? { principal } : {}),
    config: {
      enabled: cfg.enabled && !!cfg.apiKey,
      pollMs: cfg.pollMs,
      intentionEveryMs: cfg.intentionEveryMs,
      sightEveryMs: cfg.sightEveryMs,
      ...(cfg.greeting ? { greeting: cfg.greeting } : {}),
    },
  });
  const stop = () => {
    log("stopping");
    director.stop();
    // The loop may be mid-sleep; leave promptly rather than at the next beat.
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  log(`live bridge: channel=${cfg.channel} ${face} model=${cfg.model} pack=${cfg.packPath}${principalFace}`);
  void director.run();
}

void main();
