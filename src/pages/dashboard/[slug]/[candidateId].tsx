import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PHTopBar,
  PHAvatar,
  PHFitBadge,
  PHMessage,
  PHButton,
  Check,
  Download,
  Sparkle,
  ChevronLeft,
} from "@/components/ph";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
  candidate: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    score: number | null;
    verdict: string | null;
  };
  role: { slug: string; title: string };
  conversation: { status: string; endReason: string | null } | null;
  messages: Msg[];
};

function firstInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

function VerdictCallout({
  score,
  verdict,
}: {
  score: number | null;
  verdict: string | null;
}) {
  const onHundred = score === null ? null : score > 10 ? score : score * 10;
  const tier =
    score === null
      ? "Pending"
      : (score >= 8 ? "Strong fit" : score >= 5 ? "Mixed signal" : "Likely no");
  const tierClass =
    score === null
      ? "bg-white/8 text-white/60 ring-white/15"
      : score >= 8
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : score >= 5
          ? "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30"
          : "bg-red-500/15 text-red-300 ring-red-500/30";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.08] via-purple-500/[0.03] to-transparent p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <Sparkle className="h-3.5 w-3.5 text-purple-300" />
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-purple-300">
          AI verdict
        </div>
        <div
          className={`ml-auto inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${tierClass}`}
        >
          {tier}
          {onHundred !== null && (
            <span className="font-mono">{onHundred}/100</span>
          )}
        </div>
      </div>
      <p className="text-[14px] leading-relaxed text-white/85 sm:text-[14.5px]">
        {verdict ?? (
          <span className="italic text-white/55">
            Awaiting AI verdict — the scorer runs once the conversation
            completes.
          </span>
        )}
      </p>
    </div>
  );
}

export default function Transcript({
  user,
  candidate,
  role,
  conversation,
  messages,
}: Props) {
  const initial = firstInitial(candidate.name);
  const conversationStatus =
    conversation?.status === "completed"
      ? `Interview complete · ${conversation.endReason ?? "completed"}`
      : "Interview in progress";

  return (
    <>
      <Head>
        <title>
          {candidate.name} · {role.title}
        </title>
      </Head>
      <main className="ph-radial-purple relative min-h-screen text-white">
        <PHTopBar
          user={{
            email: user.email,
            image: user.image,
            letter: user.name?.[0]?.toUpperCase() ?? "A",
          }}
          onSignOut={() => signOut({ callbackUrl: "/signin" })}
        />

        {/* Sticky condensed header */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-[840px] items-center gap-3 px-5 py-2.5 sm:px-8 sm:py-3 lg:px-12">
            <PHAvatar letter={initial} size="sm" />
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-[13px] font-medium sm:text-[14px]">
                {candidate.name}
              </div>
              {candidate.score !== null && (
                <PHFitBadge score={candidate.score} />
              )}
            </div>
            <div className="ml-auto hidden text-[11px] text-white/45 sm:block">
              {role.title}
            </div>
          </div>
        </div>

        <section className="mx-auto max-w-[840px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <Link
            href={`/dashboard/${role.slug}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft />
            Back to role
          </Link>

          {/* Full header */}
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <PHAvatar letter={initial} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-medium tracking-tight sm:text-[24px]">
                  {candidate.name}
                </h1>
                {candidate.score !== null && (
                  <PHFitBadge score={candidate.score} />
                )}
              </div>
              <div className="mt-1 truncate text-[12px] text-white/45 sm:text-[13px]">
                {candidate.email} · Interviewed{" "}
                {new Date(candidate.createdAt).toLocaleDateString()} ·{" "}
                {role.title}
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <PHButton variant="ghost" size="sm" icon={<Download />}>
                Export
              </PHButton>
              <PHButton variant="ghost" size="sm">
                Email
              </PHButton>
              <PHButton size="sm" icon={<Check />}>
                Mark reviewed
              </PHButton>
            </div>
          </div>

          <div className="mt-5 sm:mt-6">
            <VerdictCallout
              score={candidate.score}
              verdict={candidate.verdict}
            />
          </div>

          {/* Transcript */}
          <section className="mt-8 sm:mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-medium tracking-tight text-white/80">
                Transcript
              </h2>
              <div className="font-mono text-[11px] text-white/40">
                {messages.length} messages
              </div>
            </div>

            {messages.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-[13px] text-white/50">
                No messages yet.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((m, i) => (
                  <div
                    key={m.id}
                    className="animate-fm-fade-up"
                    style={{
                      animationDelay: `${Math.min(i, 12) * 30}ms`,
                      animationFillMode: "both",
                    }}
                  >
                    <PHMessage from={m.role === "user" ? "candidate" : "bot"}>
                      {m.content}
                    </PHMessage>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[12px] text-white/55">
              <Check className="h-3.5 w-3.5 text-emerald-300" />
              {conversationStatus}
            </div>
          </section>
        </section>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const slug = ctx.params?.slug;
  const candidateId = ctx.params?.candidateId;
  if (typeof slug !== "string" || typeof candidateId !== "string") {
    return { notFound: true };
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      role: true,
      conversations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { messages: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (
    !candidate ||
    candidate.role.slug !== slug ||
    candidate.role.recruiterId !== userId
  ) {
    return { notFound: true };
  }

  const conv = candidate.conversations[0] ?? null;

  return {
    props: {
      user: {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      },
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        createdAt: candidate.createdAt.toISOString(),
        score: candidate.score,
        verdict: candidate.verdict,
      },
      role: { slug: candidate.role.slug, title: candidate.role.title },
      conversation: conv
        ? { status: conv.status, endReason: conv.endReason }
        : null,
      messages:
        conv?.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })) ?? [],
    },
  };
};
