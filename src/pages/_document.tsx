// Mohammad Shafay Joyo @ 2025
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        {/* Favicon: modern SVG with PNG fallback, plus Apple touch icon */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/Purplehire.png" type="image/png" />
        <link rel="apple-touch-icon" href="/Purplehire.png" />
        <meta name="theme-color" content="#9333ea" />
      </Head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var mode = localStorage.getItem('theme');
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                  if (!mode && supportDarkMode) document.documentElement.classList.add('dark');
                  if (mode === 'dark') document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
