/**
 * The mind (Task 6): what the director asks a model for. One interface
 * so the loop is tested against a scripted mind and run against
 * Anthropic (anthropicMind.ts). The mind composes Aelia's answer to
 * the visit mail as a stream of text, and, now and then, a short
 * declared intention. It is never handed anything but the pack, the
 * visit thread, the slate's telemetry, and at most one frame.
 */
import type { VisitFrame, VisitMail, VisitTelemetry } from "../../shared/visitProtocol.js";
import type { ParsedPack } from "./pack.js";

export type ThreadTurn = { who: "him" | "her"; text: string };

export type ComposeInput = {
  pack: ParsedPack;
  /** The visit so far, oldest first; the new mail is the tail. */
  thread: ThreadTurn[];
  mail: VisitMail[];
  telemetry: VisitTelemetry | null;
  intention: string | null;
  frame: VisitFrame | null;
  signal?: AbortSignal;
};

export type ComposeUsage = { outputTokens: number; inputTokens: number };

export interface Mind {
  /** Stream her answer; resolve usage when the stream ends. */
  compose(input: ComposeInput, onText: (delta: string) => void): Promise<{ text: string; usage: ComposeUsage; refused: boolean }>;
  /** One short line of intent, display only. */
  intend(input: Omit<ComposeInput, "mail" | "frame" | "signal">): Promise<{ text: string; usage: ComposeUsage }>;
}
