// The visit's violet notice (moved out of App.tsx, Nov 8, 2026): one
// line at a time, held for its own time, whose clock starts only once
// the tab is in view (a notice set while the town sat in a background
// tab is still read), and which goes on a tap (the caller clears it).
import { useEffect, useState } from "react";

export type VisitNotice = { text: string; at: number; holdMs?: number };
export const VISIT_NOTICE_HOLD_MS = 6500;

export function useVisitNotice(doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> = document) {
  const [visitNotice, setVisitNotice] = useState<VisitNotice | null>(null);
  useEffect(() => {
    if (!visitNotice) return;
    let timer = 0;
    const arm = () => {
      if (timer || doc.visibilityState !== "visible") return;
      timer = window.setTimeout(() => setVisitNotice(null), visitNotice.holdMs ?? VISIT_NOTICE_HOLD_MS);
    };
    arm();
    doc.addEventListener("visibilitychange", arm);
    return () => {
      window.clearTimeout(timer);
      doc.removeEventListener("visibilitychange", arm);
    };
  }, [visitNotice, doc]);
  return [visitNotice, setVisitNotice] as const;
}
