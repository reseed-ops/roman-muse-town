import { canonicalJson, RETRY_SAFE_ACTIONS } from "../../shared/retryActions";

interface Receipt { action: string; payload: Record<string, unknown>; requestId: string }
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const STORAGE_KEY = "muse-town-pending-actions-v1";
const safeActions = new Set<string>(RETRY_SAFE_ACTIONS);

/** Reuse a durable ID on transport retries, reloads, or a repeated tap after
 * an uncertain failure. Two intentional purchases after success get two IDs. */
export class ReliableActions {
  private pending = new Map<string, Receipt>();
  private inFlight = new Map<string, Promise<unknown>>();
  private paused = false;

  constructor(private storage?: StorageLike, private newId = () => crypto.randomUUID()) {
    try {
      const saved: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) for (const entry of saved) {
        if (entry && typeof entry === "object" && safeActions.has(entry.action) && typeof entry.requestId === "string" && /^[0-9a-f-]{36}$/i.test(entry.requestId) && entry.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload)) {
          this.pending.set(this.key(entry.action, entry.payload), entry as Receipt);
        }
      }
    } catch { /* storage may be unavailable */ }
  }
  private key(action: string, payload: Record<string, unknown>) { return `${action}:${canonicalJson(payload)}`; }
  private persist() {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify([...this.pending.values()])); } catch { /* in-memory retries still work */ }
  }
  list(): Receipt[] { return [...this.pending.values()]; }
  clear(): void { this.pending.clear(); this.persist(); }
  async pause(): Promise<void> { this.paused = true; await Promise.allSettled(this.inFlight.values()); }
  resume(): void { this.paused = false; }

  call<T>(action: string, payload: Record<string, unknown>, send: (args: Record<string, unknown>) => Promise<T>): Promise<T> {
    if (this.paused) return Promise.reject(new Error("Please wait until the save operation finishes."));
    if (!safeActions.has(action)) return send(payload);
    const key = this.key(action, payload);
    const active = this.inFlight.get(key);
    if (active) return active as Promise<T>;
    const receipt = this.pending.get(key) ?? { action, payload, requestId: this.newId() };
    this.pending.set(key, receipt);
    this.persist();
    const execute = async () => {
      try {
        const args = { ...payload, request_id: receipt.requestId };
        let result: T;
        try { result = await send(args); }
        catch (error) {
          const status = (error as { status?: number } | null)?.status;
          const networkError = error instanceof TypeError || (error instanceof Error && /network|fetch|timeout|connection/i.test(error.message));
          if (!networkError && status !== 408 && status !== 429 && !(status && status >= 500)) throw error;
          result = await send(args);
        }
        this.pending.delete(key);
        this.persist();
        return result;
      } finally { this.inFlight.delete(key); }
    };
    // Start in a microtask so even a synchronous send failure clears inFlight.
    const result = Promise.resolve().then(execute);
    this.inFlight.set(key, result);
    return result;
  }
}

let storage: StorageLike | undefined;
try { storage = typeof localStorage === "undefined" ? undefined : localStorage; } catch { /* private browsing */ }
export const reliableActions = new ReliableActions(storage);

export function protectActions<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, property, receiver) {
      const original: unknown = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || !safeActions.has(property) || typeof original !== "function") return original;
      return (args: Record<string, unknown>) => reliableActions.call(property, args, (payload) => Reflect.apply(original, target, [payload]));
    },
  });
}
