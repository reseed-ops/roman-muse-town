import { useEffect, useRef, type ReactNode } from "react";

export interface TownMenuItem {
  key: string;
  icon: string;
  label: string;
  /** A state, never an explanation: "1 unread", "Sapling", "Walking
   *  with you". The label says what the row does. */
  detail?: string;
  active: boolean;
  action(): void;
  aria: string;
  /** A colour for the icon alone (her star takes her gold). */
  tint?: string;
}
export interface MenuGroup {
  heading: string;
  collapsed?: boolean;
  /** The heading names the group for assistive tech only; nothing is
   *  drawn above the rows (her group: the first row already says her name). */
  hideHeading?: boolean;
  items: TownMenuItem[];
}

/** The folds left open (fix list, Nov 7, 2026): reopening the menu,
 *  or reloading the tab (follow-up, Nov 7), finds "Behind the scenes"
 *  as it was left. Held in this tab's sessionStorage only. */
const FOLDS_KEY = "muse-town-menu-folds";
const openFolds = new Set<string>((() => {
  try { return JSON.parse(sessionStorage.getItem(FOLDS_KEY) ?? "[]") as string[]; } catch { return []; }
})());
const keepFolds = () => { try { sessionStorage.setItem(FOLDS_KEY, JSON.stringify([...openFolds])); } catch { /* optional */ } };

// One row style for every line of the menu, the folds and Settings
// included (Nov 6, 2026 review): the eye reads one list.
const rowClass =
  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[15px] font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ffd34e]";

/** Everyday actions stay visible; destinations and occasional controls
 *  fold; the tooling folds last, under "Behind the scenes". */
export function TownMenu({ groups, backstage, className, festival, footerNote, perfNote, onClose, onSettings }: {
  groups: MenuGroup[];
  /** Tooling rows (the second controller, the visit door): folded at
   *  the very end with the diagnostics, out of the player's way. */
  backstage?: TownMenuItem[];
  className: string;
  festival?: { name: string; dressing: string } | null;
  /** One quiet status line (the scene's motion verdict), read-only,
   *  in the small print behind the scenes. */
  footerNote?: string;
  /** The perf line (v44), directly under the motion line: rolling
   *  fps, p95 frame time, and the current quality tier, read from
   *  the scene's own measurement while the menu is open. */
  perfNote?: string;
  onClose(): void;
  onSettings(): void;
}) {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    nav.current?.focus();
    return () => { if (document.activeElement === document.body || nav.current?.contains(document.activeElement)) previous?.focus(); };
  }, []);
  const rows = (items: TownMenuItem[]) => items.map((item) => (
    <button key={item.key} type="button"
      className={rowClass}
      style={item.active ? { backgroundColor: "rgba(255,211,78,0.18)" } : undefined}
      onClick={() => { onClose(); item.action(); }} aria-label={item.aria}>
      <span aria-hidden="true" className="w-6 shrink-0 text-center text-base" style={item.tint ? { color: item.tint } : undefined}>{item.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block leading-tight">{item.label}</span>
        {item.detail && <span className="mt-0.5 block text-xs font-normal leading-snug text-white/60">{item.detail}</span>}
      </span>
    </button>
  ));
  const fold = (heading: string, children: ReactNode) => (
    <details key={heading} className="group" open={openFolds.has(heading)}
      onToggle={(event) => { if (event.currentTarget.open) openFolds.add(heading); else openFolds.delete(heading); keepFolds(); }}>
      <summary className={`${rowClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <span aria-hidden="true" className="w-6 shrink-0 text-center text-lg leading-none text-white/50 transition-transform group-open:rotate-90">›</span>
        <span className="min-w-0 flex-1">{heading}</span>
      </summary>
      <div className="pb-1 pl-2">{children}</div>
    </details>
  );
  const showBackstage = (backstage && backstage.length > 0) || !!footerNote || !!perfNote;
  return <>
    <button type="button" aria-label="Close the town menu" tabIndex={-1}
      className="absolute inset-0 z-20 cursor-default" onClick={onClose} />
    <nav ref={nav} tabIndex={-1} aria-label="Town menu" className={className}
      onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <h2 className="text-base font-bold text-white">Town menu</h2>
        <button type="button" aria-label="Close the town menu" onClick={onClose} className="h-10 w-10 rounded-xl text-xl text-white/70 hover:bg-white/10">×</button>
      </div>
      {festival && <p className="mx-1 mb-1 rounded-2xl bg-[#ffd34e]/15 px-3 py-2 text-sm text-[#ffd34e]" title={festival.dressing}>🎉 Today: {festival.name}</p>}
      {groups.filter((group) => group.items.length).map((group) => group.collapsed ? fold(group.heading, rows(group.items)) : (
        <section key={group.heading} aria-label={group.heading}>
          {!group.hideHeading && <h3 className="px-3 pt-2.5 pb-0.5 text-[12px] font-semibold text-white/50">{group.heading}</h3>}
          {rows(group.items)}
        </section>
      ))}
      <div className="mt-1 border-t border-white/10 pt-1">
        <button type="button" onClick={() => { onClose(); onSettings(); }} className={rowClass}>
          <span aria-hidden="true" className="w-6 shrink-0 text-center text-base">⚙</span>
          <span className="min-w-0 flex-1">
            <span className="block leading-tight">Settings & saves</span>
            <span className="mt-0.5 block text-xs font-normal leading-snug text-white/60">Graphics, backups, the daily summary</span>
          </span>
        </button>
        {showBackstage && fold("Behind the scenes", <>
          {backstage && rows(backstage)}
          {footerNote && <p className="px-3 pt-2 pb-1 text-xs font-normal leading-snug text-white/55">{footerNote}</p>}
          {perfNote && <p className="px-3 pt-1 pb-1 text-xs font-normal leading-snug text-white/55">{perfNote}</p>}
        </>)}
      </div>
    </nav>
  </>;
}
