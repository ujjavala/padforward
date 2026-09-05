import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Compass, Gift, HeartHandshake, Sparkles } from "lucide-react";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "PadForward — No asking. No explaining. Just access.",
  description:
    "A community-powered emergency menstrual product access network. Find, give, and maintain access — privately.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

const NAV_ITEMS = [
  { href: "/find", label: "Find a pad", Icon: Compass },
  { href: "/donate", label: "Donate", Icon: Gift },
  { href: "/assistant", label: "Ask", Icon: Sparkles },
  { href: "/impact", label: "Impact", Icon: HeartHandshake },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-24 pt-4 md:max-w-3xl md:pb-10">
          <header className="mb-4 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-teal-650 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
            >
              PadForward
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-teal-50 hover:text-teal-650 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
                >
                  <item.Icon aria-hidden="true" className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <span
              className="rounded-full bg-plum-600/10 px-3 py-1 text-xs font-semibold text-plum-600"
              title="All supply data shown is demo community data"
            >
              Demo network
            </span>
          </header>
          <main className="flex-1">{children}</main>
          <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-900/10 bg-white/95 backdrop-blur md:hidden"
          >
            <div className="mx-auto flex max-w-lg items-stretch justify-around">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-ink-700 hover:text-teal-650 focus:outline-none focus-visible:bg-teal-50"
                >
                  <item.Icon aria-hidden="true" className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
