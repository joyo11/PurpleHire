import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetStaticProps } from "next";
import { SAMPLE_ROLES, type SampleRole } from "@/lib/sampleRoles";
import DemoChat from "@/components/DemoChat";
import {
  PHLogo,
  PHInput,
  PHButton,
  PHEyebrow,
  ArrowRight,
  Sparkle,
  ChevronLeft,
} from "@/components/ph";

type Props = {
  roles: Pick<SampleRole, "key" | "title" | "blurb">[];
};

type Started = {
  roleKey: string;
  roleTitle: string;
  candidateName: string;
};

export default function DemoPage({ roles }: Props) {
  const [roleKey, setRoleKey] = useState<string>(roles[0]?.key ?? "");
  const [name, setName] = useState("");
  const [started, setStarted] = useState<Started | null>(null);

  const selected = roles.find((r) => r.key === roleKey);

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (!roleKey || !name.trim() || !selected) return;
    setStarted({
      roleKey,
      roleTitle: selected.title,
      candidateName: name.trim(),
    });
  }

  if (started) {
    return (
      <>
        <Head>
          <title>{started.roleTitle} · Demo · PurpleHire</title>
        </Head>
        <DemoChat
          roleKey={started.roleKey}
          roleTitle={started.roleTitle}
          candidateName={started.candidateName}
          onRestart={() => setStarted(null)}
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Demo · PurpleHire</title>
        <meta
          name="description"
          content="Try a sample PurpleHire interview without signing up."
        />
      </Head>
      <main className="ph-radial-purple relative min-h-screen text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-5 sm:px-8 sm:pt-6 lg:px-12">
          <Link href="/" className="flex items-center gap-2">
            <PHLogo size="md" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Home
          </Link>
        </header>

        <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-3xl place-items-center px-4 py-10 sm:px-8 sm:py-16">
          <div className="w-full">
            <div className="mb-6 flex justify-center">
              <PHEyebrow live>Try a sample interview</PHEyebrow>
            </div>
            <h1 className="mb-3 text-center text-[34px] font-medium leading-[1.05] tracking-tight sm:text-[44px]">
              Play with PurpleHire as a candidate.
            </h1>
            <p className="mx-auto mb-10 max-w-[520px] text-center text-[15px] leading-relaxed text-white/65 sm:text-[16px]">
              Pick a role, give us a name, and chat with the AI recruiter.
              Nothing is saved — it&apos;s just for you to feel what the
              experience is like.
            </p>

            <form
              onSubmit={start}
              className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-card-lift sm:p-7"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-purple-500/15 p-1.5 text-purple-300">
                  <Sparkle className="h-full w-full" />
                </div>
                <h2 className="text-[16px] font-medium tracking-tight sm:text-[18px]">
                  Pick a role
                </h2>
              </div>

              <div className="mb-6 flex flex-col gap-2">
                {roles.map((r) => (
                  <button
                    type="button"
                    key={r.key}
                    onClick={() => setRoleKey(r.key)}
                    className={`flex items-start gap-3 rounded-2xl border bg-white/[0.02] p-4 text-left transition-all ${
                      roleKey === r.key
                        ? "border-purple-500/40 shadow-glow-purple-sm"
                        : "border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        roleKey === r.key
                          ? "border-purple-400 bg-purple-500"
                          : "border-white/25"
                      }`}
                    >
                      {roleKey === r.key && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-medium text-white">
                        {r.title}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-white/55">
                        {r.blurb}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <PHInput
                label="Your name (for the bot to use)"
                placeholder="e.g. Sam"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="given-name"
              />

              <div className="mt-6">
                <PHButton
                  type="submit"
                  size="lg"
                  iconRight={<ArrowRight />}
                  className="w-full"
                  disabled={!name.trim() || !roleKey}
                >
                  Start the demo interview
                </PHButton>
              </div>

              <p className="mt-4 text-center text-[11px] text-white/40">
                Nothing about this conversation is stored on our servers.
              </p>
            </form>

            <p className="mt-8 text-center text-[13px] text-white/55">
              Want to run a real interview against your own JD?{" "}
              <Link
                href="/signin"
                className="text-purple-300 underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  return {
    props: {
      roles: SAMPLE_ROLES.map(({ key, title, blurb }) => ({ key, title, blurb })),
    },
  };
};
