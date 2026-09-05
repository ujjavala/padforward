import Link from "next/link";
import { ArrowRight, Compass, Gift, HeartHandshake, Lock, MapPin, Users } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10 pt-4 md:pt-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-50 via-cream to-teal-50 px-6 py-10 text-center shadow-card md:px-12 md:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/40 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-teal-200/40 blur-2xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-plum-600/10 px-3.5 py-1.5 text-xs font-semibold text-plum-600">
            <HeartHandshake aria-hidden="true" className="h-3.5 w-3.5" />
            Community-powered period care
          </span>
          <h1 className="mx-auto mt-5 max-w-xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Periods are normal.{" "}
            <span className="bg-gradient-to-r from-teal-650 to-plum-600 bg-clip-text text-transparent">
              Getting a pad should be too.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-ink-500 md:text-lg">
            PadForward connects you with community menstrual supplies nearby —
            privately, with no account and no asking.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/find"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-650 px-8 py-4 text-lg font-semibold text-white shadow-card transition hover:bg-teal-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 active:scale-[0.99] sm:w-auto"
            >
              I need a pad
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
            <Link
              href="/donate"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-plum-600/30 bg-white px-8 py-4 text-lg font-semibold text-plum-600 shadow-card transition hover:border-plum-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 active:scale-[0.99] sm:w-auto"
            >
              <Gift aria-hidden="true" className="h-5 w-5" />
              I want to donate
            </Link>
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-500">
            <Lock aria-hidden="true" className="h-3.5 w-3.5" />
            No account. No questions. Nothing about you is stored.
          </p>
        </div>
      </section>

      {/* Promise strip */}
      <section className="text-center">
        <p className="text-lg font-semibold text-ink-700">
          No asking. No explaining. <span className="text-teal-650">Just access.</span>
        </p>
        <p className="mt-1 text-sm text-ink-500">
          Give privately. Receive privately. Pay it forward.
        </p>
      </section>

      {/* How it works */}
      <section aria-label="How it works" className="grid gap-3 sm:grid-cols-3">
        {[
          {
            Icon: Gift,
            chip: "bg-rose-100 text-rose-600",
            title: "Give",
            text: "Someone leaves spare pads at a community point",
          },
          {
            Icon: Compass,
            chip: "bg-teal-100 text-teal-650",
            title: "Find",
            text: "Someone nearby finds one — no account, no asking",
          },
          {
            Icon: HeartHandshake,
            chip: "bg-plum-600/10 text-plum-600",
            title: "Pay it forward",
            text: "When they're able, they keep the loop going",
          },
        ].map((step) => (
          <div key={step.title} className="card !p-5 text-center transition hover:shadow-lg">
            <span
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${step.chip}`}
            >
              <step.Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-semibold">{step.title}</h2>
            <p className="mt-1 text-sm text-ink-500">{step.text}</p>
          </div>
        ))}
      </section>

      {/* Secondary actions */}
      <section className="grid gap-3 sm:grid-cols-2" aria-label="More ways to help">
        <Link
          href="/champion"
          className="card group flex items-center gap-4 !p-5 transition hover:shadow-lg"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-650">
            <Users aria-hidden="true" className="h-5 w-5" />
          </span>
          <span>
            <span className="font-semibold group-hover:text-teal-650">Become a Pad Champion</span>
            <span className="mt-0.5 block text-sm text-ink-500">
              Adopt a station and keep it stocked for your community
            </span>
          </span>
          <ArrowRight
            aria-hidden="true"
            className="ml-auto h-5 w-5 shrink-0 text-ink-300 transition group-hover:translate-x-1 group-hover:text-teal-650"
          />
        </Link>
        <Link
          href="/impact"
          className="card group flex items-center gap-4 !p-5 transition hover:shadow-lg"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <MapPin aria-hidden="true" className="h-5 w-5" />
          </span>
          <span>
            <span className="font-semibold group-hover:text-teal-650">See community impact</span>
            <span className="mt-0.5 block text-sm text-ink-500">
              Watch the generosity loop grow across the network
            </span>
          </span>
          <ArrowRight
            aria-hidden="true"
            className="ml-auto h-5 w-5 shrink-0 text-ink-300 transition group-hover:translate-x-1 group-hover:text-teal-650"
          />
        </Link>
      </section>
    </div>
  );
}
