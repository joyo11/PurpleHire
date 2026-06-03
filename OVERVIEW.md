# PurpleHire — Overview

A single doc that explains what PurpleHire is, why it exists, how it's built, and who it helps. Read it top to bottom before talking about the project with anyone.

---

## 1. What is PurpleHire

PurpleHire is a two-sided AI hiring tool that replaces job applications with a 10-minute AI interview.

- A **recruiter** signs in with Google, pastes a job description, and gets a shareable link.
- A **candidate** opens that link, gives only a name + email, and chats with an AI recruiter called "PurpleHire" for ~10 minutes — no resume upload, no scheduling.
- The recruiter gets each candidate back with a **1.0–10.0 fit score**, a one-line AI verdict ("Strong React fundamentals, missing design system experience"), and the full chat transcript.
- For candidates scoring 8 or above, the recruiter clicks one button to open their default email with a pre-filled "next-round" invite.

There's also a **public demo** at `/demo` where anyone can try both sides without signing up. Nothing is saved.

Live at: **https://purplehire.vercel.app**

---

## 2. Why we built it

The job-application loop is broken in both directions.

**For recruiters:** they post a role on Ashby or Greenhouse and get 200+ applications. Most never get read. Screening calls take hours of calendar wrestling. Good candidates get lost in the pile. The people who could best evaluate the candidates spend their time on the people they're going to reject.

**For candidates:** they fill out the same form for the 14th time that month. Upload the same résumé. Get ghosted. Or worse — get a 12-minute call with someone who's clearly never seen their application.

We built PurpleHire because both sides hate this loop and nobody is fixing it. The bet is simple: a short, well-designed AI conversation can extract more useful signal in 10 minutes than a resume + a 30-minute screen + a take-home, with zero scheduling friction on either side.

It's also free for V1. The goal is feedback and adoption, not revenue yet.

---

## 3. Architecture

It's a **single Next.js app** that does both client rendering and server APIs. No separate backend service.

```
┌────────────────────────────────┐
│  Browser (Next.js client)      │
│  - Marketing landing           │
│  - Recruiter dashboard          │
│  - Candidate chat               │
│  - Demo flows                   │
└─────────────┬──────────────────┘
              │ HTTP/JSON
┌─────────────▼──────────────────┐
│  Next.js API routes             │
│  - /api/auth (NextAuth)        │
│  - /api/roles                  │
│  - /api/interviews/start, end  │
│  - /api/chat                   │
│  - /api/candidates/[id]        │
│  - /api/demo/{chat,score}      │
│  - /api/stats (admin only)     │
└──────┬──────────────┬──────────┘
       │              │
┌──────▼──────┐  ┌────▼─────────┐
│  Postgres   │  │   OpenAI     │
│ (Vercel/    │  │  gpt-4o      │
│  Neon)      │  │  gpt-4o-mini │
└─────────────┘  └──────────────┘
```

**End-to-end flow:**

1. Recruiter signs in via Google → NextAuth creates a User row in Postgres.
2. Recruiter pastes JD → `/api/roles` sends it to OpenAI (`gpt-4o-mini`) which validates it's actually a JD and extracts a structured interview plan (must-haves, nice-to-haves, skills to probe, red flags). Saved with a short random slug.
3. Recruiter shares the candidate link `purplehire.vercel.app/i/<slug>`.
4. Candidate opens it, enters name + email → `/api/interviews/start` creates a Candidate + Conversation row.
5. Candidate chats. Each message hits `/api/chat`, which builds a dynamic system prompt from the role's JD and plan, sends the message history to `gpt-4o`, and stores both sides of the conversation.
6. When the bot calls `end_interview` (or a 10-minute idle timer fires), `scoreInterview` runs — another `gpt-4o-mini` call on the full transcript that returns `{score: 8.4, verdict: "..."}` saved on the Candidate row.
7. Recruiter sees the candidate appear on their dashboard with score + verdict + transcript.

---

## 4. Frontend — Next.js + React + TypeScript + Tailwind

### What we picked

- **Next.js 16** with Pages Router
- **React 18**
- **TypeScript** throughout
- **Tailwind CSS** with a custom design system
- **Fredoka + JetBrains Mono** via `next/font/google`
- CSS animations that mirror Framer Motion semantics (`fm-fade-up`, `fm-pulse-dot`, etc.) so we can swap to actual `<motion.X>` later without redesigning anything

### Why Next.js (and not Vue / Remix / Astro / SvelteKit)

- **Single-language fullstack**: API routes and pages live in the same file tree, all TypeScript. We avoid running two servers, two type systems, two build pipelines.
- **SSR for protected pages** (`getServerSideProps`) plus **static generation for the demo** (`getStaticProps`) — both work natively, no plugins.
- **Built-in image, font, and route-level code splitting** — fewer decisions to make.
- **Vercel deploy is one command**. Push to GitHub, production updates within 60 seconds.
- React has the largest ecosystem — anything we need (auth, animation, charts) has a React-first library that "just works."

Astro and Remix would have been viable. We picked Next.js for the deploy story and the existing template velocity. Vue would have meant losing the bigger React ecosystem; Svelte same. SvelteKit's tooling is genuinely great, but we don't have time to bet on the smaller ecosystem.

### Why Pages Router (not App Router)

The project was already on Pages Router when we started. App Router is newer and conceptually cleaner, but migrating mid-flight would have cost a day with zero user-visible improvement. Pages Router covers every data-fetching pattern we need: server-side props for protected pages, static generation for marketing/demo, and standard API routes.

### Why Tailwind (not CSS Modules / styled-components / vanilla CSS)

- **Speed of iteration**: utility classes mean no context-switching between a component file and a CSS file when tweaking a margin.
- **No class-name collisions** ever — each component is self-contained.
- **A real design system** lives in `tailwind.config.js`: purple scale, glow shadows, the `fm-*` animations. Components reference these tokens, not hex codes.
- **Tree-shakes hard**: only utilities you actually use ship to the browser.

### Why TypeScript

The data model has lots of related entities (User → Role → Candidate → Conversation → Message). Prisma's generated types catch every misuse at compile time. Without TS, every refactor is dangerous.

### Why Fredoka

The brand wanted rounded and warm without being cute. Fredoka has weights 300–700, so we use one type family for everything from body to display.

---

## 5. Backend — Next.js API routes (no separate server)

### What we picked

- **Next.js API routes** as the backend, running on Vercel's serverless functions.
- **NextAuth 4** for Google sign-in, with the Prisma adapter.
- **Prisma 6** as the data-access layer.
- **OpenAI** SDK for LLM calls (`gpt-4o` for interviews, `gpt-4o-mini` for JD analysis + scoring).

### Why no separate Node / Go / Python backend

A separate API service would mean two deployments, two logging streams, two auth contexts, and an HTTP boundary between the client and server we wrote. For a project this size, that's pure overhead with no benefit.

Next.js API routes scale easily to medium-sized products. If we ever outgrow them, we can lift them into a standalone service behind the same API contract — none of our frontend would change.

### Why NextAuth (not Clerk / Auth0 / Supabase Auth)

- **Free and self-hosted in the same Next.js app** — no third-party redirect dance beyond Google's.
- **Prisma adapter is first-class** — the User/Account/Session tables sit in the same Postgres next to Role and Candidate. Single source of truth, no synchronizing between two systems.
- **No vendor lock-in**: if we ever want to swap providers, our user table goes with us.

Clerk and Auth0 are great products. We didn't need them — corporate recruiters all have Google accounts. Adding a paid service for one button felt premature.

### Why Google-only sign-in (no email/password, no magic link)

Every corporate recruiter on the planet has a Google or Google Workspace account. Skipping email/password means we never write password reset code, never store hashes, never deal with email verification edge cases. Magic links are the natural V2 if anyone asks — NextAuth supports them with ~10 lines of config.

### Why OpenAI (and which models, and why not Anthropic / Gemini)

- `gpt-4o` for the interview conversation. The interview needs structured tool calls (`end_interview`), state tracking (which question is next), and warm on-brief copy. `gpt-4o` handles all three reliably.
- `gpt-4o-mini` for the JD analyzer and the scorer — both are single-turn, JSON-mode calls (`response_format: { type: "json_object" }`) where we need extraction, not reasoning. Mini is ~10× cheaper for the same task quality on bounded prompts.

Anthropic Claude or Google Gemini would also work. We picked OpenAI for V1 because of tool-calling stability and our existing familiarity. All LLM code lives in three files (`openaiService.ts`, `jdAnalyzer.ts`, `interviewScorer.ts`) so swapping providers later is a day of work, not a rewrite.

---

## 6. Database — PostgreSQL via Prisma (and why not MongoDB)

### What we picked

- **PostgreSQL**, hosted as **Vercel Postgres** (Neon under the hood).
- **Prisma 6** as the ORM.
- Schema synced via `prisma db push` instead of migrations for speed of iteration.

### Why Postgres, not MongoDB

This is the biggest "why this not that" call in the project. We considered Mongo early — it's familiar and ships everywhere — but Postgres won for four reasons:

1. **The data is highly relational.**
   `User → Role → Candidate → Conversation → Message`. Every operation walks these relationships. Deleting a role cascades to all its candidates, their conversations, and their messages. Doing that correctly in Mongo means writing cascade logic by hand — and getting it wrong means orphaned data in production. Postgres gives us foreign keys and `onDelete: Cascade` rules for free.

2. **We get ACID transactions out of the box.**
   The role-delete endpoint runs `prisma.$transaction(async tx => { ... })` and deletes messages → conversations → candidates → role atomically. If any step fails, the whole thing rolls back. Mongo has multi-document transactions but they're an afterthought and expensive on the free tier.

3. **JSON columns when we want flexibility.**
   The LLM's interview plan (`{must_haves: [...], red_flags: [...]}`) is stored as a JSON-serialized string on the Role row. Postgres gives us schema flexibility *where we want it*, not as the default for everything. With Mongo, every field is loose; with Postgres + a JSON column, the fields we want strict stay strict.

4. **Vercel Postgres free tier just works.**
   Click "create database" on Vercel, copy the URL, paste into `DATABASE_URL`. Zero infra config. Mongo Atlas free tier is fine too, but the integration story with Vercel is rougher.

### Why Prisma (not raw SQL / Drizzle / TypeORM)

- **Type-safe queries derived from the schema file** — no string-typed `find` calls, no hand-written types.
- **`prisma db push` syncs the schema during dev** without writing migration files. Fast iteration. On deploy, `vercel-build` runs the same command so prod stays in lockstep.
- **Good ergonomics for nested reads** like `include: { candidates: { include: { conversations: { include: { messages: true } } } } }` — the result is fully typed.

Drizzle would have been the close second; we picked Prisma for the more mature tooling (Studio, db push, the Prisma Adapter for NextAuth).

### Why we didn't use Supabase

Supabase is a great product, but for our shape:
- We don't need a hosted auth product (NextAuth covers it).
- We don't need a row-level-security frontend-to-DB pattern (our frontend never talks to the DB directly; everything goes through Next.js API routes).
- We don't need their realtime / storage / edge-function bundle.

Using Supabase would have meant paying for features we don't use and adding RLS configuration for tables that should just be server-only. Vercel Postgres gives us the bare DB and that's exactly what we want.

---

## 7. How this project helps others

### For recruiters (especially small teams)
- **Get hours back every week.** No more reviewing 200 applications. The AI does the first pass; you only meet the top 5%.
- **Affordable.** Free for V1. No per-seat pricing, no per-candidate fees. Built for teams that can't afford Ashby's enterprise tier.
- **Honest signal.** The bot doesn't fake-polite candidates who clearly don't fit. If a must-have is missing, it says so. Recruiters trust the scores because they're not inflated.
- **Stays inside the recruiter's workflow.** "Send next-round email" opens *your* email client (Gmail, Outlook, whatever), with the candidate's email + a personalized draft. The candidate gets a message from you, not from "noreply@purplehire.com."

### For candidates
- **No form filling.** No same-résumé-15th-time. No 12-question intake.
- **No scheduling.** Take the interview when you want, where you want, on your phone or laptop.
- **Faster decisions.** Recruiter sees your score within minutes of you finishing.
- **Honest exits.** If you're not a fit, the bot tells you up front instead of sending you the "we'll be in touch" email that never lands.

### For hiring teams generally
- **Better candidate signal per minute.** A focused 10-minute conversation beats a generic 30-minute screen.
- **Audit trail.** Every candidate has a full transcript. You can re-read the conversation when reviewing the score, or hand it to a hiring manager who wasn't on the original call.
- **Multilingual handling already.** The bot replies in whatever language the candidate writes in.

### Who we're not for (yet)
- Large enterprises with existing ATS integrations and procurement teams — we don't have SOC 2, SSO, or contract pricing.
- Roles requiring formal credentials or licensing checks — we're not a background-check service.
- Anyone who needs voice-mode interviews — that's coming next, not shipped yet.

---

## Want more?

- **`README.md`** — quick start, setup, env vars.
- **`ARCHITECTURE.md`** — deeper architecture walkthrough, including the interview prompt design, the server-side closing-detection safety net, and the assumptions we're choosing not to fight.
