export type AeliaChatContext = {
  weatherLabel: string;
  night: boolean;
  treeStage: string;
  foundCount: number;
  totalCollectibles: number;
  affectionRank: number;
  boardAsOf: string;
  unreadLetters: number;
  knownFacts: string[];
  privateName?: string;
};

export type AeliaChatTurn = { role: "user" | "assistant"; content: string };
export type LocalModelName = "Gemma 4 E4B" | "Gemma 4 E2B";
export type LocalChatStatus =
  | { state: "checking"; message: string }
  | { state: "loading"; message: string }
  | { state: "generating"; message: string }
  | { state: "ready"; message: string; model: LocalModelName }
  | { state: "prepared"; message: string; model: LocalModelName }
  | { state: "unavailable"; message: string };

type WorkerReply =
  | { id: number; type: "status"; status: LocalChatStatus }
  | { id: number; type: "reply"; reply: string; model: LocalModelName }
  | { id: number; type: "prepared"; model: LocalModelName }
  | { id: number; type: "error"; message: string };

type Pending = {
  resolve: (value: WorkerReply) => void;
  reject: (reason: Error) => void;
  onStatus: (status: LocalChatStatus) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  const instance = new Worker(new URL("./aeliaLocalChat.worker.js", document.baseURI), { type: "module" });
  instance.onmessage = (event: MessageEvent<WorkerReply>) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) return;
    if (message.type === "status") {
      request.onStatus(message.status);
      return;
    }
    pending.delete(message.id);
    if (message.type === "error") request.reject(new Error(message.message));
    else request.resolve(message);
  };
  instance.onerror = (event) => {
    const error = new Error(event.message || "The local chat worker stopped unexpectedly.");
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    instance.terminate();
    if (worker === instance) worker = null;
  };
  worker = instance;
  return instance;
}

export function generateLocalAeliaReply(args: {
  message: string;
  context: AeliaChatContext;
  history: AeliaChatTurn[];
  onStatus: (status: LocalChatStatus) => void;
}): Promise<{ reply: string; model: LocalModelName }> {
  const id = nextId++;
  return new Promise<WorkerReply>((resolve, reject) => {
    pending.set(id, { resolve, reject, onStatus: args.onStatus });
    try {
      getWorker().postMessage({
        id,
        type: "chat",
        message: args.message,
        context: args.context,
        history: args.history.slice(-8),
      });
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }).then((result) => {
    if (result.type !== "reply") throw new Error("The local chat worker returned an unexpected result.");
    return { reply: result.reply, model: result.model };
  });
}

export function downloadAeliaModel(args: {
  model: LocalModelName;
  onStatus: (status: LocalChatStatus) => void;
}): Promise<LocalModelName> {
  const id = nextId++;
  return new Promise<WorkerReply>((resolve, reject) => {
    pending.set(id, { resolve, reject, onStatus: args.onStatus });
    try {
      getWorker().postMessage({ id, type: "download-model", model: args.model });
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }).then((result) => {
    if (result.type !== "prepared") throw new Error("The local chat worker returned an unexpected result.");
    return result.model;
  });
}
