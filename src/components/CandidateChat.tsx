"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";

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
  const initRef = useRef(false);

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
  }, [messages, sending]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending || ended) return;

    const text = input.trim();
    setInput("");
    setError(null);

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, optimistic]);
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
        const withoutOptimistic = m.filter((msg) => msg.id !== optimistic.id);
        return [...withoutOptimistic, ...(data.messages || [])];
      });
      if (data.status === "completed") setEnded(true);
    } catch (e) {
      setError((e as Error).message);
      setMessages((m) => m.filter((msg) => msg.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-black text-white">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">
              Interview · PurpleHire
            </p>
            <p className="text-sm font-medium">{roleTitle}</p>
          </div>
          <p className="text-xs text-white/50">{candidateName}</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "flex justify-end"
                  : "flex items-start gap-3"
              }
            >
              {m.role === "assistant" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500 text-xs font-semibold">
                  A
                </div>
              )}
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-white text-black"
                    : "bg-white/10 text-white"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500 text-xs font-semibold">
                A
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/60">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60" />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60"
                    style={{ animationDelay: "0.3s" }}
                  />
                </span>
              </div>
            </div>
          )}
          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {ended && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/70">
              Interview complete. The recruiter will follow up. You can close
              this tab.
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="border-t border-white/10 px-4 py-3"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder={ended ? "Interview ended" : "Type a message…"}
            rows={1}
            disabled={ended || sending}
            className="flex-1 resize-none rounded-2xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={ended || sending || !input.trim()}
            className="rounded-full bg-white p-2.5 text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
