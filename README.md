# PurpleHire

**AI interviews for any job description.** Recruiters paste a JD, get a shareable link, and receive a scored shortlist of candidates back — no scheduling, no phone screens.

🔗 Live: [purplehire.vercel.app](https://purplehire.vercel.app)

---

## What it does

Two-sided AI interview product:

- **Recruiter side** — sign in with Google, paste a job description, get a shareable interview link, then watch candidates come in with AI-generated fit scores (1.0–10.0) and one-line verdicts.
- **Candidate side** — open the link, enter name + email, chat with "PurpleHire" (an AI recruiter persona) for ~10 minutes. The conversation is steered by an interview plan the LLM extracts from the JD.
- **Public demo** — `/demo` lets visitors try both sides without signing in or hitting the database.

## Features

### Recruiter
- Google OAuth sign-in (NextAuth)
- Create interview from any pasted JD — the LLM validates it's actually a JD and rejects non-JDs (cricket match summaries, recipes, etc.)
- Per-role shareable candidate link (`/i/<slug>`)
- Candidate inbox with filter pills (All / Completed / In progress), search, sort, and per-candidate transcript view
- Score badges tiered emerald (≥8) / yellow (≥6) / red, with one-decimal precision (e.g. 8.7/10)
- **Send next-round email** button on every ≥8.0 candidate — opens the recruiter's default mail client with a pre-filled draft
- Delete role or individual candidate (transactional cascade)

### Candidate
- Anonymous interview at `/i/<slug>` — name + email gate, then chat
- Character-by-character typewriter on the latest bot message
- Inactivity timer: 5-min "still there?" banner, 10-min auto-end with `inactive` reason
- Auto-grow composer
- Clean "Interview complete" card on natural conclusion

### Interview behavior
The bot system prompt is built dynamically from the role's JD + an LLM-extracted plan. Key behaviors enforced in prompt + server-side belt-and-suspenders:

- **Hard exit on disinterest.** "not interested" / "lol no" / "changed my mind" → end immediately with one warm line.
- **Two-strike off-topic system.** Strike 1 redirect, strike 2 ends with `off_topic`. Counted from the first off-topic message regardless of greeting phase.
- **Honest must-have checks.** Woven into open questions, never as yes/no checklist grilling. If a must-have is clearly missing after one follow-up, bot is upfront about it rather than fake-polite.
- **Natural wrap detection.** "no more questions" / "thanks for the chat" → ends; no infinite "have a great day" loops.
- **Server-side safety net** in `/api/chat`: if the bot writes a closing line but forgets the `end_interview` tool call, we infer the reason from candidate context and end the conversation anyway.

### Public demo
- `/demo` — chooser between candidate and recruiter sides
- `/demo/candidate` — pick from 3 sample roles, take a real chat (ephemeral, no DB writes), get scored at the end via `/api/demo/score`
- `/demo/recruiter` — read-only dashboard with one role + 8 hardcoded candidates (scores 5.5–9.4)
- `/demo/recruiter/[id]` — per-candidate transcript with AI verdict callout

---

## Tech stack

- **Next.js 16** (Pages Router) + **React 18** + **TypeScript**
- **Tailwind CSS** with custom design tokens (Fredoka + JetBrains Mono via `next/font`, purple-anchored palette, `fm-*` animations that map to Framer Motion semantics)
- **Prisma 6** + **PostgreSQL** (Vercel Postgres in prod, schema synced via `prisma db push`)
- **NextAuth 4** with Google provider + Prisma adapter, database sessions
- **OpenAI** — `gpt-4o` for interviews, `gpt-4o-mini` for JD analysis and scoring (JSON mode)
- **Vercel** hosting + GitHub auto-deploy

---

## Roadmap

Things shipping next, in rough priority order.

### 1. Voice-mode interviews (agentic, real-time)
Today the candidate types. Adding a voice-first mode where the bot speaks and the candidate answers out loud — same prompt logic, same scoring, but conducted through the OpenAI Realtime API (or equivalent). Should feel like a phone screen with no scheduling. Voice transcripts still feed the same `scoreTranscript` pipeline so verdicts stay consistent across chat and voice candidates.

### 2. Stay-on-screen guardrails during the interview
Right now nothing stops a candidate from popping over to another tab to google an answer or ask ChatGPT mid-question. Adding:
- **Tab visibility detection** (`document.visibilityState`) — log how many times the tab loses focus and how long each absence lasted.
- **Soft full-screen suggestion** at interview start.
- **Surfaced to the recruiter** on the candidate transcript ("left tab 3 times, total 4 min away") so they can weight the score accordingly.

Not a hard lock — we don't want to feel like proctoring software. Just visibility into engagement.

### 3. AI-written answer detection
Catching candidates who paste answers from ChatGPT / Claude / etc. Multiple signals combined:
- **Paste events** (`onPaste`) — flag any answer that arrived via paste rather than typing.
- **Timing analysis** — long silence followed by a long polished answer is a tell.
- **An LLM classifier pass** at scoring time — feed each candidate answer to a small model and ask "does this read as human or AI-generated?". Score gets a confidence band rather than a hard verdict.

The bot won't accuse candidates; the signal lives on the recruiter's transcript view alongside the score.

---

## Project structure

```
src/
├── components/
│   ├── ph/index.tsx           # Design system (PHLogo, PHButton, PHFitBadge,
│   │                          # PHMessage, PHTopBar, PHMockPanel, icons...)
│   ├── CandidateChat.tsx      # Live candidate-side chat UI
│   └── DemoChat.tsx           # Ephemeral demo chat UI
├── lib/
│   ├── prisma.ts              # Shared Prisma client
│   ├── auth.ts                # NextAuth options
│   ├── jdAnalyzer.ts          # OpenAI call: validate JD + extract plan
│   ├── interviewPrompt.ts     # Builds the bot system prompt from role + plan
│   ├── interviewScorer.ts     # Transcript -> {score, verdict} (DB + pure)
│   ├── inviteEmail.ts         # mailto: builder for next-round email
│   ├── sampleRoles.ts         # 3 hardcoded roles for the demo
│   └── demoRecruiter.ts       # Hardcoded recruiter-demo data
├── pages/
│   ├── index.tsx              # Marketing landing (split hero + mock panel)
│   ├── signin.tsx             # Google sign-in
│   ├── dashboard.tsx          # Recruiter dashboard (roles list + create form)
│   ├── dashboard/
│   │   ├── [slug].tsx         # Role detail (candidates inbox)
│   │   └── [slug]/
│   │       └── [candidateId].tsx  # Transcript view
│   ├── i/[slug].tsx           # Candidate landing + chat
│   ├── demo.tsx               # Demo hub (2-card chooser)
│   ├── demo/
│   │   ├── candidate.tsx      # Candidate-side demo flow
│   │   ├── recruiter.tsx      # Recruiter-side demo dashboard
│   │   └── recruiter/[id].tsx # Per-candidate demo transcript
│   └── api/
│       ├── auth/[...nextauth].ts
│       ├── chat.ts            # Main interview chat
│       ├── roles/
│       │   ├── index.ts       # GET/POST roles
│       │   └── [id].ts        # DELETE role (cascading)
│       ├── candidates/[id].ts # DELETE candidate
│       ├── interviews/
│       │   ├── start.ts       # Create candidate + conversation
│       │   └── end.ts         # End conversation (used by idle timer)
│       └── demo/
│           ├── chat.ts        # Ephemeral demo chat (no DB)
│           └── score.ts       # Ephemeral demo scoring
└── prisma/
    └── schema.prisma          # User, Account, Session, Role, Candidate,
                                # Conversation, Message + NextAuth tables
```

---

## Local setup

1. Clone:
   ```bash
   git clone https://github.com/joyo11/PurpleHire.git
   cd PurpleHire
   ```
2. Install:
   ```bash
   npm install
   ```
3. Create `.env.local` with:
   ```env
   DATABASE_URL="postgresql://..."           # any Postgres (Neon free tier works)
   OPENAI_API_KEY="sk-..."
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="..."                      # `openssl rand -base64 32`
   GOOGLE_CLIENT_ID="..."                     # from Google Cloud Console
   GOOGLE_CLIENT_SECRET="..."
   ```
4. Push the schema:
   ```bash
   npx prisma db push
   ```
5. Run:
   ```bash
   npm run dev
   ```

### Google OAuth setup
In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):
1. OAuth consent screen → External → fill in basics.
2. Create OAuth client → Web application.
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-vercel-url>/api/auth/callback/google`
4. Copy the Client ID + Secret into your env.

---

## Deployment

The project ships to Vercel — `npm run vercel-build` runs `prisma generate && prisma db push --accept-data-loss --skip-generate && next build`, so schema changes apply automatically on deploy.

Required environment variables on Vercel: same as local, but `NEXTAUTH_URL` set to your production URL.

---

## License

Copyright © 2026 Mohammad Shafay Joyo. All rights reserved.

---

## Contact

- **Author:** Mohammad Shafay Joyo ([@joyo11](https://github.com/joyo11))
- **Email:** shafay11august@gmail.com
