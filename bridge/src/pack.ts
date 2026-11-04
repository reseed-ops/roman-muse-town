/**
 * The context pack (Task 6): one Markdown file the chat-side Muse
 * tends, the director re-reads on change. Sections, by heading:
 *
 *     # Aelia, for the Live Bridge
 *     rank: 6
 *
 *     ## Identity        who she is, who he is, the town
 *     ## Voice           the voice rules, as the chat side keeps them
 *     ## Constitution    the visit constitution, in her own words
 *     ## Life digest     the current digest, refreshed at the morning sync
 *
 * The private line's proven pack format is to be confirmed by Muse's
 * note; this parser is forgiving (headings match by first word, case
 * aside; unknown sections ride along in `extra`) so a mapping is a
 * small edit, not a rewrite. The loader polls the file's mtime so the
 * morning refresh lands without a restart.
 */

export type ParsedPack = {
  identity: string;
  voice: string;
  constitution: string;
  digest: string;
  extra: Record<string, string>;
  /** Her current affection rank (0–10) when the pack states it. */
  rank: number | null;
  raw: string;
};

const SECTION_KEYS: Record<string, keyof Pick<ParsedPack, "identity" | "voice" | "constitution" | "digest">> = {
  identity: "identity",
  voice: "voice",
  constitution: "constitution",
  digest: "digest",
  life: "digest",
};

export function parsePack(text: string): ParsedPack {
  const pack: ParsedPack = { identity: "", voice: "", constitution: "", digest: "", extra: {}, rank: null, raw: text };
  const rankMatch = text.match(/^\s*rank\s*:\s*(\d{1,2})\s*$/im);
  if (rankMatch) {
    const n = Number(rankMatch[1]);
    if (Number.isFinite(n) && n >= 0 && n <= 10) pack.rank = n;
  }
  const lines = text.split(/\r?\n/);
  let current: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (current === null) return;
    const body = buffer.join("\n").trim();
    const key = SECTION_KEYS[current.toLowerCase().split(/\s+/)[0] ?? ""];
    if (key) pack[key] = body;
    else pack.extra[current] = body;
  };
  for (const line of lines) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      flush();
      current = h[1] ?? "";
      buffer = [];
      continue;
    }
    if (current !== null) buffer.push(line);
  }
  flush();
  return pack;
}

export const emptyPack = (): ParsedPack => parsePack("");

export type PackSource = {
  /** Read the file; null when it does not exist. */
  read(): Promise<{ text: string; mtimeMs: number } | null>;
};

export type PackLoader = {
  current(): ParsedPack;
  /** Re-read when the source changed; returns true when it did. */
  check(): Promise<boolean>;
  start(): void;
  stop(): void;
  updatedAt(): number | null;
};

export function createPackLoader(source: PackSource, opts: { pollMs?: number; log?: (line: string) => void; setInterval?: typeof globalThis.setInterval; clearInterval?: typeof globalThis.clearInterval } = {}): PackLoader {
  let pack = emptyPack();
  let seenMtime: number | null = null;
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;
  const log = opts.log ?? (() => {});
  const check = async (): Promise<boolean> => {
    let file: { text: string; mtimeMs: number } | null;
    try {
      file = await source.read();
    } catch (error) {
      log(`pack: unreadable (${error instanceof Error ? error.message : String(error)})`);
      return false;
    }
    if (!file) {
      if (seenMtime !== null) {
        pack = emptyPack();
        seenMtime = null;
        log("pack: gone; running on an empty pack");
        return true;
      }
      return false;
    }
    if (file.mtimeMs === seenMtime) return false;
    pack = parsePack(file.text);
    seenMtime = file.mtimeMs;
    log(`pack: loaded (${file.text.length} chars${pack.rank !== null ? `, rank ${pack.rank}` : ""})`);
    return true;
  };
  return {
    current: () => pack,
    check,
    start() {
      if (timer) return;
      timer = (opts.setInterval ?? globalThis.setInterval)(() => void check(), opts.pollMs ?? 5000);
    },
    stop() {
      if (timer) (opts.clearInterval ?? globalThis.clearInterval)(timer);
      timer = null;
    },
    updatedAt: () => seenMtime,
  };
}

/** A pack file on disk. */
export function filePackSource(path: string): PackSource {
  return {
    async read() {
      const fs = await import("node:fs/promises");
      try {
        const [text, stat] = await Promise.all([fs.readFile(path, "utf8"), fs.stat(path)]);
        return { text, mtimeMs: stat.mtimeMs };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}
