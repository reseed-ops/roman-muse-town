// Packed assets (Task 14, Nov 5, 2026): the hosted build does not serve
// the licensed files as files. web/build.ts packs them into a few
// binary packs (packs/<name>-<hash>.pack) with a manifest of byte
// ranges, and every asset import in the hosted bundle becomes a
// "pack:<path>" string instead of a URL. This module turns those into
// bytes or object URLs for the loaders: one fetch per pack, sliced on
// demand, the pack's buffer let go once every file in it has been
// taken. A plain URL (the artifact build, the APK, a test) passes
// straight through, so nothing else in the client knows the difference.

import * as THREE from "three";

export const PACK_PREFIX = "pack:";
export const PACK_MANIFEST_PATH = "packs/manifest.json";

export interface PackEntry {
  pack: string;
  offset: number;
  size: number;
  type: string;
}
export interface PackManifest {
  version: number;
  packs: Record<string, { file: string; bytes: number; files: number }>;
  entries: Record<string, PackEntry>;
}

export const isPackUrl = (url: string): boolean => url.startsWith(PACK_PREFIX);
export const packPath = (url: string): string => url.slice(PACK_PREFIX.length);

export interface PackStoreOptions {
  manifestUrl: string;
  /** Fetches a same-origin path to bytes; injected so the store is testable. */
  fetchBytes: (url: string) => Promise<ArrayBuffer>;
  fetchJson: (url: string) => Promise<unknown>;
  makeObjectUrl?: (bytes: ArrayBuffer, type: string) => string;
}

export interface PackStore {
  bytes(url: string): Promise<ArrayBuffer>;
  objectUrl(url: string): Promise<string>;
  objectUrlSync(url: string): string | null;
  /** Packs fetched so far, for tests and the motion line. */
  fetched(): string[];
}

/** A pack that stops arriving is not a pack that is slow: after STALL_MS with no bytes the
 *  request is dropped and made again (Task 112, a restart left the loader at 0/4 behind a
 *  download that never moved). Each attempt after the first goes to the network, past any
 *  half-written cache entry. */
export const PACK_STALL_MS = 15000;
export const PACK_ATTEMPTS = 3;

export interface StallFetchOptions {
  fetchImpl?: typeof fetch;
  stallMs?: number;
  attempts?: number;
}

export async function fetchBytesWithStallRetry(url: string, opts: StallFetchOptions = {}): Promise<ArrayBuffer> {
  const doFetch = opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const stallMs = opts.stallMs ?? PACK_STALL_MS;
  const attempts = opts.attempts ?? PACK_ATTEMPTS;
  let lastError: unknown = new Error(`asset pack fetch failed: ${url}`);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    let stalled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => { stalled = true; controller.abort(); }, stallMs);
    };
    arm();
    try {
      const res = await doFetch(url, attempt === 0 ? { signal: controller.signal } : { signal: controller.signal, cache: "reload" });
      if (!res.ok) {
        // A real answer, not a stall: a missing pack will not appear by asking again.
        if (timer !== undefined) clearTimeout(timer);
        throw Object.assign(new Error(`asset pack fetch failed (${res.status}): ${url}`), { final: true });
      }
      arm();
      if (!res.body) {
        const whole = await res.arrayBuffer();
        if (timer !== undefined) clearTimeout(timer);
        return whole;
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
        arm();
      }
      if (timer !== undefined) clearTimeout(timer);
      const out = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength; }
      return out.buffer as ArrayBuffer;
    } catch (err) {
      if (timer !== undefined) clearTimeout(timer);
      if ((err as { final?: boolean }).final) throw err;
      lastError = stalled ? new Error(`asset pack stalled for ${stallMs} ms: ${url}`) : err;
    }
  }
  throw lastError;
}

export function createPackStore(opts: PackStoreOptions): PackStore {
  let manifest: Promise<PackManifest> | null = null;
  const packs = new Map<string, Promise<ArrayBuffer>>();
  const taken = new Map<string, Set<string>>();
  const objectUrls = new Map<string, string>();
  const objectUrlsPending = new Map<string, Promise<string>>();
  const fetchedPacks: string[] = [];

  const loadManifest = (): Promise<PackManifest> => {
    if (!manifest) {
      manifest = opts.fetchJson(opts.manifestUrl).then((raw) => {
        const m = raw as PackManifest;
        if (!m || typeof m !== "object" || !m.packs || !m.entries) throw new Error("asset pack manifest is malformed");
        return m;
      });
      // A failed manifest is asked for again, not remembered.
      manifest.catch(() => { manifest = null; });
    }
    return manifest;
  };
  const packBytes = (m: PackManifest, name: string): Promise<ArrayBuffer> => {
    let pending = packs.get(name);
    if (!pending) {
      const pack = m.packs[name];
      if (!pack) return Promise.reject(new Error(`asset pack missing from the manifest: ${name}`));
      fetchedPacks.push(name);
      pending = opts.fetchBytes(pack.file).then((buf) => {
        if (buf.byteLength !== pack.bytes) throw new Error(`asset pack ${name}: expected ${pack.bytes} bytes, got ${buf.byteLength}`);
        return buf;
      });
      packs.set(name, pending);
      // A failed or short pack is fetched again by the next asker, not remembered as a failure.
      pending.catch(() => { if (packs.get(name) === pending) packs.delete(name); });
    }
    return pending;
  };
  const bytes = async (url: string): Promise<ArrayBuffer> => {
    const path = packPath(url);
    const m = await loadManifest();
    const entry = m.entries[path];
    if (!entry) throw new Error(`asset not in any pack: ${path}`);
    const buf = await packBytes(m, entry.pack);
    const out = buf.slice(entry.offset, entry.offset + entry.size);
    // Once every file of a pack has been taken, the pack itself can go.
    let set = taken.get(entry.pack);
    if (!set) {
      set = new Set();
      taken.set(entry.pack, set);
    }
    set.add(path);
    if (set.size >= (m.packs[entry.pack]?.files ?? Infinity)) packs.delete(entry.pack);
    return out;
  };
  const makeObjectUrl =
    opts.makeObjectUrl ??
    ((buf: ArrayBuffer, type: string) => URL.createObjectURL(new Blob([buf], { type })));
  const objectUrl = (url: string): Promise<string> => {
    const have = objectUrls.get(url);
    if (have) return Promise.resolve(have);
    let pending = objectUrlsPending.get(url);
    if (!pending) {
      pending = (async () => {
        const m = await loadManifest();
        const entry = m.entries[packPath(url)];
        const buf = await bytes(url);
        const made = makeObjectUrl(buf, entry?.type ?? "application/octet-stream");
        objectUrls.set(url, made);
        objectUrlsPending.delete(url);
        return made;
      })();
      objectUrlsPending.set(url, pending);
    }
    return pending;
  };
  return {
    bytes,
    objectUrl,
    objectUrlSync: (url) => objectUrls.get(url) ?? null,
    fetched: () => [...fetchedPacks],
  };
}

let defaultStore: PackStore | null = null;
function store(): PackStore {
  if (!defaultStore) {
    defaultStore = createPackStore({
      manifestUrl: PACK_MANIFEST_PATH,
      fetchBytes: (url) => fetchBytesWithStallRetry(url),
      fetchJson: (url) =>
        fetch(url, { cache: "no-cache" }).then((res) => {
          if (!res.ok) throw new Error(`asset pack manifest fetch failed (${res.status}): ${url}`);
          return res.json();
        }),
    });
  }
  return defaultStore;
}

/** The bytes of an asset, packed or plain. */
export function assetBytes(url: string): Promise<ArrayBuffer> {
  if (isPackUrl(url)) return store().bytes(url);
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`fetch failed (${res.status}): ${url}`);
    return res.arrayBuffer();
  });
}

/** A URL a loader, an <img> or an <audio> can open: the asset's own
 *  URL when plain, an object URL once the pack has been fetched. */
export function assetUrl(url: string): Promise<string> {
  return isPackUrl(url) ? store().objectUrl(url) : Promise.resolve(url);
}

/** The same without waiting: the object URL if it exists already,
 *  otherwise the URL as given (a packed one will not open; call
 *  assetUrl ahead of time where a synchronous URL is needed). */
export function assetUrlSync(url: string): string {
  return isPackUrl(url) ? (store().objectUrlSync(url) ?? url) : url;
}

/** TextureLoader.load's shape over a packed or plain URL: the texture
 *  comes back at once and fills in when the image has decoded. */
export function loadAssetTexture(
  url: string,
  onLoad?: (texture: THREE.Texture) => void,
  onError?: (err: unknown) => void,
): THREE.Texture {
  if (!isPackUrl(url)) return new THREE.TextureLoader().load(url, onLoad, undefined, onError);
  const texture = new THREE.Texture();
  assetUrl(url)
    .then((resolved) => {
      new THREE.ImageLoader().load(
        resolved,
        (image) => {
          texture.image = image;
          texture.needsUpdate = true;
          onLoad?.(texture);
        },
        undefined,
        (err) => onError?.(err),
      );
    })
    .catch((err) => onError?.(err));
  return texture;
}
