import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

import { QueryProvider } from "@/providers/QueryProvider";
import { getAppOrigin } from "@/lib/site";
import { DEFAULT_THEME, THEME_IDS } from "@/lib/themes";

/** Operator design system: Geist body/UI, Geist Mono for numerics/IDs/micro-labels,
 *  Instrument Serif for sparing display moments (hero/empty-states). */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppOrigin()),
  title: "MsgBuddy - WhatsApp SaaS",
  description: "Multi-tenant WhatsApp SaaS platform",
  applicationName: "MsgBuddy",
  openGraph: {
    title: "MsgBuddy — WhatsApp SaaS",
    description: "Run your customer relationships from WhatsApp — inbox, contacts, campaigns.",
    siteName: "MsgBuddy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MsgBuddy — WhatsApp SaaS",
    description: "Run your customer relationships from WhatsApp — inbox, contacts, campaigns.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            // Runs before hydration to set data-theme/-density with no FOUC. The
            // theme allow-list is generated from the registry (THEME_IDS) so it
            // can never drift from src/lib/themes.ts.
            __html: `(function(){try{var T=${JSON.stringify(THEME_IDS)};var p=localStorage.getItem("theme-preference");var pref=T.indexOf(p)>-1?p:"${DEFAULT_THEME}";document.documentElement.setAttribute("data-theme",pref);var d=localStorage.getItem("display-density");if(d==="small"||d==="medium"||d==="large"){document.documentElement.setAttribute("data-density",d);}}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}");}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} font-sans antialiased`}
      >
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
