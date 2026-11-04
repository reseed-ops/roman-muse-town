// The web deployment's blob store (Task 8): postcard images live in the
// visitor's own schema (town_blobs, storage.pg.ts), and reach the
// browser through a signed path, since an <img> cannot carry the
// visitor token. The signature binds the schema and the key under the
// service's secret; a path for one town never opens another's.

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BlobStore } from "../../server/src/saveService";
import type { TownDb } from "../../server/src/storage";
import { asPg, townBlobs } from "../../server/src/storage.pg";

export const BLOB_PATH_PREFIX = "/blobs/";

const sign = (secret: string, schemaName: string, key: string): string =>
  createHmac("sha256", secret).update(`${schemaName}\n${key}`).digest("hex").slice(0, 40);

export function signBlobPath(secret: string, schemaName: string, key: string): string {
  return `${BLOB_PATH_PREFIX}${encodeURIComponent(key)}?t=${encodeURIComponent(schemaName)}&s=${sign(secret, schemaName, key)}`;
}

/** The town and key a signed path names, or null when the signature
 *  does not hold. */
export function verifyBlobPath(secret: string, url: URL): { schemaName: string; key: string } | null {
  if (!url.pathname.startsWith(BLOB_PATH_PREFIX)) return null;
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.slice(BLOB_PATH_PREFIX.length));
  } catch {
    return null;
  }
  const schemaName = url.searchParams.get("t") ?? "";
  const presented = url.searchParams.get("s") ?? "";
  if (!key || !/^town_[0-9a-f]{24}$/.test(schemaName) || presented.length !== 40) return null;
  const expected = sign(secret, schemaName, key);
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
export function createBlobStore(tx: TownDb, schemaName: string, secret: string): BlobStore {
  const db = asPg(tx);
  return {
    async getUrl(key) {
      return signBlobPath(secret, schemaName, key);
    },
    async put(key, data, options) {
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
