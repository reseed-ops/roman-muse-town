// The client half of @hatch/space-sdk, as the web bundle sees it (Task
// 8). The town's client imports createActionClient, spaceQueryClient and
// two types from "@hatch/space-sdk/client"; web/build.ts aliases that
// specifier to this file, so client/src stays exactly the artifact's.
//
// Every call POSTs { action, args } to ./actions with the visitor's
// token (minted once, kept in localStorage: losing it loses the town,
// which Settings says in one plain line). An answer that asks for it
// invalidates every query, as the runtime does on the artifact line.

import { QueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { VISITOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { visitorToken } from "../../client/src/hosted";

export const spaceQueryClient = new QueryClient();

export class ActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ActionError";
  }
}

type ActionShape = { request: z.ZodType; response: z.ZodType };
export type ActionClient<T> = {
  [K in keyof T]: T[K] extends { request: infer Req extends z.ZodType; response: infer Res extends z.ZodType } ? (args: z.input<Req>) => Promise<z.output<Res>> : never;
};
export type ApiRequest<C, K extends keyof C> = C[K] extends (args: infer A) => unknown ? A : never;
export type ApiResponse<C, K extends keyof C> = C[K] extends (...args: never[]) => Promise<infer R> ? R : never;

export async function callAction(action: string, args: unknown, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const res = await fetchImpl("./actions", {
    method: "POST",
    headers: { "content-type": "application/json", [VISITOR_TOKEN_HEADER]: visitorToken() },
    body: JSON.stringify({ action, args: args ?? {} }),
  });
  const text = await res.text();
  let body: { result?: unknown; invalidate?: boolean; error?: string } | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw new ActionError(body?.error ?? `The town answered ${res.status}.`, res.status);
  if (body?.invalidate) void spaceQueryClient.invalidateQueries();
  return body?.result;
}

export function createActionClient<T extends Record<string, ActionShape>>(): ActionClient<T> {
  return new Proxy({} as ActionClient<T>, {
    get(_target, property) {
      if (typeof property !== "string" || property === "then") return undefined;
      return (args: unknown) => callAction(property, args);
    },
  });
}
