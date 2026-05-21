import Head from "next/head";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Head>
        <title>PurpleHire — AI interviews for any job description</title>
        <meta
          name="description"
          content="Paste a job description, share a link, get scored candidate interviews back."
        />
        <link rel="icon" href="/PurpleHire.png" />
      </Head>
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <p className="mb-4 inline-block rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-white/60">
            For recruiters
          </p>
          <h1 className="mb-6 text-4xl font-semibold sm:text-5xl">
            AI interviews for any job description.
          </h1>
          <p className="mb-10 max-w-xl text-base text-white/60 sm:text-lg">
            Paste your JD. Share a link. Get a scored shortlist of candidates
            without scheduling a single phone screen.
          </p>
          <Link
            href="/signin"
            className="rounded-lg bg-white px-6 py-3 text-base font-medium text-black transition hover:bg-white/90"
          >
            Sign in to get started
          </Link>

          <div className="mt-20 grid w-full gap-6 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="mb-2 text-2xl">1.</p>
              <p className="text-sm text-white/70">
                Sign in with Google and paste your job description.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="mb-2 text-2xl">2.</p>
              <p className="text-sm text-white/70">
                We generate a shareable interview link tuned to your role.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="mb-2 text-2xl">3.</p>
              <p className="text-sm text-white/70">
                Candidates take the interview; you get scores and transcripts.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
