"use client";

import { useState, useRef, useEffect } from "react";
import {
  PHLogo,
  PHAvatar,
  PHMessage,
  PHTypingDots,
  Send,
} from "@/components/ph";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  conversationId: string;
  candidateName: string;
  roleTitle: string;
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
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initRef = useRef(false);

  // Auto-grow textarea to fit its content (capped by max-h).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [input]);

  // Type out only the most recently arrived assistant message.
  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  })();
  const liveBotMessage = messages.find((m) => m.id === lastAssistantId);
  const liveBotIsNew = liveBotMessage && !ended && !liveBotMessage.id.startsWith("seen-");
  const typed = useTypewriter(
    liveBotIsNew && liveBotMessage ? liveBotMessage.content : "",
  );

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
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
        if (data.status === "completed") setEnded(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSending(false);
      }
    })();
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, typed]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending || ended) return;

    const text = input.trim();
    setInput("");
    setError(null);

    const optimisticId = `tmp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      role: "user",
      content: text,
    };
    // Lock previous bot messages from re-typing.
    setMessages((m) =>
      m.map((msg) =>
        msg.role === "assistant" && !msg.id.startsWith("seen-")
          ? { ...msg, id: `seen-${msg.id}` }
          : msg,
      ).concat(optimistic),
    );
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      setMessages((m) => {
        const withoutOpt = m.filter((msg) => msg.id !== optimisticId);
        return [...withoutOpt, ...(data.messages || [])];
      });
      if (data.status === "completed") setEnded(true);
    } catch (e) {
      setError((e as Error).message);
      setMessages((m) => m.filter((msg) => msg.id !== optimisticId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  const totalMessages = messages.length;

  return (
    <div className="relative flex h-[100dvh] flex-col bg-black text-white">
      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <PHLogo size="md" wordmark={false} />
          <div className="hidden h-5 w-px bg-white/10 sm:block" />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-[13px] font-medium">{roleTitle}</div>
            <div className="truncate font-mono text-[11px] text-white/40">
              Interview with {candidateName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-white/45">
          <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-white/10 sm:block">
            <div
              className="ph-grad-btn-bg h-full origin-left transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.min(100, 8 + totalMessages * 7)}%`,
              }}
            />
          </div>
          <span className="font-mono">{totalMessages} msgs</span>
        </div>
      </header>

      {/* MESSAGES */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[760px] flex-col gap-4">
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
                    Thanks, {candidateName}. Your summary is on its way to the
                    hiring team. Feel free to close this tab.
                  </div>
                </div>
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
              placeholder={ended ? "Interview ended" : "Type your answer…"}
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
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeOpacity=".25"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <Send />
              )}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
            <span>Shift + Enter for newline · Enter to send</span>
            <span className="font-mono">
              Powered by <span className="text-purple-300">PurpleHire</span>
            </span>
          </div>
        </form>
      </footer>
    </div>
  );
}
