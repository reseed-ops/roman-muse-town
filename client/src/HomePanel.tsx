// Arrange our home (Task 40): each spot in the house, and the keepsakes
// he has earned that fit it; tapping one places it there (a keepsake
// stands in one spot at a time, so placing it moves it). Below, what is
// still to earn and how. Cosmetic only.
import { HOME_KEEPSAKES, HOME_SLOTS, type HomeArrangement, type HomeKeepsakeId, type HomeSlotId } from "../../shared/homeDecor";

export function HomePanel({
  arrangement,
  earned,
  busy,
  onPlace,
  onClose,
}: {
  arrangement: HomeArrangement;
  earned: Set<HomeKeepsakeId>;
  busy: boolean;
  onPlace: (slot: HomeSlotId, keepsake: HomeKeepsakeId | null) => void;
  onClose: () => void;
}) {
  const locked = HOME_KEEPSAKES.filter((k) => !earned.has(k.id));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[64px] z-40 flex justify-center px-4 pt-safe">
      <section aria-label="Arrange our home" className="mt-plate mt-scrollable pointer-events-auto mt-3 max-h-[calc(100dvh-120px)] w-[min(500px,94vw)] overflow-y-auto px-4 pt-4 pb-4">
        <p className="mt-nametab">
          <span aria-hidden="true">🏠</span> Our home
        </p>
        <div className="flex justify-end">
          <button type="button" aria-label="Close" className="rounded-full bg-[#2b2118]/8 px-2 py-0.5 text-[12px] leading-none font-bold transition active:scale-90" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="text-[14px] leading-relaxed" style={{ fontFamily: "var(--font-voice)" }}>
          Things we did together, kept where we can see them. Choose what stands where.
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {HOME_SLOTS.map((slot) => {
            const here = arrangement[slot.id];
            const choices = HOME_KEEPSAKES.filter((k) => k.mount === slot.mount && earned.has(k.id));
            return (
              <li key={slot.id}>
                <p className="text-[13px] font-bold">{slot.label}</p>
                {choices.length === 0 ? (
                  <p className="text-[12px] text-[#2b2118]/60 italic">Nothing earned for this spot yet.</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {choices.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        disabled={busy}
                        aria-pressed={here === k.id}
                        className={`rounded-full px-3 py-1 text-[12px] font-semibold transition active:scale-95 disabled:opacity-60 ${here === k.id ? "bg-[#ffd34e] text-[#4a3600]" : "bg-[#2b2118]/7"}`}
                        onClick={() => onPlace(slot.id, here === k.id ? null : k.id)}
                      >
                        {k.label}
                      </button>
                    ))}
                    {here && (
                      <button type="button" disabled={busy} className="rounded-full px-3 py-1 text-[12px] text-[#2b2118]/70 underline" onClick={() => onPlace(slot.id, null)}>
                        Leave it empty
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {locked.length > 0 && (
          <>
            <h3 className="mt-4 text-[12px] font-bold text-[#2b2118]/70">Still to earn</h3>
            <ul className="mt-1 list-disc pl-5 text-[12px] leading-relaxed text-[#2b2118]/75">
              {locked.map((k) => (
                <li key={k.id}>
                  {k.label}: {k.earnedBy}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
