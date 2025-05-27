// Mohammad Shafay Joyo @ 2025
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { interviewQuestions } from "@/services/interviewService";
import { generateResponse } from "@/services/openaiService";

// Initialize Prisma client for database access
const prisma = new PrismaClient();

// Main API handler for chat messages
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      // Extract message, conversationId, and isInitial from request body
      const { message, conversationId, isInitial } = req.body;

      // Retrieve existing conversation or create a new one
      const conversation = conversationId
        ? await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { messages: true },
          })
        : await prisma.conversation.create({
            data: {
              status: "in_progress",
              metadata: JSON.stringify({ sessionNumber: Date.now() }),
            },
            include: { messages: true },
          });

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Map messages to correct types for OpenAI
      const conversationMessages = conversation.messages.map(msg => ({
        ...msg,
        role: msg.role as "user" | "assistant" // Ensure role is correctly typed
      }));

      // If this is the initial message, send the first question
      if (isInitial) {
        const assistantMessage = await prisma.message.create({
          data: {
            content: interviewQuestions.initial.text,
            role: "assistant",
            conversationId: conversation.id,
          },
        });

        // Return the initial assistant message
        return res.status(200).json({
          messages: [assistantMessage as { content: string; id: string; conversationId: string; role: "user" | "assistant"; createdAt: Date; }],
          conversationId: conversation.id,
          status: "in_progress" // Initial message doesn't end interview
        });
      }

      // Save the user's message to the database
      const userMessage = await prisma.message.create({
        data: {
          content: message,
          role: "user",
          conversationId: conversation.id,
        },
      });

      // Prepare messages for the AI (history + new user message)
      const messagesForAI = [...conversationMessages, userMessage as { content: string; id: string; conversationId: string; role: "user" | "assistant"; createdAt: Date; }];

      // Generate the bot's response using OpenAI
      // (currentQuestion context can be passed if needed)
      const botResponse = await generateResponse(
        messagesForAI,
        "" // Pass an empty string or relevant context if generateResponse requires it
      );

      // Determine if the interview should end based on botResponse (tool call)
      let endInterviewReason = botResponse.endInterviewReason;
      let newStatus = endInterviewReason ? "completed" : "in_progress";

      // Save the assistant's message if there is a text response
      let assistantMessage = null;
      if (botResponse.text) {
        assistantMessage = await prisma.message.create({
          data: {
            content: botResponse.text, // Use the text property for content
            role: "assistant",
            conversationId: conversation.id,
          },
        });

        // --- Fallback checks for ending phrases if tool call wasn't triggered ---
        // Fallback for unclear communication ending phrase
        const unclearCommunicationEndingPhrase = "Clear communication is really important in this role, so we'll need to pause the interview for now. You're welcome to try again anytime!";
        if (newStatus === "in_progress" && assistantMessage.content.includes(unclearCommunicationEndingPhrase)) {
          newStatus = "completed";
          endInterviewReason = "unclear_communication";
        }

        // Fallback for "Not Interested" ending phrases
        // Checking for key phrases that indicate the user is not interested and the interview is ending
        if (newStatus === "in_progress" &&
          (assistantMessage.content.includes("Thank you for your time") ||
            assistantMessage.content.includes("best of luck") ||
            assistantMessage.content.includes("best in your job search") ||
            assistantMessage.content.includes("wrap up the interview here"))) {
          newStatus = "completed";
          endInterviewReason = "not_interested";
        }

        // Additional fallback checks for other closing phrases
        const relocationEndingPhrase = "Since this role requires regular in-office work in NYC, we need candidates located there or willing to relocate. To respect your time, let's wrap up here. Thank you!";
        const warmRelocationEndingPhrase = "Thank you so much for being open with me. I completely understand that relocating isn't always possible. While we do need someone in NYC for this role, I truly appreciate your interest and the time you spent chatting today. Please feel free to stay in touch or check back for future opportunities with us. Wishing you all the best in your career journey!";
        const politeClosingPhrase = "Thanks again for your time";
        const notAFitClosingPhrase = "It seems like this role may not be the best fit at the moment.";

        if (newStatus === "in_progress" &&
          (assistantMessage.content.includes("Thank you for your time") ||
            assistantMessage.content.includes("best of luck") ||
            assistantMessage.content.includes("best in your job search") ||
            assistantMessage.content.includes("wrap up the interview here") ||
            assistantMessage.content.includes(relocationEndingPhrase) ||
            assistantMessage.content.includes(warmRelocationEndingPhrase) ||
            assistantMessage.content.includes(politeClosingPhrase) ||
            assistantMessage.content.includes(notAFitClosingPhrase))) {
          newStatus = "completed";
          endInterviewReason = "completed";
        }
        // --- End Fallback checks ---
      }

      // Update conversation status and timestamp in the database
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      // Prepare messages to return (include the user message and the new assistant message if created)
      const messagesToReturn = [userMessage as { content: string; id: string; conversationId: string; role: "user" | "assistant"; createdAt: Date; }];
      if (assistantMessage) {
        messagesToReturn.push(assistantMessage as { content: string; id: string; conversationId: string; role: "user" | "assistant"; createdAt: Date; });
      }

      // Return the response to the frontend
      return res.status(200).json({
        messages: messagesToReturn, // Return the user message and the (optional) assistant message
        conversationId: conversation.id,
        status: newStatus, // Indicate the new status
        endInterviewReason: endInterviewReason // Include reason if interview ended
      });

    } catch (error) {
      // Handle errors and return a 500 response
      console.error('Error in chat API:', error);
      res.status(500).json({ error: 'Error processing chat' });
    }

  } else {
    // Only POST method is allowed
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Helper function to process user responses and update metadata (not used in main flow)
function processUserResponse(
  metadata: Record<string, any>,
  questionId: string,
  answer: string
): Record<string, any> {
  const newMetadata = { ...metadata };

  // Only update specific fields based on question type
  switch (questionId) {
    case "position":
      newMetadata.position = answer;
      break;
    case "salary":
      newMetadata.salary = parseInt(answer);
      break;
    case "experience":
      newMetadata.experience = parseInt(answer);
      break;
    case "education":
      newMetadata.education = answer;
      break;
    case "skills":
      newMetadata.skills = answer.split(",").map((skill: string) => skill.trim());
      break;
    case "availability":
      newMetadata.availability = answer;
      break;
  }

  return newMetadata;
}

// Helper function to get the current question based on conversation history (not used in main flow)
function getCurrentQuestion(conversation: any) {
  const messageCount = conversation.messages.length;
  const questionKeys = Object.keys(interviewQuestions);
  const currentQuestionIndex = Math.floor(messageCount / 2);
  return interviewQuestions[questionKeys[currentQuestionIndex]];
} 