import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MotionProvider } from "@/components/motion/motion-provider";
import { SignalRibbon } from "@/components/motion/signal-ribbon";
import { themeColor } from "@/lib/design/tokens";
import "./globals.css";

// Open-licence variable fonts (SIL OFL 1.1) shipped in the repository, so the
// server build never downloads fonts. Sources and licences: app/fonts/ and
// docs/design/asset-sourcing.md.
// Bricolage Grotesque: display (headings, large numbers). Figtree: interface
// and body text. JetBrains Mono: data, routes and code.
const figtree = localFont({
  src: "./fonts/figtree-latin-wght-normal.woff2",
  variable: "--font-figtree",
  weight: "300 900",
  display: "swap",
});
const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
  display: "swap",
});
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin-opsz-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
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

// The root layout owns what every page shares: fonts, the skip link, the
// motion configuration and the route-change ribbon. The page frame (header,
// main, footer) comes from the route group layouts through AppShell.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${jetbrainsMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main-content"
          className="focus:bg-accent-ink focus:text-canvas sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-(--z-skip-link) focus:rounded focus:px-4 focus:py-2 focus:font-medium"
        >
          Skip to content
        </a>
        <MotionProvider>
          <SignalRibbon />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
