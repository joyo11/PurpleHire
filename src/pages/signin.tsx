import Head from "next/head";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default function SignIn() {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <>
      <Head>
        <title>Sign in · PurpleHire</title>
      </Head>
      <main className="ph-radial-purple relative grid min-h-screen place-items-center px-5 text-white">
        <div className="w-full max-w-[440px] animate-fm-fade-up rounded-3xl border border-white/10 bg-white/[0.02] p-7 shadow-card-lift sm:p-8">
          <div className="flex items-center justify-center">
            <div
              className={`ph-grad-btn-bg flex h-14 w-14 items-center justify-center rounded-2xl text-[22px] font-semibold ${
                loading ? "animate-fm-pulse-glow" : "shadow-glow-purple-sm"
              }`}
            >
              P
            </div>
          </div>
          <h1 className="mt-6 text-center text-[26px] font-medium tracking-tight sm:text-[28px]">
            Welcome to PurpleHire
          </h1>
          <p className="mt-2 text-center text-[14px] leading-relaxed text-white/55 sm:text-[14.5px]">
            One click. We&apos;ll use your Google account to set up your
            workspace.
          </p>
          <div className="mt-7">
            {loading ? (
              <button
                disabled
                className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white text-[15px] font-medium text-black/70"
              >
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeOpacity=".2"
                    strokeWidth="3"
                  />
                  <path
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Redirecting to Google…
              </button>
            ) : (
              <button
                onClick={handleSignIn}
                className="group flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white text-[15px] font-medium text-black transition-all hover:-translate-y-px hover:shadow-[0_10px_30px_-12px_rgba(255,255,255,0.4)] active:translate-y-0 active:scale-[.98]"
              >
                <svg viewBox="0 0 18 18" className="h-5 w-5">
                  <path
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.63z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.47-.8 5.95-2.18l-2.9-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.7H.95v2.32A9 9 0 0 0 9 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.95 10.72A5.4 5.4 0 0 1 3.66 9c0-.6.1-1.18.29-1.72V4.96H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.04l3-2.32z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 9 0 9 9 0 0 0 .95 4.96l3 2.32C4.66 5.16 6.65 3.58 9 3.58z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>
            )}
          </div>
          <div className="mt-6 text-center text-[12px] text-white/35">
            By continuing you agree to our{" "}
            <a className="text-white/55 underline-offset-2 hover:underline">
              Terms
            </a>{" "}
            and{" "}
            <a className="text-white/55 underline-offset-2 hover:underline">
              Privacy
            </a>
            .
          </div>
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
