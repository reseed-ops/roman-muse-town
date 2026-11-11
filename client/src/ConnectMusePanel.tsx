// Connect my Muse (Task 29), the panel: the one-time pairing code and
// the message the visitor pastes to their Muse, with a copy button.
// Moved out of App.tsx, which keeps the state and the code request.
import { useCallback, useEffect, useState } from "react";
import { disconnectMuse, museConnectMessage, startPairingCheck, requestPairCode, type PairCode, type PairingState } from "./connectMuse";
import { isHostedTown } from "./hosted";

export type ConnectMuseState = { state: "loading" } | { state: "ready"; pair: PairCode; copied: boolean } | { state: "error"; text: string };

/** The panel's state, whether the hosted bridge pairs (asked once per
 *  load, on the hosted web only), and the opener the menu row calls. */
export function useConnectMuse(closeMenu: () => void) {
  const [connectMuse, setConnectMuse] = useState<ConnectMuseState | null>(null);
  const [pairing, setPairing] = useState<PairingState>(() => (isHostedTown() ? "checking" : "off"));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    return startPairingCheck(isHostedTown(), setPairing);
  }, [attempt]);
  const retryPairing = useCallback(() => setAttempt((n) => n + 1), []);
  const openConnectMuse = useCallback(() => {
    closeMenu();
    setConnectMuse({ state: "loading" });
    requestPairCode().then(
      (pair) => setConnectMuse({ state: "ready", pair, copied: false }),
      (error: unknown) => setConnectMuse({ state: "error", text: error instanceof Error ? error.message : String(error) }),
    );
  }, [closeMenu]);
  return { connectMuse, setConnectMuse, pairing, pairingLive: pairing === "live", retryPairing, openConnectMuse };
}

export function ConnectMusePanel({ state, onClose, onCopied }: { state: ConnectMuseState; onClose: () => void; onCopied: (copied: boolean) => void }) {
  const [unlink, setUnlink] = useState<"idle" | "working" | "done" | "error">("idle");
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[64px] z-40 flex justify-center px-4 pt-safe">
      <section aria-label="Connect my Muse" className="mt-plate pointer-events-auto mt-3 w-[min(460px,94vw)] px-4 pt-4 pb-3.5">
        <p className="mt-nametab"><span aria-hidden="true">🔗</span> Connect my Muse</p>
        <div className="flex justify-end">
          <button type="button" className="rounded-full bg-[#2b2118]/8 px-2 py-0.5 text-[12px] leading-none font-bold transition active:scale-90" aria-label="Close Connect my Muse" onClick={() => onClose()}>
            ✕
          </button>
        </div>
        {state.state === "loading" && <p className="text-sm">Making your code…</p>}
        {state.state === "error" && <p className="text-sm">{state.text} Close this and try again in a moment.</p>}
        {state.state === "ready" && (
          <>
            <p className="text-sm leading-relaxed">
              Copy this message and paste it to your Muse in your chat with her. When she says she is watching, open the menu, tap Talk to my Muse, and talk to Aelia here.
            </p>
            <p className="mt-2 text-center text-[22px] font-bold tracking-[0.12em]" aria-label={`Your code: ${state.pair.code}`}>
              {state.pair.code}
            </p>
            <p className="text-center text-[12px] text-[#2b2118]/60">
              Works once, until {new Date(state.pair.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
            </p>
            <pre className="mt-2 max-h-[30vh] overflow-y-auto rounded-xl bg-[#2b2118]/6 p-2.5 text-[12px] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "inherit" }}>
              {museConnectMessage(state.pair.code)}
            </pre>
            <button
              type="button"
              className="mt-2.5 w-full rounded-full bg-[#ffd34e] px-4 py-2 text-sm font-bold text-[#4a3600] shadow transition active:scale-95"
              onClick={() => {
                const text = museConnectMessage(state.pair.code);
                void navigator.clipboard?.writeText(text).then(
                  () => onCopied(true),
                  () => onCopied(false),
                );
              }}
            >
              {state.copied ? "Copied" : "Copy the message"}
            </button>
          </>
        )}
        <div className="mt-3 border-t border-[#2b2118]/10 pt-2.5">
          <button
            type="button"
            className="w-full rounded-full bg-[#2b2118]/8 px-4 py-1.5 text-[13px] font-bold transition active:scale-95 disabled:opacity-60"
            disabled={unlink === "working" || unlink === "done"}
            onClick={() => {
              setUnlink("working");
              disconnectMuse().then(
                () => setUnlink("done"),
                () => setUnlink("error"),
              );
            }}
          >
            {unlink === "working" ? "Disconnecting…" : unlink === "done" ? "Disconnected" : "Disconnect my Muse"}
          </button>
          <p className="mt-1 text-center text-[11px] leading-snug text-[#2b2118]/60" role="status">
            {unlink === "done"
              ? "Every link to a Muse made so far has stopped working. To connect again, close this and open Connect my Muse for a new code."
              : unlink === "error"
                ? "The town could not do that just now. Try again in a moment."
                : "Stops every Muse linked to this town, at once. A new code makes a new link, and the old ones stay stopped. A copy of the town she has already seen cannot be taken back."}
          </p>
        </div>
      </section>
    </div>
  );
}
