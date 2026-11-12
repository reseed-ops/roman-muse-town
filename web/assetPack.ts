// The build's half of the packed assets (Task 14): which pack each
// licensed file goes into, the pack bytes, and the manifest the client
// reads (client/src/assetPack.ts). Pure, so the layout is testable
// without a build.

export interface PackSource {
  /** Path under client/src/assets, forward slashes. */
  rel: string;
  bytes: Uint8Array;
}
export interface PackManifest {
  version: number;
  packs: Record<string, { file: string; bytes: number; files: number }>;
  entries: Record<string, { pack: string; offset: number; size: number; type: string }>;
}

/** The packs follow the scene's own loading order: the two bodies first,
 *  the world that stands at arrival, each clip library as a unit, the
 *  wolf by itself (12 MB that only the forest asks for), the song by
 *  itself (160 KB the summit asks for), the sea's ships by themselves
 *  (fetched only once he walks out onto the sea cliff, Task 50), the
 *  wedding pieces by themselves (fetched only once the day dresses the
 *  town, Task 84). */
export function packNameFor(rel: string): string {
  if (rel.startsWith("anim/outdoor/")) return "outdoor";
  if (rel.startsWith("anim/")) return "anim";
  if (rel.startsWith("roman/")) return "roman";
  if (rel.startsWith("greek/")) return "greek";
  if (rel.startsWith("pets/")) return "pets";
  if (rel.startsWith("ships/")) return "ships";
  if (rel.startsWith("wedding/")) return "wedding";
  if (rel === "centurion.vrm" || rel === "muse-avatar.vrm") return "bodies";
  if (rel === "wolf.glb") return "wolf";
  if (rel === "stars-fall-song.mp3") return "song";
  return "world";
}

export function mimeFor(rel: string): string {
  const ext = rel.slice(rel.lastIndexOf(".") + 1).toLowerCase();
  return (
    { glb: "model/gltf-binary", vrm: "model/gltf-binary", fbx: "application/octet-stream", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav" } as Record<string, string>
  )[ext] ?? "application/octet-stream";
}

export function buildPacks(
  sources: PackSource[],
  hashOf: (bytes: Uint8Array) => string,
): { manifest: PackManifest; packs: { name: string; file: string; bytes: Uint8Array }[] } {
  const byPack = new Map<string, PackSource[]>();
  for (const source of [...sources].sort((a, b) => a.rel.localeCompare(b.rel))) {
    const name = packNameFor(source.rel);
    let list = byPack.get(name);
    if (!list) {
      list = [];
      byPack.set(name, list);
    }
    list.push(source);
  }
  const manifest: PackManifest = { version: 1, packs: {}, entries: {} };
  const packs: { name: string; file: string; bytes: Uint8Array }[] = [];
  for (const [name, list] of [...byPack].sort(([a], [b]) => a.localeCompare(b))) {
    const total = list.reduce((sum, source) => sum + source.bytes.byteLength, 0);
    const whole = new Uint8Array(total);
    let offset = 0;
    for (const source of list) {
      whole.set(source.bytes, offset);
      manifest.entries[source.rel] = { pack: name, offset, size: source.bytes.byteLength, type: mimeFor(source.rel) };
      offset += source.bytes.byteLength;
    }
    const file = `packs/${name}-${hashOf(whole).slice(0, 12)}.pack`;
    manifest.packs[name] = { file, bytes: total, files: list.length };
    packs.push({ name, file, bytes: whole });
  }
  return { manifest, packs };
}
