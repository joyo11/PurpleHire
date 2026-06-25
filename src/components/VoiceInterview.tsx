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
  // For assistant messages during voice playback: how many characters
  // are revealed so far (rAF-driven typewriter synced to audio.currentTime).
  // null = render the full content (used for user messages + finished AI).
  revealedChars: number | null;
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
  // Audio element for OpenAI TTS playback (voice "nova"). Replaces the
  // robotic browser SpeechSynthesis. Single element reused across turns.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Buffer all final transcripts during one mic session; submit ONCE on
  // release. Chrome's SpeechRecognition can fire multiple "isFinal"
  // events for one utterance (one per natural pause), which without
  // buffering produced 3 separate API calls for "hello how are you".
  const accumulatedRef = useRef<string>("");

  // ── Browser support gate ────────────────────────────────────────────
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR || typeof window.speechSynthesis === "undefined") {
      setUnsupported(true);
      return;
    }
    const rec = new SR();
    // continuous=true so natural pauses ("I don't have... ", thinking)
    // don't auto-end recognition. We end it manually on key/mic release.
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      // BUFFER finals into accumulatedRef; only submit on rec.onend so a
      // single sentence like "hello how are you" produces ONE API call,
      // not three.
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const transcript = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          accumulatedRef.current = (accumulatedRef.current + " " + transcript).trim();
        } else {
          interim += transcript;
        }
      }
      // Show running transcript: buffered finals + current interim.
      setInterimText(
        (accumulatedRef.current + " " + interim).trim(),
      );
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
    };

    rec.onend = () => {
      // Single point of submission: take the buffered transcript and fire
      // one API call. This fixes the multi-bubble bug from Chrome firing
      // multiple isFinal results within one utterance.
      const buffered = accumulatedRef.current.trim();
      accumulatedRef.current = "";
      setInterimText("");
      if (buffered) {
        void submitUserUtterance(buffered);
      } else {
        setPhase((p) => (p === "listening" ? "ready" : p));
      }
    };

    recognitionRef.current = rec;

    return () => {
      try { rec.stop(); } catch { /* no-op */ }
      // Stop and tear down any in-flight TTS playback.
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Kick off the AI's opening question on mount ─────────────────────
  useEffect(() => {
    if (unsupported) return;
    void requestInitialGreeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsupported]);

  // ── Hold-P-to-talk: keyboard push-to-talk ──────────────────────────
  // Hold P → mic opens. Release P → mic closes + utterance submits.
  // Ignored when an input/textarea is focused (defensive — current page
  // has none, but future settings panels might).
  useEffect(() => {
    if (unsupported) return;
    const isTypingTarget = (t: EventTarget | null): boolean => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;  // ignore auto-repeat while held
      if (e.key !== "p" && e.key !== "P") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      // Don't start a new session if already listening or thinking.
      if (phase === "listening" || phase === "thinking") return;
      startListening();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      stopListening();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsupported, phase]);

  // /api/chat returns { messages: [...], status, endInterviewReason }.
  // For voice we want only the LAST assistant message to speak.
  type ChatApiResponse = {
    messages?: Array<{ role: string; content: string }>;
    status?: "in_progress" | "completed";
    endInterviewReason?: string | null;
    error?: string;
  };

  function lastAssistantText(data: ChatApiResponse): string {
    const msgs = data.messages ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") return msgs[i].content ?? "";
    }
    return "";
  }

  async function requestInitialGreeting() {
    try {
      setPhase("thinking");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, isInitial: true }),
      });
      const data = (await res.json()) as ChatApiResponse;
      if (!res.ok) throw new Error(data?.error ?? "Could not start interview.");
      const greeting = lastAssistantText(data) || "Hi there. Let's get started.";
      pushAndSpeak(greeting);
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
      { id: `u-${Date.now()}`, role: "user", content: text, revealedChars: null },
    ]);
    setPhase("thinking");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = (await res.json()) as ChatApiResponse;
      if (!res.ok) throw new Error(data?.error ?? "Server error.");
      const reply = lastAssistantText(data);
      const ended = data.status === "completed";
      if (ended) {
        // pushAndSpeak fires the audio; we just preemptively mark "done"
        // so when the close line finishes, the StatusPill stays at "done".
        await pushAndSpeak(reply || "Thanks for chatting. We'll be in touch.");
        setPhase("done");
        return;
      }
      pushAndSpeak(reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setPhase("ready");
    }
  }

  async function pushAndSpeak(text: string) {
    if (!text) {
      setPhase("ready");
      return;
    }
    // Stay in "thinking" while we fetch TTS, so the bubble doesn't appear
    // before the voice. When audio is ready, render text + start playback
    // in the SAME tick → text and voice land together.
    setPhase("thinking");

    // Tear down any previous audio so we don't double-speak.
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }

    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "nova" }),
      });
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      // Wait for "canplay" so audio.play() resolves instantly and stays
      // perfectly in sync with the text we're about to render.
      await new Promise<void>((resolve) => {
        const onReady = () => {
          audio.removeEventListener("canplay", onReady);
          resolve();
        };
        audio.addEventListener("canplay", onReady);
        // Safety fallback in case canplay never fires (rare).
        setTimeout(() => {
          audio.removeEventListener("canplay", onReady);
          resolve();
        }, 1500);
      });

      // Stable id so the rAF loop below can find this message to update.
      const messageId = `a-${Date.now()}`;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        // Snap to full text on end (in case rAF undershot the last few chars).
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, revealedChars: null } : m,
          ),
        );
        setPhase((p) => (p === "done" ? "done" : "ready"));
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        setPhase("ready");
      };

      // Render the bubble (empty so far) + start playback in the same render
      // pass. The rAF loop below progressively reveals chars in sync with
      // audio.currentTime, producing a typewriter effect that PACES with
      // the actual spoken voice.
      setMessages((prev) => [
        ...prev,
        { id: messageId, role: "assistant", content: text, revealedChars: 0 },
      ]);
      setPhase("ai-speaking");
      await audio.play();

      // Typewriter: char-level reveal driven by audio.currentTime.
      // We bias the reveal slightly AHEAD of the audio (factor 1.05) so
      // the eye doesn't lag the ear — readers process print faster than
      // they process speech, so a tiny lead feels naturally synced.
      const LEAD_FACTOR = 1.05;
      const tick = () => {
        if (audio.paused || audio.ended) return;
        const dur = audio.duration;
        if (!isFinite(dur) || dur <= 0) {
          requestAnimationFrame(tick);
          return;
        }
        const ratio = Math.min(1, (audio.currentTime / dur) * LEAD_FACTOR);
        const target = Math.floor(text.length * ratio);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.revealedChars !== null && m.revealedChars < target
              ? { ...m, revealedChars: target }
              : m,
          ),
        );
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (err) {
      console.warn("[voice] TTS failed, using browser fallback:", err);
      // TTS failed — still show text + use browser synth so the interview
      // completes. Robotic but better than silence. No typewriter in
      // fallback (we don't know the audio duration ahead of time).
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: text, revealedChars: null },
      ]);
      setPhase("ai-speaking");
      const utter = new SpeechSynthesisUtterance(text);
      utter.onend = () => setPhase((p) => (p === "done" ? "done" : "ready"));
      utter.onerror = () => setPhase("ready");
      window.speechSynthesis.speak(utter);
    }
  }

  function startListening() {
    if (!recognitionRef.current) return;
    setError(null);
    accumulatedRef.current = "";  // fresh buffer per mic session
    // If the AI is mid-sentence and the candidate wants to interrupt, cut it.
    if (phase === "ai-speaking") {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current = null;
      }
      try { window.speechSynthesis.cancel(); } catch { /* no-op */ }
    }
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
            {messages.map((m) => {
              // Typewriter: while voice is playing, the assistant message
              // shows only the portion of the content the rAF loop has
              // revealed so far (synced to audio.currentTime). When the
              // audio ends, revealedChars is reset to null and the full
              // content renders.
              const display =
                m.revealedChars !== null && m.role === "assistant"
                  ? m.content.slice(0, m.revealedChars)
                  : m.content;
              return (
                <PHMessage key={m.id} from={m.role === "user" ? "candidate" : "bot"}>
                  {display}
                </PHMessage>
              );
            })}
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
                  ? "Hold P or tap mic to interrupt and respond"
                  : phase === "ready"
                    ? (
                      <>
                        Hold{" "}
                        <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/80">
                          P
                        </kbd>{" "}
                        or click the mic to speak
                      </>
                    )
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
