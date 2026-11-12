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
 * What a token is (Task 63): a versioned, authenticated payload, sealed
 * with AES-256-GCM under a fresh 96-bit IV, holding the town's key, a token
 * id, the issue and expiry times, the audience ("town-bridge") and the
 * town's pairing generation at the time. It is refused when:
 *   - it is not a v2 token, or does not unseal (wrong key, edited);
 *   - it has expired (PAIRED_TOKEN_DAYS, default 90): pair again;
 *   - its generation is older than the town's current one. The town holds
 *     the generation (web/src/pairingState.ts) and moves it on when a code
 *     is redeemed (pairing again retires every earlier token) and when the
 *     visitor disconnects from their own town (POST /bridge/disconnect).
 *     The bridge reads the current generation from the town with each
 *     state read; it holds no revocation list of its own, so a restart
 *     forgets nothing.
 *
 * Which rotation revokes what, exactly:
 *   - PAIRING_SECRET, when set, is the seal key. Rotating it retires every
 *     paired token at once. Rotating DIRECTOR_TOKEN alone does NOT: the
 *     seal key does not derive from it, and the old tokens keep unsealing.
 *     (The director token only opens the town's door for the bridge; a
 *     new one must be set on both the town and the bridge.)
 *   - PAIRING_SECRET unset: the seal key derives from DIRECTOR_TOKEN, so
 *     rotating DIRECTOR_TOKEN retires every paired token at once.
 *   - One town: the visitor disconnects, or pairs again (generation).
 *   - A town's own key changing (a new browser) leaves the old town's token
 *     valid for the old town until it is disconnected or expires; changing
 *     browser does not revoke it.
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

export const PAIRED_TOKEN_AUDIENCE = "town-bridge";
export const DEFAULT_PAIRED_TOKEN_DAYS = 90;

export type PairedClaim = { visitorToken: string; tokenId: string; issuedAt: number; expiresAt: number; generation: number };

export function sealVisitorKey(key: Buffer, visitorToken: string, opts: { generation?: number; ttlMs?: number; now?: number } = {}): string {
  const issuedAt = opts.now ?? Date.now();
  const payload = JSON.stringify({
    v: 2,
    vk: visitorToken,
    tid: randomBytes(8).toString("hex"),
    iat: issuedAt,
    exp: issuedAt + (opts.ttlMs ?? DEFAULT_PAIRED_TOKEN_DAYS * 86_400_000),
    aud: PAIRED_TOKEN_AUDIENCE,
    gen: opts.generation ?? 0,
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return PAIRED_TOKEN_PREFIX + Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

/** What a paired token claims, or null for anything else: not ours, edited, another audience or version, expired. */
export function readPairedToken(key: Buffer, token: string | null, now: number = Date.now()): PairedClaim | null {
  if (!token || !token.startsWith(PAIRED_TOKEN_PREFIX)) return null;
  try {
    const raw = Buffer.from(token.slice(PAIRED_TOKEN_PREFIX.length), "base64url");
    if (raw.length < 12 + 16 + 20) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const out = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
    const p = JSON.parse(out) as Record<string, unknown>;
    if (p.v !== 2 || p.aud !== PAIRED_TOKEN_AUDIENCE) return null;
    if (typeof p.vk !== "string" || !VISITOR_KEY.test(p.vk)) return null;
    if (typeof p.tid !== "string" || typeof p.iat !== "number" || typeof p.exp !== "number" || typeof p.gen !== "number") return null;
    if (p.exp <= now || p.iat > now + 60_000) return null;
    return { visitorToken: p.vk, tokenId: p.tid, issuedAt: p.iat, expiresAt: p.exp, generation: p.gen };
  } catch {
    return null;
  }
}

/** The visitor key a live paired token names, or null (expiry and shape checked; the generation is the registry's check). */
export function unsealVisitorKey(key: Buffer, token: string | null, now: number = Date.now()): string | null {
  return readPairedToken(key, token, now)?.visitorToken ?? null;
}

export type TenantRegistryOptions = {
  /** A director channel for one visitor's town (createTownChannel in production). */
  channelFor: (visitorToken: string) => DirectorChannel;
  claimMs: number;
  /**
   * Durable revision state for one town (Task 70), keyed by the sha256 hex of its visitor key.
   * Without it, or when it fails, the registry keeps each town's mark in memory (up to 5,000 towns,
   * least recently used desk first out; a town with an awake desk is never dropped), so a desk
   * recreated after idle eviction stays above the one it replaces while its mark is retained. Past
   * that bound, or after a restart, the order rests on the store: a healthy per-town file keeps it,
   * and without one a recreated desk falls back to the clock seed alone.
   */
  revisionStoreFor?: (id: string) => { load(): number; save(high: number): void };
  /** Towns whose marks are kept in memory (default 5000). */
  markCap?: number;
  idleMs?: number;
  now?: () => number;
  log?: (line: string) => void;
};

export type TenantRegistry = {
  /** The desk for this town, made on first use; every call keeps it awake. */
  deskFor(visitorToken: string): PrincipalDesk;
  /** Is this generation still the town's current one? Asks the town (kept 3 s); an unreachable town reads as no. */
  currentGeneration(visitorToken: string): Promise<number | null>;
  /** Read each awake town's slate for its desk, and drop idle ones. */
  observeAll(): Promise<void>;
  /** Perform due beats in every awake town. */
  pumpAll(): Promise<void>;
  size(): number;
};

/** A short, stable, non-reversible label for logs: never the key. */
export const townLabel = (visitorToken: string): string => createHash("sha256").update(`town-bridge log label\n${visitorToken}`).digest("hex").slice(0, 8);

export function createTenantRegistry(opts: TenantRegistryOptions): TenantRegistry {
  const now = opts.now ?? (() => Date.now());
  const idleMs = opts.idleMs ?? TENANT_IDLE_MS;
  const log = opts.log ?? (() => {});
  const towns = new Map<string, { desk: PrincipalDesk; channel: DirectorChannel; lastUse: number; label: string }>();
  const generations = new Map<string, { at: number; generation: number | null }>();
  // Task 72 (Task 70): each town's revision mark outlives its desk's eviction. Bounded at MARK_CAP;
  // ordered by last desk use (deskFor refreshes it), and a town with an awake desk is never evicted.
  const marks = new Map<string, number>();
  const MARK_CAP = opts.markCap ?? 5000;
  const touchMark = (id: string) => {
    const m = marks.get(id);
    if (m !== undefined) {
      marks.delete(id);
      marks.set(id, m);
    }
  };
  // The bound: marks.size <= max(MARK_CAP, awake desks). Trims the oldest idle marks (never an awake
  // desk's) until the cap holds, so overflow from an awake burst recovers once those desks go idle.
  const trimMarks = (keep?: string) => {
    if (marks.size <= MARK_CAP) return;
    for (const k of marks.keys()) {
      if (marks.size <= MARK_CAP) break;
      if (k === keep || towns.has(k)) continue; // the saving desk may not be registered yet
      marks.delete(k);
    }
  };
  const storeFor = (id: string) => {
    let durable: { load(): number; save(high: number): void } | undefined;
    try {
      durable = opts.revisionStoreFor?.(id);
    } catch {
      durable = undefined;
    }
    return {
      load: () => {
        let stored = 0;
        try {
          stored = durable?.load() ?? 0;
        } catch {
          stored = 0;
        }
        return Math.max(marks.get(id) ?? 0, stored);
      },
      save: (high: number) => {
        marks.delete(id);
        marks.set(id, high);
        trimMarks(id);
        durable?.save(high); // a throw is logged by the desk; the memory mark is already kept
      },
    };
  };
  return {
    async currentGeneration(visitorToken) {
      const id = createHash("sha256").update(visitorToken).digest("hex");
      const t = now();
      const hit = generations.get(id);
      if (hit && t - hit.at < 3000) return hit.generation;
      let generation: number | null = null;
      try {
        const state = await (towns.get(id)?.channel ?? opts.channelFor(visitorToken)).readState();
        generation = state.entitlement?.pairingGeneration ?? 0;
      } catch {
        generation = null;
      }
      if (generations.size > 5000) generations.clear();
      generations.set(id, { at: t, generation });
      return generation;
    },
    deskFor(visitorToken) {
      const id = createHash("sha256").update(visitorToken).digest("hex");
      let town = towns.get(id);
      if (!town) {
        const label = townLabel(visitorToken);
        const inner = opts.channelFor(visitorToken);
        // A paired town carries no pack. Its rank is the town's own
        // entitlement, read from the town's database at its door and
        // refreshed with every read of its state (Task 62); until the first
        // read, and for a town that gives none, rank 0: the strictest band.
        const held = { rank: 0 };
        const channel: DirectorChannel = {
          ...inner,
          async readState() {
            const state = await inner.readState();
            held.rank = state.entitlement?.rank ?? 0;
            return state;
          },
        };
        const desk = createPrincipalDesk({ channel, rank: () => held.rank, claimMs: opts.claimMs, now, resident: false, revisionStore: storeFor(id), log: (line) => log(`[town ${label}] ${line}`) });
        town = { desk, channel, lastUse: now(), label };
        towns.set(id, town);
        log(`tenants: town ${label} awake (${towns.size} awake)`);
      }
      town.lastUse = now();
      touchMark(id);
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
      trimMarks(); // after the sweep, so a desk idling out is judged by its last use against those still awake
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

/**
 * The desk a presented paired token may reach, or null: unsealed and
 * unexpired (readPairedToken), and not retired by the town's pairing
 * generation. An unreachable town reads as null (fail closed). The
 * owner's own town reaches the owner's desk, not a second one.
 */
export async function resolvePairedToken(opts: {
  key: Buffer;
  registry: TenantRegistry;
  presented: string | null;
  ownerVisitorToken?: string | null;
  ownerDesk?: PrincipalDesk | null;
  now?: () => number;
}): Promise<PrincipalDesk | null> {
  const claim = readPairedToken(opts.key, opts.presented, opts.now?.() ?? Date.now());
  if (!claim) return null;
  const current = await opts.registry.currentGeneration(claim.visitorToken);
  if (current === null || claim.generation < current) return null;
  if (opts.ownerDesk && claim.visitorToken === opts.ownerVisitorToken) return opts.ownerDesk;
  return opts.registry.deskFor(claim.visitorToken);
}
