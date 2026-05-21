// Mohammad Shafay Joyo @ 2025
import type { AppType } from "next/app";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import "@/styles/globals.css";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-black">
        <Component {...pageProps} />
      </div>
    </SessionProvider>
  );
};

export default MyApp;
