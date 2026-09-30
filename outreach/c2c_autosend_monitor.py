#!/usr/bin/env python3
"""Watch Gmail Sent for the C2C batch; auto-open the next 10 drafts as each
batch is sent. Honors Shafay's rule (he hits Send; we only open drafts).

State: drafts 1-20 already opened by hand before this starts (opened=20).
Rule: when unsent-open drafts drop to <=10, open the next 10, until all 50.
"""
import csv, subprocess, time, imaplib, email, os, re
from pathlib import Path
from email.utils import getaddresses

ENV = Path("/Users/shafay11aug/PurpleHire/outreach/.env")
for line in ENV.read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))
USER = os.environ["GMAIL_USER"]; PASS = os.environ["GMAIL_APP_PASSWORD"]

RESUME = "/Users/shafay11aug/Downloads/Shafay_Joyo_Resume.pdf"
SUBJ = "Oracle Fusion / APEX / OIC + AI engineer, available C2C"
SENT_LIST = Path("/Users/shafay11aug/jobs/cold-outreach-sent.txt")
rows = list(csv.DictReader(open("/Users/shafay11aug/PurpleHire/outreach/c2c_final50.csv")))
all_emails = {r["email"].lower() for r in rows}

def body(fn, co):
    return f"""Hi {fn},

I am an engineer working through Consult America Inc., available on a C2C basis. I build on Oracle Fusion Cloud with Oracle APEX and Oracle Integration Cloud (OIC), alongside modern AI and full-stack engineering. I wanted to introduce myself in case {co} has project or team needs where I could help.

I deliver low-code applications and REST/SOAP integrations on the Oracle stack, and I take AI products from idea to production, most recently PurpleHire, an AI hiring platform I built and shipped.

If you have upcoming project needs, I would welcome a quick chat. My resume is attached.

A bit of my work:
- PurpleHire, an AI hiring platform I built (100+ users in week one): https://purplehire.vercel.app
- Onbehalf, an autonomous browser agent that fills and submits ATS forms: https://onbehalfai.vercel.app
- Portfolio: https://shafayjoyo.vercel.app

Best,
Shafay
Available C2C via Consult America Inc.
shafay11august@gmail.com | (929) 433-7408 | linkedin.com/in/joyoshafay"""

def q(s): return s.replace("\\", "\\\\").replace('"', '\\"')
def open_draft(r):
    s=f'''tell application "Mail"
  set m to make new outgoing message with properties {{subject:"{q(SUBJ)}", content:"{q(body(r['first_name'],r['company']))}", visible:true}}
  tell m
    make new to recipient at end of to recipients with properties {{address:"{q(r['email'])}"}}
  end tell
  tell content of m
    make new attachment with properties {{file name:(POSIX file "{q(RESUME)}")}} at after the last paragraph
  end tell
end tell'''
    subprocess.run(["osascript","-e",s],check=True)

def sent_set():
    """Return the subset of our 50 that already appear in Gmail Sent Mail."""
    found=set()
    try:
        M=imaplib.IMAP4_SSL("imap.gmail.com"); M.login(USER,PASS)
        M.select('"[Gmail]/Sent Mail"', readonly=True)
        typ,data=M.search(None,'SUBJECT','"Oracle Fusion / APEX / OIC + AI engineer, available C2C"')
        for num in data[0].split():
            t,d=M.fetch(num,'(BODY.PEEK[HEADER.FIELDS (TO)])')
            raw=b" ".join(p[1] for p in d if isinstance(p,tuple) and p[1]) or b""
            for _,addr in getaddresses([raw.decode("utf-8","ignore")]):
                a=addr.lower().strip()
                if a in all_emails: found.add(a)
        M.logout()
    except Exception as e:
        print(f"[warn] imap: {e}",flush=True)
    return found

def already_logged():
    if not SENT_LIST.exists(): return set()
    return {l.strip().lower() for l in SENT_LIST.read_text().splitlines() if "@" in l}

opened = 20            # drafts 1-20 already open
logged = already_logged()
print(f"[monitor] start. opened={opened}, total=50", flush=True)

for it in range(240):          # ~6h cap at 90s
    sent = sent_set()
    n_sent = len(sent)
    # log newly-confirmed sends to dedup list
    new = sent - logged
    if new:
        with open(SENT_LIST,"a") as f:
            for a in sorted(new): f.write(a+"\n")
        logged |= new
        print(f"[monitor] logged {len(new)} newly-sent to dedup list", flush=True)
    # advance drafts: keep at most 10 unsent-open; open next 10 when caught up
    while opened < 50 and (opened - n_sent) < 10:
        nxt = rows[opened:opened+10]
        for r in nxt: open_draft(r)
        subprocess.run(["osascript","-e",'tell application "Mail" to activate'])
        print(f"[monitor] opened drafts {opened+1}-{opened+len(nxt)} (sent so far: {n_sent})", flush=True)
        opened += len(nxt)
    print(f"[monitor] sent={n_sent}/50, opened={opened}", flush=True)
    if n_sent >= 50:
        print("[monitor] all 50 sent. done.", flush=True); break
    time.sleep(90)
print("[monitor] exit", flush=True)
