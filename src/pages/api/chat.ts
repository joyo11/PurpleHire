import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { generateResponse } from "@/services/openaiService";
import { buildInterviewSystemPrompt } from "@/lib/interviewPrompt";
import type { InterviewPlan } from "@/lib/jdAnalyzer";
import { scoreInterview } from "@/lib/interviewScorer";

/** If the LLM wrote an obvious closing line but forgot to fire the
 * end_interview tool, infer the right end reason from the candidate's
 * most recent message. This is a known LLM tic (text-or-tool, not both).
 * False positives just end an interview the bot was already trying to
 * end, so the risk is low. */
function inferEndFromText(botText: string, userText: string): string | undefined {
  const b = botText.toLowerCase();
  const u = userText.toLowerCase();
  const wrapPhrase =
    /(wrap up|wrapping up|i'll end here|best of luck out there|wishing you the best|wrap things up|so i'll wrap|let's wrap)/.test(
      b,
    );
  if (!wrapPhrase) return undefined;

  if (/not interested|don'?t want|changed my mind|isn'?t for me|lol no/.test(u)) {
    return "not_interested";
  }
  if (
    /(can only discuss|outside what i'm here|focus.*role|on topic)/.test(b)
  ) {
    return "off_topic";
  }
  return "completed";
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
