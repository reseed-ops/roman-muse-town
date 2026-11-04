// The town's service worker (Task 8). Built by web/build.ts, which
// defines the precache list and the version from the build's own
// output, so every deploy is a new cache and the old one is retired on
// activation.
//
//   - the app shell and the small hashed files are precached at install;
//   - hashed files, the scene's models and textures among them, are
//     cache-first and cached on first use (the heavy first load this
//     worker exists to cure); postcard images too, their paths are
//     unique per image;
//   - action calls and the bridge routes never touch the cache;
//   - everything else, the shell included, is network-first with the
//     cache as the fallback. No offline play is promised: the town's
//     state lives on the server.

declare const __PRECACHE__: string[];
declare const __VERSION__: string;

type FetchEventLike = Event & { request: Request; respondWith(response: Promise<Response> | Response): void };
type ExtendableEventLike = Event & { waitUntil(promise: Promise<unknown>): void };
const worker = self as unknown as {
  addEventListener(type: "install" | "activate", listener: (event: ExtendableEventLike) => void): void;
  addEventListener(type: "fetch", listener: (event: FetchEventLike) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  location: Location;
};

const CACHE = `muse-town-${__VERSION__}`;
const HASHED = /-[0-9a-z]{8,}\.[a-z0-9]+$/i;

worker.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(__PRECACHE__)).then(() => worker.skipWaiting()),
  );
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => worker.clients.claim()),
  );
});

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) void cache.put(request, response.clone());
  return response;
}

async function networkFirst(request: Request, fallbackPath?: string): Promise<Response> {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) void cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = (await cache.match(request)) ?? (fallbackPath ? await cache.match(fallbackPath) : undefined);
    if (hit) return hit;
    throw error;
  }
}

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== worker.location.origin) return;
  if (url.pathname === "/actions" || url.pathname.startsWith("/bridge/") || url.pathname === "/healthz") return;
  if (url.pathname.startsWith("/blobs/") || HASHED.test(url.pathname) || url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request, request.mode === "navigate" ? "/" : undefined));
});
