import { spaceQueryClient } from "@hatch/space-sdk/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

// --- Out-of-band safety net ------------------------------------------------
// The town's one unforgivable failure is a bare sky-blue screen with
// no title, no buttons, nothing to tap — which is what a visitor gets
// if the 3D scene dies in a way that also takes the React tree (or
// the tree's own error overlay) down with it. Two guards live OUTSIDE
// the app's failure path:
//  1. An ErrorBoundary that replaces a crashed tree with a small
//     working panel (title, cause, Retry / Light graphics).
//  2. A plain-DOM watchdog (no React at all) that watches health
//     flags the scene stamps on window — first frame, frame
//     heartbeat, fatal scene error — plus whether the React root is
//     still mounted, and paints its own emergency overlay when the
//     town is dead and nothing else has spoken up. It defers to the
//     app's own overlays (marked data-mt-overlay) and to the
//     boundary panel whenever either is already on screen.

interface MtFlags {
  __mtFirstFrameAt?: number;
  __mtLastFrameAt?: number;
  __mtSceneError?: string;
  __mtLastError?: string;
}
const mtFlags = window as unknown as MtFlags;

window.addEventListener("error", (e) => {
  if (!mtFlags.__mtLastError && e.message) mtFlags.__mtLastError = e.message;
});
window.addEventListener("unhandledrejection", (e) => {
  if (!mtFlags.__mtLastError) {
    const reason = (e as PromiseRejectionEvent).reason;
    mtFlags.__mtLastError = reason instanceof Error ? reason.message : String(reason ?? "");
  }
});

function reloadInLightGraphics() {
  try {
    window.localStorage.setItem("muse-town-lowgfx", "1");
  } catch {
    /* the reload still helps */
  }
  window.location.reload();
}

class TownErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        id="mt-boundary-fallback"
        role="alert"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#22332b",
          color: "#ffffff",
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Muse Town</h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, maxWidth: 340, margin: 0, color: "rgba(255,255,255,0.85)" }}>
          The town ran into a problem and its screen had to be rebuilt
          {error.message ? ` — ${error.message}` : ""}. Your saved progress is untouched.
        </p>
        <button
          type="button"
          aria-label="Retry loading Muse Town"
          onClick={() => window.location.reload()}
          style={{
            borderRadius: 999,
            border: "none",
            background: "#ffd34e",
            color: "#4a3600",
            fontWeight: 700,
            fontSize: 14,
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          ↻ Bring the town back
        </button>
        <button
          type="button"
          aria-label="Reload Muse Town in light graphics mode"
          onClick={reloadInLightGraphics}
          style={{
            borderRadius: 999,
            border: "none",
            background: "rgba(255,255,255,0.14)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 13,
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          Reload in light graphics mode
        </button>
      </div>
    );
  }
}

function installWatchdog() {
  const installedAt = Date.now();
  let overlay: HTMLDivElement | null = null;
  // The root only counts as "gone" once it has been seen alive — a
  // slow first boot on a weak phone must never trip the alarm.
  let sawChildren = false;

  const hideOverlay = () => {
    overlay?.remove();
    overlay = null;
  };

  const showOverlay = (cause: string) => {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "mt-emergency-overlay";
    overlay.setAttribute("role", "alert");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#22332b;color:#fff;padding:24px;text-align:center;font-family:system-ui,sans-serif;";
    const title = document.createElement("h1");
    title.textContent = "Muse Town";
    title.style.cssText = "font-size:22px;font-weight:700;margin:0;";
    const msg = document.createElement("p");
    msg.textContent = `The town couldn't load — tap to retry. ${cause} A fresh load brings it back, and your saved progress is untouched.`;
    msg.style.cssText = "font-size:14px;line-height:1.55;max-width:340px;margin:0;color:rgba(255,255,255,0.85);";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "↻ Bring the town back";
    retry.setAttribute("aria-label", "Retry loading Muse Town");
    retry.style.cssText =
      "border-radius:999px;border:none;background:#ffd34e;color:#4a3600;font-weight:700;font-size:14px;padding:10px 20px;cursor:pointer;";
    retry.addEventListener("click", () => window.location.reload());
    const light = document.createElement("button");
    light.type = "button";
    light.textContent = "Reload in light graphics mode";
    light.setAttribute("aria-label", "Reload Muse Town in light graphics mode");
    light.style.cssText =
      "border-radius:999px;border:none;background:rgba(255,255,255,0.14);color:#fff;font-weight:600;font-size:13px;padding:8px 16px;cursor:pointer;";
    light.addEventListener("click", reloadInLightGraphics);
    overlay.append(title, msg, retry, light);
    document.body.appendChild(overlay);
  };

  window.setInterval(() => {
    // Someone else is already handling it: the app's own failure
    // overlay or the boundary panel is on screen.
    if (document.querySelector("[data-mt-overlay], #mt-boundary-fallback")) {
      hideOverlay();
      return;
    }
    if (rootEl && rootEl.childNodes.length > 0) sawChildren = true;
    const rootGone = sawChildren && !!rootEl && rootEl.childNodes.length === 0;
    const now = Date.now();
    const firstFrameAt = mtFlags.__mtFirstFrameAt;
    const lastFrameAt = mtFlags.__mtLastFrameAt;
    const noFrameTooLong = !firstFrameAt && now - installedAt > 35000;
    const heartbeatStale =
      !!firstFrameAt && !!lastFrameAt && performance.now() - lastFrameAt > 10000;
    const sceneError = mtFlags.__mtSceneError;
    const dead = rootGone || noFrameTooLong || (!!sceneError && (!firstFrameAt || heartbeatStale || rootGone));
    if (dead) {
      showOverlay(
        sceneError ??
          (noFrameTooLong
            ? "The 3D town never painted its first picture (this happens under memory pressure on a phone — it isn't anything you did)."
            : (mtFlags.__mtLastError ?? "The town's screen stopped answering.")),
      );
    } else if (firstFrameAt && !sceneError) {
      hideOverlay();
    }
  }, 2000);
}

// If you edit this file: keep `<QueryClientProvider client={spaceQueryClient}>`
// wrapping the app (every space shares the SDK's QueryClient), and keep
// BOTH the `hatch-space-root` class AND the `data-hatch-space-root`
// attribute on the outer div. The SDK styles select on
// `.hatch-space-root[data-hatch-space-root]` to apply mobile safe-area
// insets (notches, gesture bars, etc.), correct viewport sizing, and the
// hosting header/chrome offsets — dropping either breaks layout silently.
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={spaceQueryClient}>
      <TownErrorBoundary>
        <div className="hatch-space-root" data-hatch-space-root>
          <App />
        </div>
      </TownErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
installWatchdog();
