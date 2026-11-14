// The town's loom-made ground (Task 93): seamless PBR maps for the forum
// paving and the cobbles (tools/textures/town.tx.js builds them). Each
// material carries three maps: albedo (sRGB), a tangent-space normal (GL
// convention, what three.js expects) and an ORM map (R = ambient occlusion,
// G = roughness, as glTF), used for both aoMap and roughnessMap.
import * as THREE from "three";
import pavingAlbedoUrl from "./textures/forum_paving_albedo.png";
import pavingNormalUrl from "./textures/forum_paving_normal.png";
import pavingOrmUrl from "./textures/forum_paving_orm.png";
import cobbleAlbedoUrl from "./textures/cobbles_albedo.png";
import cobbleNormalUrl from "./textures/cobbles_normal.png";
import cobbleOrmUrl from "./textures/cobbles_orm.png";

export type GroundKind = "paving" | "cobbles";

/** Metres one tile of each material covers (slabs are 2 m x 1 m; cobbles
 *  about 27 cm across), so the callers can set UVs in metres. */
export const GROUND_TILE_METRES: Record<GroundKind, number> = { paving: 4, cobbles: 2.4 };

const URLS: Record<GroundKind, { albedo: string; normal: string; orm: string }> = {
  paving: { albedo: pavingAlbedoUrl, normal: pavingNormalUrl, orm: pavingOrmUrl },
  cobbles: { albedo: cobbleAlbedoUrl, normal: cobbleNormalUrl, orm: cobbleOrmUrl },
};

export interface GroundMaps {
  albedo: THREE.Texture;
  normal: THREE.Texture;
  orm: THREE.Texture;
}

/** Anisotropy the ground asks for: the old canvas texture left it at 1, so
 *  the stones blurred to flat tan at a grazing angle. */
export function groundAnisotropy(maxSupported: number): number {
  return Math.max(1, Math.min(8, Math.floor(maxSupported)));
}

export function loadGroundMaps(
  kind: GroundKind,
  anisotropy: number,
  load: (url: string) => THREE.Texture = (url) => new THREE.TextureLoader().load(url),
): GroundMaps {
  const urls = URLS[kind];
  const prep = (tex: THREE.Texture, srgb: boolean) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = anisotropy;
    return tex;
  };
  return { albedo: prep(load(urls.albedo), true), normal: prep(load(urls.normal), false), orm: prep(load(urls.orm), false) };
}

/** A copy of the maps with their own repeat (same images, so no second download). */
export function repeatedMaps(maps: GroundMaps, repeat: number): GroundMaps {
  const copy = (tex: THREE.Texture) => {
    const t = tex.clone();
    t.repeat.set(repeat, repeat);
    t.needsUpdate = true;
    return t;
  };
  return { albedo: copy(maps.albedo), normal: copy(maps.normal), orm: copy(maps.orm) };
}

export function groundMaterial(maps: GroundMaps, normalStrength = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: maps.albedo,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(normalStrength, normalStrength),
    aoMap: maps.orm,
    aoMapIntensity: 0.8,
    roughnessMap: maps.orm,
    roughness: 1, // the map's G channel is the roughness; this multiplies it
    metalness: 0,
  });
}

/** Re-UV a flat-faced geometry (boxes) in world metres, per face by its
 *  dominant normal axis, so a texture tile covers `tileMetres` on every
 *  slab whatever its size. Positions must already be in world space. */
export function worldMetricUVs(geo: THREE.BufferGeometry, tileMetres: number): THREE.BufferGeometry {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / tileMetres;
    uv[i * 2 + 1] = v / tileMetres;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
