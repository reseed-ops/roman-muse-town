import { expect, mock, test } from "bun:test";
import type { AeliaChatContext, LocalChatStatus, LocalModelName } from "./aeliaLocalChat";

// The chat path's model choice. On the Xperia, the prepare button had
// stocked E2B's cache and reached "E2B ready", yet the first chat asked
// the device instead of the cache: deviceMemory said 8 GB, so ensureModel
// picked E4B and began downloading it over the top of the cached model.
// These tests drive the real worker module against a mocked transformers
// package and pin the cache-first rule: the cache is consulted before the
// device preference, a single fully cached model wins whichever it is,
// both or neither keep the device preference exactly, the E4B fallback to
// E2B survives, and a cache-chosen E2B that fails still fails plainly.
//
// Each scenario boots a fresh worker instance (a query string on the
// import gives a new module with empty model state), so a model loaded
// in one test never short-circuits ensureModel in the next.

type WorkerReply =
  | { id: number; type: "status"; status: LocalChatStatus }
  | { id: number; type: "reply"; reply: string; model: LocalModelName }
  | { id: number; type: "prepared"; model: LocalModelName }
  | { id: number; type: "error"; message: string };

const E4B = "onnx-community/gemma-4-E4B-it-ONNX";
const E2B = "onnx-community/gemma-4-E2B-it-ONNX";
const PROCESSOR_FILES = ["processor_config.json", "chat_template.jinja"];

type Setup = {
  cached?: string[]; // fully cached: registry files and both processor files
  registryOnly?: string[]; // registry files present, processor files missing
  failLoad?: string[];
  deviceMemory?: number;
  cachesBroken?: boolean;
};

const scenario = {
  registry: new Set<string>(),
  processorFiles: new Set<string>(),
  failLoad: new Set<string>(),
  deviceMemory: undefined as number | undefined,
  cachesBroken: false,
};
const calls: string[] = [];
const posted: WorkerReply[] = [];
let settle: ((reply: WorkerReply) => void) | null = null;

mock.module("@huggingface/transformers", () => {
  const env = {
    useBrowserCache: true,
    cacheKey: "transformers-cache",
    remoteHost: "https://huggingface.co/",
    remotePathTemplate: "{model}/resolve/{revision}/",
  };
  class ModelRegistry {
    static async is_cached(modelId: string) {
      calls.push(`is_cached:${modelId}`);
      return scenario.registry.has(modelId);
    }
  }
  const processor = Object.assign(async () => ({ input_ids: { dims: [1, 3] } }), {
    apply_chat_template: () => "prompt",
    batch_decode: () => ["Salve, Gaius."],
  });
  class AutoProcessor {
    static async from_pretrained() {
      return processor;
    }
  }
  class Gemma4ForConditionalGeneration {
    static async from_pretrained(modelId: string) {
      calls.push(`load:${modelId}`);
      if (scenario.failLoad.has(modelId)) throw new Error(`${modelId} ran out of memory`);
      return { generate: async () => ({ slice: () => ({}) }), dispose: async () => {} };
    }
  }
  return { env, ModelRegistry, AutoProcessor, Gemma4ForConditionalGeneration };
});

const globals = globalThis as unknown as {
  postMessage: (message: WorkerReply) => void;
  isSecureContext: boolean;
  caches: unknown;
  onmessage: (event: { data: unknown }) => void;
};
globals.postMessage = (message) => {
  posted.push(message);
  if (message.type !== "status") settle?.(message);
};
globals.isSecureContext = true;
globals.caches = {
  open: async () => {
    if (scenario.cachesBroken) throw new Error("Cache Storage is unavailable");
    return {
      match: async (url: string) => {
        const modelId = [E4B, E2B].find((id) => url.includes(id));
        const file = PROCESSOR_FILES.find((name) => url.endsWith(name));
        return modelId && file && scenario.processorFiles.has(modelId) ? new Response("{}") : undefined;
      },
    };
  },
};
Object.defineProperty(navigator, "gpu", {
  configurable: true,
  value: { requestAdapter: async () => ({ requestDevice: async () => ({ destroy() {} }) }) },
});
Object.defineProperty(navigator, "deviceMemory", {
  configurable: true,
  get() {
    calls.push("deviceMemory");
    return scenario.deviceMemory;
  },
});

const context: AeliaChatContext = {
  weatherLabel: "clear",
  night: false,
  treeStage: "a sapling",
  foundCount: 1,
  totalCollectibles: 12,
  affectionRank: 3,
  boardAsOf: "",
  unreadLetters: 0,
  knownFacts: [],
};
let boots = 0;

async function chat(setup: Setup) {
  scenario.registry = new Set([...(setup.cached ?? []), ...(setup.registryOnly ?? [])]);
  scenario.processorFiles = new Set(setup.cached ?? []);
  scenario.failLoad = new Set(setup.failLoad ?? []);
  scenario.deviceMemory = setup.deviceMemory;
  scenario.cachesBroken = setup.cachesBroken ?? false;
  calls.length = 0;
  posted.length = 0;

  await import(`./aeliaLocalChat.worker.ts?boot=${++boots}`);
  const final = await new Promise<WorkerReply>((resolve) => {
    settle = resolve;
    globals.onmessage({ data: { type: "chat", id: 1, message: "Salve", context, history: [] } });
  });
  settle = null;
  const statuses = posted.flatMap((message) => (message.type === "status" ? [message.status.message] : []));
  const loads = calls.filter((call) => call.startsWith("load:")).map((call) => call.slice("load:".length));
  return { final, statuses, loads };
}

function probesBeforeDevice(): boolean {
  const device = calls.indexOf("deviceMemory");
  const probes = calls.filter((call) => call.startsWith("is_cached:"));
  return probes.length === 2 && (device < 0 || calls.lastIndexOf(probes[1]!) < device);
}

test("a lone cached E2B wins the chat on an 8 GB device, before the device is even asked", async () => {
  const { final, loads } = await chat({ cached: [E2B], deviceMemory: 8 });
  expect(loads).toEqual([E2B]);
  expect(final).toMatchObject({ type: "reply", model: "Gemma 4 E2B" });
  expect(calls.filter((call) => call.startsWith("is_cached:")).sort()).toEqual([`is_cached:${E2B}`, `is_cached:${E4B}`]);
  expect(calls).not.toContain("deviceMemory");
});

test("a lone cached E4B wins on a small device too", async () => {
  const { final, loads } = await chat({ cached: [E4B], deviceMemory: 4 });
  expect(loads).toEqual([E4B]);
  expect(final).toMatchObject({ type: "reply", model: "Gemma 4 E4B" });
  expect(calls).not.toContain("deviceMemory");
});

test("both cached keeps the device preference, and the cache is still asked first", async () => {
  const big = await chat({ cached: [E4B, E2B], deviceMemory: 8 });
  expect(big.loads).toEqual([E4B]);
  expect(big.final).toMatchObject({ type: "reply", model: "Gemma 4 E4B" });
  expect(probesBeforeDevice()).toBe(true);

  const small = await chat({ cached: [E4B, E2B], deviceMemory: 4 });
  expect(small.loads).toEqual([E2B]);
  expect(small.final).toMatchObject({ type: "reply", model: "Gemma 4 E2B" });
});

test("neither cached keeps the device preference and its download", async () => {
  const big = await chat({ deviceMemory: 8 });
  expect(big.loads).toEqual([E4B]);
  expect(big.final).toMatchObject({ type: "reply", model: "Gemma 4 E4B" });
  expect(probesBeforeDevice()).toBe(true);

  const unknown = await chat({});
  expect(unknown.loads).toEqual([E2B]);
  expect(unknown.final).toMatchObject({ type: "reply", model: "Gemma 4 E2B" });
});

test("the E4B fallback to E2B survives, whether E4B came from the device or the cache", async () => {
  const preferred = await chat({ deviceMemory: 8, failLoad: [E4B] });
  expect(preferred.loads).toEqual([E4B, E2B]);
  expect(preferred.statuses).toContain("E4B needs more memory here; trying the smaller E2B model…");
  expect(preferred.final).toMatchObject({ type: "reply", model: "Gemma 4 E2B" });

  const cached = await chat({ cached: [E4B], deviceMemory: 4, failLoad: [E4B] });
  expect(cached.loads).toEqual([E4B, E2B]);
  expect(cached.statuses).toContain("E4B needs more memory here; trying the smaller E2B model…");
  expect(cached.final).toMatchObject({ type: "reply", model: "Gemma 4 E2B" });
});

test("a cache-chosen E2B that fails propagates its error, with no second load", async () => {
  const { final, loads, statuses } = await chat({ cached: [E2B], deviceMemory: 8, failLoad: [E2B] });
  expect(loads).toEqual([E2B]);
  expect(final).toMatchObject({ type: "error", message: `${E2B} ran out of memory` });
  expect(statuses.at(-1)).toBe(`Using Aelia’s scripted replies. ${E2B} ran out of memory`);
});

test("a model the registry has but whose processor files are missing is not cached", async () => {
  const { loads } = await chat({ registryOnly: [E2B], deviceMemory: 8 });
  expect(loads).toEqual([E4B]);
});

test("a cache probe that throws counts as not cached and keeps the device preference", async () => {
  const { final, loads } = await chat({ cached: [E2B], deviceMemory: 8, cachesBroken: true });
  expect(loads).toEqual([E4B]);
  expect(final).toMatchObject({ type: "reply", model: "Gemma 4 E4B" });
});
