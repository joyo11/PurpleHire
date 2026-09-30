"""Helper: create a Mac Mail draft with a file attachment via AppleScript.

Use instead of mailto: when you want recruiters/hiring managers to receive
the resume PDF as a real attachment they can drag into ATS systems.

Usage from another script:
    from mail_draft import open_draft_with_attachment
    open_draft_with_attachment(
        to="someone@example.com",
        subject="Re: SWE role",
        body="Hi ...",
        attachment_path="/Users/shafay11aug/Documents/Resume's/Shafay_Resume_final_V2.pdf",
    )
"""
import subprocess


def _quote(s: str) -> str:
    """Quote a string for AppleScript double-quoted literal."""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def open_draft_with_attachment(
    to: str,
    subject: str,
    body: str,
    attachment_path: str | None = None,
) -> None:
    """Create a Mail draft addressed to `to` with subject/body, optionally
    attach the file at `attachment_path`. The draft becomes visible so the
    user can review + click Send."""
    sub_q = _quote(subject)
    body_q = _quote(body)
    to_q = _quote(to)
    att_q = _quote(attachment_path) if attachment_path else ""

    attach_block = ""
    if attachment_path:
        # `tell content` is the canonical place to make new attachment.
        attach_block = f'''
  tell content of newMessage
    make new attachment with properties {{file name:(POSIX file "{att_q}")}} at after the last paragraph
  end tell
'''.rstrip()

    script = f'''
tell application "Mail"
  set newMessage to make new outgoing message with properties {{subject:"{sub_q}", content:"{body_q}", visible:true}}
  tell newMessage
    make new to recipient at end of to recipients with properties {{address:"{to_q}"}}
  end tell{attach_block}
  activate
end tell
'''.strip()

    subprocess.run(["osascript", "-e", script], check=True)


if __name__ == "__main__":
    # Smoke test: open a draft addressed to yourself with a tiny note.
    open_draft_with_attachment(
        to="shafay11august@gmail.com",
        subject="Test draft with attachment",
        body="If you see this in Mail and the resume PDF is attached, the helper works.",
        attachment_path="/Users/shafay11aug/Documents/Resume's/Shafay_Resume_final_V2.pdf",
    )
