/**
 * Configuration (Task 6): environment only. The owner's key never
 * enters the repo; caps and cadences have safe defaults; the director
 * is OFF unless DIRECTOR_ENABLED=true.
 */
export type BridgeConfig = {
  enabled: boolean;
  channel: "seam" | "bridge";
  harnessUrl: string;
  /** The per-installation token the town presents (Task 7); never in the repo. */
  bridgeToken: string | null;
  port: number;
  allowOrigin: string;
  snapshotLapseMs: number;
  apiKey: string | null;
  model: string;
  packPath: string;
  ledgerPath: string | null;
  pollMs: number;
  intentionEveryMs: number;
  sightEveryMs: number;
  dailyCalls: number;
  dailyOutputTokens: number;
  dailyFrames: number;
  greeting: string | null;
};

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function readConfig(env: Record<string, string | undefined> = process.env): BridgeConfig {
  return {
    enabled: env.DIRECTOR_ENABLED === "true" || env.DIRECTOR_ENABLED === "1",
    channel: env.DIRECTOR_CHANNEL === "bridge" || env.DIRECTOR_CHANNEL === "slate" ? "bridge" : "seam",
    harnessUrl: env.HARNESS_URL || "http://localhost:8787",
    bridgeToken: env.BRIDGE_TOKEN || null,
    port: num(env.PORT, 8790),
    allowOrigin: env.BRIDGE_ALLOW_ORIGIN || "*",
    snapshotLapseMs: num(env.SNAPSHOT_LAPSE_MS, 30_000),
    apiKey: env.ANTHROPIC_API_KEY || null,
    model: env.DIRECTOR_MODEL || "claude-opus-5-5",
    packPath: env.PACK_PATH || "./pack.md",
    ledgerPath: env.LEDGER_PATH === "" ? null : (env.LEDGER_PATH ?? "./ledger.json"),
    pollMs: num(env.POLL_MS, 2000),
    intentionEveryMs: num(env.INTENTION_EVERY_MS, 5 * 60 * 1000),
    sightEveryMs: num(env.SIGHT_EVERY_MS, 5 * 60 * 1000),
    dailyCalls: num(env.DAILY_CALL_CAP, 200),
    dailyOutputTokens: num(env.DAILY_OUTPUT_TOKEN_CAP, 60_000),
    dailyFrames: num(env.DAILY_FRAME_CAP, 60),
    greeting: env.DIRECTOR_GREETING || null,
  };
}
