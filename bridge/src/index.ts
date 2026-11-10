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
import { trustProxyFromEnv } from "./pairLimiter.js";
import { startPrincipalServer, type PairOutcome } from "./principalServer.js";
import { createTenantRegistry, sealKey, sealVisitorKey, unsealVisitorKey, TENANT_POLL_MS } from "./tenants.js";
import { DIRECTOR_TOKEN_HEADER } from "../../shared/visitProtocol.js";

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
    const desk = principal;
    setInterval(() => void desk.pump(), 250).unref();
    principalFace = ` principal=on (claim lapses after ${Math.round(cfg.principalClaimMs / 1000)} s; marker token ${cfg.principalMarkerToken ? "set" : "not set"})`;
  }
  // Many towns (Task 29): any visitor's town pairs to its own Muse.
  let resolvePaired: ((presented: string | null) => PrincipalDesk | null) | undefined;
  let pair: ((code: unknown) => Promise<PairOutcome>) | undefined;
  if (cfg.channel === "town" && cfg.pairing && cfg.townUrl && cfg.directorToken) {
    const townUrl = cfg.townUrl.replace(/\/+$/, "");
    const directorToken = cfg.directorToken;
    const key = sealKey({ pairingSecret: cfg.pairingSecret, directorToken });
    const tenants = createTenantRegistry({
      channelFor: (visitorToken) => createTownChannel({ townUrl, directorToken, visitorToken }),
      claimMs: cfg.principalClaimMs,
      log,
    });
    setInterval(() => void tenants.pumpAll(), 250).unref();
    let observing = false;
    setInterval(() => {
      if (observing) return;
      observing = true;
      void tenants.observeAll().finally(() => {
        observing = false;
      });
    }, TENANT_POLL_MS).unref();
    const owner = principal;
    resolvePaired = (presented) => {
      const visitorToken = unsealVisitorKey(key, presented);
      if (!visitorToken) return null;
      // The owner pairing his own town reaches his own desk, not a second one.
      if (owner && visitorToken === cfg.visitorToken) return owner;
      return tenants.deskFor(visitorToken);
    };
    pair = async (code) => {
      if (typeof code !== "string" || code.length > 40) return { ok: false, status: 400, error: "a pairing code is required" };
      try {
        const res = await fetch(`${townUrl}/director/pair-redeem`, {
          method: "POST",
          headers: { "content-type": "application/json", [DIRECTOR_TOKEN_HEADER]: directorToken },
          body: JSON.stringify({ code }),
          signal: AbortSignal.timeout(6000),
        });
        if (res.status === 429) return { ok: false, status: 429, error: "too many attempts; wait a minute and try again" };
        if (res.status !== 200) return { ok: false, status: 404, error: "that code is unknown or has expired; make a new one in the town (menu, Connect my Muse)" };
        const body = (await res.json()) as { visitorToken?: unknown };
        if (typeof body.visitorToken !== "string") return { ok: false, status: 502, error: "the town answered oddly; try again" };
        log("pair: a town was paired");
        return { ok: true, principalToken: sealVisitorKey(key, body.visitorToken) };
      } catch {
        return { ok: false, status: 502, error: "the town could not be reached; try again" };
      }
    };
  }
  if (principal || pair) {
    const server = await startPrincipalServer({
      desk: principal ?? null,
      token: principal ? cfg.principalToken : null,
      markerToken: cfg.principalMarkerToken,
      ...(resolvePaired ? { resolve: resolvePaired } : {}),
      ...(pair ? { pair } : {}),
      trustProxy: trustProxyFromEnv(process.env),
      port: cfg.port,
      log,
    });
    principalFace += ` principal=serving on :${server.port}${pair ? " pairing=on" : ""}`;
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
