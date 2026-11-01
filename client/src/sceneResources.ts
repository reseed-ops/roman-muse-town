import * as THREE from "three";

type Disposable = { dispose(): void };
const sharedResources = new WeakSet<Disposable>();
const sharedUsers = new WeakMap<Disposable, number>();

function collect(root: THREE.Object3D, visit: (resource: Disposable) => void): void {
  root.traverse((object) => {
    const drawable = object as THREE.Mesh;
    // Sprite geometry belongs to Three.js and is shared by every Sprite.
    if (drawable.geometry && !(object instanceof THREE.Sprite)) visit(drawable.geometry);
    const materials = drawable.material
      ? Array.isArray(drawable.material) ? drawable.material : [drawable.material]
      : [];
    for (const material of materials) {
      visit(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) visit(value);
      }
      if (material instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          if (uniform.value instanceof THREE.Texture) visit(uniform.value);
        }
      }
    }
    if (object instanceof THREE.SkinnedMesh) visit(object.skeleton);
    if (object instanceof THREE.DirectionalLight || object instanceof THREE.PointLight || object instanceof THREE.SpotLight) visit(object.shadow);
  });
}

/** Cached model clones borrow these resources across scene lifetimes. */
export function retainSharedModel(root: THREE.Object3D): void {
  collect(root, (resource) => sharedResources.add(resource));
}

/** Own resources even when their objects are later detached from the scene. */
export class SceneResources {
  disposed = false;
  private roots = new Set<THREE.Object3D>();
  private owned = new Set<Disposable>();
  private released = new WeakSet<Disposable>();

  private release(resource: Disposable): void {
    if (this.released.has(resource)) return;
    this.released.add(resource);
    if (sharedResources.has(resource)) {
      const remaining = Math.max(0, (sharedUsers.get(resource) ?? 1) - 1);
      sharedUsers.set(resource, remaining);
      if (remaining > 0) return;
    }
    // dispose() releases GPU allocations, not the cached CPU model data.
    // A later scene can upload the same geometry/material/texture again.
    resource.dispose();
  }

  track<T extends Disposable>(resource: T): T {
    if (this.disposed) {
      // A late callback never acquired a reference to cached resources.
      if (!sharedResources.has(resource)) this.release(resource);
    } else if (!this.owned.has(resource)) {
      this.owned.add(resource);
      if (sharedResources.has(resource)) sharedUsers.set(resource, (sharedUsers.get(resource) ?? 0) + 1);
    }
    return resource;
  }

  /** Late loads are released immediately and must not be attached. */
  adopt(root: THREE.Object3D): boolean {
    if (!this.disposed) this.roots.add(root);
    collect(root, (resource) => this.track(resource));
    return !this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    // Collect again to include materials/textures assigned after the load.
    for (const root of this.roots) collect(root, (resource) => this.track(resource));
    this.disposed = true;
    for (const resource of this.owned) this.release(resource);
    this.roots.clear();
    this.owned.clear();
  }
}
