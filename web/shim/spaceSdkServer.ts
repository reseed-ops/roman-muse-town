// The server half of @hatch/space-sdk, as the web bundle sees it (Task
// 8). The action layer imports defineAction, z and two types from the
// SDK; here defineAction is the identity, exactly as the test suites
// mock it, and the web server (web/src/server.ts) is the runtime that
// validates and dispatches. web/build.ts aliases the package to this
// file when bundling the server.

import { z } from "zod";

export { z };

export interface Ctx {
  db<S extends Record<string, unknown>>(): import("drizzle-orm/bun-sqlite").BunSQLiteDatabase<S>;
  blobs: {
    getUrl(key: string): Promise<string>;
    put(key: string, data: Uint8Array, options: { contentType: string }): Promise<unknown>;
    delete(key: string): Promise<unknown>;
  };
  invalidateQueries(): void;
  /** As the SDK: with a schema the answer is the parsed object, without one `{ text }`. */
  inference: {
    complete<S extends z.ZodType>(request: unknown, options: { schema: S }): Promise<z.output<S>>;
    complete(request: unknown): Promise<{ text: string }>;
  };
}

export interface ActionDefinition<Req extends z.ZodType, Res extends z.ZodType> {
  description: string;
  request: Req;
  response: Res;
  handler(ctx: Ctx, args: z.output<Req>): Promise<z.output<Res>>;
}

export function defineAction<Req extends z.ZodType, Res extends z.ZodType>(definition: ActionDefinition<Req, Res>): ActionDefinition<Req, Res> {
  return definition;
}

export type ActionsModule = Record<string, ActionDefinition<z.ZodType, z.ZodType>>;
