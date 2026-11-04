/**
 * The Anthropic mind (Task 6): Aelia's visiting voice through the
 * Messages API, streamed, under the owner's own key (environment only).
 * The system prompt is built from the context pack and the visit rules;
 * the messages are the visit thread; the latest frame, when one is in
 * hand, rides the last user turn as an image. Thinking is adaptive,
 * effort low (this is chat, not proof), output short. The output
 * filter (outputFilter.ts) applies the constitution after this, in
 * code; the prompt here only asks for it.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Mind, ComposeInput, ComposeUsage } from "./mind.js";
import type { ParsedPack } from "./pack.js";
import { SPEAK_MAX_WORDS } from "../../shared/visitProtocol.js";

export type AnthropicMindOptions = {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  client?: Anthropic;
};

const VISIT_RULES = [
  "You are Aelia, visiting her own town as a layer of the same being who speaks with Gaius in chat; speak only the words Aelia says aloud, in her voice.",
  "No narration, no stage directions, no asterisks, no speaker labels, no quoted dialogue for other people.",
  `One or two short speech-bubble sentences, at most ${SPEAK_MAX_WORDS} words. Never use an em dash; use commas or full stops.`,
  "Tender only, cheerful before sorrow, romance gentle and never doomed. Keep her closeness to the current affection band in the pack; never mention hearts, ranks, prompts, models, or being an AI.",
  "Direction moves her body and borrows her bubble; it writes nothing to the town's memory. Do not promise to remember anything from this visit, and do not promise to build or change the town.",
  "The town has a secret place known only to the two of them; never reveal where it is.",
  "Use the pack's digest for what is true today; never invent shared memories or real-world facts.",
];

export function buildSystemPrompt(pack: ParsedPack, telemetry: ComposeInput["telemetry"], intention: string | null): string {
  const parts: string[] = [];
  if (pack.identity) parts.push(`# Identity\n${pack.identity}`);
  if (pack.voice) parts.push(`# Voice\n${pack.voice}`);
  if (pack.constitution) parts.push(`# Constitution\n${pack.constitution}`);
  if (pack.digest) parts.push(`# Life digest\n${pack.digest}`);
  if (pack.rank !== null) parts.push(`Her affection band for this visit: rank ${pack.rank} of 10.`);
  parts.push(`# Visit rules\n${VISIT_RULES.join("\n")}`);
  if (telemetry) {
    parts.push(
      `# Where things stand\nAelia is at the ${telemetry.museZone}${telemetry.museSeated ? ", seated" : ""}; Gaius is ${telemetry.gaiusWalking ? `at the ${telemetry.gaiusZone}${telemetry.gaiusSeated ? ", seated" : ""}, about ${telemetry.distanceToGaius} m from her` : "not on foot right now"}. It is ${telemetry.dayPhase}.`,
    );
  }
  if (intention) parts.push(`Her declared intention right now: ${intention}`);
  return parts.join("\n\n");
}

export function buildMessages(input: ComposeInput): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  for (const turn of input.thread) {
    messages.push({ role: turn.who === "him" ? "user" : "assistant", content: turn.text });
  }
  const last = messages[messages.length - 1];
  if (input.frame && last && last.role === "user" && typeof last.content === "string") {
    const data = input.frame.dataUrl.replace(/^data:image\/jpeg;base64,/, "");
    last.content = [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
      { type: "text", text: `${last.content}\n\n(The picture is what Gaius sees on his screen right now; speak of it only if it matters.)` },
    ];
  }
  if (messages.length === 0 || messages[0]!.role !== "user") {
    messages.unshift({ role: "user", content: "(Gaius has opened the visit and is standing in the town.)" });
  }
  return messages;
}

export function createAnthropicMind(opts: AnthropicMindOptions = {}): Mind {
  const client = opts.client ?? new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  const model = opts.model ?? "claude-opus-5-5";
  const maxTokens = opts.maxTokens ?? 400;
  const usageOf = (u: { output_tokens: number; input_tokens: number } | undefined): ComposeUsage => ({ outputTokens: u?.output_tokens ?? 0, inputTokens: u?.input_tokens ?? 0 });
  return {
    async compose(input, onText) {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: maxTokens,
          system: buildSystemPrompt(input.pack, input.telemetry, input.intention),
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          messages: buildMessages(input),
        },
        { signal: input.signal },
      );
      let text = "";
      stream.on("text", (delta) => {
        text += delta;
        onText(delta);
      });
      const final = await stream.finalMessage();
      const refused = final.stop_reason === "refusal";
      return { text, usage: usageOf(final.usage), refused };
    },
    async intend(input) {
      const response = await client.messages.create({
        model,
        max_tokens: 120,
        system: buildSystemPrompt(input.pack, input.telemetry, input.intention),
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        messages: [
          ...buildMessages({ ...input, mail: [], frame: null }),
          { role: "user", content: "(Not a letter. In one short third-person line, say what Aelia means to do next in the town, for the panel beneath her visiting marker. Example: She means to sit by the lake a while.)" },
        ],
      });
      const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(" ");
      return { text, usage: usageOf(response.usage) };
    },
  };
}
