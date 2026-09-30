# Interview Completion Redesign — proposed approach (not yet implemented)

## Core principle
The AI is the interviewer, so **the AI owns completion**. The candidate owns
only two things: **participating** (answer / skip) and **the exit door**
(leave). "The interview finished" and "the candidate bailed" are different
events with different statuses. We never let a single weak/short/"I don't know"
answer, or a skip, end the interview.

## The completion brain (server-authoritative coverage tracker)
Completion is decided by the **server**, from an evidence-coverage model, not by
the bot's prose and not by the candidate.

- The interview plan already yields competencies + must-haves. We track an
  **evidence level per competency**: `none | weak | some | strong`.
- Each turn, the interviewer model returns a small structured signal alongside
  its reply: which competency the last answer addressed and the evidence level
  it added. The server aggregates this into a coverage map (stored in
  `Conversation.metadata`, no schema migration).
- **Completion fires when** (server logic, in priority order):
  1. Hard cap: `questionsAsked >= MAX_QUESTIONS` (safeguard, ~12-14). Always ends.
  2. Coverage target met AND `questionsAsked >= MIN_QUESTIONS` (~4): every
     must-have competency is `some`/`strong`. Ends naturally.
  3. Diminishing returns: no competency has improved for K consecutive turns
     (e.g. 3) and `questionsAsked >= MIN_QUESTIONS`. Ends naturally.
- **Follow-ups**: the model asks a follow-up when the last answer left a still-
  needed competency at `weak`/`some`; it moves on when the competency is
  `strong`, or after a per-competency follow-up cap (~2), or when the candidate
  clearly can't speak to it (two non-answers on the same topic).
- Reaching the last planned question with a must-have still `none`/`weak` →
  the AI asks targeted follow-ups up to the cap; if still lacking at the hard
  cap, it completes anyway and the **report** marks that competency "Not enough
  evidence." The candidate is never penalized in-session.

## Candidate UX (preserve current visual design)
- **Composer**: the answer box + a **subtle secondary "Skip question"** (small
  text button, not a prominent chip). No "End interview" button next to it.
- **Leave**: a quiet "Leave interview" in a top-right overflow (⋯) / link, away
  from the primary actions. Clicking opens a confirmation:
  "Leave the interview? It will be marked **incomplete** and may not be
  reviewed. [Stay] [Leave anyway]". Only an explicit confirm leaves.
- **Completion**: natural closing message: "Thanks, that's everything I needed.
  Your responses have been submitted to the hiring team." No score, no
  pass/fail, no "you were weak."
- **Optional** progress hint: a soft "Question 3" / progress bar that never
  reveals a hard length or implies judgement. (Recommend: subtle "In progress"
  dot, no numeric count, to avoid gaming.)

## The welcome / readiness gate (separate from questions)
- Turn 0 is a **readiness gate**, not a question. UI: "Ready to begin?"
  [I'm ready] (primary) and an optional [Not yet].
- If the candidate says "No"/"not yet": warm pre-interview reply ("No rush,
  start whenever you're ready"), stay in `welcome`. **"Skip question" does not
  appear in `welcome`** (skip only exists in `active`). Readiness "No" is never
  treated as an interview answer.
- Readiness "Yes" → `active` + first real question.

## State machine
`welcome -> active -> wrapping -> completed`
with `active -> left_early` (confirmed leave) and `* -> disconnected` (idle
timeout without a terminal). Persisted in `Conversation.status` + `metadata`.

## Statuses (distinct, not "all terminations are equal")
- **Completed** — AI decided coverage/cap reached. Green.
- **Incomplete · Left early** — candidate confirmed Leave. Amber.
- **Disconnected** — went idle past the end threshold with no terminal / no
  Leave. Gray. (Resumable: see below.)
Recruiter surfaces (dashboard, role page, candidate page) show these; left_early
and disconnected map to `incomplete` in the evaluation report ("Not enough
evidence"), never a punitive low score.

## Edge cases (decisions)
- **"No" at welcome** → stay in welcome, reassure, no skip chip, not a question.
- **Multiple skips** → allowed; skipped competencies stay `none`; if must-haves
  remain uncovered at the cap → Completed but report flags "Not enough evidence"
  on those.
- **"I don't know"** → weak evidence; at most one gentle reframe, then move on.
  Never an end.
- **Irrelevant answers** → redirect once ("Let's focus on X"); still not an end.
  (Abuse/NSFW stays on the existing moderation + red_flag path.)
- **Stops responding** → soft "still there?" at ~2-3 min, then mark
  **Disconnected** (not Completed, not Left early) after a longer idle.
- **Disconnect + return** → reloading `/i/[slug]` resumes the same in-progress
  conversation from stored state + coverage (don't start fresh, don't double-
  count). Requires resuming by conversationId, cookie/localStorage handoff.
- **Enough evidence early** → wrap up once coverage met and `>= MIN_QUESTIONS`;
  don't drag to a fixed length.
- **Last planned question but a key competency still lacking** → targeted
  follow-ups up to the cap, then complete + report the gap.

## Never during the interview
No "you failed / unqualified / low score" to the candidate, ever. All evaluation
lives in the recruiter report.

## Implementation footprint (when approved)
- `interviewPrompt.ts`: model emits per-turn coverage signal + follow-up
  guidance; strip candidate-facing end authority and the 3-equal-choice framing.
- `chat.ts`: coverage tracker + MIN/MAX/follow-up caps + readiness gate +
  completion decision + status differentiation (`completed` / `left_early` /
  `disconnected`). Builds on the current server-authoritative state machine.
- `CandidateChat.tsx`: remove End chip; subtle Skip + Leave-in-overflow +
  confirm modal; readiness UI; completion screen; resume-on-reload.
- `interviews/end` + `flag`/idle: distinguish left_early vs disconnected.
- Scorer/report: already emit "Not enough evidence" for incomplete (shipped);
  map left_early/disconnected to it.
- No Prisma migration needed (coverage in metadata; status/endReason already
  exist). Recruiter status chips reuse the dashboard work just shipped.

## Open choices for Shafay
1. Progress indicator: subtle "in progress" dot (recommended) vs "Question N".
2. MAX_QUESTIONS ceiling: recommend ~12-14; MIN ~4.
3. Resume-on-return: build now (recommended, it's the disconnected story) or
   defer and treat disconnect as terminal for v1.
