#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { parse } from "csv-parse/sync";
import {
  insertRecruiter,
  listByStatus,
  updateRecruiter,
  countsByStatus,
  sentToday,
  db,
  type Recruiter,
} from "./db.js";
import { enrichRecruiter } from "./apollo.js";
import { generateDraft } from "./draft.js";
import { sendCold, verifyTransport } from "./gmail.js";

const DAILY_CAP = 25;

const program = new Command();
program
  .name("outreach")
  .description("PurpleHire recruiter outreach — enrich, draft, send via Gmail");

program
  .command("status")
  .description("Show counts by status + sends today")
  .action(() => {
    const c = countsByStatus();
    const today = sentToday();
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    console.log(`\nTotal recruiters: ${total}`);
    console.log(`  pending:  ${c.pending}`);
    console.log(`  enriched: ${c.enriched}`);
    console.log(`  drafted:  ${c.drafted}`);
    console.log(`  sent:     ${c.sent}`);
    console.log(`  replied:  ${c.replied}`);
    console.log(`  bounced:  ${c.bounced}`);
    console.log(`  skipped:  ${c.skipped}`);
    console.log(`\nSent today: ${today} / ${DAILY_CAP}\n`);
  });

program
  .command("add")
  .description("Add a single recruiter")
  .requiredOption("--name <name>", "Full name")
  .requiredOption("--company <company>", "Company")
  .option("--email <email>", "Work email (skips Apollo lookup if provided)")
  .option("--hook <hook>", "One-line context for personalization")
  .action((opts: { name: string; company: string; email?: string; hook?: string }) => {
    const r = insertRecruiter({
      name: opts.name,
      company: opts.company,
      email: opts.email,
      hook: opts.hook,
    });
    if (!r) {
      console.log(`Already in DB: ${opts.name} @ ${opts.company}`);
      return;
    }
    console.log(`#${r.id}  ${r.name} @ ${r.company}  [${r.status}]`);
  });

program
  .command("import")
  .description("Import recruiters from a CSV (columns: name,company[,hook][,email])")
  .argument("<csv-path>")
  .action((csvPath: string) => {
    const file = path.resolve(csvPath);
    if (!fs.existsSync(file)) {
      console.error(`Not found: ${file}`);
      process.exit(1);
    }
    const rows = parse(fs.readFileSync(file, "utf-8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;
    let added = 0;
    let dup = 0;
    for (const row of rows) {
      const name = row.name || row.Name;
      const company = row.company || row.Company;
      if (!name || !company) continue;
      const r = insertRecruiter({
        name,
        company,
        hook: row.hook || row.Hook || undefined,
        email: row.email || row.Email || undefined,
      });
      if (r) added++;
      else dup++;
    }
    console.log(`Imported: ${added} new · ${dup} duplicates skipped (of ${rows.length} rows)`);
  });

program
  .command("enrich")
  .description("Run Apollo lookup on every 'pending' recruiter to find email")
  .option("--limit <n>", "Max to enrich this run", "50")
  .action(async (opts: { limit: string }) => {
    const limit = Math.max(1, parseInt(opts.limit, 10));
    const pending = listByStatus("pending").slice(0, limit);
    if (pending.length === 0) {
      console.log("Nothing pending.");
      return;
    }
    console.log(`Enriching ${pending.length} recruiter(s)…`);
    let found = 0;
    let missing = 0;
    for (const r of pending) {
      process.stdout.write(`  ${r.name} @ ${r.company} … `);
      try {
        const result = await enrichRecruiter(r.name, r.company);
        if (result.email) {
          updateRecruiter(r.id, {
            email: result.email,
            title: result.title,
            linkedin_url: result.linkedinUrl,
            apollo_confidence: result.confidence,
            status: "enriched",
          });
          console.log(`✓ ${result.email} (conf ${result.confidence})`);
          found++;
        } else {
          updateRecruiter(r.id, { status: "skipped", notes: "no email from apollo" });
          console.log("× no email");
          missing++;
        }
      } catch (err) {
        console.log(`! ${(err as Error).message}`);
        break;
      }
    }
    console.log(`\nDone: ${found} found · ${missing} missing`);
  });

program
  .command("draft")
  .description("Generate personalized email drafts for every 'enriched' recruiter")
  .option("--limit <n>", "Max to draft this run", "50")
  .action(async (opts: { limit: string }) => {
    const limit = Math.max(1, parseInt(opts.limit, 10));
    const ready = listByStatus("enriched").slice(0, limit);
    if (ready.length === 0) {
      console.log("Nothing to draft.");
      return;
    }
    console.log(`Drafting ${ready.length} email(s)…`);
    const senderName = process.env.SENDER_NAME ?? "Shafay";
    const senderTitle = process.env.SENDER_TITLE ?? "Solo dev, PurpleHire";
    const productUrl = process.env.PRODUCT_URL ?? "https://purplehire.vercel.app/demo";
    for (const r of ready) {
      try {
        const d = await generateDraft({
          recruiter: r,
          senderName,
          senderTitle,
          productUrl,
        });
        updateRecruiter(r.id, {
          draft_subject: d.subject,
          draft_body: d.body,
          status: "drafted",
        });
        console.log(`  ✓ #${r.id} ${r.name}`);
      } catch (err) {
        console.log(`  ! #${r.id} ${r.name}: ${(err as Error).message}`);
      }
    }
  });

program
  .command("review")
  .description("Approve and send drafts one at a time")
  .option("--cap <n>", "Override the daily send cap", String(DAILY_CAP))
  .action(async (opts: { cap: string }) => {
    const cap = Math.max(1, parseInt(opts.cap, 10));
    await verifyTransport().catch((err) => {
      console.error(`Gmail SMTP error: ${(err as Error).message}`);
      process.exit(1);
    });
    const drafted = listByStatus("drafted");
    if (drafted.length === 0) {
      console.log("Nothing to review.");
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let sentNow = sentToday();
    for (let i = 0; i < drafted.length; i++) {
      if (sentNow >= cap) {
        console.log(`\nDaily cap reached (${cap}). Come back tomorrow.\n`);
        break;
      }
      const r = drafted[i];
      console.log(
        `\n[${i + 1}/${drafted.length}] #${r.id} · ${r.name} · ${r.company}`,
      );
      console.log(`  ${r.email ?? "(no email!)"}  (conf ${r.apollo_confidence ?? "?"})`);
      console.log(`\nSubject: ${r.draft_subject}`);
      console.log(`-----`);
      console.log(r.draft_body);
      console.log(`-----`);
      const answer = (await rl.question("[a]pprove, [s]kip, [e]dit-subject, [q]uit: "))
        .trim()
        .toLowerCase();
      if (answer === "q") break;
      if (answer === "s") {
        updateRecruiter(r.id, { status: "skipped" });
        continue;
      }
      if (answer === "e") {
        const newSubj = await rl.question("New subject: ");
        if (newSubj.trim()) {
          updateRecruiter(r.id, { draft_subject: newSubj.trim() });
          i--; // re-show
          continue;
        }
      }
      if (answer === "a") {
        if (!r.email) {
          console.log("Skipping — no email on file.");
          updateRecruiter(r.id, { status: "skipped" });
          continue;
        }
        try {
          await sendCold({
            to: r.email,
            subject: r.draft_subject ?? "",
            body: r.draft_body ?? "",
          });
          updateRecruiter(r.id, {
            status: "sent",
            sent_at: new Date().toISOString(),
          });
          sentNow++;
          console.log(`  → sent (${sentNow}/${cap} today)`);
        } catch (err) {
          console.log(`  ! send failed: ${(err as Error).message}`);
        }
      }
    }
    rl.close();
  });

program
  .command("log")
  .description("Manually update a recruiter's status (e.g. after a reply)")
  .argument("<id>", "Recruiter id")
  .argument("<status>", "replied | bounced | skipped")
  .option("--note <note>", "Optional note")
  .action((idStr: string, statusStr: string, opts: { note?: string }) => {
    const id = parseInt(idStr, 10);
    const row = db
      .prepare<[number], Recruiter>("SELECT * FROM recruiters WHERE id = ?")
      .get(id);
    if (!row) {
      console.error(`No recruiter #${id}`);
      process.exit(1);
    }
    const allowed = ["replied", "bounced", "skipped"] as const;
    if (!allowed.includes(statusStr as (typeof allowed)[number])) {
      console.error(`Status must be one of: ${allowed.join(", ")}`);
      process.exit(1);
    }
    const patch: Parameters<typeof updateRecruiter>[1] = { status: statusStr as Recruiter["status"], notes: opts.note ?? null };
    if (statusStr === "replied") patch.replied_at = new Date().toISOString();
    if (statusStr === "bounced") patch.bounced_at = new Date().toISOString();
    updateRecruiter(id, patch);
    console.log(`#${id} ${row.name} → ${statusStr}`);
  });

program.parseAsync(process.argv);
