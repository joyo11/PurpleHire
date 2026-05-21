import Head from "next/head";
import { signIn } from "next-auth/react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default function SignIn() {
  return (
    <>
      <Head>
        <title>Sign in · PurpleHire</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <h1 className="mb-2 text-center text-2xl font-semibold text-white">
            Sign in to PurpleHire
          </h1>
          <p className="mb-8 text-center text-sm text-white/60">
            Recruiters only — paste a JD, get a candidate-ready interview link.
          </p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 font-medium text-black transition hover:bg-white/90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.997 10.997 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.997 10.997 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (session) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }
  return { props: {} };
};
