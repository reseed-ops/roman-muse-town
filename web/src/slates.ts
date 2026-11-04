// One slate face per visitor (Task 8): the hosted town's director door
// and bridge routes read and feed these. In memory only, by the visit
// constitution (nothing in a visit is ever persisted): a restart drops
// every open visit, and each folds back into ordinariness by its own
// heartbeat. A face that holds nothing and has not been touched for a
// while is swept.

import { createSlateFace, type SlateFace } from "../../shared/slateFace";

export interface SlateKeeper {
  faceFor(schemaName: string): SlateFace;
  size(): number;
  sweep(): number;
}

export function createSlateKeeper(opts: { now?: () => number; lapseMs?: number; idleMs?: number } = {}): SlateKeeper {
  const now = opts.now ?? (() => Date.now());
  const idleMs = opts.idleMs ?? 10 * 60 * 1000;
  const faces = new Map<string, SlateFace>();
  let sweeps = 0;
  const sweep = (): number => {
    const t = now();
    let gone = 0;
    for (const [name, face] of faces) {
      if (face.held() === null && t - face.touchedAt() > idleMs) {
        faces.delete(name);
        gone++;
      }
    }
    return gone;
  };
  return {
    faceFor(schemaName) {
      // Housekeeping rides on access, about once in a hundred touches.
      if (++sweeps % 100 === 0) sweep();
      let face = faces.get(schemaName);
      if (!face) {
        face = createSlateFace({ now, ...(opts.lapseMs !== undefined ? { lapseMs: opts.lapseMs } : {}) });
        faces.set(schemaName, face);
      }
      return face;
    },
    size: () => faces.size,
    sweep,
  };
}
