import Head from "next/head";
import Link from "next/link";

type MockCandidate = {
  initial: string;
  name: string;
  meta: string;
  tags: string[];
  fit: number;
};

const MOCK_CANDIDATES: MockCandidate[] = [
  {
    initial: "M",
    name: "Maya R.",
    meta: "ex-Stripe · 4y",
    tags: ["React", "TS", "Systems"],
    fit: 94,
  },
  {
    initial: "D",
    name: "Daniel K.",
    meta: "ex-Linear · 5y",
    tags: ["React", "Perf"],
    fit: 91,
  },
  {
    initial: "P",
    name: "Priya S.",
    meta: "ex-Vercel · 4y",
    tags: ["Next.js", "DX"],
    fit: 87,
  },
];

function fitColor(fit: number) {
  if (fit >= 90) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (fit >= 75) return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  return "bg-red-500/15 text-red-300 border-red-500/30";
}

export default function Home() {
  return (
    <>
      <Head>
        <title>PurpleHire — AI interviews for any job description</title>
        <meta
          name="description"
          content="Paste a JD. Share a link. Get a scored shortlist of candidates back."
        />
        <link rel="icon" href="/PurpleHire.png" />
      </Head>

      <main className="min-h-screen bg-black text-white">
        {/* Nav */}
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-500 text-sm font-bold text-white">
              P
            </span>
            <span className="text-base font-semibold">PurpleHire</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/signin"
              className="rounded-md px-3 py-1.5 text-white/70 transition hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signin"
              className="rounded-md bg-white px-3 py-1.5 font-medium text-black transition hover:bg-white/90"
            >
              Get started
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-12 pb-20 lg:grid-cols-2 lg:gap-16 lg:pt-20">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
              </span>
              AI recruiter · live
            </div>

            <h1 className="mb-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              AI interviews for{" "}
              <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text italic text-transparent">
                any
              </span>{" "}
              job description.
            </h1>

            <p className="mb-8 max-w-lg text-lg text-white/60">
              Paste a JD, get scored candidates back. PurpleHire screens,
              interviews and ranks applicants while you sleep — so you only
              meet the top 5%.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-500 px-5 py-3 font-medium text-white transition hover:bg-purple-400"
              >
                Sign in to get started
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 font-medium text-white/90 transition hover:bg-white/10"
              >
                <span aria-hidden>▶</span>
                Try a sample interview
              </Link>
            </div>

            <p className="mt-8 text-xs text-white/40">
              Trusted by hiring teams · 12k+ interviews this month
            </p>
          </div>

          {/* Mock candidate panel */}
          <div className="flex items-center">
            <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Job description
                  </p>
                  <p className="text-sm font-medium">
                    Senior React Engineer · Series B fintech
                  </p>
                </div>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                  Parsed
                </span>
              </div>

              <div className="mb-3 flex items-center justify-between border-t border-white/5 pt-3">
                <p className="text-xs uppercase tracking-wide text-white/40">
                  Top candidates
                </p>
                <p className="text-xs text-white/40">47 interviewed</p>
              </div>

              <ul className="space-y-2">
                {MOCK_CANDIDATES.map((c) => (
                  <li
                    key={c.name}
                    className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/40 p-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                      {c.initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {c.name}
                        </p>
                        <p className="truncate text-xs text-white/40">
                          {c.meta}
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${fitColor(c.fit)}`}
                      >
                        {c.fit}
                      </span>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">
                        Fit
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3 text-xs text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                3 interviews in progress · last completed 2 min ago
              </div>
            </div>
          </div>
        </section>

        {/* 3-step explainer */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Paste the JD",
                body: "Role, skills, must-haves — we extract them automatically.",
              },
              {
                step: "02",
                title: "We run interviews",
                body: "Voice + chat, on candidates' time. No scheduling.",
              },
              {
                step: "03",
                title: "Pick the top 5%",
                body: "Ranked shortlist with transcripts and signal.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="mb-3 text-xs font-medium tracking-wider text-white/40">
                  STEP {s.step}
                </p>
                <p className="mb-2 text-lg font-semibold">{s.title}</p>
                <p className="text-sm text-white/60">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-white/40">
          PurpleHire · AI interviews for any job description
        </footer>
      </main>
    </>
  );
}
