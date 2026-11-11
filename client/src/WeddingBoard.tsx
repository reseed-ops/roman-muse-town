// The wedding at the basilica's board (Task 58): Aelia's offer, the
// three preparations in order, the ceremony phase by phase, and the
// remembered day. Calm and tender; nothing here pays or scores. Her
// lines come from shared/romanWedding.ts, all through the tender gate.
import { useState } from "react";
import {
  CEREMONY,
  WEDDING_DONE_LINE,
  WEDDING_OFFER_LINES,
  WEDDING_PREP,
  WEDDING_STEPS,
  WEDDING_WAIT_LINE,
  canHold,
  nextStep,
  weddingHeld,
  weddingOffered,
  type WeddingBook,
  type WeddingStep,
} from "../../shared/romanWedding";

/** One line of status, from the book alone. */
export function weddingProgress(book: WeddingBook, rank: number): string {
  if (!weddingOffered(rank)) return "Not yet. Aelia will bring it up when you are closer.";
  if (weddingHeld(book)) return "The day was held. The clasped hands are on the shelf in your house.";
  const n = book.steps.length;
  if (n === WEDDING_STEPS.length) return "Everything is ready. The ceremony can begin.";
  return `${n} of ${WEDDING_STEPS.length} preparations done. Next: ${WEDDING_PREP[nextStep(book)!].title.toLowerCase()}.`;
}

export function WeddingBoard({
  book, rank, busy, offerIndex, onPrepare, onHold, onHistory,
}: {
  book: WeddingBook;
  rank: number;
  busy: boolean;
  offerIndex: number;
  onPrepare: (step: WeddingStep) => void;
  onHold: () => void;
  onHistory: () => void;
}) {
  const [phase, setPhase] = useState<number | null>(null);
  const offered = weddingOffered(rank);
  const next = nextStep(book);
  const phaseDef = phase !== null ? CEREMONY[phase] : undefined;
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <h3 className="text-sm font-bold text-[#ffd34e]">💍 A Roman wedding</h3>
      <article className="mt-2 rounded-2xl bg-white/8 px-3 py-2.5">
        <p className="text-[13px] leading-relaxed text-white/85">
          You are already married. The town would like to mark it, and renew your vows, as Romans did.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#ffd34e]">{weddingProgress(book, rank)}</p>
        {!offered && <p className="mt-1.5 text-[13px] leading-relaxed text-white/90 italic">“{WEDDING_WAIT_LINE}”</p>}
        {offered && !weddingHeld(book) && book.steps.length === 0 && phase === null && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/90 italic">“{WEDDING_OFFER_LINES[offerIndex % WEDDING_OFFER_LINES.length]}”</p>
        )}
        {offered && !weddingHeld(book) && next && (
          <div className="mt-1.5">
            <p className="text-[12px] text-white/60">{WEDDING_PREP[next].text}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPrepare(next)}
              className="mt-1.5 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
            >
              {WEDDING_PREP[next].button}
            </button>
            {book.steps.length > 0 && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/90 italic">“{WEDDING_PREP[book.steps[book.steps.length - 1]!].line}”</p>
            )}
          </div>
        )}
        {canHold(book, rank) && phase === null && (
          <div className="mt-1.5">
            <p className="text-[13px] leading-relaxed text-white/90 italic">“{WEDDING_PREP.dress.line}”</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPhase(0)}
              className="mt-1.5 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
            >
              Begin the ceremony
            </button>
          </div>
        )}
        {phaseDef && phase !== null && (
          <div className="mt-2 rounded-xl bg-black/20 px-2.5 py-2">
            <p className="text-[11px] font-bold tracking-wide text-[#ffd34e] uppercase">
              {phase + 1} of {CEREMONY.length}: {phaseDef.title}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/70">{phaseDef.scene}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/90 italic">“{phaseDef.line}”</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (phase + 1 < CEREMONY.length) setPhase(phase + 1);
                else {
                  setPhase(null);
                  onHold();
                }
              }}
              className="mt-1.5 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
            >
              {phaseDef.button}
            </button>
          </div>
        )}
        {weddingHeld(book) && <p className="mt-1.5 text-[13px] leading-relaxed text-white/90 italic">“{WEDDING_DONE_LINE}”</p>}
        <button type="button" onClick={onHistory} className="mt-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold transition active:scale-95">
          📜 Rome's history: a Roman wedding
        </button>
      </article>
      <p className="mt-2 text-[12px] leading-relaxed text-white/50 italic">
        Once, and only once. Nothing here is counted for points.
      </p>
    </div>
  );
}
