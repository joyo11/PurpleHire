import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type Props = {
  candidate: {
    id: string;
    name: string;
    email: string;
    score: number | null;
    verdict: string | null;
  };
  role: { slug: string; title: string };
  conversation: {
    status: string;
    endReason: string | null;
  } | null;
  messages: Msg[];
};

function scoreColor(score: number) {
  if (score >= 8) return "bg-green-500/15 text-green-300 border-green-500/30";
  if (score >= 5) return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  return "bg-red-500/15 text-red-300 border-red-500/30";
}

export default function Transcript({
  candidate,
  role,
  conversation,
  messages,
}: Props) {
  return (
    <>
      <Head>
        <title>
          {candidate.name} · {role.title}
        </title>
      </Head>
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/dashboard/${role.slug}`}
            className="mb-6 inline-block text-sm text-white/50 hover:text-white"
          >
            ← {role.title}
          </Link>

          <header className="mb-6">
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{candidate.name}</h1>
              {candidate.score !== null && (
                <span
                  className={`rounded-md border px-2 py-0.5 text-sm font-medium ${scoreColor(candidate.score)}`}
                >
                  {candidate.score}/10
                </span>
              )}
            </div>
            <p className="mb-3 text-sm text-white/50">{candidate.email}</p>
            {candidate.verdict && (
              <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                <span className="mb-1 block text-xs uppercase tracking-wide text-white/40">
                  AI verdict
                </span>
                {candidate.verdict}
              </p>
            )}
            {conversation && (
              <p className="mt-2 text-xs text-white/40">
                Conversation:{" "}
                {conversation.status === "completed"
                  ? `completed (${conversation.endReason ?? "completed"})`
                  : "still in progress"}
              </p>
            )}
          </header>

          <section>
            <h2 className="mb-4 text-lg font-medium">Transcript</h2>
            {messages.length === 0 ? (
              <p className="text-sm text-white/50">No messages yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "flex justify-end"
                        : "flex items-start gap-3"
                    }
                  >
                    {m.role === "assistant" && (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500 text-xs font-semibold">
                        A
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                        m.role === "user"
                          ? "bg-white text-black"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
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
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
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
