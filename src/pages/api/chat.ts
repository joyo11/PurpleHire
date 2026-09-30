import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { generateResponse } from "@/services/openaiService";
import { buildInterviewSystemPrompt } from "@/lib/interviewPrompt";
import type { InterviewPlan } from "@/lib/jdAnalyzer";
import { scoreInterview } from "@/lib/interviewScorer";
import { classifyCandidateIntent } from "@/lib/inferEndFromText";

// Hard cap on transcript length. Once the conversation reaches this many
// messages with no natural or confirmed ending, we force the interview closed
// so a stuck/looping model can't run forever.
const MAX_TURNS = 24;

// Copy for the clarification turn (the three-way choice). Rendered whenever an
// ambiguous "leaving" signal arrives; the UI mirrors it with action chips.
const CLARIFY_MESSAGE =
  "No problem. We can keep going in text, skip this question, or wrap up here — what works?";

// Server-owned interview control state, persisted in Conversation.metadata
// (a JSON string). We never make the model count strikes or own end authority.
type ConvoMeta = {
  startedAt?: number;
  state?: "active" | "clarifying" | "ended";
  declineCount?: number;
  [k: string]: unknown;
};

function parseMeta(raw: string | null | undefined): ConvoMeta {
  try {
    const m = JSON.parse(raw || "{}");
    return m && typeof m === "object" ? (m as ConvoMeta) : {};
  } catch {
    return {};
  }
}

// End authority (server-owned): bot prose never terminates. Only a genuine
// full-interview completion or a safety red flag the model proposes may end a
// turn. Everything else it "proposes" (not_interested, reschedule, off_topic,
// missing_must_have, unclear_communication) is ignored so we never accidentally
// terminate an engaged candidate.
function gateProposedEnd(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  if (reason === "completed") return reason;
  if (reason.startsWith("red_flag_")) return reason;
  return undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, conversationId, isInitial, action } = req.body as {
      message?: string;
      conversationId?: string;
      isInitial?: boolean;
      action?: "continue" | "skip" | "end";
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

    const candidateName = conversation.candidate.name;
    const systemPrompt = buildInterviewSystemPrompt({
      roleTitle: role.title,
      candidateName,
      jdText: role.jdText,
      plan,
    });

    const meta = parseMeta(conversation.metadata);

    if (isInitial) {
      const llm = await generateResponse([], systemPrompt);
      const endInterviewReason = gateProposedEnd(llm.endInterviewReason);
      const assistantMessage = await prisma.message.create({
        data: {
          content:
            llm.text ||
            `Hi ${candidateName}! Ready to chat about the ${role.title} role?`,
          role: "assistant",
          conversationId: conversation.id,
        },
      });
      meta.state = endInterviewReason ? "ended" : "active";
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { metadata: JSON.stringify(meta), updatedAt: new Date() },
      });
      return res.status(200).json({
        messages: [assistantMessage],
        conversationId: conversation.id,
        status: endInterviewReason ? "completed" : "in_progress",
        endInterviewReason,
      });
    }

    // Resolve this turn's control intent. Chips (from the recovery UI) are
    // authoritative; typed messages go through the server-side classifier.
    const chip =
      action === "continue" || action === "skip" || action === "end"
        ? action
        : null;

    let userText: string;
    if (chip === "end") userText = "I'd like to end the interview.";
    else if (chip === "skip") userText = "Let's skip this question and move on.";
    else if (chip === "continue") userText = "Let's keep going in text.";
    else {
      if (!message?.trim()) {
        return res.status(400).json({ error: "message is required" });
      }
      userText = message.trim();
    }

    const priorState = meta.state === "clarifying" ? "clarifying" : "active";
    const declineCount =
      typeof meta.declineCount === "number" ? meta.declineCount : 0;

    // "end" / "clarify" / "continue" (continue covers skip + normal Q&A).
    let control: "end" | "clarify" | "continue";
    if (chip === "end") {
      // Confirmed via the End-interview chip (the UI requires a confirm tap).
      control = "end";
    } else if (chip === "skip" || chip === "continue") {
      control = "continue";
    } else {
      const intent = classifyCandidateIntent(userText);
      if (intent === "explicit_end") {
        control = "end";
      } else if (intent === "leave") {
        // Ambiguous leave. Never ends. First one -> clarify. A repeat while
        // already clarifying -> skip and advance (still never ends).
        control =
          priorState === "clarifying" && declineCount >= 1
            ? "continue"
            : "clarify";
      } else {
        control = "continue";
      }
    }

    // Persist the candidate turn.
    const userMessage = await prisma.message.create({
      data: { content: userText, role: "user", conversationId: conversation.id },
    });

    // ---- CONFIRMED / EXPLICIT END ----
    if (control === "end") {
      const closing = `Thanks for taking the time today, ${candidateName}. I'll pass along what we covered to the hiring team. Take care!`;
      const assistantMessage = await prisma.message.create({
        data: {
          content: closing,
          role: "assistant",
          conversationId: conversation.id,
        },
      });
      meta.state = "ended";
      meta.declineCount = 0;
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: "completed",
          endReason: "candidate_ended",
          metadata: JSON.stringify(meta),
          updatedAt: new Date(),
        },
      });
      try {
        await scoreInterview(conversation.id);
      } catch (err) {
        console.error("scoreInterview failed", err);
      }
      return res.status(200).json({
        messages: [userMessage, assistantMessage],
        conversationId: conversation.id,
        status: "completed",
        endInterviewReason: "candidate_ended",
      });
    }

    // ---- CLARIFY (ambiguous leave) — never ends, offers the three choices ----
    if (control === "clarify") {
      const assistantMessage = await prisma.message.create({
        data: {
          content: CLARIFY_MESSAGE,
          role: "assistant",
          conversationId: conversation.id,
        },
      });
      meta.state = "clarifying";
      meta.declineCount = declineCount + 1;
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: "in_progress",
          metadata: JSON.stringify(meta),
          updatedAt: new Date(),
        },
      });
      return res.status(200).json({
        messages: [userMessage, assistantMessage],
        conversationId: conversation.id,
        status: "clarifying",
      });
    }

    // ---- CONTINUE / SKIP / NORMAL Q&A — run the interviewer model ----
    meta.state = "active";
    meta.declineCount = 0;

    const history = [...conversation.messages, userMessage].map((m) => ({
      id: m.id,
      content: m.content,
      role: m.role as "user" | "assistant",
      conversationId: m.conversationId,
      createdAt: m.createdAt,
    }));

    const llm = await generateResponse(history, systemPrompt);
    const text = llm.text;

    // Gate the model's proposed end (bot prose never terminates).
    let endInterviewReason = gateProposedEnd(llm.endInterviewReason);
    // Hard turn cap: force-close a stuck/looping interview. `history` already
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
    if (endInterviewReason) meta.state = "ended";

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: newStatus,
        endReason: endInterviewReason ?? null,
        metadata: JSON.stringify(meta),
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
