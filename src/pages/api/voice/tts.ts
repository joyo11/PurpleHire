import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

// OpenAI TTS endpoint. Streams an MP3 of `text` rendered in voice "nova"
// (the energetic young-adult female voice). Uses the same OPENAI_API_KEY
// already configured for chat scoring — no new env var needed.
//
// Cost: ~$0.015 per 1K characters with tts-1. A 10-min interview's AI
// speech is ~3K chars, so ~$0.05 per interview added.

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

// One TTS request must stay under this to keep latency tight + cost bounded.
const MAX_INPUT_CHARS = 4000;

export const config = {
  api: {
    // We're streaming bytes, not parsing JSON for the response.
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, voice = "nova" } = req.body as {
    text?: string;
    voice?: string;
  };

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  if (text.length > MAX_INPUT_CHARS) {
    return res
      .status(400)
      .json({ error: `text exceeds ${MAX_INPUT_CHARS} chars` });
  }

  // Whitelist the 6 standard OpenAI voices; default any unknown to nova.
  const VOICES = ["alloy", "echo", "fable", "nova", "onyx", "shimmer"] as const;
  type Voice = (typeof VOICES)[number];
  const safeVoice: Voice = (VOICES as readonly string[]).includes(voice)
    ? (voice as Voice)
    : "nova";

  try {
    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: safeVoice,
      input: text,
      response_format: "mp3",
      speed: 1.05,  // very slightly faster than default — reads as more energetic
    });

    // Buffer-and-send. For streaming we'd pipe the Web Stream into the
    // Node response, but v1 keeps it simple — total latency is still
    // sub-second for typical interview-length replies.
    const arrayBuffer = await speech.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "TTS failed";
    console.error("[api/voice/tts]", msg);
    return res.status(500).json({ error: msg });
  }
}
