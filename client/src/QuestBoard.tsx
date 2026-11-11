// The basilica board's quests (Task 56): the four real projects, what
// each is, how far along, and Aelia's offer for the ones waiting to be
// taken up. Cosmetic and calm: no points, no streaks, no currency.
import { QUEST_DEFS, type QuestRecord } from "../../shared/projectQuests";

/** One line of progress she can see, from the record alone. */
export function questProgress(def: (typeof QUEST_DEFS)[number], rec: QuestRecord | undefined): string {
  if (!rec) return "Not on the board yet. Muse carries it in when it begins.";
  if (rec.stage === "posted") return "Posted. Aelia has an offer for you.";
  if (rec.stage === "done") return rec.celebrated ? `Finished. ${def.leaves}` : "Finished. The town is about to celebrate.";
  if (def.step) {
    const n = rec.steps;
    return n === 0 ? `Begun. No ${def.step.noun} carried in yet.` : `Begun. ${n} ${def.step.noun}${n === 1 ? "" : "s"} so far.`;
  }
  return "Begun. Waiting for the day it ends well.";
}

export function QuestBoard({ quests, busy, offerIndex, onAccept }: { quests: QuestRecord[]; busy: boolean; offerIndex: number; onAccept: (kind: QuestRecord["kind"]) => void }) {
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <h3 className="text-sm font-bold text-[#ffd34e]">⚔️ Quests from the real world</h3>
      <div className="mt-2 space-y-2.5">
        {QUEST_DEFS.map((def) => {
          const rec = quests.find((r) => r.kind === def.kind);
          return (
            <article key={def.kind} className="rounded-2xl bg-white/8 px-3 py-2.5">
              <h4 className="text-sm font-bold text-white">{def.title}</h4>
              <p className="text-[12px] text-white/60">{def.project}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-white/85">{def.beginning}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#ffd34e]">{questProgress(def, rec)}</p>
              {rec?.stage === "posted" && (
                <div className="mt-1.5">
                  <p className="text-[13px] leading-relaxed text-white/90 italic">“{def.offer[offerIndex % def.offer.length]}”</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAccept(def.kind)}
                    aria-label={`Take up the quest: ${def.title}`}
                    className="mt-1.5 rounded-full bg-[#ffd34e] px-3.5 py-1.5 text-sm font-bold text-[#4a3600] shadow transition active:scale-95 disabled:opacity-40"
                  >
                    Take it up with her
                  </button>
                </div>
              )}
              {rec && rec.completed > 0 && (
                <p className="mt-1 text-[12px] text-white/55">Finished {rec.completed} time{rec.completed === 1 ? "" : "s"}.</p>
              )}
            </article>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-white/50 italic">
        Muse carries each step in by hand, from the real project. Nothing here is counted for points.
      </p>
    </div>
  );
}
