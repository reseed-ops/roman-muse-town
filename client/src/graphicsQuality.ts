import * as THREE from "three";

/** Keep automatic degradation and the UI's mirrored setting idempotent. */
export class GraphicsQuality {
  private pixelRatio: number | null = null;
  constructor(
    private renderer: { setPixelRatio(ratio: number): void; shadowMap: { enabled: boolean } },
    private scene: THREE.Scene,
    private fullPixelRatio: number,
    public gentle: boolean,
  ) {}

  set(gentle: boolean, recompile = true): boolean {
    return this.setProfile(gentle ? 1 : this.fullPixelRatio, !gentle, recompile);
  }

  /** Ratio only (v44): the swing tuner's steps land here. No shadow
   *  toggle, no material sweep, so a step costs one resize and can
   *  never stall on a shader recompile mid-gesture. */
  setPixelRatioOnly(pixelRatio: number): boolean {
    if ((this.pixelRatio ?? this.fullPixelRatio) === pixelRatio) return false;
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    return true;
  }

  setProfile(pixelRatio: number, shadows: boolean, recompile = true): boolean {
    const gentle = !shadows;
    if (gentle === this.gentle && (this.pixelRatio ?? (gentle ? 1 : this.fullPixelRatio)) === pixelRatio) return false;
    const shadowsChanged = gentle !== this.gentle;
    this.gentle = gentle;
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = shadows;
    if (recompile && shadowsChanged) {
      const materials = new Set<THREE.Material>();
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        }
      });
      for (const material of materials) material.needsUpdate = true;
    }
    return true;
  }
}
