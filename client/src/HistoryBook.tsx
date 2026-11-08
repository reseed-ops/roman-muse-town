// The town's history book (Task 37): Rome's real history, one short
// sourced lesson per place, kept visibly apart from the town's own
// story. A history page wears the "Rome's history" tag and lists its
// sources; where this town departs from history, that note sits in its
// own violet box, "This town's own story". The inscriptions, Aelia's
// book and the Two Lanterns wear the town's tag instead.
import { HISTORY_BOOK_INTRO, HISTORY_LESSONS, type HistoryLesson } from "./romanHistory";

/** The lesson for a place in town, if the book has one. */
export function lessonForPlace(placeId: string): HistoryLesson | undefined {
  return HISTORY_LESSONS.find((l) => l.placeId === placeId);
}

/** The tag a real-history page wears. */
export function HistoryTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#5a4632] px-2.5 py-0.5 text-[11px] font-bold text-[#fdf3dc]">
      <span aria-hidden="true">🏛</span> Rome's history, sourced
    </span>
  );
}

/** The tag the town's own story wears (inscriptions, her book, the Two Lanterns). */
export function TownStoryTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#6d28d9] px-2.5 py-0.5 text-[11px] font-bold text-white">
      <span aria-hidden="true">✦</span> The town's own story
    </span>
  );
}

export function HistoryBook({ lessonId, onOpen, onClose }: { lessonId: string | null; onOpen: (id: string | null) => void; onClose: () => void }) {
  const lesson = lessonId ? HISTORY_LESSONS.find((l) => l.id === lessonId) : undefined;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[64px] z-40 flex justify-center px-4 pt-safe">
      <section
        aria-label={lesson ? `History: ${lesson.title}` : "The history book"}
        className="mt-plate mt-scrollable pointer-events-auto mt-3 max-h-[calc(100dvh-120px)] w-[min(520px,94vw)] overflow-y-auto px-4 pt-4 pb-4"
      >
        <p className="mt-nametab" style={{ background: "#5a4632" }}>
          <span aria-hidden="true">📜</span> History book
        </p>
        <div className="flex items-center justify-between gap-2">
          {lesson ? (
            <button type="button" className="rounded-full bg-[#2b2118]/8 px-2.5 py-0.5 text-[12px] font-bold transition active:scale-95" onClick={() => onOpen(null)}>
              ‹ All lessons
            </button>
          ) : (
            <span />
          )}
          <button type="button" aria-label="Close the history book" className="rounded-full bg-[#2b2118]/8 px-2 py-0.5 text-[12px] leading-none font-bold transition active:scale-90" onClick={onClose}>
            ✕
          </button>
        </div>
        {!lesson && (
          <>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ fontFamily: "var(--font-voice)" }}>
              {HISTORY_BOOK_INTRO}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {HISTORY_LESSONS.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-[#2b2118]/6 px-3.5 py-2 text-left text-sm font-semibold transition hover:bg-[#ffd34e]/30 active:scale-[0.99]"
                    onClick={() => onOpen(l.id)}
                  >
                    {l.title}
                    <span className="block text-[11px] font-normal text-[#2b2118]/60">{l.period}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {lesson && (
          <article className="mt-2">
            <HistoryTag />
            <h2 className="mt-2 text-lg leading-tight font-bold">{lesson.title}</h2>
            <p className="text-[12px] font-semibold text-[#2b2118]/60">{lesson.period}</p>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ fontFamily: "var(--font-voice)" }}>
              {lesson.text}
            </p>
            {lesson.townNote && (
              <div className="mt-3 rounded-2xl bg-[#8b5cf6]/10 px-3 py-2.5">
                <TownStoryTag />
                <p className="mt-1.5 text-[13px] leading-relaxed">{lesson.townNote}</p>
              </div>
            )}
            <h3 className="mt-3 text-[12px] font-bold text-[#2b2118]/70">Sources</h3>
            <ul className="mt-1 list-disc pl-5 text-[12px] leading-relaxed text-[#2b2118]/80">
              {lesson.sources.map((s) => (
                <li key={s.cite}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-[#a87800]/50 underline-offset-2">
                      {s.cite}
                    </a>
                  ) : (
                    s.cite
                  )}
                </li>
              ))}
            </ul>
          </article>
        )}
      </section>
    </div>
  );
}
