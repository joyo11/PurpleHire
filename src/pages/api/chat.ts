import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { runInterviewTurn } from "@/services/openaiService";
import {
  buildInterviewSystemPrompt,
  type PromptCompetency,
} from "@/lib/interviewPrompt";
import type { InterviewPlan } from "@/lib/jdAnalyzer";
import { scoreInterview } from "@/lib/interviewScorer";
import { classifyCandidateIntent } from "@/lib/inferEndFromText";
import {
  type Coverage,
  type EvidenceLevel,
  mergeEvidence,
  uncoveredRequired,
  decideCompletion,
  canFollowUp,
  classifyReadiness,
  FOLLOWUP_CAP,
  MIN_QUESTIONS,
  TARGET_MIN,
  TARGET_MAX,
  MAX_QUESTIONS,
} from "@/lib/interviewMachine";

// Server-authoritative interview state, persisted in Conversation.metadata.
// The model NEVER owns completion; this state does.
type ConvoMeta = {
  startedAt?: number;
  state?: "welcome" | "active" | "ended";
  coverage?: Coverage;
  questionsAsked?: number;
  followups?: Record<string, number>;
  noImprovementStreak?: number;
  abuseCount?: number;
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

const RANK: Record<EvidenceLevel, number> = {
  none: 0,
  weak: 1,
  some: 2,
  strong: 3,
};

/** Required competencies to cover, derived deterministically from the plan.
 *  ids are stable stringified indices the model reports evidence against. */
function requiredCompetencies(plan: InterviewPlan): PromptCompetency[] {
  const src =
    plan.must_haves && plan.must_haves.length
      ? plan.must_haves
      : plan.skills_to_probe && plan.skills_to_probe.length
        ? plan.skills_to_probe
        : [];
  const list = src.slice(0, 8).map((label, i) => ({ id: String(i), label }));
  return list.length ? list : [{ id: "0", label: "General fit for the role" }];
}

// Lightweight, dependency-free per-IP rate limiting.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(ip, hits);
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
    return res
      .status(429)
      .json({ error: "Too many requests. Please slow down." });
  }

  try {
    const { message, conversationId, isInitial, action } = req.body as {
      message?: string;
      conversationId?: string;
      isInitial?: boolean;
      action?: "skip" | "leave";
    };

    if (!conversationId) {
      return res.status(400).json({
        error: "conversationId is required (start via /api/interviews/start)",
      });
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
    if (!conversation.candidate?.role) {
      return res
        .status(400)
        .json({ error: "Conversation has no linked candidate/role" });
    }
    if (conversation.status === "completed" || conversation.status === "left_early") {
      return res.status(409).json({ error: "This interview is already closed." });
    }

    const role = conversation.candidate.role;
    let plan: InterviewPlan;
    try {
      plan = JSON.parse(role.interviewPlan) as InterviewPlan;
    } catch {
      return res.status(500).json({ error: "Role's interview plan is invalid." });
    }

    const candidateName = conversation.candidate.name;
    const comps = requiredCompetencies(plan);
    const requiredIds = comps.map((c) => c.id);

    const meta = parseMeta(conversation.metadata);
    meta.state ??= "welcome";
    meta.coverage ??= {};
    meta.questionsAsked ??= 0;
    meta.followups ??= {};
    meta.noImprovementStreak ??= 0;
    meta.abuseCount ??= 0;

    const historyOf = (msgs: { id: string; content: string; role: string; conversationId: string; createdAt: Date }[]) =>
      msgs.map((m) => ({
        id: m.id,
        content: m.content,
        role: m.role as "user" | "assistant",
        conversationId: m.conversationId,
        createdAt: m.createdAt,
      }));

    const buildPrompt = (
      phase: "welcome" | "active",
      readiness: "ready" | "not_ready" | "unclear" | undefined,
      neededIds: string[],
    ) =>
      buildInterviewSystemPrompt({
        roleTitle: role.title,
        candidateName,
        jdText: role.jdText,
        plan,
        competencies: comps,
        phase,
        readiness,
        neededIds,
        questionsAsked: meta.questionsAsked ?? 0,
        targetMin: TARGET_MIN,
        targetMax: TARGET_MAX,
        maxQuestions: MAX_QUESTIONS,
      });

    // ---------- INITIAL GREETING (welcome gate) ----------
    if (isInitial) {
      const turn = await runInterviewTurn([], buildPrompt("welcome", undefined, requiredIds));
      const assistant = await prisma.message.create({
        data: {
          content:
            turn.reply ||
            `Hi ${candidateName}, welcome. Ready to start the ${role.title} interview?`,
          role: "assistant",
          conversationId: conversation.id,
        },
      });
      meta.state = "welcome";
      meta.startedAt ??= Date.now();
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { metadata: JSON.stringify(meta), updatedAt: new Date() },
      });
      return res.status(200).json({
        messages: [assistant],
        conversationId: conversation.id,
        status: "welcome",
      });
    }

    // ---------- EXPLICIT LEAVE (client already confirmed) ----------
    if (action === "leave") {
      const assistant = await prisma.message.create({
        data: {
          content: `Thanks for your time, ${candidateName}. I've saved where you left off. This interview will be marked incomplete for the hiring team.`,
          role: "assistant",
          conversationId: conversation.id,
        },
      });
      meta.state = "ended";
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: "left_early",
          endReason: "candidate_left",
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
        messages: [assistant],
        conversationId: conversation.id,
        status: "left_early",
      });
    }

    // Resolve the candidate's turn text.
    const isSkip = action === "skip";
    let userText: string;
    if (isSkip) {
      userText = "(skipped this question)";
    } else {
      if (!message?.trim()) {
        return res.status(400).json({ error: "message is required" });
      }
      userText = message.trim();
    }

    const userMessage = await prisma.message.create({
      data: { content: userText, role: "user", conversationId: conversation.id },
    });
    const history = historyOf([...conversation.messages, userMessage]);

    // ---------- WELCOME STATE: readiness handling ----------
    if (meta.state === "welcome") {
      const readiness = isSkip ? "unclear" : classifyReadiness(userText);
      const turn = await runInterviewTurn(history, buildPrompt("welcome", readiness, requiredIds));
      const started = readiness === "ready" || turn.phase === "interview";
      const assistant = await prisma.message.create({
        data: { content: turn.reply, role: "assistant", conversationId: conversation.id },
      });
      if (started) {
        meta.state = "active";
        meta.questionsAsked = 1; // the first interview question was just asked
      }
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: "in_progress",
          metadata: JSON.stringify(meta),
          updatedAt: new Date(),
        },
      });
      return res.status(200).json({
        messages: [userMessage, assistant],
        conversationId: conversation.id,
        status: started ? "in_progress" : "welcome",
      });
    }

    // ---------- ACTIVE STATE ----------
    // Typed explicit-end intent routes to the client Leave confirmation rather
    // than ending: no auto-termination, but we honour a clear wish to stop.
    if (!isSkip && classifyCandidateIntent(userText) === "explicit_end") {
      const assistant = await prisma.message.create({
        data: {
          content: `No problem, ${candidateName}. You can leave the interview using the "Leave interview" option at the top, and it will be marked incomplete. Or we can keep going, whichever you prefer.`,
          role: "assistant",
          conversationId: conversation.id,
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { metadata: JSON.stringify(meta), updatedAt: new Date() },
      });
      return res.status(200).json({
        messages: [userMessage, assistant],
        conversationId: conversation.id,
        status: "confirm_leave",
      });
    }

    // Which competencies still need evidence and can still be probed.
    const neededIds = uncoveredRequired(meta.coverage, requiredIds).filter((id) =>
      canFollowUp(meta.followups ?? {}, id),
    );

    const turn = await runInterviewTurn(history, buildPrompt("active", undefined, neededIds));

    // Safety: a genuine red flag, or repeated moderation-flagged messages, ends
    // the interview (server-decided, not model-decided).
    if (turn.moderationFlagged) meta.abuseCount = (meta.abuseCount ?? 0) + 1;
    const redFlag =
      turn.safety === "red_flag" || (meta.abuseCount ?? 0) >= 2;
    if (redFlag) {
      const assistant = await prisma.message.create({
        data: {
          content: "Thanks for your time. I'm going to wrap up here.",
          role: "assistant",
          conversationId: conversation.id,
        },
      });
      meta.state = "ended";
      const label = turn.redFlagLabel ? `red_flag_${turn.redFlagLabel}` : "red_flag_abuse";
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: "completed",
          endReason: label,
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
        messages: [userMessage, assistant],
        conversationId: conversation.id,
        status: "completed",
        endReason: label,
      });
    }

    // Apply the model's evidence signal. A SKIP is never evidence.
    let improved = false;
    if (!isSkip && turn.assessed && requiredIds.includes(turn.assessed.competencyId)) {
      const id = turn.assessed.competencyId;
      const before = meta.coverage![id];
      const merged = mergeEvidence(before, turn.assessed.evidence);
      if (before !== undefined) {
        meta.followups![id] = (meta.followups![id] ?? 0) + 1;
      }
      meta.coverage![id] = merged;
      improved = RANK[merged] > (before ? RANK[before] : 0);
    }
    meta.noImprovementStreak = improved ? 0 : (meta.noImprovementStreak ?? 0) + 1;

    // Deterministic completion decision (the model's recommend is advisory).
    const decision = decideCompletion({
      questionsAsked: meta.questionsAsked ?? 0,
      coverage: meta.coverage ?? {},
      requiredIds,
      noImprovementStreak: meta.noImprovementStreak ?? 0,
    });

    if (decision.complete) {
      const wrap = `That's everything I needed, ${candidateName}. Thanks for taking the time, your responses have been submitted to the hiring team.`;
      const assistant = await prisma.message.create({
        data: { content: wrap, role: "assistant", conversationId: conversation.id },
      });
      meta.state = "ended";
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: "completed",
          endReason: `completed_${decision.reason}`,
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
        messages: [userMessage, assistant],
        conversationId: conversation.id,
        status: "completed",
        endReason: `completed_${decision.reason}`,
      });
    }

    // Continue: ask the next question. If the model wrapped up on its own
    // despite an open competency, fall back to a targeted question.
    let replyText = turn.reply;
    const looksLikeQuestion = /\?/.test(replyText);
    if (!looksLikeQuestion && neededIds.length) {
      const needLabel = comps.find((c) => c.id === neededIds[0])?.label;
      if (needLabel) {
        replyText = `Let's dig into ${needLabel}. Could you walk me through your hands-on experience there?`;
      }
    }
    const assistant = await prisma.message.create({
      data: { content: replyText, role: "assistant", conversationId: conversation.id },
    });
    meta.questionsAsked = (meta.questionsAsked ?? 0) + 1;
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "in_progress",
        metadata: JSON.stringify(meta),
        updatedAt: new Date(),
      },
    });
    return res.status(200).json({
      messages: [userMessage, assistant],
      conversationId: conversation.id,
      status: "in_progress",
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return res.status(500).json({ error: "Error processing chat" });
  }
}
