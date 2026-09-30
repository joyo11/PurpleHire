# Cold-Email Agent — spec + loop

GOAL: 500 cold emails over 10 iterations of 50. Each iteration = pick a location + industry, find 50 decision-makers, look up emails, draft tailored, Shafay reviews + sends, then next.

## Who Shafay is (use in every email)
- Software engineer, NYC. MS in Computer Science, Columbia. Ex-Nutanix.
- Builds AI products end-to-end. Flagship: PurpleHire (AI hiring platform, 100+ users week one, Stripe tier). Also Onbehalf (autonomous job-application agent), The One With the AI (RAG + multi-agent, live), NetGuard (AI security co-pilot).
- F-1 STEM OPT, needs sponsorship eventually. Open to relocating ANYWHERE in the US.
- Resume PDF: /Users/shafay11aug/Documents/Resume's/Shafay_Resume_final_V2.pdf
- Email sign-off: "Best, Shafay" + shafay11august@gmail.com | (929) 433-7408 | linkedin.com/in/joyoshafay. No em dashes.

## The loop (per iteration)
1. Pick a LOCATION (any US state/metro) + INDUSTRY (rotate: see list).
2. Source ~80-120 real LinkedIn /in/ URLs of CEOs/founders/owners/decision-makers (via `site:linkedin.com/in` searches through research agents). Over-source because Jobright won't resolve all.
3. Look up emails: `tail -n +2 <targets>.csv | cut -d, -f1 | python3 jobright_lookup.py - > <emails>.csv` (drives Shafay's logged-in Chrome). Keep going until 50 emails resolve.
4. Draft 50 tailored emails (mail_draft.py, resume attached). Tailor the pitch to the industry (see angles).
5. Shafay reviews + sends (batches of ~10 so Mail doesn't choke).
6. Next iteration.

## Industry rotation (10 iterations)
1. NYC/NJ engineering (electrical/civil/mechanical) + clinics  ← iteration 1 (in progress)
2. CA Bay Area healthcare / hospitals / health-tech            ← iteration 2 (staged)
3. US automotive / car companies (Porsche, Rivian, dealership groups, auto-tech)
4. Gaming (studios + gaming-tech, any state)
5. Fintech (any state)
6. E-commerce / retail-tech
7. Biotech / pharma
8. Logistics / supply-chain tech
9. Real-estate / proptech + construction-tech
10. AI startups (broad, any state)
(Adjust freely; Shafay can swap any industry/location.)

## Pitch angles by target type
- Tech/AI companies → "I build AI products end to end; would love to build with you" (the PurpleHire/Onbehalf story). For SWE/AI roles.
- Non-tech firms (engineering, clinics, auto, logistics) → "I'm a software/AI engineer who can build you tools/automation" (intake, scheduling, dispatch, dashboards, AI assistants). Offer to chat / help, not "hire me as SWE."
- Always: 1 proof project (PurpleHire), personalized opener referencing THEM, low ask ("15 min").

## HARD CONSTRAINTS (be honest about these)
- **Jobright credits:** free tier will cap out well before 500 lookups. When lookups start returning all NOT_FOUND/errors, credits are likely spent → switch to guessing emails from each company's domain (web-search the email pattern + construct).
- **Gmail deliverability:** sending 500 cold emails from a personal Gmail risks spam-flagging + Gmail's ~500/day cap. PACE it: ~20-40 sends/day, not 500 at once. Reputation matters more than speed.
- **Quality:** keep per-industry tailoring so it's not pure spam (the Hushh win came from targeted + personalized).

## Files
- Targets staged: `nynj_targets.csv` (iter 1), `ca_healthcare_targets.csv` (iter 2).
- Emails resolved: `nynj_emails.csv`, etc.
- Tooling: `jobright_lookup.py` (email lookup), `mail_draft.py` (drafts w/ attachment).
