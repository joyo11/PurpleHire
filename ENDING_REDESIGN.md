# PurpleHire interview-ending redesign (expert-panel synthesis)

# PurpleHire Interview-End Redesign: Decision Doc

## 1. Problems in the current code

- **`openaiService.ts:204-234` (forced second pass)** is the primary defect. When no tool fired but `looksLikeClosing(text)` is true, it re-calls the model with `tool_choice` forced to `end_interview`. A forced tool call cannot decline, so any goodbye-shaped token guarantees termination. The model's own politeness ("best of luck") becomes the exit signal, a self-fulfilling loop. Verified in source.
- **`interviewPrompt.ts:143-175` (hard-exit rule)** bundles "Refusal to answer questions paired with apparent disengagement" into `not_interested`, and explicitly brands both "wait to confirm" and "Are you sure?" as bugs. Verified: the prompt trains out the one recovery behavior the system needs.
- **`inferEndFromText.ts:38-69`** treats bot prose as a control signal, classifying a `wrapPhrase` in the bot's own text into an end reason.
- **`chat.ts:146-176`** collapses any non-empty `endInterviewReason` into `status:"completed"`, a one-way absorbing transition. No server-owned decline counter; the LLM "counts" strikes silently and non-deterministically.
- **`CandidateChat.tsx:221,365,370`** sets `ended` purely from `status==="completed"`, hard-disables the composer, shows a terminal card. No confirmation, no un-end, no recovery surface.

## 2. Panel reasoning and convergence

All seven experts converged on four non-negotiables: (a) **no single short response ever auto-terminates** (Q8, unanimous); (b) **kill the forced-end-from-bot-text path** (openaiService.ts:204-234) rather than tune its regex, since bot prose is not candidate intent; (c) **ambiguity defaults to stay**, and "No"/"skip"/"I don't know"/silence/frustration/input-method requests are all ambiguous; (d) **refusing one question is a skip, not an exit**. The CTO and ML engineer pushed the sharpest structural point: end authority must be server-owned, not inferred, and clarification must *gate* the tool rather than sit downstream. The recruiter and candidate-experience experts framed the human cost (misreading the most engaged/most anxious candidates). The UX designer contributed the concrete recovery affordance: three action chips, not an "Are you sure?" binary. The only real tension was chips-vs-confirmation-modal; resolved in favor of chips because a binary modal nags genuine leavers and trains "yes"-spam.

## 3. Interview state machine (server-authoritative)

States: `active → clarifying → active | ended`.

- **`active`**: normal Q&A. The LLM may *propose* an end via `end_interview`; it never *causes* one.
- **`clarifying`**: entered on any ambiguous signal or a proposed end without prior confirmation. Server increments a `declineCount` it owns and injects the three-way choice. The chat pauses closing prose.
- **`ended`**: reached only via (a) an explicit structured **End** click/confirmation, (b) `end_interview` fired *after* the server already recorded one confirmed decline, (c) all required questions answered, (d) turn cap, or (e) technical/idle failure.

The counter lives in code the server persists, never in the model's head. This kills the "LLM adjudicates AND counts" problem.

## 4. Termination and clarification rules

**EXPLICIT end** (honored immediately, skips clarification): candidate clicks the **End interview** chip, OR first-person unambiguous termination of the *whole* interview: "end the interview," "I withdraw," "I'm done," "stop the interview," "I'm not interested in the job," "I have to go." Bot text never qualifies.

**AMBIGUOUS** (never ends; routes to `clarifying`): "No," "skip," "next," "I don't know," one-word negatives, silence, frustration, profanity, and any input-method request ("can I speak").

**Clarification turn** (rendered once per ambiguous signal, as chips + text): *"No problem. We can keep going in text, skip this question, or wrap up here. What works?"* Chips: **Continue with text · Skip this question · End interview**.

**Confirmations required**: an explicit end chip needs one confirm tap (one to choose End, one to confirm). An ambiguous signal needs a *second, consistent* explicit end after the clarification turn. Two confirmed declines on the *same* question → skip and advance, never end.

## 5. Edge cases

- **"No" / one-word negative** → clarify (this is the failure case; "No" to "requires text" means "no, I won't type," not "terminate").
- **"skip" / "I don't know" / "next"** → skip chip behavior: mark question unanswered, advance pointer.
- **Silence** → clarify on re-engagement; only the 10-min idle timeout ends (unchanged).
- **Irrelevant answer** → treat as an answer, log, continue (no strike escalation to end).
- **Frustration / profanity** → distressed human, de-escalate warmly, offer the three chips; never an end trigger.
- **Input-method request ("I'd like to speak")** → accommodation: acknowledge the text constraint warmly, offer continue-with-text (and voice when available).
- **Abuse / repeated hostility** → allowed as a legitimate end, but only after the clarify turn, so it is confirmed not misread.

## 6. UX changes

Add three action chips above the composer, rendered only when the server enters `clarifying` (friction or proposed end). Chat stays pure during normal Q&A so chips do not read as an exit ramp every turn. Chips: **Skip this question · Continue with text · End interview**. Clicking Continue returns to `active`; Skip advances; End triggers the one-tap confirm. Remove the unconditional `ended`-disables-composer coupling so a clarifying state keeps the composer live.

## 7. Voice-mode forward compatibility

The intent taxonomy is modality-agnostic. The three options must be speakable ("skip," "continue," "end") and read aloud; chips are the visual mirror of a spoken menu. "I'd like to speak" becomes a *fulfillable* offer routed through the same classifier and clarify state, not a dead end. Build the accommodation branch now.

## 8. Files/functions to change

- **`openaiService.ts`**: DELETE the forced-end second pass (204-234) and `looksLikeClosing` (48-57). Replace `end_interview`'s auto-parse with a `classify_turn` tool returning `{intent, confidence}`; only `intent=end ∧ confidence≥0.85` may *propose* end.
- **`interviewPrompt.ts:143-175`**: rewrite the hard-exit section. Separate refuse-one-question from exit-interview; remove the "waiting to confirm is a bug" and "Are you sure? is a bug" lines; instruct the model to propose (not force) ends and to offer the three-way choice on ambiguity.
- **`inferEndFromText.ts`**: remove from the end path entirely (bot prose is not a control signal).
- **`chat.ts` / `demo/chat.ts`**: implement the state machine + server-owned `declineCount`; gate the `completed` transition behind explicit-or-confirmed intent; keep the turn cap and idle paths.
- **`CandidateChat.tsx`**: render chips on `clarifying`; decouple composer-disable from a non-terminal state; add the End-confirm step.
- **Schema**: add `state` (`active|clarifying|ended`), `declineCount`, per-question `skipped` flags, and keep `endReason`.

## 9. Phased plan

1. **Stop the bleeding (ship first):** delete forced-end pass + `inferEndFromText` classification; add server guard "no single short response → `ended`." Low risk, kills the live bug.
2. **State machine + counter:** add `clarifying` state, `declineCount`, skip-advance logic in `chat.ts`/`demo/chat.ts` + schema.
3. **Prompt rewrite + `classify_turn` tool** with calibrated confidence gate.
4. **UX chips + End-confirm** in `CandidateChat.tsx`.
5. **Voice compatibility pass** once voice ships: wire spoken chip equivalents through the same classifier.

Key files confirmed against source: `openaiService.ts:204-234`, `interviewPrompt.ts:143-175`.
