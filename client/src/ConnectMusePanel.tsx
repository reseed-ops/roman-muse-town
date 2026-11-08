// Connect my Muse (Task 29), the panel: the one-time pairing code and
// the message the visitor pastes to their Muse, with a copy button.
// Moved out of App.tsx, which keeps the state and the code request.
import { museConnectMessage, type PairCode } from "./connectMuse";

export type ConnectMuseState = { state: "loading" } | { state: "ready"; pair: PairCode; copied: boolean } | { state: "error"; text: string };

export function ConnectMusePanel({ state, onClose, onCopied }: { state: ConnectMuseState; onClose: () => void; onCopied: (copied: boolean) => void }) {
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
      </section>
    </div>
  );
}
