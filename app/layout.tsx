import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { themeColor } from "@/lib/design/tokens";
import "./globals.css";

// Open-licence variable fonts (SIL OFL 1.1) shipped in the repository, so the
// server build never downloads fonts. Sources and licences: app/fonts/ and
// docs/design/asset-sourcing.md.
const geistSans = localFont({
  src: "./fonts/geist-latin-wght-normal.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/geist-mono-latin-wght-normal.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});
const fraunces = localFont({
  src: "./fonts/fraunces-latin-opsz-normal.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "YTL Nexus",
    template: "%s · YTL Nexus",
  },
  description:
    "YTL Nexus unifies infrastructure monitoring, local AI, secure file transfer, mail and content for the YTL Communications IT Infrastructure team.",
  applicationName: "YTL Nexus",
};

export const viewport: Viewport = {
  themeColor,
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main-content"
          className="focus:bg-accent-ink focus:text-canvas sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-(--z-skip-link) focus:rounded focus:px-4 focus:py-2 focus:font-medium"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
