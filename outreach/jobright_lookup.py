#!/usr/bin/env python3
"""
Drive Shafay's real Chrome (already signed into Jobright) to look up
work emails by LinkedIn profile URL.

Workflow per URL:
  1. Fill the LinkedIn URL into the Find Any Email input.
  2. Click the search icon button.
  3. Wait for the "Contact Info Found" sidebar to appear (or for a
     "no contact" notice). If neither, treat as NOT_FOUND.
  4. Click the "Connect Now" button to open the email modal.
  5. Read the email from the modal.
  6. Close the modal.

Reuses the same Jobright tab across all lookups (faster, fewer page
loads). Targets the tab by URL match so it doesn't follow whatever
the user has clicked on.

Requires Chrome's View > Developer > Allow JavaScript from Apple Events.

Usage:
  python3 jobright_lookup.py URL1 [URL2 ...]
  python3 jobright_lookup.py -                  # read URLs from stdin
"""
import subprocess
import sys
import time
import re
import json

JOB_URL = "https://jobright.ai/jobs/info/69b4770006c1ba00c545e7f3"
HOST_URL_NEEDLE = "jobright.ai/jobs/info/"
EMAIL_RE = re.compile(r"[\w.+\-]+@[\w\-]+\.[\w.\-]+")


def osa(applescript: str) -> str:
    r = subprocess.run(
        ["osascript", "-e", applescript],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return r.stdout.strip()


def find_host_tab_index() -> int | None:
    """Find the 1-based tab index whose URL contains the Jobright job
    needle. Returns None if not found."""
    raw = osa(
        '''tell application "Google Chrome"
  set out to ""
  set tabList to tabs of window 1
  repeat with i from 1 to count of tabList
    set out to out & i & "|" & URL of (item i of tabList) & "\\n"
  end repeat
  out
end tell'''
    )
    for line in raw.splitlines():
        if "|" not in line:
            continue
        idx_s, url = line.split("|", 1)
        if HOST_URL_NEEDLE in url:
            try:
                return int(idx_s)
            except ValueError:
                pass
    return None


def js_on_tab(tab_idx: int, code: str) -> str:
    """Execute JS in a specific tab and return result as text."""
    escaped = code.replace("\\", "\\\\").replace('"', '\\"')
    script = (
        f'tell application "Google Chrome" to '
        f"execute (tab {tab_idx} of window 1) javascript \"{escaped}\""
    )
    return osa(script)


def reload_to_job(tab_idx: int):
    """Navigate the specified tab to the Jobright job URL."""
    osa(
        f'''tell application "Google Chrome"
  set URL of (tab {tab_idx} of window 1) to "{JOB_URL}"
end tell'''
    )


def minimize_chrome():
    """Send Chrome's window to the dock so it doesn't distract while the
    lookup runs. AppleScript can still execute JS on a minimized window."""
    osa(
        '''tell application "Google Chrome"
  if (count of windows) > 0 then
    set miniaturized of window 1 to true
  end if
end tell'''
    )


def open_host_tab() -> int:
    """Ensure there's a Jobright job tab open and return its index."""
    idx = find_host_tab_index()
    if idx is not None:
        # Confirm it actually has the Find Any Email widget loaded.
        ready = js_on_tab(
            idx,
            "document.querySelector('[class*=\"find-any-email\"]') ? 'yes' : 'no'",
        )
        if ready == "yes":
            return idx
        # Otherwise navigate it to the job URL.
        reload_to_job(idx)
    else:
        osa(
            f'''tell application "Google Chrome"
  make new tab at end of tabs of window 1 with properties {{URL:"{JOB_URL}"}}
end tell'''
        )

    # Wait for the page + widget to render.
    for _ in range(40):
        time.sleep(1)
        idx = find_host_tab_index()
        if idx is None:
            continue
        ready = js_on_tab(idx, "document.readyState")
        if ready == "complete":
            found = js_on_tab(
                idx,
                "document.querySelector('[class*=\"find-any-email\"]') ? 'yes' : 'no'",
            )
            if found == "yes":
                time.sleep(1)
                return idx
    raise RuntimeError("Jobright job page didn't load the email widget in time")


def _sidebar_fingerprint(tab_idx: int) -> str:
    """Returns a fingerprint of the current 'Contact Info Found' card
    (its full visible text) so we can tell when it updates after a new
    search. Empty string when no card is showing."""
    return js_on_tab(
        tab_idx,
        """
(function() {
  const t = document.body.innerText || '';
  const m = t.match(/Contact Info Found[\\s\\S]{0,300}Connect Now/i);
  return m ? m[0].trim() : '';
})()
""".strip(),
    )


def lookup_one(tab_idx: int, linkedin_url: str, last_email: str | None = None) -> str | None:
    """Run one lookup. Returns the email string or None.

    Strategy: hard-reload the Jobright tab between lookups so the modal
    can't show cached data from a previous person. Then fill, click,
    wait for Connect Now, read modal email.
    """
    # Reload the host tab to clear any stale state. Jobright's Connect
    # Now modal serves cached data from previous lookups otherwise.
    reload_to_job(tab_idx)
    for _ in range(20):
        time.sleep(1)
        ready = js_on_tab(tab_idx, "document.readyState")
        if ready == "complete":
            found = js_on_tab(
                tab_idx,
                "document.querySelector('[class*=\"find-any-email\"]') ? 'yes' : 'no'",
            )
            if found == "yes":
                time.sleep(1)
                break
    else:
        return None

    # Step 1: fill input via the React-safe native setter.
    fill_js = f"""
(function() {{
  const container = document.querySelector('[class*=\"find-any-email\"]');
  if (!container) return 'NO_CONTAINER';
  const input = container.querySelector('input');
  if (!input) return 'NO_INPUT';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, {json.dumps(linkedin_url)});
  input.dispatchEvent(new Event('input', {{bubbles: true}}));
  return 'OK';
}})()
""".strip()
    if js_on_tab(tab_idx, fill_js) != "OK":
        return None

    # Step 2: click the search icon button. Pure click, no Enter, since
    # dispatching keyboard events appears to interfere with Jobright's
    # input handlers and cancels the search.
    click_js = """
(function() {
  const container = document.querySelector('[class*="find-any-email"]');
  const btn = container?.querySelector('button');
  if (!btn) return 'NO_BUTTON';
  btn.click();
  return 'OK';
})()
""".strip()
    if js_on_tab(tab_idx, click_js) != "OK":
        return None

    # Step 3: wait for Jobright to finish its lookup. 5 seconds is
    # enough for most lookups; for slow ones we'll retry the Connect
    # Now click below.
    time.sleep(5)

    # Step 4: try clicking the "Connect Now" button. If the button
    # doesn't appear in time, Jobright found no contact.
    found_connect = False
    for _ in range(15):
        result = js_on_tab(
            tab_idx,
            """
(function() {
  const btns = Array.from(document.querySelectorAll('button'));
  const target = btns.find(b => (b.innerText || '').trim().toLowerCase() === 'connect now');
  if (!target) return 'NO_BUTTON';
  if (target.disabled) return 'DISABLED';
  target.click();
  return 'OK';
})()
""".strip(),
        )
        if result == "OK":
            found_connect = True
            break
        time.sleep(1)
    if not found_connect:
        return None

    # Step 5: poll the modal for an email. Reject the previous result
    # so we never return stale data even if the modal re-renders slowly.
    email = None
    for _ in range(20):
        time.sleep(1)
        result = js_on_tab(
            tab_idx,
            """
(function() {
  const modal = document.querySelector('.ant-modal-content, [role="dialog"], [class*="modal-content"]');
  if (!modal) return 'WAIT';
  const inputs = Array.from(modal.querySelectorAll('input'));
  const re = /^[\\w.+\\-]+@[\\w\\-]+\\.[\\w.\\-]+$/;
  const match = inputs.find(i => re.test((i.value || '').trim()));
  if (match) return 'EMAIL:' + match.value.trim();
  return 'WAIT';
})()
""".strip(),
        )
        if result.startswith("EMAIL:"):
            candidate = result[len("EMAIL:"):]
            if last_email and candidate == last_email:
                continue
            email = candidate
            break

    # Step 6: close the modal so the next lookup starts clean.
    js_on_tab(
        tab_idx,
        """
(function() {
  const closeBtn = document.querySelector('.ant-modal-close, [aria-label="Close"], button[aria-label*="close" i]');
  if (closeBtn) { closeBtn.click(); return 'X'; }
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', code:'Escape', keyCode:27, which:27, bubbles:true}));
  return 'ESC';
})()
""".strip(),
    )
    time.sleep(1)

    # Step 7: clear input so next iteration starts clean.
    js_on_tab(
        tab_idx,
        """
(function() {
  const i = document.querySelector('[class*="find-any-email"] input');
  if (!i) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, '');
  i.dispatchEvent(new Event('input', {bubbles: true}));
})()
""".strip(),
    )

    return email


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == "-":
        urls = [
            line.strip()
            for line in sys.stdin
            if line.strip().startswith("http")
        ]
    else:
        urls = [u for u in sys.argv[1:] if u.startswith("http")]

    if not urls:
        print("no LinkedIn URLs given", file=sys.stderr)
        sys.exit(1)

    print(f"# opening Jobright host tab...", file=sys.stderr)
    tab_idx = open_host_tab()
    print(f"# host tab is index {tab_idx}, looking up {len(urls)} URL(s)\n", file=sys.stderr)
    # Minimize Chrome so the user doesn't see it bouncing around as we
    # drive the page. JS execution works on minimized windows.
    minimize_chrome()

    print("linkedin_url,email")
    last_email: str | None = None
    for url in urls:
        try:
            email = lookup_one(tab_idx, url, last_email=last_email)
            print(f"{url},{email if email else 'NOT_FOUND'}", flush=True)
            if email:
                last_email = email
        except Exception as e:
            print(f"{url},ERROR:{str(e)[:80]}", flush=True)


if __name__ == "__main__":
    main()
