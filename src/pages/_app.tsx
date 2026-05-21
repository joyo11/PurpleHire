// Mohammad Shafay Joyo @ 2025
import type { AppType } from "next/app";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { Fredoka } from "next/font/google";
import "@/styles/globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fredoka",
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <div className={`${fredoka.variable} min-h-screen bg-black font-sans`}>
        <Component {...pageProps} />
      </div>
    </SessionProvider>
  );
};

export default MyApp;
