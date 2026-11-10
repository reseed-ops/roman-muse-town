// Private images, caches and deletion (Task 64). Postcards are served at
// signed paths that expire (web/src/blobStore.ts) and are kept by the
// browser for minutes only; the service worker does not cache them at all
// (web/sw.ts). This purges whatever copy a cache still holds when a
// postcard is deleted, or the town is restored or reset. A copy someone
// has already downloaded cannot be revoked.

const BLOBS = "/blobs/";

/** Delete cached copies of one image url, or of every image when no url is given. Never throws. */
export async function purgeImageCaches(url?: string, cachesImpl: CacheStorage | undefined = typeof caches === "undefined" ? undefined : caches): Promise<number> {
  if (!cachesImpl) return 0;
  let removed = 0;
  try {
    const wantPath = url ? new URL(url, typeof location === "undefined" ? "http://localhost" : location.origin).pathname : null;
    for (const name of await cachesImpl.keys()) {
      const cache = await cachesImpl.open(name);
      for (const request of await cache.keys()) {
        const path = new URL(request.url).pathname;
        if (!path.startsWith(BLOBS)) continue;
        if (wantPath !== null && path !== wantPath) continue;
        if (await cache.delete(request)) removed++;
      }
    }
  } catch {
    /* a purge that cannot run leaves the cache to expire on its own */
  }
  return removed;
}
