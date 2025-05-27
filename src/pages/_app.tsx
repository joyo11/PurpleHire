// Mohammad Shafay Joyo @ 2025
import type { AppType } from "next/app";
import "@/styles/globals.css";

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <div className="min-h-screen bg-black">
      <Component {...pageProps} />
    </div>
  );
};

export default MyApp; 