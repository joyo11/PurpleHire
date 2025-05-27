// Mohammad Shafay Joyo @ 2025

// Type definition for an interview question
export type InterviewQuestion = {
  id: string; // Unique identifier for the question
  text: string; // The question text shown to the candidate
  type: "text" | "choice"; // Type of input expected
  choices?: string[]; // Choices for 'choice' type questions
  nextQuestion: string | null; // ID of the next question, or null if last
  actions: { onComplete: (() => void) | null }; // Optional action on completion
};

// The interview script as a map of question IDs to question objects
export const interviewQuestions: Record<string, InterviewQuestion> = {
  initial: {
    id: "initial",
    text: "Hi! Are you interested in discussing a Full Stack role?",
    type: "text",
    nextQuestion: "greeting",
    actions: { onComplete: null },
  },
  greeting: {
    id: "greeting",
    text: "Would you be interested in learning more about this Full Stack role?",
    type: "choice",
    choices: ["Yes", "No"],
    nextQuestion: "name",
    actions: { onComplete: null },
  },
  name: {
    id: "name",
    text: "Can I get your name, please?",
    type: "text",
    nextQuestion: "background",
    actions: { onComplete: null },
  },
  background: {
    id: "background",
    text: "Do you hold a Bachelor's degree or higher in Computer Science?",
    type: "choice",
    choices: ["Yes", "No"],
    nextQuestion: "experience",
    actions: { onComplete: null },
  },
  experience: {
    id: "experience",
    text: "Do you have at least 2 years of work experience in full-stack development?",
    type: "text",
    nextQuestion: "tech_stack",
    actions: { onComplete: null },
  },
  tech_stack: {
    id: "tech_stack",
    text: "Which programming languages are you most comfortable with?",
    type: "text",
    nextQuestion: "recent_project",
    actions: { onComplete: null },
  },
  recent_project: {
    id: "recent_project",
    text: "Tell me about your most recent project. What was your role and what technologies did you use?",
    type: "text",
    nextQuestion: "salary",
    actions: { onComplete: null },
  },
  salary: {
    id: "salary",
    text: "Our salary range is $100,000-$130,000. Does this align with your expectations?",
    type: "choice",
    choices: ["Yes", "No"],
    nextQuestion: "availability",
    actions: { onComplete: null },
  },
  availability: {
    id: "availability",
    text: "If selected, when would you be able to start?",
    type: "text",
    nextQuestion: "end",
    actions: { onComplete: null },
  },
  end: {
    id: "end",
    text: "Thank you for your time. We'll review your application and get back to you soon.",
    type: "text",
    nextQuestion: null,
    actions: { onComplete: endInterview },
  },
};

/**
 * Validates the candidate's answer for a given question.
 * For 'choice' questions, checks if the answer matches one of the choices.
 * For 'text' questions, checks if the answer is non-empty.
 */
export function validateAnswer(questionId: string, answer: string): boolean {
  const question = interviewQuestions[questionId];
  
  if (question.type === "choice" && question.choices) {
    return question.choices.map(c => c.toLowerCase()).includes(answer.toLowerCase());
  }
  
  return answer.trim().length > 0;
}

/**
 * Action to handle ending the interview (can be extended for side effects).
 */
function endInterview() {
  // Logic to handle ending the interview
  console.log("Interview has ended.");
  // You can add more logic here, such as updating state or notifying the user.
} 