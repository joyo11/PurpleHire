import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { generateResponse } from "@/services/openaiService";
import { buildInterviewSystemPrompt } from "@/lib/interviewPrompt";
import type { InterviewPlan } from "@/lib/jdAnalyzer";
import { scoreInterview } from "@/lib/interviewScorer";

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

    const { text, endInterviewReason } = await generateResponse(
      history,
      systemPrompt,
    );

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
