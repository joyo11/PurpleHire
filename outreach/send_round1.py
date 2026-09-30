#!/usr/bin/env python3
"""Round 1 cold-email drafts (NYC/NJ engineering + clinics). Tailored per
vertical, resume attached. Usage: python3 send_round1.py <batch 1..5>"""
import sys, csv, time
sys.path.insert(0, "/Users/shafay11aug/PurpleHire/outreach")
from mail_draft import open_draft_with_attachment

RESUME = "/Users/shafay11aug/Documents/Resume's/Shafay_Resume_final_V2.pdf"
SIG = ("Best,\nShafay\nshafay11august@gmail.com | (929) 433-7408 | "
       "https://www.linkedin.com/in/joyoshafay")
PROOF = ("One thing I shipped: PurpleHire, an AI platform I built that reached "
         "100+ users in its first week: https://purplehire.vercel.app\n"
         "Portfolio: https://shafayjoyo.vercel.app")

ENG_HOOK = ("I build AI tools and automation, and the tedious parts of running an "
            "engineering firm, proposals and bids, takeoffs, reporting, scheduling and "
            "dispatch, are exactly the kind of thing I can streamline with custom software.")
CLINIC_HOOK = ("I build AI tools and automation, and the admin side of a practice, "
               "patient intake, scheduling, reminders, and follow-up paperwork, is exactly "
               "what I automate so your staff spends less time on busywork.")

def hook(v):
    return CLINIC_HOOK if v == "clinic" else ENG_HOOK

def subject(company):
    return f"NYC software engineer, could build {company} some time-saving tools"

def body(first, company, v):
    return (f"Hi {first},\n\n"
            f"I'm Shafay, a software engineer in NYC (MS in Computer Science from Columbia, "
            f"ex-Nutanix). {hook(v)}\n\n"
            f"{PROOF}\n\n"
            f"Would love to swap notes for 15 minutes and see if I could help {company}. "
            f"Resume attached.\n\n{SIG}")

rows = list(csv.DictReader(open("/Users/shafay11aug/PurpleHire/outreach/round1_final.csv")))
BATCH = 10
nbatches = (len(rows) + BATCH - 1) // BATCH
print(f"Total: {len(rows)} drafts, {nbatches} batches of {BATCH}.")

if len(sys.argv) < 2:
    print(f"Usage: python3 send_round1.py <batch 1..{nbatches}>")
    sys.exit(0)

b = int(sys.argv[1])
chunk = rows[(b-1)*BATCH : b*BATCH]
print(f"Opening batch {b}/{nbatches} ({len(chunk)} drafts)...")
for r in chunk:
    first = r["name"].split()[0]
    open_draft_with_attachment(
        to=r["email"], subject=subject(r["company"]),
        body=body(first, r["company"], r["vertical"]), attachment_path=RESUME)
    print(f"  draft -> {r['email']} ({r['company']})")
    time.sleep(0.6)
print("Done. Review + Send in Mail, then run the next batch.")
