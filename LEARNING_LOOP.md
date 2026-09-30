# Learning Loop v1 — "every interview makes the next one better"

Outcome-calibrated memory. NOT model retraining, NOT an MCP server. It is
orchestration + pgvector. Each completed interview writes a datapoint; each new
interview reads similar past datapoints to calibrate scoring toward the
recruiter's real bar.

## What it learns
1. **Your bar (calibration)** — where its score disagrees with your decision, it shifts its scale, per role + per recruiter.
2. **Comparison, not cold guessing** — a new candidate is scored relative to similar past candidates and what you decided about them.
3. (v2) Which questions actually separated shortlisted from rejected candidates.

## Data model
New table `InterviewMemory` (pgvector):
- `id, roleId, recruiterId, candidateId, conversationId`
- `embedding vector(1536)` — embedding of a **distilled, competency-focused
  summary** of the transcript (strengths/concerns/competency notes + answer
  content), NOT raw PII.
- `aiScore Float?`, `recommendation String?`
- `decision String?` — recruiter ground truth (shortlisted/maybe/rejected), filled/updated when they decide
- `competencySignals Json` — from the EvaluationReport
- `createdAt`

## Write path (on interview complete)
In `scoreInterview`, after the EvaluationReport is produced:
1. Build the distilled summary (reuse report fields, strip name/school/location/age).
2. Embed it (`text-embedding-3-small`).
3. Insert an `InterviewMemory` row with aiScore + recommendation + competencySignals.
On recruiter decision (PATCH `decision`): update that row's `decision` (the ground-truth label).

## Read path (on new interview scoring)
In `scoreTranscript`, before final scoring:
1. Embed the new candidate's distilled summary.
2. Query top-K similar memories `WHERE roleId = ? AND decision IS NOT NULL`
   (only learn from decided interviews), scoped to this recruiter/role.
3. Build a calibration block: "Similar past candidates for this role: scored
   7.2 -> SHORTLISTED; scored 8.1 -> REJECTED (weak testing); ..." and feed it
   into the scoring prompt as anchors.
4. Scorer aligns its number to those outcomes.

## Guards (non-negotiable)
- **Bias guard**: embed only job-relevant signal; strip protected/PII
  attributes (name, age, school, location, gender cues) from both the stored
  summary and the calibration block. Protected attributes can never become
  features. Auditable logs.
- **Tenant isolation**: memory queried only within the same recruiterId/roleId.
- **Cold start**: if fewer than N (~5) decided memories for the role, skip
  calibration and behave exactly as today. Turns on gradually.
- **Consent**: a consent line before reusing candidate transcripts as learning
  data (ties into the GDPR item).
- **Eval gate**: before trusting calibration, run it against held-out decided
  interviews; ship only if scores move TOWARD recruiter decisions, not away.

## Infra
OpenAI embeddings + existing Postgres/pgvector. No new services. `report`
(EvaluationReport) from the overhaul is the source material, which is why this
builds AFTER the overhaul merges.
