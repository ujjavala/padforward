import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Gift,
  HeartHandshake,
  Lock,
  MapPin,
  Quote,
  Sparkles,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About — PadForward",
  description:
    "The story behind PadForward: why needing a pad unexpectedly shouldn't mean asking a stranger, and how a community network can help.",
};

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-8 pt-2 md:pt-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-50 via-cream to-teal-50 px-6 py-10 shadow-card md:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/40 blur-2xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-plum-600/10 px-3.5 py-1.5 text-xs font-semibold text-plum-600">
            <HeartHandshake aria-hidden="true" className="h-3.5 w-3.5" />
            The story behind PadForward
          </span>
          <h1 className="mt-5 max-w-xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            Sometimes you just need a pad.
          </h1>
          <p className="mt-3 max-w-xl text-ink-500 md:text-lg">
            PadForward started with one bad afternoon at a train station — and the
            realisation that something this simple shouldn't be this hard.
          </p>
        </div>
      </section>

      {/* The story */}
      <section className="card space-y-3 !p-6 md:!p-8" aria-label="How it started">
        <h2 className="text-xl font-bold">How it started</h2>
        <p className="text-ink-700">
          I unexpectedly got my period while out, near a train station — with no pad, and no
          way to get one there. I had money and options, but in that moment I still ended up
          using toilet paper.
        </p>
        <p className="text-ink-700">
          <strong className="text-ink-900">Needing a pad unexpectedly can happen to anyone</strong>{" "}
          — your period comes early, you forget to pack one, you're travelling. It happens
          to the best of us.
        </p>
      </section>

      {/* The asking problem */}
      <section className="card space-y-3 !p-6 md:!p-8" aria-label="The asking problem">
        <h2 className="text-xl font-bold">&ldquo;Does anyone have a pad?&rdquo;</h2>
        <p className="text-ink-700">
          Even if someone nearby had a spare, would you walk up and ask? Periods are normal
          — but asking a stranger in a crowded station still comes with a moment of
          hesitation. And when you're already stressed, the last thing you need is another
          problem to solve.
        </p>
        <p className="font-semibold text-teal-650">That's where PadForward came from.</p>
      </section>

      {/* What it is */}
      <section className="card space-y-3 !p-6 md:!p-8" aria-label="What PadForward is">
        <h2 className="text-xl font-bold">So, what is PadForward?</h2>
        <p className="text-ink-700">
          A community-powered network for finding and donating menstrual products in public
          places — stations, universities, workplaces. Someone donates pads today; someone
          else finds one tomorrow. They never meet, and nobody has to ask.
        </p>
        <blockquote className="flex gap-3 rounded-xl2 bg-teal-50 p-4 text-teal-800">
          <Quote aria-hidden="true" className="h-5 w-5 shrink-0" />
          <p className="font-medium">
            Someone helped you today. When you're able, help someone else.
          </p>
        </blockquote>
      </section>

      {/* Principles */}
      <section aria-label="What we believe" className="grid gap-3 sm:grid-cols-2">
        {[
          {
            Icon: Lock,
            title: "No asking, no explaining",
            text: "You shouldn't need an account, a reason, or an awkward conversation to get a pad.",
          },
          {
            Icon: MapPin,
            title: "Access where you already are",
            text: "Supplies live at stations and public places people pass through every day.",
          },
          {
            Icon: Users,
            title: "Powered by community",
            text: "Donors, champions, and quick supply reports keep every station honest and stocked.",
          },
          {
            Icon: HeartHandshake,
            title: "Pay it forward",
            text: "Nobody owes anything back. When you're able, you keep the loop going for someone else.",
          },
        ].map((p) => (
          <div key={p.title} className="card flex gap-4 !p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-650">
              <p.Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <span>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-0.5 text-sm text-ink-500">{p.text}</p>
            </span>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section
        className="rounded-3xl bg-gradient-to-r from-teal-650 to-plum-600 px-6 py-8 text-center text-white shadow-card md:px-12"
        aria-label="Get involved"
      >
        <h2 className="text-2xl font-bold">Be part of the loop</h2>
        <p className="mx-auto mt-2 max-w-md text-white/85">
          Find a pad when you need one. Donate when you can. Adopt a station if you want to
          do more.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/find"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-teal-650 shadow-card transition hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:w-auto"
          >
            <Compass aria-hidden="true" className="h-5 w-5" />
            Find a pad
          </Link>
          <Link
            href="/donate"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/50 px-6 py-3 font-semibold text-white transition hover:border-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:w-auto"
          >
            <Gift aria-hidden="true" className="h-5 w-5" />
            Donate pads
          </Link>
          <Link
            href="/assistant"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/50 px-6 py-3 font-semibold text-white transition hover:border-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:w-auto"
          >
            <Sparkles aria-hidden="true" className="h-5 w-5" />
            Ask the assistant
          </Link>
        </div>
        <p className="mt-5 text-xs text-white/70">
          All supply data shown today is demo community data.
        </p>
      </section>

      <p className="text-center text-sm text-ink-500">
        Built for the DEV Weekend Challenge: Generosity Edition.{" "}
        <Link
          href="/"
          className="font-medium text-teal-650 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          Back to home
          <ArrowRight aria-hidden="true" className="ml-0.5 inline h-3.5 w-3.5" />
        </Link>
      </p>
    </div>
  );
}
