import { useEffect, useRef, useState, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { TownSceneHandle } from "./townScene";
import type { TownState } from "./useTownState";
import { buildArrivalSummary, utcDay, type ArrivalDestination, type ArrivalMarker, type ArrivalSummary } from "./arrivalSummary";
import { reliableActions } from "./reliableActions";
import { addDeviceState, restoreDeviceState, saveDownload } from "./townSaveClient";
import { MAX_SAVE_BYTES, readSaveEnvelope, type TownSave } from "../../shared/saveFormat";
import type { PerformanceSnapshot } from "./performanceMonitor";
import "./townUtilities.css";

function preference(key: string, fallback: boolean): boolean {
  try { const value = localStorage.getItem(key); return value === null ? fallback : value === "1"; } catch { return fallback; }
}
function storePreference(key: string, on: boolean) { try { localStorage.setItem(key, on ? "1" : "0"); } catch { /* optional preferences */ } }
function readMarker(): ArrivalMarker | null {
  try {
    const marker: unknown = JSON.parse(localStorage.getItem("muse-town-arrival-v1") ?? "null");
    if (marker && typeof marker === "object" && "day" in marker && "lastLetterId" in marker && typeof marker.day === "string" && typeof marker.lastLetterId === "number") return marker as ArrivalMarker;
  } catch { /* first visit */ }
  return null;
}

function PerformanceOverlay({ scene }: { scene: RefObject<TownSceneHandle | null> }) {
  const [stats, setStats] = useState<PerformanceSnapshot | null>(null);
  useEffect(() => {
    const update = () => setStats(scene.current?.performanceSnapshot() ?? null);
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [scene]);
  if (!stats) return null;
  return <aside className="town-performance" aria-label="Developer performance diagnostics">
    <strong>{stats.fps.toFixed(0)} FPS · {["Light", "Balanced", "Full"][stats.quality]}</strong>
    <span>Frame {stats.frameMs.toFixed(1)} ms · p95 {stats.p95Ms.toFixed(1)} ms</span>
    <span>CPU submission {stats.cpuMs.toFixed(1)} ms</span>
    <span>{stats.drawCalls} draw calls · {stats.triangles.toLocaleString()} triangles</span>
    <span>{stats.textures} textures · {stats.geometries} geometries · {stats.pixelRatio.toFixed(2)}× pixels</span>
    <span>Pieces {stats.loading.loaded}/{stats.loading.total} · {stats.loading.active} loading</span>
    <span>{stats.loading.deferred} waiting for proximity · {stats.loading.failed} failed</span>
  </aside>;
}

export function TownUtilities({ open, onClose, scene, state, ready, holdArrival, onArrivalOpen, onNavigate, lowGraphics, onLowGraphicsChange }: {
  open: boolean; onClose(): void; scene: RefObject<TownSceneHandle | null>; state: TownState | undefined;
  ready: boolean; holdArrival: boolean; onArrivalOpen(open: boolean): void; onNavigate(destination: ArrivalDestination): void;
  lowGraphics: boolean; onLowGraphicsChange(on: boolean): void;
}) {
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDivElement>(null);
  const [diagnostics, setDiagnostics] = useState(false);
  const [automatic, setAutomatic] = useState(() => preference("muse-town-auto-graphics", true));
  const [arrivals, setArrivals] = useState(() => preference("muse-town-arrival-enabled", true));
  const [arrival, setArrival] = useState<ArrivalSummary | null>(null);
  const marker = useRef(readMarker());
  const shownDay = useRef<string | null>(null);
  const [day, setDay] = useState(() => utcDay(new Date()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{ json: string; save: TownSave; requestId: string } | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(() => reliableActions.list().length);

  useEffect(() => {
    const timer = window.setInterval(() => { setDay(utcDay(new Date())); setPendingCount(reliableActions.list().length); }, 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => onArrivalOpen(!!arrival), [arrival, onArrivalOpen]);
  useEffect(() => {
    if (!state || !ready || holdArrival || shownDay.current === day) return;
    if (arrivals && marker.current?.day !== day) {
      // A returning visit only hears about it if there's something to tell.
      const summary = buildArrivalSummary(state, marker.current);
      // A first visit is already on its way to the tree; don't send it elsewhere.
      if (!marker.current && !state.tree.watered_today) {
        summary.destination = "tree";
        summary.suggestion = "Water the Town Tree";
      }
      if (!marker.current || !summary.quiet) setArrival(summary);
    }
    shownDay.current = day;
    marker.current = { day, lastLetterId: Math.max(0, ...state.letters.map((letter) => letter.id)) };
    try { localStorage.setItem("muse-town-arrival-v1", JSON.stringify(marker.current)); } catch { /* optional */ }
  }, [state, ready, holdArrival, day, arrivals]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    setPendingCount(reliableActions.list().length);
    return () => previous?.focus();
  }, [open]);

  const exportCurrent = async () => {
    const result = await api.exportSave({});
    try { return addDeviceState(result.json, localStorage); } catch { return result.json; }
  };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setMessage(""); setError("");
    try { await operation(); } catch (error) { setError(error instanceof Error ? error.message : "The operation could not finish."); }
    finally { reliableActions.resume(); setBusy(false); setPendingCount(reliableActions.list().length); }
  };

  return <>
    {diagnostics && <PerformanceOverlay scene={scene} />}
    {arrival && !open && <section className="town-arrival" aria-label="Your daily town summary">
      <button className="town-close" aria-label="Dismiss daily summary" onClick={() => setArrival(null)}>×</button>
      <h2>{arrival.title}</h2>
      <ul>{arrival.lines.map((line) => <li key={line}>{line}</li>)}</ul>
      <button onClick={() => { onNavigate(arrival.destination); setArrival(null); }}>{arrival.suggestion}</button>
      <button className="town-quiet" onClick={() => { setArrivals(false); storePreference("muse-town-arrival-enabled", false); setArrival(null); }}>Don’t show automatically</button>
    </section>}
    {open && <div className="town-tools-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="town-tools-title" className="town-tools mt-scrollable" onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" && !busy) onClose();
        if (event.key === "Tab") {
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]') ?? []);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <button className="town-close" aria-label="Close town settings" disabled={busy} onClick={onClose}>×</button>
        <h2 id="town-tools-title">Settings & saves</h2>
        <section>
          <h3>Today</h3>
          <label><input type="checkbox" checked={arrivals} onChange={(event) => { setArrivals(event.target.checked); storePreference("muse-town-arrival-enabled", event.target.checked); if (!event.target.checked) setArrival(null); }} /> Show a daily arrival summary</label>
          <button disabled={!state} onClick={() => { if (state) setArrival(buildArrivalSummary(state, marker.current)); onClose(); }}>See today’s summary</button>
        </section>
        <section>
          <h3>Save your town</h3>
          <p>Keep letters, memories, progress, and postcard images in a file you can restore later. The file contains your town’s private writing.</p>
          <button disabled={busy || !state} onClick={() => void run(async () => { await reliableActions.pause(); saveDownload(await exportCurrent()); setMessage("Your save is ready to download."); })}>Download a save</button>
          <label className="town-file">Choose a save to restore<input type="file" accept=".json,application/json" disabled={busy} onChange={(event) => {
            const file = event.target.files?.[0];
            setSelected(null); setRecovery(null); setError(""); setMessage("");
            if (!file) return;
            void run(async () => {
              if (file.size > MAX_SAVE_BYTES) throw new Error("This save is larger than 32 MB.");
              const json = await file.text();
              setSelected({ json, save: readSaveEnvelope(json), requestId: crypto.randomUUID() });
            });
          }} /></label>
          {selected && <div className="town-restore-preview">
            <p>Save from <strong>{new Date(selected.save.exportedAt).toLocaleString()}</strong></p>
            <p>{selected.save.tables.letters?.length ?? 0} letters · {selected.save.tables.aelia_facts?.length ?? 0} memories · {selected.save.attachments.length} postcards</p>
            <p>{selected.save.tables.muse_notes?.length ?? 0} notes for Muse · {selected.save.tables.life_digest?.length ?? 0} digest entries</p>
            {(selected.save.tables.muse_notes ?? []).slice(-3).map((note, i) => <p key={i} className="town-restore-note">“{String(note.text).slice(0, 120)}”</p>)}
            <p>Restoring replaces the current town. Download a recovery copy first.</p>
            <button disabled={busy} onClick={() => void run(async () => { await reliableActions.pause(); const json = await exportCurrent(); setRecovery(json); saveDownload(json, "before-restore"); setMessage("Keep this recovery copy before restoring."); })}>{recovery ? "Download recovery copy again" : "Download recovery copy"}</button>
            <button disabled={busy || !recovery} onClick={() => void run(async () => {
              await reliableActions.pause();
              await queryClient.cancelQueries();
              await api.restoreSave({ json: selected.json, request_id: selected.requestId });
              reliableActions.clear();
              // Prevent the old scene's pagehide handler from overwriting the restored pose.
              scene.current?.dispose(); scene.current = null;
              try { restoreDeviceState(selected.save, localStorage); } catch { /* server save remains restored */ }
              queryClient.clear();
              window.location.reload();
            })}>Restore selected save</button>
          </div>}
          {pendingCount > 0 && <p>{pendingCount} action{pendingCount === 1 ? " has" : "s have"} an unconfirmed response. Repeating the same action safely reuses its request ID.</p>}
        </section>
        <section>
          <h3>Performance</h3>
          <label><input type="checkbox" checked={lowGraphics} onChange={(event) => onLowGraphicsChange(event.target.checked)} /> Light graphics</label>
          <label><input type="checkbox" checked={automatic} onChange={(event) => { const on = event.target.checked; setAutomatic(on); storePreference("muse-town-auto-graphics", on); scene.current?.setAutomaticGraphics(on); }} /> Adapt graphics to frame rate</label>
          <p>Adjusts detail gradually. Light graphics takes priority when enabled.</p>
          <label><input type="checkbox" checked={diagnostics} onChange={(event) => setDiagnostics(event.target.checked)} /> Show developer diagnostics</label>
        </section>
        {busy && <p role="status">Working…</p>}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert" className="town-error">{error}</p>}
      </div>
    </div>}
  </>;
}
