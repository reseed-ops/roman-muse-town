/**
 * Adapter A (Task 6): the director channel over this line's Task 4
 * seam harness (harness/visitHarness.ts), plain HTTP and JSON. Every
 * call is one request with a short timeout; a failure throws, and the
 * director folds a dead channel quietly (see director.ts).
 */
import type { DirectorPack, VisitDirection, VisitFrame, VisitMail } from "../../shared/visitProtocol.js";
import type { ChannelState, DirectResult, DirectorChannel } from "./channel.js";

export type SeamAdapterOptions = {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export function createSeamAdapter(opts: SeamAdapterOptions): DirectorChannel {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? 4000;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const call = async (method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<{ status: number; json: unknown }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}${path}`, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      return { status: res.status, json: text ? JSON.parse(text) : null };
    } finally {
      clearTimeout(timer);
    }
  };
  const expectOk = (r: { status: number; json: unknown }, what: string): unknown => {
    if (r.status < 200 || r.status >= 300) throw new Error(`${what}: HTTP ${r.status}`);
    return r.json;
  };
  return {
    async readState() {
      return expectOk(await call("GET", "/visit/state"), "readState") as ChannelState;
    },
    async readInbox(since) {
      return expectOk(await call("GET", `/visit/inbox?since=${encodeURIComponent(String(since))}`), "readInbox") as VisitMail[];
    },
    async readFrame(id) {
      const r = await call("GET", id === undefined ? "/visit/frame" : `/visit/frame?id=${encodeURIComponent(String(id))}`);
      if (r.status === 404) return null;
      return expectOk(r, "readFrame") as VisitFrame;
    },
    async direct(direction: VisitDirection) {
      const r = await call("POST", "/visit/direct", direction);
      const body = r.json as { ok?: boolean; id?: number; error?: string } | null;
      if (r.status === 200 && body?.ok && typeof body.id === "number") return { ok: true, id: body.id } satisfies DirectResult;
      if (r.status === 400 && body && body.ok === false) return { ok: false, error: body.error ?? "refused" };
      throw new Error(`direct: HTTP ${r.status}`);
    },
    async setComposing(on) {
      expectOk(await call("POST", "/visit/composing", { on }), "setComposing");
    },
    async readPack() {
      const r = await call("GET", "/visit/pack");
      if (r.status === 404) return null;
      return expectOk(r, "readPack") as DirectorPack;
    },
  };
}
