#!/usr/bin/env python3
"""Scan Shafay's Gmail inbox for cold-outreach replies, bounces, and auto-replies.

Uses IMAP (same App Password as SMTP) to read INBOX only. Does NOT mark
messages as read, modify them, or touch any other folder.

Output: a tight report categorizing recent messages.
"""
import os
import imaplib
import email
import re
import sys
from datetime import datetime, timedelta
from email.utils import parseaddr, parsedate_to_datetime
from pathlib import Path

# Load .env
ENV_PATH = Path("/Users/shafay11aug/PurpleHire/outreach/.env")
for line in ENV_PATH.read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

USER = os.environ["GMAIL_USER"]
PASS = os.environ["GMAIL_APP_PASSWORD"]

# Hours back to look. Default 36 (covers Mon evening + all of Tue).
HOURS = int(sys.argv[1]) if len(sys.argv) > 1 else 36
since = datetime.now() - timedelta(hours=HOURS)

# Load the exclude list (every address we sent cold outreach to).
sent_to = set()
sent_path = Path("/Users/shafay11aug/jobs/cold-outreach-sent.txt")
if sent_path.exists():
    for line in sent_path.read_text().splitlines():
        line = line.strip().lower()
        if "@" in line:
            sent_to.add(line)

print(f"Scanning inbox for messages in last {HOURS}h from {since:%a %m/%d %H:%M}")
print(f"Cross-referencing against {len(sent_to)} cold-outreach addresses\n")

M = imaplib.IMAP4_SSL("imap.gmail.com")
M.login(USER, PASS)
M.select("INBOX", readonly=True)

# IMAP date format for SINCE: 1-Jun-2026
typ, data = M.search(None, f'(SINCE "{since:%d-%b-%Y}")')
ids = data[0].split()
print(f"Fetched {len(ids)} message IDs from inbox\n")

bounces = []
replies = []
auto_replies = []
other = []

BOUNCE_FROM_PATTERNS = re.compile(
    r"mailer-daemon|postmaster|noreply|no-reply", re.I
)
BOUNCE_SUBJECT_PATTERNS = re.compile(
    r"undelivered|undeliverable|delivery (failed|status notification)|failure notice|address (not found|rejected)|returned mail",
    re.I,
)
AUTO_REPLY_PATTERNS = re.compile(
    r"automatic reply|auto[- ]?reply|out of (office|the office)|out of office|on leave|away from|i am out|i'm out|currently out",
    re.I,
)

for msg_id in ids:
    typ, msg_data = M.fetch(msg_id, "(BODY.PEEK[HEADER])")
    if not msg_data or not msg_data[0]:
        continue
    msg = email.message_from_bytes(msg_data[0][1])
    sender = parseaddr(msg.get("From", ""))[1].lower()
    subject = msg.get("Subject", "")
    date_str = msg.get("Date", "")
    try:
        msg_date = parsedate_to_datetime(date_str)
        if msg_date.replace(tzinfo=None) < since.replace(tzinfo=None):
            continue
    except Exception:
        pass

    item = {"from": sender, "subject": subject, "date": date_str}

    # Bounce check
    if BOUNCE_FROM_PATTERNS.search(sender) or BOUNCE_SUBJECT_PATTERNS.search(subject):
        bounces.append(item)
    # Auto-reply (Vince Marin / Gail Keyser type)
    elif AUTO_REPLY_PATTERNS.search(subject):
        auto_replies.append(item)
    # Real reply from a cold-outreach recipient
    elif sender in sent_to:
        replies.append(item)
    else:
        other.append(item)

M.close()
M.logout()

# Report
print(f"=" * 60)
print(f"REPLIES from cold-outreach recipients: {len(replies)}")
print(f"=" * 60)
for r in replies:
    print(f"  {r['from']}")
    print(f"    Subject: {r['subject'][:80]}")
    print(f"    Date: {r['date']}")
    print()

print(f"\n=" * 60)
print(f"BOUNCES: {len(bounces)}")
print(f"=" * 60)
for b in bounces[:20]:
    print(f"  Subject: {b['subject'][:80]}")
    print(f"    From: {b['from']}")
    print()

print(f"\n=" * 60)
print(f"AUTO-REPLIES (out of office, retired, redirect): {len(auto_replies)}")
print(f"=" * 60)
for a in auto_replies:
    print(f"  {a['from']}")
    print(f"    Subject: {a['subject'][:80]}")
    print()

print(f"\n=" * 60)
print(f"SUMMARY")
print(f"=" * 60)
print(f"  Sent: {len(sent_to)}")
print(f"  Replies: {len(replies)}")
print(f"  Bounces: {len(bounces)}")
print(f"  Auto-replies: {len(auto_replies)}")
print(f"  Reply rate: {len(replies) / max(len(sent_to), 1) * 100:.1f}%")
print(f"  Bounce rate: {len(bounces) / max(len(sent_to), 1) * 100:.1f}%")
