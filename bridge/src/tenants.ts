/**
 * Many towns, each with its own Muse (Task 29, Nov 8, 2026).
 *
 * Before this the bridge directed exactly one town (VISITOR_TOKEN) for
 * exactly one Muse (PRINCIPAL_TOKEN). Now any visitor can pair their
 * town to their Muse: the town mints a single-use code for its visitor
 * (web/src/pairing.ts), the Muse brings the code here (POST /pair), and
 * the bridge redeems it on the town's director-only route for that
 * visitor's key. It never stores the key: it seals it (AES-256-GCM)
 * inside the principal token it hands the Muse. Presenting that token
 * later unseals the one town it names, so:
 *
 * - the Muse never sees the visitor key or the director token;
 * - a token directs only its own town (it cannot be edited to name
 *   another: the seal is authenticated);
 * - the bridge keeps no database, and pairings survive restarts;
 * - each paired town gets its own desk (claim, held wake, waiting line,
 *   transcript), created on its first call and dropped after it has
 *   been idle, so an unpaired or quiet town costs nothing.
 *
 * Paired towns have no resident director (no API spend, no voice but
 * hers): while no Muse attends, his lines simply wait for her, and a
 * town that is never paired plays exactly as before, with Aelia's own
 * town voice. Only the owner's town (VISITOR_TOKEN) keeps its resident.
 *
 * The seal key is PAIRING_SECRET when set, otherwise derived from the
 * DIRECTOR_TOKEN. Rotating either retires every paired token at once
 * (each visitor pairs again); a town's own key changing (a new browser)
 * retires its token too.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { DirectorChannel } from "./channel.js";
import { createPrincipalDesk, type PrincipalDesk } from "./principal.js";

export const PAIRED_TOKEN_PREFIX = "mtp1.";
/** A paired town's desk is dropped after this long without a call. */
export const TENANT_IDLE_MS = 15 * 60 * 1000;
/** How often a paired town's slate is read while its Muse is about. */
export const TENANT_POLL_MS = 2000;
const VISITOR_KEY = /^[A-Za-z0-9_-]{20,96}$/;

export function sealKey(opts: { pairingSecret?: string | null; directorToken: string }): Buffer {
  return opts.pairingSecret
    ? createHash("sha256").update(`town-bridge pairing v1\n${opts.pairingSecret}`).digest()
    : createHmac("sha256", opts.directorToken).update("town-bridge pairing v1").digest();
}

export function sealVisitorKey(key: Buffer, visitorToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(visitorToken, "utf8"), cipher.final()]);
  return PAIRED_TOKEN_PREFIX + Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

/** The visitor key a paired token names, or null for anything else. */
export function unsealVisitorKey(key: Buffer, token: string | null): string | null {
  if (!token || !token.startsWith(PAIRED_TOKEN_PREFIX)) return null;
  try {
    const raw = Buffer.from(token.slice(PAIRED_TOKEN_PREFIX.length), "base64url");
    if (raw.length < 12 + 16 + 20) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const out = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
    return VISITOR_KEY.test(out) ? out : null;
  } catch {
    return null;
  }
}

export type TenantRegistryOptions = {
  /** A director channel for one visitor's town (createTownChannel in production). */
  channelFor: (visitorToken: string) => DirectorChannel;
  claimMs: number;
  idleMs?: number;
  now?: () => number;
  log?: (line: string) => void;
};

export type TenantRegistry = {
  /** The desk for this town, made on first use; every call keeps it awake. */
  deskFor(visitorToken: string): PrincipalDesk;
  /** Read each awake town's slate for its desk, and drop idle ones. */
  observeAll(): Promise<void>;
  /** Perform due beats in every awake town. */
  pumpAll(): Promise<void>;
  size(): number;
};

/** A short, stable, non-reversible label for logs: never the key. */
export const townLabel = (visitorToken: string): string => createHash("sha256").update(visitorToken).digest("hex").slice(0, 8);

export function createTenantRegistry(opts: TenantRegistryOptions): TenantRegistry {
  const now = opts.now ?? (() => Date.now());
  const idleMs = opts.idleMs ?? TENANT_IDLE_MS;
  const log = opts.log ?? (() => {});
  const towns = new Map<string, { desk: PrincipalDesk; channel: DirectorChannel; lastUse: number; label: string }>();
  return {
    deskFor(visitorToken) {
      const id = createHash("sha256").update(visitorToken).digest("hex");
      let town = towns.get(id);
      if (!town) {
        const label = townLabel(visitorToken);
        const channel = opts.channelFor(visitorToken);
        // Paired towns carry no pack: the filter takes the strictest band
        // (rank 0), as for a bond the bridge cannot see.
        const desk = createPrincipalDesk({ channel, rank: () => 0, claimMs: opts.claimMs, now, resident: false, log: (line) => log(`[town ${label}] ${line}`) });
        town = { desk, channel, lastUse: now(), label };
        towns.set(id, town);
        log(`tenants: town ${label} awake (${towns.size} awake)`);
      }
      town.lastUse = now();
      return town.desk;
    },
    async observeAll() {
      const t = now();
      for (const [id, town] of towns) {
        if (t - town.lastUse > idleMs && !town.desk.live()) {
          towns.delete(id);
          log(`tenants: town ${town.label} idle, dropped (${towns.size} awake)`);
          continue;
        }
        try {
          await town.desk.observe(await town.channel.readState());
        } catch {
          /* a town that cannot be read this beat is read again next beat */
        }
      }
    },
    async pumpAll() {
      for (const town of towns.values()) {
        try {
          await town.desk.pump();
        } catch {
          /* the next pump tries again */
        }
      }
    },
    size: () => towns.size,
  };
}
