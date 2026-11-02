import { useEffect, useRef } from "react";

export interface TownMenuItem {
  key: string;
  icon: string;
  label: string;
  detail?: string;
  active: boolean;
  action(): void;
  aria: string;
}
interface MenuGroup { heading: string; collapsed?: boolean; items: TownMenuItem[] }

/** Everyday actions stay visible; destinations and occasional controls expand on demand. */
export function TownMenu({ groups, className, festival, footerNote, perfNote, onClose, onSettings }: {
  groups: MenuGroup[];
  className: string;
  festival?: { name: string; dressing: string } | null;
  /** One quiet status line at the foot of the menu (the scene's
   *  motion verdict), read-only, in the small print. */
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
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ffd34e]"
      style={item.active ? { backgroundColor: "rgba(255,211,78,0.18)" } : undefined}
      onClick={() => { onClose(); item.action(); }} aria-label={item.aria}>
      <span aria-hidden="true" className="w-6 shrink-0 text-center text-base">{item.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block">{item.label}</span>
        {item.detail && <span className="mt-0.5 block text-xs font-normal leading-relaxed text-white/65">{item.detail}</span>}
      </span>
    </button>
  ));
  return <>
    <button type="button" aria-label="Close the town menu" tabIndex={-1}
      className="absolute inset-0 z-20 cursor-default" onClick={onClose} />
    <nav ref={nav} tabIndex={-1} aria-label="Town menu" className={className}
      onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <h2 className="text-base font-bold text-white">Town menu</h2>
        <button type="button" aria-label="Close the town menu" onClick={onClose} className="h-10 w-10 rounded-xl text-xl text-white hover:bg-white/10">×</button>
      </div>
      {festival && <p className="mx-1 mb-2 rounded-2xl bg-[#ffd34e]/15 px-3 py-2 text-sm text-[#ffd34e]" title={festival.dressing}>🎉 Today: {festival.name}</p>}
      {groups.filter((group) => group.items.length).map((group) => group.collapsed ? (
        <details key={group.heading} className="mt-1 border-t border-white/10">
          <summary className="cursor-pointer rounded-xl px-3 py-3 text-sm font-bold text-white/85 focus-visible:outline-2 focus-visible:outline-[#ffd34e]">{group.heading}</summary>
          {rows(group.items)}
        </details>
      ) : <section key={group.heading} aria-label={group.heading}>
        <h3 className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-white/55">{group.heading}</h3>
        {rows(group.items)}
      </section>)}
      <div className="mt-2 border-t border-white/10 pt-2">
        <button type="button" onClick={() => { onClose(); onSettings(); }}
          className="w-full rounded-2xl bg-white/10 px-3 py-3 text-left text-sm font-bold text-white hover:bg-white/15">
          Settings & saves
          <span className="mt-1 block text-xs font-normal text-white/65">Graphics, daily summary & backups</span>
        </button>
      </div>
      {footerNote && <p className="px-3 pb-1 pt-2 text-xs font-normal text-white/55">{footerNote}</p>}
      {perfNote && <p className="px-3 pb-1 pt-1 text-xs font-normal text-white/55">{perfNote}</p>}
    </nav>
  </>;
}
