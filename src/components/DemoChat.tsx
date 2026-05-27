"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  PHLogo,
  PHAvatar,
  PHMessage,
  PHTypingDots,
  PHFitBadge,
  PHButton,
  Send,
  Sparkle,
  ArrowRight,
} from "@/components/ph";

type Msg = { id: string; role: "user" | "assistant"; content: string };

type Props = {
  roleKey: string;
  roleTitle: string;
  candidateName: string;
  onRestart: () => void;
};

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

type Score = { score: number; verdict: string };

export default function DemoChat({
  roleKey,
  roleTitle,
  candidateName,
  onRestart,
}: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initRef = useRef(false);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [input]);

  // Type out the most recent assistant message
  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  })();
  const liveBotMessage = messages.find((m) => m.id === lastAssistantId);
  const liveBotIsNew =
    liveBotMessage && !ended && !liveBotMessage.id.startsWith("seen-");
  const typed = useTypewriter(
    liveBotIsNew && liveBotMessage ? liveBotMessage.content : "",
  );

  // Kick off the conversation: send no messages, get the bot opener.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void send([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, typed]);

  // Whenever the interview ends, auto-score the transcript.
  useEffect(() => {
    if (!ended || score || scoring) return;
    if (messages.length < 2) return; // nothing meaningful to score
    setScoring(true);
    (async () => {
      try {
        const res = await fetch("/api/demo/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleKey,
            messages: messages.map(({ role, content }) => ({ role, content })),
            endReason,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as Score;
          setScore(data);
        }
      } finally {
        setScoring(false);
      }
    })();
  }, [ended, messages, score, scoring, roleKey, endReason]);

  async function send(history: Msg[]) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleKey,
          candidateName,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send.");
        return;
      }
      if (data.message) {
        setMessages((m) => [
          ...m,
          {
            id: `bot-${Date.now()}-${Math.random()}`,
            role: "assistant",
            content: data.message.content,
          },
        ]);
      }
      if (data.endInterviewReason) {
        setEndReason(data.endInterviewReason);
        setEnded(true);
      }
    } catch {
      setError("Network error.");
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending || ended) return;
    const text = input.trim();
    setInput("");
    const newUserMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    // Lock prior bot messages from re-typing
    const next = messages
      .map((m) =>
        m.role === "assistant" && !m.id.startsWith("seen-")
          ? { ...m, id: `seen-${m.id}` }
          : m,
      )
      .concat(newUserMsg);
    setMessages(next);
    await send(next);
  }

  return (
    <div className="relative flex h-[100dvh] flex-col bg-black text-white">
      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <PHLogo size="md" wordmark={false} />
          <div className="hidden h-5 w-px bg-white/10 sm:block" />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-[13px] font-medium">{roleTitle}</div>
            <div className="font-mono text-[11px] text-purple-300">
              DEMO · interviewing {candidateName}
            </div>
          </div>
        </div>
        <button
          onClick={onRestart}
          className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          Restart
        </button>
      </header>

      {/* MESSAGES */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[760px] flex-col gap-4">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[11px] font-medium text-purple-300">
            <Sparkle className="h-3 w-3" />
            Demo mode · nothing saved
          </div>

          {messages.map((m) => {
            const isLiveBot =
              m.role === "assistant" && m.id === lastAssistantId && liveBotIsNew;
            return (
              <PHMessage
                key={m.id}
                from={m.role === "user" ? "candidate" : "bot"}
              >
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

          {ended && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-purple-500/40 bg-gradient-to-br from-purple-500/[0.12] via-purple-500/[0.04] to-transparent p-5 shadow-glow-purple animate-fm-fade-up animate-fm-pulse-glow sm:p-6">
              <div className="flex items-center gap-3">
                <PHAvatar letter="P" brand size="md" />
                <div className="min-w-0">
                  <div className="text-[16px] font-medium sm:text-[18px]">
                    Interview complete
                  </div>
                  <div className="text-[13px] text-white/65">
                    Demo over — no data saved.
                  </div>
                </div>
              </div>

              {scoring && (
                <div className="mt-5 text-[13px] text-white/55">
                  Scoring your interview…
                </div>
              )}

              {score && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-purple-300">
                      AI verdict
                    </div>
                    <PHFitBadge score={score.score} />
                  </div>
                  <p className="text-[14px] leading-relaxed text-white/85">
                    {score.verdict}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Link href="/signin" className="w-full sm:w-auto">
                  <PHButton iconRight={<ArrowRight />} className="w-full">
                    Do this for real — sign in
                  </PHButton>
                </Link>
                <button
                  onClick={onRestart}
                  className="rounded-full border border-white/15 px-5 py-2.5 text-[14px] text-white/80 transition-colors hover:bg-white/5"
                >
                  Try another role
                </button>
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
              ended
                ? "border-white/10 opacity-60"
                : "border-white/10 focus-within:border-purple-500/40 focus-within:shadow-glow-purple-sm"
            }`}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              rows={1}
              placeholder={ended ? "Demo ended" : "Type your answer…"}
              disabled={ended || sending}
              className="max-h-48 min-h-[1.5rem] flex-1 resize-none overflow-y-auto bg-transparent text-[15px] leading-relaxed text-white placeholder:text-white/35 focus:outline-none disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={ended || sending || !input.trim()}
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
            <span>Shift + Enter for newline · Enter to send</span>
            <span className="font-mono text-purple-300">DEMO</span>
          </div>
        </form>
      </footer>
    </div>
  );
}
