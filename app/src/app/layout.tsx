import type { Metadata } from "next";
import { LocaleProvider } from "@/lib/i18n";
import "./styles.css";
import "./graph.css";
import "./panels.css";
import "./tweaks.css";

export const metadata: Metadata = {
  title: "Irembo Journey Companion",
  description: "See the whole path to any Rwandan government service — including the steps people usually miss.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
