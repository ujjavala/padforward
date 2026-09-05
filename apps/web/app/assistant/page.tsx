"use client";

/**
 * Ask PadForward — the AI agent. Understands natural language and calls
 * real application tools (find, recommend, report, adopt).
 *
 * Fallback chain:
 *   1. Server AI (/api/ai/query): Gemini when configured, else the
 *      deterministic server engine — always grounded in live network data.
 *   2. Offline: the browser's built-in on-device AI (Chrome Prompt API /
 *      Gemini Nano), grounded in the last station data the app cached.
 *   3. Last resort: deterministic heuristics over the cached map data.
 */
import { useRef, useState } from "react";
import { Wrench, WifiOff } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { api } from "@/lib/api";
import { offlineQuery } from "@/lib/browserAI";
import type { AIResponse } from "@/lib/types";

interface Turn {
  role: "user" | "assistant";
  text: string;
  tools?: string[];
  provider?: string;
}

const SUGGESTIONS = [
  "I need a pad nearby",
  "Where should I donate 20 pads?",
  "The donation box at Town Hall is empty",
  "I'm travelling from Redfern to Wynyard — is there a pad along my route?",
];

export default function AssistantPage() {
  const { state, locate } = useGeolocation();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput("");
    setBusy(true);
    try {
      const lat = state.status === "granted" ? state.lat : undefined;
      const lng = state.status === "granted" ? state.lng : undefined;
      const res: AIResponse = await api.aiQuery(message, lat, lng);
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          text: res.reply,
          tools: res.tool_calls.map((c) => c.tool),
          provider: res.provider,
        },
      ]);
    } catch {
      // Network/API unreachable — fall back to on-device browser AI,
      // then deterministic heuristics over cached map data.
      const res = await offlineQuery(message);
      setTurns((t) => [
        ...t,
        { role: "assistant", text: res.reply, provider: res.provider },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold">Ask PadForward</h1>
        <p className="text-sm text-ink-500">
          The assistant uses live network data — it never guesses availability.
        </p>
        {state.status !== "granted" && (
          <button type="button" onClick={locate} className="mt-1 text-sm text-teal-650 underline">
            Share location for nearby results
          </button>
        )}
      </div>

      <div
        ref={listRef}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className="flex-1 space-y-3 overflow-y-auto"
      >
        {turns.length === 0 && (
          <div className="flex flex-col gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="card text-left text-sm text-ink-700 transition hover:shadow-lg"
              >
                &ldquo;{s}&rdquo;
              </button>
            ))}
          </div>
        )}
        {turns.map((turn, i) => (
          <div
            key={`${i}-${turn.role}`}
            className={`max-w-[85%] rounded-xl2 px-4 py-3 text-sm shadow-card ${
              turn.role === "user"
                ? "ml-auto bg-teal-650 text-white"
                : "mr-auto bg-white text-ink-900"
            }`}
          >
            <p>{turn.text}</p>
            {turn.tools && turn.tools.length > 0 && (
              <p className="mt-1.5 flex items-center gap-1 text-xs opacity-70">
                <Wrench aria-hidden="true" className="h-3 w-3" />
                {turn.tools.join(", ")}
              </p>
            )}
            {(turn.provider === "browser-ai" || turn.provider === "offline-heuristics") && (
              <p className="mt-1.5 flex items-center gap-1 text-xs opacity-70">
                <WifiOff aria-hidden="true" className="h-3 w-3" />
                {turn.provider === "browser-ai"
                  ? "answered offline by your browser's built-in AI"
                  : "answered offline using cached map data"}
              </p>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-ink-500">Thinking…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex gap-2"
      >
        <label htmlFor="ai-input" className="sr-only">
          Ask PadForward
        </label>
        <input
          id="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "I need a pad near Central"'
          className="min-h-[48px] flex-1 rounded-xl2 border border-ink-300 bg-white px-4 py-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="btn-primary !w-auto px-5 !py-2"
        >
          Send
        </button>
      </form>
    </div>
  );
}
