/**
 * Jobright "Find Any Email" automation.
 *
 * First run: `npx tsx jobright.ts login`
 *   → Opens Chromium, you log into Jobright manually, hit Enter,
 *     storage state is saved to jobright-session.json so subsequent
 *     runs don't need to log in again.
 *
 * Lookup: `npx tsx jobright.ts lookup <linkedinUrl> [<linkedinUrl> ...]`
 *   → For each URL, visits a Jobright job page, uses the Find Any
 *     Email widget, prints "LINKEDIN_URL -> EMAIL" to stdout.
 *
 * Batch: `npx tsx jobright.ts batch <inputFile>`
 *   → Reads one LinkedIn URL per line from inputFile, prints CSV to
 *     stdout: linkedin_url,email
 */

import { chromium, BrowserContext, Page } from "playwright";
import fs from "fs";
import path from "path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
// Persistent Chrome profile directory. Survives between runs so the auth
// state captured at login (cookies, localStorage, sessionStorage, indexedDB)
// is reused. We do NOT use Playwright's storageState JSON because Jobright
// keeps auth in sessionStorage which storageState doesn't capture.
const PROFILE_DIR = path.join(HERE, "jobright-profile");

// Any job page works as the host for the Find Any Email widget. Using the
// one Shafay opened earlier as the default; can be overridden via env.
const JOB_URL =
  process.env.JOBRIGHT_JOB_URL ??
  "https://jobright.ai/jobs/info/6a26f4bb2056260dd6e842fd";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

async function ensureContext(headless = false): Promise<{
  context: BrowserContext;
}> {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport: { width: 1400, height: 900 },
  });
  return { context };
}

async function login() {
  const { context } = await ensureContext(false);
  const page = await context.newPage();
  await page.goto("https://jobright.ai/jobs");
  console.log(
    "\n>>> Log into Jobright in the open browser. As soon as the dashboard loads with personalized data (like 'Applied 202' or the Find Any Email widget), this script auto-saves and closes.\n",
  );
  // Auto-detect post-login: wait for a tab pill that only renders for
  // authenticated users with a personalized count, OR the Find Any Email
  // section. Up to 5 min to log in.
  await Promise.race([
    page.waitForSelector('text=/Applied\\s*\\d+/i', {
      timeout: 5 * 60_000,
    }),
    page.waitForSelector("text=/Find Any Email/i", {
      timeout: 5 * 60_000,
    }),
  ]);
  // Let sessionStorage / IndexedDB settle.
  await page.waitForTimeout(3000);
  console.log(`Saved profile to ${PROFILE_DIR}`);
  await context.close();
}

/**
 * Look up the work email for one LinkedIn profile URL via Jobright's
 * Find Any Email widget. Returns null if Jobright can't find one or the
 * widget times out.
 */
async function findEmail(page: Page, linkedinUrl: string): Promise<string | null> {
  // Re-visit the job page on each lookup so the widget starts from a
  // clean state. The reload is intentional: cached UI sometimes shows
  // the previous result and skips the search call.
  await page.goto(JOB_URL, { waitUntil: "domcontentloaded" });

  // Scroll to the Find Any Email section so it lazy-renders if needed.
  const heading = page.getByText(/Find Any Email/i).first();
  await heading.scrollIntoViewIfNeeded({ timeout: 15000 });

  // The input under the Find Any Email heading.
  const input = page
    .locator(
      'input[placeholder*="linkedin" i], input[type="text"]:near(:text("Find Any Email"))',
    )
    .first();
  await input.waitFor({ timeout: 15000 });
  await input.fill("");
  await input.fill(linkedinUrl);

  // Click the search icon (looks like a magnifying-glass button next to
  // the input). Use last() in case there are multiple.
  await page
    .locator(
      'button:near(:text("Find Any Email")), [role="button"]:near(:text("Find Any Email"))',
    )
    .first()
    .click({ timeout: 10000 });

  // Wait for either "Contact Info Found", a visible email string, or a
  // "not found" notice. We poll for 30s.
  const result = await Promise.race([
    page
      .getByText(/Contact Info Found/i)
      .first()
      .waitFor({ timeout: 30000 })
      .then(() => "found")
      .catch(() => null),
    page
      .locator(`text=${EMAIL_RE.source}`)
      .first()
      .waitFor({ timeout: 30000 })
      .then(() => "found")
      .catch(() => null),
    page
      .getByText(/no.*(email|contact)|not found/i)
      .first()
      .waitFor({ timeout: 30000 })
      .then(() => "not_found")
      .catch(() => null),
  ]);
  if (result !== "found") return null;

  // Grab the full DOM text and extract the first email-like substring
  // that appears AFTER the "Contact Info Found" or "Connect Via Email"
  // marker, so we don't pick up an email from elsewhere on the page.
  const full = await page.locator("body").innerText();
  const idx = Math.max(
    full.search(/Contact Info Found/i),
    full.search(/Connect Via Email/i),
  );
  const segment = idx >= 0 ? full.slice(idx) : full;
  const match = segment.match(EMAIL_RE);
  return match?.[0] ?? null;
}

async function lookup(urls: string[]) {
  if (!fs.existsSync(PROFILE_DIR)) {
    console.error(
      "No saved profile. Run `npx tsx jobright.ts login` first.",
    );
    process.exit(1);
  }
  const { context } = await ensureContext(false);
  const page = await context.newPage();
  try {
    for (const url of urls) {
      try {
        const email = await findEmail(page, url);
        console.log(`${url},${email ?? "NOT_FOUND"}`);
      } catch (e) {
        console.log(`${url},ERROR:${(e as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    await context.close();
  }
}

async function batch(file: string) {
  const urls = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("http"));
  console.log("linkedin_url,email");
  await lookup(urls);
}

const cmd = process.argv[2];
if (cmd === "login") {
  await login();
} else if (cmd === "lookup") {
  await lookup(process.argv.slice(3));
} else if (cmd === "batch") {
  if (!process.argv[3]) {
    console.error("usage: tsx jobright.ts batch <file>");
    process.exit(1);
  }
  await batch(process.argv[3]);
} else {
  console.log(`Usage:
  npx tsx jobright.ts login                          # one-time, saves session
  npx tsx jobright.ts lookup <url1> [<url2> ...]     # find one or more emails
  npx tsx jobright.ts batch <file>                   # CSV from a file of URLs`);
}
