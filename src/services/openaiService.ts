import OpenAI from "openai";
import { Message } from "@/types/chat";
// OpenAI SDK v4 moduleResolution=bundler quirk: the legacy
// "openai/resources/chat" subpath isn't in package.json exports, so we
// import from the explicit completions subpath that IS exported.
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

function closingFallback(reason: string): string {
  if (reason === "not_interested") {
    return "Totally understand, thanks for taking the time. Best of luck out there.";
  }
  if (reason === "reschedule") {
    return "Totally understand. The interview link stays active, so come back whenever you're ready. I'll be here.";
  }
  if (reason === "off_topic") {
    return "Looks like this conversation got off track. Wrapping up here, thanks for your time.";
  }
  if (reason === "unclear_communication") {
    return "Looks like the connection isn't quite working, wrapping up here. Feel free to try again anytime.";
  }
  if (reason === "missing_must_have") {
    return "Thanks for being upfront. This particular role might not be the right fit, but I appreciate the chat.";
  }
  if (reason.startsWith("red_flag_")) {
    return "Thanks for the conversation. Wrapping up here, the recruiter will be in touch if there's a next step.";
  }
  return "Thanks for the chat. The recruiter will review and follow up. Have a great day.";
}

const END_INTERVIEW_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "end_interview",
    description:
      "Call this to end the interview after you've delivered a warm closing message to the candidate. Use 'completed' for a full interview, or a short reason like 'not_interested', 'unclear_communication', 'missing_must_have', or 'red_flag_<label>'.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Short label explaining why the interview is ending.",
        },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
};

export async function generateResponse(
  messages: Message[],
  systemPrompt: string,
): Promise<{ text: string; endInterviewReason?: string }> {
  try {
    if (!openai.apiKey) {
      return {
        text: "I apologize, but the AI service isn't configured right now.",
      };
    }

    const history: ChatCompletionMessageParam[] = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...history],
      temperature: 0.7,
      max_tokens: 500,
      tools: [END_INTERVIEW_TOOL],
      tool_choice: "auto",
    });

    const message = response.choices[0]?.message;
    if (!message) {
      throw new Error("No response from OpenAI");
    }

    let endInterviewReason: string | undefined;
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      const endCall = message.tool_calls.find(
        (tc) => tc.function?.name === "end_interview",
      );
      if (endCall) {
        try {
          const args = JSON.parse(endCall.function.arguments);
          endInterviewReason = args.reason || "completed";
        } catch {
          endInterviewReason = "completed";
        }
      }
    }

    let text = (message.content ?? "")
      .replace(/\(end_interview\(.*?\)\)|\[End of interview\]/g, "")
      .trim();

    // Belt-and-suspenders: if the model called end_interview without any
    // accompanying text, inject a polite goodbye so the candidate sees one.
    if (endInterviewReason && !text) {
      text = closingFallback(endInterviewReason);
    }

    return { text, endInterviewReason };
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message?: string };
    console.error("OpenAI API Error:", err.message);
    if (err.response?.status === 401) {
      return {
        text: "Authentication error with the AI service.",
      };
    }
    return {
      text: "I'm having trouble responding right now. Could you try again?",
    };
  }
}
