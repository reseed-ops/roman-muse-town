import * as THREE from "three";

export function isRomanPalette(name: string): boolean {
  const normalized = name.toLowerCase().replace(/\.\d+$/, "").replace(/[\s_-]/g, "");
  return normalized === "mcolor" || normalized === "material#25" ||
    /^mcolor(?:palette|pallete)(?:roman|rome|romanempire)?(?:basecolor)?$/.test(normalized);
}

let stone: THREE.DataTexture | undefined;
/** Small, repeatable travertine surface made in code; no commercial file needed. */
function stoneTexture(): THREE.DataTexture {
  if (stone) return stone;
  const size = 128, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / 32), columnX = (x + (row % 2) * 32) % 64;
    const joint = y % 32 < 2 || columnX < 2;
    const grain = ((x * 37 + y * 61 + x * y * 3) % 17) - 8;
    const shade = joint ? -24 : grain * 0.55 + Math.sin(y * 0.65) * 2;
    const i = (y * size + x) * 4;
    bytes[i] = 218 + shade; bytes[i + 1] = 205 + shade; bytes[i + 2] = 183 + shade; bytes[i + 3] = 255;
  }
  stone = new THREE.DataTexture(bytes, size, size);
  stone.name = "Town travertine fallback";
  stone.colorSpace = THREE.SRGBColorSpace;
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
  stone.magFilter = THREE.LinearFilter;
  stone.minFilter = THREE.LinearMipmapLinearFilter;
  stone.generateMipmaps = true;
  stone.channel = 1;
  stone.needsUpdate = true;
  return stone;
}

function stoneCoordinates(mesh: THREE.Mesh): void {
  // A separate UV channel preserves working atlas maps on other material slots.
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  const unit = Math.max(size.x, size.y, size.z, 0.001) / 8;
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i + 2 < position.count; i += 3) {
    a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
    normal.crossVectors(b.sub(a), c.sub(a));
    const axis = Math.abs(normal.y) >= Math.max(Math.abs(normal.x), Math.abs(normal.z)) ? "y" : Math.abs(normal.x) > Math.abs(normal.z) ? "x" : "z";
    for (let j = i; j < i + 3; j++) {
      uv[j * 2] = (axis === "x" ? position.getZ(j) : position.getX(j)) / unit;
      uv[j * 2 + 1] = (axis === "y" ? position.getZ(j) : position.getY(j)) / unit;
    }
  }
  geometry.setAttribute("uv1", new THREE.BufferAttribute(uv, 2));
  mesh.geometry = geometry;
}

export async function repairRomanMaterials(root: THREE.Object3D, options: {
  architecture: boolean;
  palette(): Promise<THREE.Texture>;
  report(message: string): void;
}): Promise<void> {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => { if (object instanceof THREE.Mesh) meshes.push(object); });
  const needsPalette = meshes.some((mesh) => mesh.geometry.hasAttribute("uv") &&
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some((m) => isRomanPalette(m.name)));
  let palette: THREE.Texture | undefined;
  if (needsPalette) {
    try { palette = await options.palette(); }
    catch { options.report("Roman palette could not load; neutral building surfaces use travertine."); }
  }
  for (const mesh of meshes) {
    let fallback = false;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      if (isRomanPalette(material.name) && palette && mesh.geometry.hasAttribute("uv")) {
        material.map = palette; material.color.setRGB(1, 1, 1); material.needsUpdate = true;
        options.report(`${mesh.name || "mesh"} (${material.name}): restored Roman palette`);
        return material;
      }
      const image = material.map?.image as { width?: number } | undefined;
      const usableMap = !!image && (image.width ?? 0) > 0;
      const { r, g, b } = material.color;
      const neutral = Math.min(r, g, b) > 0.5 && Math.max(r, g, b) - Math.min(r, g, b) < 0.08;
      if (!options.architecture || usableMap || !neutral || material.transparent || mesh.geometry.hasAttribute("color")) return material;
      const repaired = material.clone();
      repaired.map = stoneTexture(); repaired.color.setRGB(1, 1, 1);
      repaired.roughness = 0.88; repaired.metalness = 0; repaired.needsUpdate = true;
      fallback = true;
      options.report(`${mesh.name || "mesh"} (${material.name || "unnamed"}): untextured neutral surface given travertine`);
      return repaired;
    });
    if (fallback) stoneCoordinates(mesh);
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0]!;
  }
}
