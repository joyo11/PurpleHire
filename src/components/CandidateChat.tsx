"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  PHLogo,
  PHAvatar,
  PHMessage,
  PHTypingDots,
  Send,
} from "@/components/ph";
import { LARGE_PASTE_CHARS } from "@/lib/proctoring";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// WhatsApp-style doodle backdrop: faint purple line-art (speech bubble, sparkle,
// check, document, briefcase, magnifier, stars) tiled behind the messages. Kept
// very low-opacity so it's atmospheric, never competing with the conversation.
const DOODLE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'><g fill='none' stroke='rgb(167,139,250)' stroke-opacity='0.11' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M20 30h42a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H40l-11 10V66h-9a8 8 0 0 1-8-8V38a8 8 0 0 1 8-8z'/><path d='M162 24l4.5 13 13 4.5-13 4.5-4.5 13-4.5-13-13-4.5 13-4.5z'/><circle cx='206' cy='78' r='15'/><path d='M199 78l5 5 9-10'/><rect x='28' y='128' width='36' height='46' rx='4'/><path d='M36 141h20M36 151h20M36 161h12'/><rect x='158' y='158' width='44' height='32' rx='4'/><path d='M172 158v-7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v7M158 171h44'/><circle cx='96' cy='190' r='11'/><path d='M104 198l9 9'/><path d='M118 100l3.5 8 8 3.5-8 3.5-3.5 8-3.5-8-8-3.5 8-3.5z'/><path d='M214 150v14M207 157h14'/><path d='M44 92h18M44 100h10'/></g></svg>`;
const DOODLE_BG = `url("data:image/svg+xml,${encodeURIComponent(DOODLE_SVG)}")`;

type Phase = "welcome" | "active" | "ended" | "left";

type Props = {
  conversationId: string;
  candidateName: string;
  roleTitle: string;
  /** Resume-on-reload: prior transcript + where the interview was. */
  initialMessages?: ChatMessage[];
  initialStatus?: "welcome" | "in_progress" | "disconnected";
};

/** Reveal an assistant message character-by-character at ~28 cps. */
function useTypewriter(text: string, cps = 28) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!text) {
      setOut("");
      return;
    }
    let i = 0;
    let cancelled = false;
    const tickMs = Math.max(8, 1000 / cps);
    setOut("");
    const tick = () => {
      if (cancelled) return;
      i = Math.min(text.length, i + 1);
      setOut(text.slice(0, i));
      if (i < text.length) setTimeout(tick, tickMs);
    };
    const start = setTimeout(tick, 60);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [text, cps]);
  return out;
}

export default function CandidateChat({
  conversationId,
  candidateName,
  roleTitle,
  initialMessages,
  initialStatus,
}: Props) {
  const resuming = !!(initialMessages && initialMessages.length);
  const [messages, setMessages] = useState<ChatMessage[]>(
    resuming
      ? initialMessages!.map((m, i) => ({
          ...m,
          // Mark prior messages "seen-" so they don't re-type on resume.
          id: m.id?.startsWith("seen-") ? m.id : `seen-${i}-${m.id ?? "m"}`,
        }))
      : [],
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<Phase>(
    resuming ? (initialStatus === "welcome" ? "welcome" : "active") : "welcome",
  );
  const [tabSwitches, setTabSwitches] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  const endTimerRef = useRef<number | null>(null);

  const isTerminal = phase === "ended" || phase === "left";
  const interactive = !isTerminal;
  const showSkip = phase === "active" && !sending;

  const IDLE_WARN_MS = 5 * 60 * 1000;
  const IDLE_END_MS = 10 * 60 * 1000;

  // Proctoring: detect leaving the interview tab (best-effort, never blocking).
  useEffect(() => {
    if (isTerminal) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        setTabSwitches((n) => n + 1);
        void fetch("/api/interviews/flag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
          keepalive: true,
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isTerminal, conversationId]);

  function clearIdleTimers() {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (endTimerRef.current !== null) {
      window.clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }
  }

  // Idle -> pause (server marks it "disconnected", which is resumable). We do
  // NOT end the interview: typing again picks up where they left off.
  const pauseInterview = useCallback(async () => {
    try {
      await fetch("/api/interviews/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
    } catch {
      // ignore; resuming still works
    }
    setPaused(true);
    setIdleWarning(false);
  }, [conversationId]);

  useEffect(() => {
    clearIdleTimers();
    setIdleWarning(false);
    if (isTerminal) return;
    idleTimerRef.current = window.setTimeout(
      () => setIdleWarning(true),
      IDLE_WARN_MS,
    );
    endTimerRef.current = window.setTimeout(pauseInterview, IDLE_END_MS);
    return clearIdleTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isTerminal]);

  // Auto-grow textarea.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [input]);

  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  })();
  const liveBotMessage = messages.find((m) => m.id === lastAssistantId);
  const liveBotIsNew =
    liveBotMessage && !isTerminal && !liveBotMessage.id.startsWith("seen-");
  const typed = useTypewriter(
    liveBotIsNew && liveBotMessage ? liveBotMessage.content : "",
  );

  // Initial greeting (skipped when resuming an existing transcript).
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (resuming) return;
    (async () => {
      setSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, isInitial: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start");
        setMessages(data.messages || []);
        applyStatus(data.status);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSending(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, typed]);

  function applyStatus(status: string | undefined) {
    if (status === "completed") setPhase("ended");
    else if (status === "left_early") setPhase("left");
    else if (status === "welcome") setPhase("welcome");
    else if (status === "in_progress") setPhase("active");
    else if (status === "confirm_leave") setLeaveOpen(true);
  }

  function markSeen(list: ChatMessage[]): ChatMessage[] {
    return list.map((msg) =>
      msg.role === "assistant" && !msg.id.startsWith("seen-")
        ? { ...msg, id: `seen-${msg.id}` }
        : msg,
    );
  }

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data as {
      messages?: ChatMessage[];
      status?: string;
    };
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending || !interactive) return;
    const text = input.trim();
    setInput("");
    setError(null);
    setPaused(false);

    const optimisticId = `tmp-${Date.now()}`;
    setMessages((m) =>
      markSeen(m).concat({ id: optimisticId, role: "user", content: text }),
    );
    setSending(true);
    try {
      const data = await post({ message: text });
      setMessages((m) => [
        ...m.filter((msg) => msg.id !== optimisticId),
        ...(data.messages || []),
      ]);
      applyStatus(data.status);
    } catch (e) {
      setError((e as Error).message);
      setMessages((m) => m.filter((msg) => msg.id !== optimisticId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  async function handleSkip() {
    if (sending || phase !== "active") return;
    setError(null);
    setPaused(false);
    setMessages((m) => markSeen(m));
    setSending(true);
    try {
      const data = await post({ action: "skip" });
      setMessages((m) => [...m, ...(data.messages || [])]);
      applyStatus(data.status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function confirmLeave() {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    try {
      const data = await post({ action: "leave" });
      setMessages((m) => [...markSeen(m), ...(data.messages || [])]);
      setLeaveOpen(false);
      setPhase("left");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="relative flex h-[100dvh] flex-col bg-black text-white">
      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-label="PurpleHire" className="cursor-default">
            <PHLogo size="md" wordmark={false} />
          </span>
          <div className="hidden h-5 w-px bg-white/10 sm:block" />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-[13px] font-medium">{roleTitle}</div>
            <div className="truncate font-mono text-[11px] text-white/40">
              Interview with {candidateName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!isTerminal && (
            <div className="flex items-center gap-1.5 text-[12px] text-emerald-300/80">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="font-medium">In progress</span>
            </div>
          )}
          {!isTerminal && (
            <button
              type="button"
              onClick={() => setLeaveOpen(true)}
              className="rounded-full px-2.5 py-1 text-[12px] text-white/40 transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-white/80 active:scale-95"
            >
              Leave interview
            </button>
          )}
        </div>
      </header>

      {tabSwitches > 0 && !isTerminal && (
        <div className="border-b border-yellow-500/25 bg-yellow-500/10 px-4 py-2 text-center text-[12.5px] text-yellow-200 sm:px-8">
          Please stay on this tab. Leaving the interview is recorded for the
          hiring team{tabSwitches > 1 ? ` (${tabSwitches}×)` : ""}.
        </div>
      )}

      {/* MESSAGES */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-8"
        style={{
          backgroundImage: DOODLE_BG,
          backgroundSize: "240px 240px",
        }}
      >
        <div className="mx-auto flex max-w-[760px] flex-col gap-4">
          {messages.map((m) => {
            const isLiveBot =
              m.role === "assistant" && m.id === lastAssistantId && liveBotIsNew;
            return (
              <PHMessage key={m.id} from={m.role === "user" ? "candidate" : "bot"}>
                {isLiveBot ? (
                  <>
                    {typed}
                    {typed.length < m.content.length && (
                      <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-fm-pulse-dot bg-white/75" />
                    )}
                  </>
                ) : (
                  m.content
                )}
              </PHMessage>
            );
          })}

          {sending && <PHTypingDots />}

          {error && (
            <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
              {error}
            </p>
          )}

          {paused && !isTerminal && (
            <div className="rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-[13px] text-white/70">
              Your interview is paused. Type below to pick up right where you left
              off, nothing is lost.
            </div>
          )}

          {idleWarning && !paused && !isTerminal && (
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-[13px] text-yellow-200">
              Still there? We&apos;ll pause the interview if there&apos;s no reply
              for a while, you can always come back to it.
            </div>
          )}

          {phase === "ended" && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-purple-500/40 bg-gradient-to-br from-purple-500/[0.12] via-purple-500/[0.04] to-transparent p-5 shadow-glow-purple animate-fm-fade-up animate-fm-pulse-glow sm:p-6">
              <div className="flex items-center gap-3">
                <PHAvatar letter="P" brand size="md" />
                <div className="min-w-0">
                  <div className="text-[16px] font-medium sm:text-[18px]">
                    Interview complete
                  </div>
                  <div className="text-[13px] text-white/65">
                    Thanks, {candidateName}. Your responses have been submitted to
                    the hiring team. Feel free to close this tab.
                  </div>
                </div>
              </div>
            </div>
          )}

          {phase === "left" && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-white/15 bg-white/[0.03] p-5 animate-fm-fade-up sm:p-6">
              <div className="text-[16px] font-medium sm:text-[18px]">
                Interview left
              </div>
              <div className="mt-1 text-[13px] text-white/60">
                Thanks for your time, {candidateName}. This interview was marked
                incomplete. If you left by mistake, contact the person who invited
                you.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COMPOSER */}
      <footer className="border-t border-white/10 bg-black/80 px-4 py-3 backdrop-blur sm:px-8">
        <form onSubmit={handleSend} className="mx-auto max-w-[760px]">
          <div
            className={`flex items-end gap-2 rounded-2xl border bg-white/[0.02] px-4 py-3 transition-all ${
              !interactive
                ? "border-white/10 opacity-60"
                : "border-white/10 focus-within:border-purple-500/40 focus-within:shadow-glow-purple-sm"
            }`}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (idleWarning || paused) {
                  setIdleWarning(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData?.getData("text") ?? "";
                if (interactive && pasted.length >= LARGE_PASTE_CHARS) {
                  void fetch("/api/interviews/flag", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ conversationId, type: "paste" }),
                    keepalive: true,
                  }).catch(() => {});
                }
              }}
              rows={1}
              placeholder={
                phase === "welcome"
                  ? "Type here to reply…"
                  : isTerminal
                    ? "Interview closed"
                    : "Type your answer…"
              }
              disabled={!interactive || sending}
              className="max-h-48 min-h-[1.5rem] flex-1 resize-none overflow-y-auto bg-transparent text-[15px] leading-relaxed text-white placeholder:text-white/35 focus:outline-none disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!interactive || sending || !input.trim()}
              aria-label="Send"
              className="ph-grad-btn-bg grid h-9 w-9 place-items-center rounded-xl text-white shadow-glow-purple-sm transition-all hover:-translate-y-px active:scale-95 disabled:opacity-40"
            >
              {sending ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              ) : (
                <Send />
              )}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
            {showSkip ? (
              <button
                type="button"
                onClick={handleSkip}
                className="text-white/45 underline-offset-2 transition-colors hover:text-white/80 hover:underline"
              >
                Skip this question
              </button>
            ) : (
              <span>Shift + Enter for newline · Enter to send</span>
            )}
            <span className="font-mono">
              Powered by <span className="text-purple-300">PurpleHire</span>
            </span>
          </div>
        </form>
      </footer>

      {/* LEAVE CONFIRMATION */}
      {leaveOpen && !isTerminal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/12 bg-[#0d0b12] p-6 shadow-2xl animate-fm-fade-up">
            <div className="text-[17px] font-medium">Leave the interview?</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/60">
              Your interview will be marked <span className="text-white/85">incomplete</span> and may
              not be reviewed by the hiring team. You can keep going instead.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeaveOpen(false)}
                disabled={leaving}
                className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[13px] font-medium text-white/80 transition-all hover:-translate-y-0.5 hover:bg-white/10 active:scale-95 disabled:opacity-40"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmLeave}
                disabled={leaving}
                className="rounded-full border border-red-500/40 bg-red-500/15 px-4 py-2 text-[13px] font-medium text-red-200 transition-all hover:-translate-y-0.5 hover:bg-red-500/25 active:scale-95 disabled:opacity-40"
              >
                {leaving ? "Leaving…" : "Leave anyway"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
