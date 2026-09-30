import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { generateResponse } from "@/services/openaiService";
import { buildInterviewSystemPrompt } from "@/lib/interviewPrompt";
import type { InterviewPlan } from "@/lib/jdAnalyzer";
import { scoreInterview } from "@/lib/interviewScorer";
import { inferEndFromText } from "@/lib/inferEndFromText";

// Hard cap on transcript length. Once the conversation reaches this many
// messages with no natural or tool-driven ending, we force the interview
// closed so a stuck/looping model can't run forever.
const MAX_TURNS = 24;

// Lightweight, dependency-free per-IP rate limiting. Kept in module memory so
// it resets on redeploy; good enough to blunt abuse of the LLM-backed endpoint.
const RATE_LIMIT = 30; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const rateBuckets = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(ip, hits);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(k);
    }
  }
  return hits.length > RATE_LIMIT;
}

function clientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0];
  return req.socket?.remoteAddress ?? "unknown";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (rateLimited(clientIp(req))) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  try {
    const { message, conversationId, isInitial } = req.body as {
      message?: string;
      conversationId?: string;
      isInitial?: boolean;
    };

    if (!conversationId) {
      return res
        .status(400)
        .json({ error: "conversationId is required (start via /api/interviews/start)" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        candidate: { include: { role: true } },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    if (!conversation.candidate || !conversation.candidate.role) {
      return res
        .status(400)
        .json({ error: "Conversation has no linked candidate/role" });
    }

    const role = conversation.candidate.role;
    let plan: InterviewPlan;
    try {
      plan = JSON.parse(role.interviewPlan) as InterviewPlan;
    } catch {
      return res.status(500).json({ error: "Role's interview plan is invalid." });
    }

    const systemPrompt = buildInterviewSystemPrompt({
      roleTitle: role.title,
      candidateName: conversation.candidate.name,
      jdText: role.jdText,
      plan,
    });

    if (isInitial) {
      const { text, endInterviewReason } = await generateResponse(
        [],
        systemPrompt,
      );
      const assistantMessage = await prisma.message.create({
        data: {
          content: text || `Hi ${conversation.candidate.name}! Ready to chat about the ${role.title} role?`,
          role: "assistant",
          conversationId: conversation.id,
        },
      });
      return res.status(200).json({
        messages: [assistantMessage],
        conversationId: conversation.id,
        status: endInterviewReason ? "completed" : "in_progress",
        endInterviewReason,
      });
    }

    if (!message?.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    const userMessage = await prisma.message.create({
      data: {
        content: message.trim(),
        role: "user",
        conversationId: conversation.id,
      },
    });

    const history = [...conversation.messages, userMessage].map((m) => ({
      id: m.id,
      content: m.content,
      role: m.role as "user" | "assistant",
      conversationId: m.conversationId,
      createdAt: m.createdAt,
    }));

    const llm = await generateResponse(history, systemPrompt);
    const text = llm.text;
    // Safety net: if the LLM produced an obvious wrap-up message without
    // firing the tool call, infer the end reason from candidate context.
    // (Some models produce the closing copy but forget the structured call.)
    let endInterviewReason = llm.endInterviewReason;
    if (!endInterviewReason && text) {
      endInterviewReason = inferEndFromText(text, userMessage.content);
    }
    // Hard turn cap: if neither the tool nor the regex ended things, force the
    // interview closed once the transcript gets too long. `history` already
    // includes the just-added candidate message.
    if (!endInterviewReason && history.length >= MAX_TURNS) {
      endInterviewReason = "turn_limit";
    }

    let assistantMessage = null;
    if (text) {
      assistantMessage = await prisma.message.create({
        data: {
          content: text,
          role: "assistant",
          conversationId: conversation.id,
        },
      });
    }

    const newStatus = endInterviewReason ? "completed" : "in_progress";

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: newStatus,
        endReason: endInterviewReason ?? null,
        updatedAt: new Date(),
      },
    });

    if (newStatus === "completed") {
      try {
        await scoreInterview(conversation.id);
      } catch (err) {
        console.error("scoreInterview failed", err);
      }
    }

    const messagesToReturn = [userMessage];
    if (assistantMessage) messagesToReturn.push(assistantMessage);

    return res.status(200).json({
      messages: messagesToReturn,
      conversationId: conversation.id,
      status: newStatus,
      endInterviewReason,
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return res.status(500).json({ error: "Error processing chat" });
  }
}
