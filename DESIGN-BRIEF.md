# PurpleHire — Design brief

Paste this into Claude Design (or hand to any designer). Goal: a full UI pass that turns the current functional-but-flat app into something interactive, animated, and beautiful — without changing what each page *does*.

---

## Product in one paragraph

PurpleHire is a two-sided AI interview product. **Recruiters** paste a job description → get a shareable interview link → see a scored candidate inbox. **Candidates** open the link → chat with "PurpleHire" (an AI recruiter persona) → leave. The product replaces phone screens. Vibe should feel premium and modern but warm and playful — not corporate-cold.

## Brand

- **Primary**: black `#000` background, white `#fff` text.
- **Accent**: purple `#9333ea` (Tailwind `purple-500` is the anchor; `purple-400`/`purple-600` for gradients).
- **Status palette** (fit scores): emerald-500 / yellow-500 / red-500, each as 15% bg + 30% border + 300 text.
- **Type**: Fredoka (Google Font, weights 300–700) — already loaded.
- **Tone**: warm, professional, never robotic. Short copy, opinionated.
- **Purple is a *signal* color, not a flood.** Reserve it for: the brand letter mark "P", the primary CTA, live-status dots, the gradient word "any" in the hero. Everything else stays neutral. If a page reads as more than ~10% purple by area, it's too much.

## What to deliver

A multi-page Figma file (1440px desktop + 390px mobile per page) organized as:

```
00 · Cover & design system   (colors, type scale, spacing, shadows, all components in isolation)
01 · Marketing
02 · Auth
03 · Recruiter dashboard
04 · Role detail
05 · Transcript
06 · Candidate flow
07 · States & empties
```

For each page: hero mockup + annotated microinteractions + a small inset showing the mobile layout.

For each component (button, badge, candidate row, etc.): show isolated variants (default, hover, focus, disabled, loading).

Share the Figma file with view access. I'll translate to React + Tailwind + Framer Motion.

---

## Pages

### 1. Marketing landing — `/`

**Purpose**: convert visitors into recruiter sign-ups.

**Current shape**:
- Nav: logo "P · PurpleHire", "Sign in" link, "Get started" button.
- Hero (split layout):
  - Left: eyebrow badge ("AI recruiter · live" with pulsing dot) → headline "AI interviews for **any** job description" ("any" in purple gradient) → sub-paragraph → two CTAs ("Sign in to get started" purple, "Try a sample interview" ghost) → small social proof line.
  - Right: a mock recruiter card — parsed JD ("Senior React Engineer · Series B fintech" + "Parsed" badge), then "TOP CANDIDATES · 47 INTERVIEWED", three candidate rows (M Maya R. 94, D Daniel K. 91, P Priya S. 87) with fit-score badges and skill tags, then a footer "3 interviews in progress · last completed 2 min ago".
- 3-step explainer cards: 01 Paste the JD · 02 We run interviews · 03 Pick the top 5%.
- Footer.

**Microinteractions to design**:
- Hero badge: live dot pulses gently (2s loop).
- Headline reveal on first paint (no scroll trigger needed — page is short).
- Mock candidate panel: candidate rows stagger-fade in; one row could shimmer briefly as if "just scored"; the "+ in progress" counter increments occasionally.
- Primary CTA: hover = subtle purple glow + arrow nudges right.
- 3-step cards: stagger-reveal on scroll; on hover, soft purple left-border accent.

### 2. Sign in — `/signin`

**Purpose**: one-click Google sign-in.

**Current shape**: centered card on black, title + tagline + Google button.

**Microinteractions**:
- Card entrance: fade + slight upward translate.
- Google button: hover lift + slight inner glow; press = scale-down 0.98.
- After click: button morphs into a loading state ("Redirecting to Google…" with a small spinner). Logo subtly pulses while we wait for the redirect.

### 3. Recruiter dashboard — `/dashboard`

**Purpose**: create new interviews + see the recruiter's existing roles at a glance.

**Current shape**:
- Header: logo · avatar · email · Sign out.
- "Create an interview" card: role title input → big JD textarea → "Create interview" button.
- "Your interviews" list. Each row: title (links to detail) · date · completed count · in-progress count · "View candidates →" link · interview URL with Copy button.

**Microinteractions**:
- **Empty state**: friendly illustration + "No interviews yet — paste your first JD and we'll do the rest."
- JD textarea: focus = purple-tinted border + 1px glow; subtle character count appears bottom-right.
- "Create interview" button: while submitting, button text morphs through "Analyzing JD…" with a shimmering gradient. On success, the new role row slides in at the top of the list with a soft highlight that fades over 1.5s.
- Copy link button: morphs into "✓ Copied!" with a green tick; auto-reverts after 1.5s.
- Hover a role row: card lifts very slightly (translate-y 1px) + border becomes white/20.

### 4. Role detail — `/dashboard/[slug]`

**Purpose**: see every candidate who took this role's interview, sortable/filterable.

**Current shape**:
- "← All interviews" back link.
- Role header: title + meta ("Created May 22 · 4 candidates").
- Candidate link card: URL + Copy button.
- "Candidates" list. Each row: name · score badge · email · AI verdict · Transcript button.
- Bottom: full JD text in a monospace card.

**Microinteractions**:
- Score badges: count-up animation on first paint (0 → score over 600ms).
- Filter/sort bar above the candidate list: "All / Completed / In progress" pill toggle + a "Sort by: score / recency" dropdown. Design this — it doesn't exist yet but the page is starting to need it.
- Hover candidate row: subtle purple left-border accent (4px) slides in.
- Empty state: "No one's taken this interview yet. Share the link above to your candidates."

### 5. Transcript — `/dashboard/[slug]/[candidateId]`

**Purpose**: read the full bot↔candidate conversation and the AI's reasoning.

**Current shape**:
- Back link to role detail.
- Candidate header: name + score badge + email + "AI verdict" callout box + conversation status line.
- Full message transcript: bot ("P" avatar) on the left with grey bubble; candidate on the right with white bubble.

**Microinteractions**:
- AI verdict callout: subtle purple-to-transparent gradient border; key phrases (e.g. "strong React fundamentals", "missing Linux experience") highlighted by the LLM and rendered with a soft purple underline.
- Sticky candidate header on scroll, condensing into a slim bar.
- Messages: gentle fade-in on initial load (stagger by 30ms).
- Add an action menu in the header: "Export PDF", "Email candidate", "Mark reviewed". Design where it lives.

### 6. Candidate landing — `/i/[slug]` (pre-interview)

**Purpose**: convince the candidate to enter name + email and start the interview.

**Current shape**: centered card · eyebrow "You've been invited to an AI interview" · role title (big) · explanation paragraph · name input · email input · "Start interview" button.

**Microinteractions**:
- Background: very slow drifting purple-to-black gradient on the edges (~30s loop), so the page feels alive even before they engage.
- Inputs: clean focus state with purple-tinted border; inline email validation.
- "Start interview" button: on press, morphs into "Connecting to PurpleHire…" + the AI's "P" avatar slides in from the left and the card transitions into the chat view.

### 7. Candidate chat — `/i/[slug]` (during interview)

**Purpose**: have the candidate actually take the interview.

**Current shape**: header (role title + candidate name) · scrolling message list · typing indicator while bot thinks · input + send button · "Interview complete" card when done.

**Microinteractions**:
- Bot messages type out character-by-character at ~25 chars/sec (already an effect in the legacy codebase — bring it back as the default).
- Candidate messages slide in from the right with a 200ms ease-out.
- Typing indicator: three dots that animate in a wave, with the bot's "P" avatar visible.
- Send button: while waiting for the bot, morphs into a small spinner.
- "Interview complete" card: animates in with a soft purple pulse around the border (not confetti — that's overkill for a job interview).
- A persistent "Powered by PurpleHire" mark in the corner — small but always visible.

---

## Animation principles

- All animations < 300ms unless there's a *reason* (e.g. a typing effect).
- `ease-out` for entrances, `ease-in-out` for state changes, `ease-in` for exits.
- Respect `prefers-reduced-motion` — drop to instant transitions.
- Animations should feel like *physics*, not Disney. Subtle.
- Never block interaction during animation. The user can always click through.

## States to design for every page

- Loading skeleton (what shows while SSR data is being fetched on a slow connection)
- Empty state (no candidates, no roles)
- Error state (e.g. JD rejected as "not a job description")
- Success/confirmation state

## Implementation notes (so you don't design something I can't build)

- Stack: Next.js 16 (Pages Router), Tailwind, TypeScript.
- I'll use **Framer Motion** for non-trivial animations, pure Tailwind for hover/focus.
- Font is **Fredoka** via `next/font/google` (already wired).
- Existing reusable bits to preserve: gradient-purple primary button, status badges (emerald/yellow/red), the right-side mock candidate panel.
- All pages must work on mobile (390px). Show mobile insets for each.

## What I want back

- The Figma file (link with view access).
- A short note on anything you'd recommend cutting or rethinking.
- Spec for any *new* component you propose (filter pills, sticky headers, action menus) shown isolated.

That's it. Make it beautiful.
