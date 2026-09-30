#!/usr/bin/env python3
"""
Faster Jobright email lookup: drives N Chrome tabs (default 3) in parallel.

Each tab is its OWN Jobright host tab. We fire all N searches, share the
single render wait, then collect each tab's result FROM THAT SAME TAB, so a
URL is only ever paired with the email produced on its own tab (no
cross-contamination). ~N x faster than the single-tab version because the
per-lookup waiting overlaps across tabs.

Requires Chrome's View > Developer > Allow JavaScript from Apple Events
(verify with: osascript -e 'tell application "Google Chrome" to execute (active tab of window 1) javascript "1+1"').
ONLY ONE driver can use Chrome at a time — don't run alongside the single-tab tool.

Usage:
  cat urls.txt | python3 jobright_lookup_multi.py -            # 3 tabs (default)
  cat urls.txt | python3 jobright_lookup_multi.py - 4          # 4 tabs
"""
import subprocess, sys, time, json

JOB_URL = "https://jobright.ai/jobs/info/6a5f898833ef5c58b4ffe860"
HOST_URL_NEEDLE = "jobright.ai/jobs/info/"


def osa(applescript: str) -> str:
    r = subprocess.run(["osascript", "-e", applescript],
                       capture_output=True, text=True, timeout=30)
    return r.stdout.strip()


def js_on_tab(tab_idx: int, code: str) -> str:
    escaped = code.replace("\\", "\\\\").replace('"', '\\"')
    return osa(f'tell application "Google Chrome" to execute (tab {tab_idx} of window 1) javascript "{escaped}"')


def reload_to_job(tab_idx: int):
    osa(f'tell application "Google Chrome"\n  set URL of (tab {tab_idx} of window 1) to "{JOB_URL}"\nend tell')


def all_host_tab_indices() -> list[int]:
    raw = osa('''tell application "Google Chrome"
  set out to ""
  set tabList to tabs of window 1
  repeat with i from 1 to count of tabList
    set out to out & i & "|" & URL of (item i of tabList) & "\\n"
  end repeat
  out
end tell''')
    idxs = []
    for line in raw.splitlines():
        if "|" not in line:
            continue
        idx_s, url = line.split("|", 1)
        if HOST_URL_NEEDLE in url:
            try:
                idxs.append(int(idx_s))
            except ValueError:
                pass
    return idxs


def widget_ready(tab_idx: int) -> bool:
    if js_on_tab(tab_idx, "document.readyState") != "complete":
        return False
    return js_on_tab(tab_idx, "document.querySelector('[class*=\"find-any-email\"]') ? 'yes' : 'no'") == "yes"


def open_host_tabs(n: int) -> list[int]:
    """Ensure exactly n Jobright host tabs exist; return their indices."""
    have = all_host_tab_indices()
    for _ in range(max(0, n - len(have))):
        osa(f'tell application "Google Chrome"\n  make new tab at end of tabs of window 1 with properties {{URL:"{JOB_URL}"}}\nend tell')
        time.sleep(0.4)
    idxs = all_host_tab_indices()[:n]
    # wait for all to render the widget
    for _ in range(40):
        time.sleep(1)
        if all(widget_ready(i) for i in idxs):
            return idxs
    raise RuntimeError("Jobright host tabs didn't load the email widget in time")


FILL_TPL = """
(function() {{
  const c = document.querySelector('[class*="find-any-email"]');
  if (!c) return 'NO_CONTAINER';
  const input = c.querySelector('input');
  if (!input) return 'NO_INPUT';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, {url});
  input.dispatchEvent(new Event('input', {{bubbles: true}}));
  return 'OK';
}})()
"""

CLICK_JS = """
(function() {
  const c = document.querySelector('[class*="find-any-email"]');
  const btn = c?.querySelector('button');
  if (!btn) return 'NO_BUTTON';
  btn.click();
  return 'OK';
})()
""".strip()

CONNECT_JS = """
(function() {
  const btns = Array.from(document.querySelectorAll('button'));
  const t = btns.find(b => (b.innerText||'').trim().toLowerCase() === 'connect now');
  if (!t) return 'NO_BUTTON';
  if (t.disabled) return 'DISABLED';
  t.click();
  return 'OK';
})()
""".strip()

MODAL_JS = """
(function() {
  const m = document.querySelector('.ant-modal-content, [role="dialog"], [class*="modal-content"]');
  if (!m) return 'WAIT';
  const ins = Array.from(m.querySelectorAll('input'));
  const re = /^[\\w.+\\-]+@[\\w\\-]+\\.[\\w.\\-]+$/;
  const match = ins.find(i => re.test((i.value||'').trim()));
  if (match) return 'EMAIL:' + match.value.trim();
  return 'WAIT';
})()
""".strip()

CLOSE_JS = """
(function() {
  const x = document.querySelector('.ant-modal-close, [aria-label="Close"], button[aria-label*="close" i]');
  if (x) { x.click(); return 'X'; }
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', code:'Escape', keyCode:27, which:27, bubbles:true}));
  return 'ESC';
})()
""".strip()


def prep_and_fire(tab_idx: int, url: str) -> bool:
    """Fill + click search on this tab. Assumes tab already freshly reloaded
    and ready. Returns True if the search was fired."""
    if js_on_tab(tab_idx, FILL_TPL.format(url=json.dumps(url))) != "OK":
        return False
    return js_on_tab(tab_idx, CLICK_JS) == "OK"


def collect(tab_idx: int, last_email: str | None) -> str | None:
    """Click Connect Now then read the email from THIS tab's modal."""
    connected = False
    for _ in range(15):
        if js_on_tab(tab_idx, CONNECT_JS) == "OK":
            connected = True
            break
        time.sleep(1)
    if not connected:
        return None
    email = None
    for _ in range(20):
        time.sleep(1)
        r = js_on_tab(tab_idx, MODAL_JS)
        if r.startswith("EMAIL:"):
            cand = r[len("EMAIL:"):]
            if last_email and cand == last_email:
                continue
            email = cand
            break
    js_on_tab(tab_idx, CLOSE_JS)
    return email


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    n_tabs = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    if sys.argv[1] == "-":
        urls = [l.strip() for l in sys.stdin if l.strip().startswith("http")]
    else:
        urls = [u for u in sys.argv[1:] if u.startswith("http")]
    if not urls:
        print("no LinkedIn URLs given", file=sys.stderr); sys.exit(1)

    print(f"# opening {n_tabs} Jobright host tabs...", file=sys.stderr)
    tabs = open_host_tabs(n_tabs)
    print(f"# host tabs at indices {tabs}, looking up {len(urls)} URL(s)\n", file=sys.stderr)
    osa('tell application "Google Chrome"\n  if (count of windows) > 0 then set miniaturized of window 1 to true\nend tell')

    print("linkedin_url,email", flush=True)
    last = {t: None for t in tabs}
    done = 0
    for i in range(0, len(urls), len(tabs)):
        chunk = urls[i:i + len(tabs)]
        assigned = list(zip(tabs, chunk))   # (tab, url) pairs for this round
        # 1) reload all assigned tabs (async), then wait until all ready
        for tab, _ in assigned:
            reload_to_job(tab)
        ready_tabs = set()
        for _ in range(20):
            time.sleep(1)
            for tab, _ in assigned:
                if tab not in ready_tabs and widget_ready(tab):
                    ready_tabs.add(tab)
            if len(ready_tabs) == len(assigned):
                break
        # 2) fire all searches
        fired = []
        for tab, url in assigned:
            if tab in ready_tabs and prep_and_fire(tab, url):
                fired.append((tab, url))
            else:
                print(f"{url},NOT_FOUND", flush=True); done += 1
        # 3) shared wait for Jobright to run the lookups
        time.sleep(5)
        # 4) collect each tab's own result
        for tab, url in fired:
            try:
                email = collect(tab, last[tab])
            except Exception as e:
                print(f"{url},ERROR:{str(e)[:60]}", flush=True); done += 1; continue
            print(f"{url},{email if email else 'NOT_FOUND'}", flush=True)
            if email:
                last[tab] = email
            done += 1
        print(f"# progress {done}/{len(urls)}", file=sys.stderr)


if __name__ == "__main__":
    main()
