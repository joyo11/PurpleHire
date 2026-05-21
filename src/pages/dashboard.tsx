import Head from "next/head";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";

type Props = {
  user: { name: string | null; email: string | null; image: string | null };
};

export default function Dashboard({ user }: Props) {
  return (
    <>
      <Head>
        <title>Dashboard · PurpleHire</title>
      </Head>
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        <div className="mx-auto max-w-5xl">
          <header className="mb-12 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">PurpleHire</h1>
            <div className="flex items-center gap-3">
              {user.image && (
                <img
                  src={user.image}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              )}
              <span className="text-sm text-white/70">{user.email}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          </header>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <h2 className="mb-2 text-xl font-medium">
              Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
            </h2>
            <p className="mb-6 text-white/60">
              You don't have an interview set up yet. Paste a JD to create one.
            </p>
            <button
              disabled
              className="cursor-not-allowed rounded-lg bg-white/20 px-5 py-2.5 font-medium text-white/60"
            >
              Create interview (coming next)
            </button>
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) {
    return { redirect: { destination: "/signin", permanent: false } };
  }
  return {
    props: {
      user: {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      },
    },
  };
};
