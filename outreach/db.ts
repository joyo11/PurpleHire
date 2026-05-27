import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "outreach.db");

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS recruiters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    email TEXT,
    title TEXT,
    linkedin_url TEXT,
    hook TEXT,
    draft_subject TEXT,
    draft_body TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    apollo_confidence INTEGER,
    sent_at TEXT,
    replied_at TEXT,
    bounced_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, company)
  );

  CREATE INDEX IF NOT EXISTS idx_recruiters_status ON recruiters(status);
  CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters(email);
`);

export type RecruiterStatus =
  | "pending"
  | "enriched"
  | "drafted"
  | "sent"
  | "replied"
  | "bounced"
  | "skipped";

export type Recruiter = {
  id: number;
  name: string;
  company: string;
  email: string | null;
  title: string | null;
  linkedin_url: string | null;
  hook: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  status: RecruiterStatus;
  apollo_confidence: number | null;
  sent_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  notes: string | null;
  created_at: string;
};

export function findRecruiter(
  name: string,
  company: string,
): Recruiter | undefined {
  return db
    .prepare<[string, string], Recruiter>(
      "SELECT * FROM recruiters WHERE LOWER(name) = LOWER(?) AND LOWER(company) = LOWER(?) LIMIT 1",
    )
    .get(name, company);
}

export function insertRecruiter(args: {
  name: string;
  company: string;
  hook?: string;
  email?: string;
}): Recruiter | null {
  const existing = findRecruiter(args.name, args.company);
  if (existing) return null;
  const stmt = db.prepare(
    "INSERT INTO recruiters (name, company, hook, email, status) VALUES (?, ?, ?, ?, ?)",
  );
  const status = args.email ? "enriched" : "pending";
  const info = stmt.run(
    args.name,
    args.company,
    args.hook ?? null,
    args.email ?? null,
    status,
  );
  return db
    .prepare<[number], Recruiter>("SELECT * FROM recruiters WHERE id = ?")
    .get(info.lastInsertRowid as number)!;
}

export function listByStatus(status: RecruiterStatus): Recruiter[] {
  return db
    .prepare<[string], Recruiter>(
      "SELECT * FROM recruiters WHERE status = ? ORDER BY id ASC",
    )
    .all(status);
}

export function updateRecruiter(
  id: number,
  patch: Partial<
    Pick<
      Recruiter,
      | "email"
      | "title"
      | "linkedin_url"
      | "apollo_confidence"
      | "draft_subject"
      | "draft_body"
      | "status"
      | "sent_at"
      | "replied_at"
      | "bounced_at"
      | "notes"
    >
  >,
): void {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE recruiters SET ${set} WHERE id = @id`).run({
    id,
    ...patch,
  });
}

export function countsByStatus(): Record<RecruiterStatus, number> {
  type Row = { status: RecruiterStatus; n: number };
  const rows = db
    .prepare<[], Row>("SELECT status, COUNT(*) as n FROM recruiters GROUP BY status")
    .all();
  const out: Record<string, number> = {
    pending: 0,
    enriched: 0,
    drafted: 0,
    sent: 0,
    replied: 0,
    bounced: 0,
    skipped: 0,
  };
  for (const r of rows) out[r.status] = r.n;
  return out as Record<RecruiterStatus, number>;
}

export function sentToday(): number {
  return (
    db
      .prepare<[], { n: number }>(
        "SELECT COUNT(*) as n FROM recruiters WHERE sent_at IS NOT NULL AND DATE(sent_at) = DATE('now', 'localtime')",
      )
      .get()!.n
  );
}
