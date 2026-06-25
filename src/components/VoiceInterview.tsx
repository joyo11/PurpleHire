"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  PHLogo,
  PHAvatar,
  PHMessage,
  PHTypingDots,
} from "@/components/ph";

type Props = {
  conversationId: string;
  candidateName: string;
  roleTitle: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Phase =
  | "idle"          // waiting for the first AI greeting
  | "ai-speaking"   // browser is reading out the AI's reply
  | "ready"         // mic ready, candidate can speak
  | "listening"     // mic is active, capturing speech
  | "thinking"      // user spoke; we're calling /api/chat
  | "done";         // interview ended

// Browser feature-detect for Web Speech API. Falls back gracefully.
function getSpeechRecognition(): typeof window.SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  // Standard then webkit prefix (Safari/Chrome)
  return (
    (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition })
      .webkitSpeechRecognition ??
    null
  );
}

export default function VoiceInterview({
  conversationId,
  candidateName,
  roleTitle,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ── Browser support gate ────────────────────────────────────────────
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR || typeof window.speechSynthesis === "undefined") {
      setUnsupported(true);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let finalText = "";
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const transcript = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (interim) setInterimText(interim);
      if (finalText) {
        setInterimText("");
        void submitUserUtterance(finalText.trim());
      }
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      // "no-speech" + "aborted" are normal between turns — don't surface.
      if (ev.error !== "no-speech" && ev.error !== "aborted") {
        setError(
          ev.error === "not-allowed"
            ? "Microphone access denied. Refresh and allow mic, or switch to chat."
            : `Mic error: ${ev.error}`,
        );
      }
      setPhase("ready");
    };

    rec.onend = () => {
      // If the recognition stops while we're still listening (silence
      // timeout) and we have no finalText to submit, fall back to ready.
      setPhase((p) => (p === "listening" ? "ready" : p));
    };

    recognitionRef.current = rec;

    return () => {
      try { rec.stop(); } catch { /* no-op */ }
      try { window.speechSynthesis.cancel(); } catch { /* no-op */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Kick off the AI's opening question on mount ─────────────────────
  useEffect(() => {
    if (unsupported) return;
    void requestInitialGreeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsupported]);

  async function requestInitialGreeting() {
    try {
      setPhase("thinking");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, isInitial: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not start interview.");
      pushAndSpeak(data.message ?? "Hi there. Let's get started.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start.");
      setPhase("ready");
    }
  }

  async function submitUserUtterance(text: string) {
    if (!text) return;
    // Optimistically render the user's turn.
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: text },
    ]);
    setPhase("thinking");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Server error.");
      if (data.ended) {
        pushAndSpeak(data.message ?? "Thanks for chatting. We'll be in touch.");
        // After AI finishes speaking, mark done (handled in onend handler).
        utteranceRef.current?.addEventListener("end", () => setPhase("done"));
        return;
      }
      pushAndSpeak(data.message ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setPhase("ready");
    }
  }

  function pushAndSpeak(text: string) {
    if (!text) {
      setPhase("ready");
      return;
    }
    setMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, role: "assistant", content: text },
    ]);
    setPhase("ai-speaking");

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    // Prefer a natural-sounding English voice if available.
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.name.includes("Samantha")) ??
      voices.find((v) => v.lang.startsWith("en")) ??
      voices[0];
    if (preferred) utter.voice = preferred;

    utter.onend = () => {
      utteranceRef.current = null;
      setPhase((p) => (p === "done" ? "done" : "ready"));
    };
    utter.onerror = () => {
      utteranceRef.current = null;
      setPhase("ready");
    };

    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }

  function startListening() {
    if (!recognitionRef.current) return;
    setError(null);
    // If the AI is mid-sentence and the candidate wants to interrupt, cut it.
    if (phase === "ai-speaking") window.speechSynthesis.cancel();
    try {
      recognitionRef.current.start();
      setPhase("listening");
    } catch {
      // Already started — just flip phase.
      setPhase("listening");
    }
  }

  function stopListening() {
    try { recognitionRef.current?.stop(); } catch { /* no-op */ }
  }

  // ── Render ──────────────────────────────────────────────────────────
  if (unsupported) {
    return (
      <UnsupportedFallback roleTitle={roleTitle} conversationId={conversationId} />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <PHLogo size="sm" wordmark={false} />
          <span className="text-sm font-medium">PurpleHire</span>
        </Link>
        <span className="text-xs text-white/60">
          Voice interview · {roleTitle}
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center px-5 py-8">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          {/* AI avatar + status pill */}
          <div className="flex flex-col items-center gap-3">
            <PHAvatar size="lg" brand />
            <StatusPill phase={phase} />
          </div>

          {/* Live message stream */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-white/50">
                Connecting{candidateName ? `, ${candidateName}` : ""}...
              </p>
            )}
            {messages.map((m) => (
              <PHMessage key={m.id} from={m.role === "user" ? "candidate" : "bot"}>
                {m.content}
              </PHMessage>
            ))}
            {interimText && (
              <p className="text-right text-sm italic text-white/40">
                {interimText}
              </p>
            )}
            {phase === "thinking" && <PHTypingDots />}
          </div>

          {/* Mic control */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <MicButton
              phase={phase}
              onPress={startListening}
              onRelease={stopListening}
            />
            <p className="text-xs text-white/50">
              {phase === "listening"
                ? "Listening... release to send"
                : phase === "ai-speaking"
                  ? "Tap mic to interrupt and respond"
                  : phase === "ready"
                    ? "Hold mic to speak"
                    : phase === "done"
                      ? "Interview complete. Thanks for chatting."
                      : "Connecting..."}
            </p>
          </div>

          {error && (
            <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusPill({ phase }: { phase: Phase }) {
  const map: Record<Phase, { label: string; cls: string }> = {
    idle:         { label: "Connecting",  cls: "bg-white/10 text-white/70" },
    "ai-speaking":{ label: "Speaking",    cls: "bg-purple-500/20 text-purple-200" },
    ready:        { label: "Your turn",   cls: "bg-emerald-500/20 text-emerald-200" },
    listening:    { label: "Listening",   cls: "bg-red-500/20 text-red-200" },
    thinking:     { label: "Thinking",    cls: "bg-white/10 text-white/70" },
    done:         { label: "Complete",    cls: "bg-white/10 text-white/60" },
  };
  const { label, cls } = map[phase];
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function MicButton({
  phase,
  onPress,
  onRelease,
}: {
  phase: Phase;
  onPress: () => void;
  onRelease: () => void;
}) {
  const disabled = phase === "done" || phase === "thinking" || phase === "idle";
  const active = phase === "listening";
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
      className={`grid h-20 w-20 place-items-center rounded-full border transition ${
        active
          ? "border-red-400 bg-red-500/30 shadow-[0_0_24px_rgba(248,113,113,0.4)]"
          : disabled
            ? "border-white/10 bg-white/5 opacity-50"
            : "border-purple-400 bg-purple-500/20 hover:bg-purple-500/30"
      }`}
      aria-label={active ? "Release to send" : "Hold to speak"}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 fill-current"
        aria-hidden="true"
      >
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
      </svg>
    </button>
  );
}

function UnsupportedFallback({
  roleTitle,
  conversationId,
}: {
  roleTitle: string;
  conversationId: string;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-black p-6 text-white">
      <div className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h2 className="text-lg font-medium">
          Your browser doesn&apos;t support voice mode
        </h2>
        <p className="text-sm text-white/70">
          The {roleTitle} interview needs Chrome, Edge, or Safari for voice.
          You can do it as a chat interview instead.
        </p>
        <Link
          href={`/i/${conversationId}?fallback=chat`}
          className="inline-block rounded-md bg-purple-500 px-4 py-2 text-sm font-medium hover:bg-purple-600"
        >
          Switch to chat
        </Link>
      </div>
    </div>
  );
}
