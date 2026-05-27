# PurpleHire — Outreach CLI

Local-only tool for personalized cold outreach to recruiters from your Gmail. Not deployed.

**Pipeline:** add recruiters → Apollo finds the email → Claude/OpenAI drafts the message → you approve each one → sends from your Gmail → SQLite tracks status.

---

## One-time setup (5 minutes)

```bash
cd outreach
npm install
cp .env.example .env
```

Then edit `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | Reuse the one from the main project's `.env.local` |
| `APOLLO_API_KEY` | https://app.apolloapp.io → Settings → API → "Create API Key". Free tier: 50 credits/mo. |
| `GMAIL_USER` | `shafay11august@gmail.com` |
| `GMAIL_APP_PASSWORD` | **Not your normal Gmail password.** Enable 2-Step Verification on your Google account first, then generate one at https://myaccount.google.com/apppasswords (select "Mail" / "Other"). 16 chars, no spaces. |
| `SENDER_NAME` | Shafay |
| `SENDER_TITLE` | Solo dev, PurpleHire |
| `PRODUCT_URL` | https://purplehire.vercel.app/demo |

---

## Daily flow

### 1. Add recruiters (batch)

Create a CSV like `recruiters.csv`:

```csv
name,company,hook
Maya Chen,Anthropic,posted about AI hiring last week
Alex Patel,Vercel,leads engineering recruiting
Sara Kim,Linear,
```

Then:

```bash
npm run outreach -- import recruiters.csv
```

Or add them one at a time:

```bash
npm run outreach -- add --name "Maya Chen" --company "Anthropic" --hook "posted about AI hiring last week"
```

### 2. Look up emails

```bash
npm run outreach -- enrich
```

Each lookup costs 1 Apollo credit. Recruiters with no email found get auto-marked `skipped`.

### 3. Draft the emails

```bash
npm run outreach -- draft
```

OpenAI writes a 3–5 sentence personalized email for each enriched row. Uses the `hook` field if present. Stored in the db, not sent yet.

### 4. Review + send (one at a time)

```bash
npm run outreach -- review
```

Shows the subject and body for each draft. Press:
- `a` → approve and send via your Gmail
- `s` → skip permanently (marks `skipped`)
- `e` → edit subject only, then re-prompt
- `q` → quit (you can resume later)

Hard cap of **25 sends per day** to keep Gmail happy. Override with `--cap 50` (don't push it too high — new Gmail senders get flagged above ~50/day).

### 5. Track replies manually

The tool can't watch your inbox. When a recruiter replies (or the email bounces), mark it:

```bash
npm run outreach -- log 42 replied --note "wants a demo call thursday"
npm run outreach -- log 17 bounced
```

### 6. Check stats

```bash
npm run outreach -- status
```

Output:

```
Total recruiters: 47
  pending:  0
  enriched: 0
  drafted:  0
  sent:     38
  replied:  4
  bounced:  1
  skipped:  4

Sent today: 12 / 25
```

---

## Important rules baked in

- **No duplicates** — `(name, company)` is unique. `add` and `import` skip rows already in the db.
- **Daily cap** — 25 sends/day default. Protects your Gmail sender reputation.
- **Plain text only** — no HTML email. Looks like a personal email, not a marketing blast.
- **CAN-SPAM compliant** — every draft ends with the opt-out phrase "If not useful, just delete this — no follow-ups." and identifies the sender clearly.
- **One-shot** — the tool never auto-follows-up. If a recruiter doesn't reply, that's it.

---

## Files

- `cli.ts` — commander-based CLI entry point
- `db.ts` — SQLite schema + helpers
- `apollo.ts` — Apollo People Match API
- `draft.ts` — OpenAI prompt for personalized cold-email drafts
- `gmail.ts` — nodemailer Gmail SMTP
- `outreach.db` — SQLite file (created on first run, gitignored)
- `.env` — your secrets (gitignored)
