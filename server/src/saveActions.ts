import { defineAction as defineSdkAction, z } from "@hatch/space-sdk";
import { MAX_SAVE_BYTES } from "../../shared/saveFormat";
import * as schema from "./schema";
import { exportTownSave, restoreTownSave } from "./saveService";
import { oneTownAtATime, storageOf } from "./storage";

/** Every town action runs one at a time per town (storage.ts). */
const defineAction: typeof defineSdkAction = (definition) => defineSdkAction(oneTownAtATime(definition));

export const saveActions = {
  exportSave: defineAction({
    description: "Export a versioned town save, including letters, memories, progress and postcard images.",
    request: z.object({}), response: z.object({ json: z.string() }),
    async handler(ctx) { return { json: await exportTownSave(ctx.db<typeof schema>(), ctx.blobs) }; },
  }),
  restoreSave: defineAction({
    description: "Validate a complete town save, upload its images, and atomically replace town state. The client offers a pre-restore backup first.",
    request: z.object({ json: z.string().max(MAX_SAVE_BYTES), request_id: z.string().uuid() }), response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      await restoreTownSave(ctx.db<typeof schema>(), ctx.blobs, args.json, args.request_id, storageOf(ctx));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),
};
