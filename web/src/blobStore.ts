// The web deployment's blob store (Task 8): postcard images live in the
// visitor's own schema (town_blobs, storage.pg.ts), and reach the
// browser through a signed path, since an <img> cannot carry the
// visitor token. The signature binds the schema and the key under the
// service's secret; a path for one town never opens another's.

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, ne, sql } from "drizzle-orm";
import type { BlobStore } from "../../server/src/saveService";
import type { TownDb } from "../../server/src/storage";
import { asPg, townBlobs } from "../../server/src/storage.pg";

export const BLOB_PATH_PREFIX = "/blobs/";

/** What one town's images may add up to (Task 61): a full 32 MB save fits, with room. */
export const TOWN_BLOB_QUOTA_BYTES = 48 * 1024 * 1024;

/** Postcard links expire (Task 64). The expiry is a window boundary, so a
 *  link is the same all through a window (the state read's digest stays
 *  stable) and lives between one and two windows: an hour or two. The
 *  retention rule for private images: a link is good for at most two
 *  hours, the server tells browsers to keep an image five minutes, the
 *  service worker never caches one, and deleting a postcard deletes its
 *  blob and purges the browser's copies. A copy someone has downloaded
 *  cannot be revoked. */
export const BLOB_LINK_WINDOW_MS = 60 * 60 * 1000;
export const BLOB_BROWSER_MAX_AGE_S = 300;
const linkExpiry = (nowMs: number): number => (Math.floor(nowMs / BLOB_LINK_WINDOW_MS) + 2) * BLOB_LINK_WINDOW_MS;

const sign = (secret: string, schemaName: string, key: string, expiresAt: number): string =>
  createHmac("sha256", secret).update(`${schemaName}\n${key}\n${expiresAt}`).digest("hex").slice(0, 40);

export function signBlobPath(secret: string, schemaName: string, key: string, nowMs: number = Date.now()): string {
  const expiresAt = linkExpiry(nowMs);
  return `${BLOB_PATH_PREFIX}${encodeURIComponent(key)}?t=${encodeURIComponent(schemaName)}&e=${expiresAt}&s=${sign(secret, schemaName, key, expiresAt)}`;
}

/** The town and key a signed path names, or null when the signature
 *  does not hold. */
export function verifyBlobPath(secret: string, url: URL, nowMs: number = Date.now()): { schemaName: string; key: string } | null {
  if (!url.pathname.startsWith(BLOB_PATH_PREFIX)) return null;
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.slice(BLOB_PATH_PREFIX.length));
  } catch {
    return null;
  }
  const schemaName = url.searchParams.get("t") ?? "";
  const presented = url.searchParams.get("s") ?? "";
  const expiresAt = Number(url.searchParams.get("e"));
  if (!key || !/^town_[0-9a-f]{24}$/.test(schemaName) || presented.length !== 40) return null;
  // Expired, or claiming longer than a link is ever given: refused.
  if (!Number.isInteger(expiresAt) || expiresAt <= nowMs || expiresAt > nowMs + 2 * BLOB_LINK_WINDOW_MS) return null;
  const expected = sign(secret, schemaName, key, expiresAt);
  if (!timingSafeEqual(Buffer.from(presented), Buffer.from(expected))) return null;
  return { schemaName, key };
}

export async function readBlob(tx: TownDb, key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const rows = await asPg(tx).select({ bytes: townBlobs.bytes, contentType: townBlobs.contentType }).from(townBlobs).where(eq(townBlobs.key, key)).limit(1);
  const row = rows[0];
  return row ? { bytes: row.bytes, contentType: row.contentType } : null;
}

/** The store one request's actions see: bound to the request's
 *  transaction, so a put rolls back with a failed action. */
export function createBlobStore(tx: TownDb, schemaName: string, secret: string, quotaBytes: number = TOWN_BLOB_QUOTA_BYTES, now: () => number = Date.now): BlobStore {
  const db = asPg(tx);
  return {
    async getUrl(key) {
      return signBlobPath(secret, schemaName, key, now());
    },
    async put(key, data, options) {
      const held = await db.select({ n: sql<number>`coalesce(sum(length(${townBlobs.bytes})), 0)::float8` }).from(townBlobs).where(ne(townBlobs.key, key));
      if ((Number(held[0]?.n) || 0) + data.byteLength > quotaBytes) throw new Error("This town's image storage is full. Delete some postcards first.");
      await db.insert(townBlobs).values({ key, contentType: options.contentType, bytes: data })
        .onConflictDoUpdate({ target: townBlobs.key, set: { contentType: options.contentType, bytes: data } });
    },
    async delete(key) {
      await db.delete(townBlobs).where(eq(townBlobs.key, key));
    },
    async read(key) {
      return (await readBlob(tx, key))?.bytes ?? null;
    },
  };
}
