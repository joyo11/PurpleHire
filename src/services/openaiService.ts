import OpenAI from "openai";
import { Message } from "@/types/chat";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

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

    const text = (message.content ?? "")
      .replace(/\(end_interview\(.*?\)\)|\[End of interview\]/g, "")
      .trim();

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
