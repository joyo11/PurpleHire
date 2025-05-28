# PurpleHire Agent

## Overview
This project is a modern, AI-powered interview agent designed for Purplefish. The Purplehire Agent automates candidate screening by conducting structured, natural-feeling interviews, handling conditional logic, and persisting all conversations for later review. The system leverages a hybrid approach: a hardcoded interview script for validation and flow, and a powerful LLM (GPT-4o) for natural conversation and adaptability.


## Design Decisions, Assumptions, and Technical Tidbits

### Interview Flow and Ending Logic
A core design decision in this project was to combine a flexible LLM-driven script with explicit backend logic to determine when the interview should end. The interview can end early or late based on both candidate responses and the requirements of the role. Here's how and why:

- **Mandatory Requirements:**
  The interview ends immediately if the candidate does not meet hard requirements such as relevant degree, minimum experience, willingness to relocate (even with relocation support), salary flexibility, or Linux comfort. This is enforced both in the LLM prompt and with backend checks for specific phrases, ensuring the process is robust even if the LLM output varies.
- **Communication and Engagement:**
  If a candidate gives unclear or off-topic answers three times, the interview ends. This ensures that only candidates who can communicate clearly and stay engaged continue.
- **Growth Mindset:**
  If a candidate is not open to learning new technologies, the interview ends, reflecting the company's value on adaptability and willingness to learn.
- **Not Ending on Non-Mandatory Questions:**
  The interview does not end if a candidate cannot provide an example for a soft-skill or follow-up question (e.g., "Tell me about a time you collaborated with a teammate"). These are not hard requirements; the interview continues to allow the candidate to demonstrate fit in other areas.
- **Completion:**
  The interview ends naturally when all questions are answered, or when the candidate has no further questions.

**Reasoning:**
This approach ensures the interview is both efficient and fair: it ends early when a candidate is clearly not a fit, but gives candidates every reasonable opportunity to clarify, elaborate, or show willingness to learn. Only truly mandatory requirements or repeated communication issues will end the interview.

### Other Key Design Choices
- **Hybrid Script Approach:**
  The system combines a structured `interviewQuestions` object for validation and UI flow with a detailed LLM system prompt for natural conversation and edge cases.
- **Backend Fallbacks:**
  The backend checks for a variety of polite closing phrases and tool calls to ensure the interview ends reliably, even if the LLM output is not perfectly structured.
- **Session Management:**
  All conversations are persisted in a database, and users can revisit past sessions.
- **Modern Stack:**
  The project uses Next.js 15, React 18, Prisma, and GPT-4o for a modern, maintainable codebase.
- **User Experience:**
  The chat interface features a typing effect, a welcoming intro, and disables input when the interview ends for clarity.

### Assumptions
- **Single Script:**
  The Purplehire Agent only needs to support one interview script, so the script is hardcoded and not user-configurable.
- **Mandatory Requirements:**
  We assumed certain requirements (e.g., willingness to relocate, salary range, minimum experience) are truly mandatory and should end the interview if not met.
- **User is a Candidate:**
  The chat interface is designed for candidates only, not for recruiters or admins.
- **English Language:**
  The system prompt and validation assume the interview is conducted in English.

### Technical Tidbits
- **Ending detection** is robust, using both LLM tool calls and backend substring checks.
- **Structured LLM function calling** is used (e.g., `end_interview`, `mark_question_complete`) to let the agent signal interview state transitions, making the flow robust and less reliant on brittle substring checks.
- **Question progression logic** ensures the interview flow does not skip questions, even if there is back-and-forth or clarification within a single question.
- **Memory handling** is implemented to avoid re-asking for the candidate's name, though perfect memory is a known challenge for LLMs.
- **Error handling** is user-friendly, with recovery prompts for unclear or off-topic responses.

---

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/joyo11/PurpleHire.git
   ```
2. In the root folder, create a `.env` file if it doesn't already exist.
3. Add your environment variables in the `.env` file, such as:
   ```env
   DATABASE_URL="file:./dev.db"
   OPENAI_API_KEY=your-api-key-here
   ```
4. Install all project dependencies:
   ```bash
   npm install
   ```
4. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```
6. Reset the database schema (optional):
   ```bash
   npx prisma migrate reset
   ```
   It will prompt:
   ```
   Are you sure you want to reset your database? All data will be lost. › (y/N)
   ```
   Type `yes` and press Enter to continue.
   ```
7. Start your development server:
   ```bash
   npm run dev
   ```

---

## Features in Detail
- **Conversational Interview Flow:**
  The Purplehire Agent conducts interviews using a natural, human-like chat interface, following a predefined script with dynamic branching and follow-ups.
- **Conditional Logic:**
  Handles early exits, clarifications, and follow-up questions based on candidate responses.
- **Session Persistence:**
  All conversations are stored in a database, allowing users to revisit and review past interviews.
- **Session History & Management:**
  Users can view and return to past interview sessions, and can change the names of their sessions for easier organization.
- **FAQ Access:**
  Users can access a FAQ section for common questions about the interview process or the platform.
- **Role Q&A:**
  The Purplehire Agent can answer basic questions about the role or company, based on static knowledge in the system prompt.
- **Robust Error Handling:**
  Gracefully manages unclear, off-topic, or invalid responses with recovery prompts and fallback logic.
- **Modern UI/UX:**
  Features a typing effect, welcoming intro, and disables input when the interview ends for clarity.

---

## Code Structure
- **src/pages/api/chat.ts:** Backend API route for handling chat messages, managing conversation state, and coordinating with the OpenAI service.
- **src/services/openaiService.ts:** Handles interaction with the OpenAI API, including the system prompt and parsing LLM responses.
- **src/components/ChatInterface.tsx:** Main React component for the chat UI, managing chat state, user input, and session management.
- **src/services/interviewService.ts:** Defines the interview script, question structure, and validation logic.
- **src/components/Logo.tsx:** Renders the Purplehire logo as an SVG for branding.
- **package.json:** Lists dependencies and scripts for running and maintaining the project.

---

## Technologies Used
- **Next.js 15**
- **React 18**
- **Prisma (with SQLite)**
- **OpenAI GPT-4o**
- **Tailwind CSS**
- **TypeScript**

---

## Contact
For questions or support:

- **Email:** shafay11august@gmail.com
- **GitHub:** [@joyo11](https://github.com/joyo11)

---

## License
Copyright (c) 2025 Mohammad Shafay Joyo


