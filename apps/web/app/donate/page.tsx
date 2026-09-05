"use client";

/**
 * Donate flow: quantity → highest-need recommendation → confirm → impact,
 * with the CRITICAL → AVAILABLE before/after transition.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, HandHeart, PartyPopper, Wallet } from "lucide-react";
import { NeedBadge, SupplyBadge } from "@/components/Badges";
import { StationCard } from "@/components/StationCard";
import { DEMO_LOCATION, useGeolocation } from "@/hooks/useGeolocation";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/display";
import type { DonationResult, PaymentMethod, SolQuote, Station } from "@/lib/types";

type Phase = "quantity" | "recommend" | "done";

export default function DonatePage() {
  const { state, locate } = useGeolocation();
  const [phase, setPhase] = useState<Phase>("quantity");
  const [quantity, setQuantity] = useState(10);
  const [recommended, setRecommended] = useState<Station[]>([]);
  const [chosen, setChosen] = useState<Station | null>(null);
  const [result, setResult] = useState<DonationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("IN_PERSON");
  const [quote, setQuote] = useState<SolQuote | null>(null);

  // Ask for the donor's location up front so recommendations are local.
  useEffect(() => {
    locate();
  }, [locate]);

  useEffect(() => {
    if (phase !== "recommend" || payMethod !== "SOL") return;
    let live = true;
    api
      .solQuote(quantity)
      .then((q) => live && setQuote(q))
      .catch(() => live && setQuote(null));
    return () => {
      live = false;
    };
  }, [phase, payMethod, quantity]);

  const origin = state.status === "granted" ? { lat: state.lat, lng: state.lng } : DEMO_LOCATION;

  async function recommend() {
    setBusy(true);
    setError(null);
    try {
      const stations = await api.priorityStations(origin.lat, origin.lng, 3);
      setRecommended(stations);
      setChosen(stations[0] ?? null);
      setPhase("recommend");
    } catch {
      setError("Couldn't load recommendations. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const donation = await api.createDonation(
        chosen.id,
        quantity,
        payMethod,
        payMethod === "SOL" ? "DemoWa11etAddre55PadForward" : undefined
      );
      setResult(donation);
      setPhase("done");
    } catch {
      setError("Donation couldn't be recorded. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "done" && result) {
    const before = result.station_before;
    const after = result.station_after;
    return (
      <div className="flex flex-col gap-5 pt-6 text-center">
        <PartyPopper aria-hidden="true" className="mx-auto h-10 w-10 text-teal-650" />
        <h1 className="text-2xl font-bold">
          {result.donation.quantity} pads added to the PadForward network.
        </h1>
        <div className="card">
          <h2 className="font-semibold">{after.name}</h2>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm">
            <div className="flex flex-col items-center gap-1">
              <SupplyBadge status={before.supply_status} />
              <NeedBadge level={before.need_level} score={before.need_score} />
            </div>
            <ArrowRight aria-hidden="true" className="h-5 w-5 text-ink-300" />
            <div className="flex flex-col items-center gap-1">
              <SupplyBadge status={after.supply_status} />
              <NeedBadge level={after.need_level} score={after.need_score} />
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-500">
            Supply: {before.current_supply} → {after.current_supply} pads
          </p>
          {result.donation.payment_method === "SOL" && result.donation.tx_signature && (
            <div className="mt-3 rounded-xl bg-plum-600/10 px-3 py-2 text-left text-xs text-ink-500">
              <p className="flex items-center gap-1.5 font-semibold text-plum-600">
                <Wallet aria-hidden="true" className="h-3.5 w-3.5" />
                Funded with {result.donation.sol_amount} SOL (devnet demo)
              </p>
              <p className="mt-1 break-all font-mono">
                tx: {result.donation.tx_signature.slice(0, 20)}…
                {result.donation.tx_signature.slice(-8)}
              </p>
            </div>
          )}
        </div>
        <p className="text-ink-700">
          Someone may need one of these today.
          <br />
          Thank you for paying it forward.
        </p>
        <Link href="/impact" className="btn-primary">
          See community impact
        </Link>
        <Link href="/" className="btn-secondary">
          Done
        </Link>
      </div>
    );
  }

  if (phase === "recommend") {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setPhase("quantity")}
          className="self-start text-sm font-medium text-teal-650 underline"
        >
          ← Change quantity
        </button>
        <h1 className="text-xl font-bold">Where can your donation help most?</h1>
        {chosen && (
          <div className="card border-2 border-teal-650">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-650">
              Recommended — highest need nearby
            </p>
            <h2 className="mt-1 text-lg font-bold">{chosen.name}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SupplyBadge status={chosen.supply_status} />
              <NeedBadge level={chosen.need_level} score={chosen.need_score} />
            </div>
            <ul className="mt-2 space-y-0.5 text-sm text-ink-500">
              <li>
                {chosen.current_supply} pads currently
                reported
              </li>
              <li>Last verified {timeAgo(chosen.last_verified_at)}</li>
              {chosen.distance_km !== null && <li>{chosen.distance_km} km away</li>}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
              <button
                type="button"
                role="radio"
                aria-checked={payMethod === "IN_PERSON"}
                onClick={() => setPayMethod("IN_PERSON")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
                  payMethod === "IN_PERSON"
                    ? "border-teal-650 bg-teal-50 text-teal-800"
                    : "border-ink-900/10 bg-white text-ink-500"
                }`}
              >
                <HandHeart aria-hidden="true" className="h-4 w-4" />
                Drop off pads
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={payMethod === "SOL"}
                onClick={() => setPayMethod("SOL")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
                  payMethod === "SOL"
                    ? "border-plum-600 bg-plum-600/10 text-plum-600"
                    : "border-ink-900/10 bg-white text-ink-500"
                }`}
              >
                <Wallet aria-hidden="true" className="h-4 w-4" />
                Fund with SOL
              </button>
            </div>
            {payMethod === "SOL" && (
              <p className="mt-2 rounded-xl bg-plum-600/10 px-3 py-2 text-xs text-plum-600">
                {quote
                  ? `${quantity} pads ≈ ${quote.sol_amount} SOL on ${quote.network}. A local Pad Champion delivers them for you.`
                  : "Fetching SOL quote…"}
              </p>
            )}
            <button type="button" onClick={confirm} disabled={busy} className="btn-primary mt-4">
              {busy
                ? "Recording…"
                : payMethod === "SOL"
                  ? `Pay ${quote ? `${quote.sol_amount} SOL` : "with SOL"} for ${quantity} pads`
                  : `Donate ${quantity} pads here`}
            </button>
          </div>
        )}
        {recommended.length > 1 && (
          <>
            <h2 className="text-sm font-semibold text-ink-500">Other high-need locations</h2>
            <ul className="flex flex-col gap-3">
              {recommended.slice(1).map((s) => (
                <li key={s.id}>
                  <StationCard station={s} showNeed onSelect={(st) => setChosen(st)} />
                </li>
              ))}
            </ul>
          </>
        )}
        {error && <p className="card text-sm text-rose-800">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="text-2xl font-bold text-center">
        How many pads would you like to donate?
      </h1>
      <fieldset className="flex items-center justify-center gap-6 border-0">
        <legend className="sr-only">Quantity</legend>
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 5))}
          className="h-14 w-14 rounded-full border-2 border-ink-900/10 bg-white text-2xl font-bold shadow-card focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
          aria-label="Decrease quantity by 5"
        >
          −
        </button>
        <output className="min-w-[4rem] text-center text-5xl font-bold" aria-live="polite">
          {quantity}
        </output>
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.min(500, q + 5))}
          className="h-14 w-14 rounded-full border-2 border-ink-900/10 bg-white text-2xl font-bold shadow-card focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
          aria-label="Increase quantity by 5"
        >
          +
        </button>
      </fieldset>
      <p className="text-center text-sm text-ink-500">
        Unopened, individually wrapped pads please. Your identity is never shown publicly.
      </p>
      <button type="button" onClick={recommend} disabled={busy} className="btn-primary">
        {busy ? "Finding highest need…" : "Where should my donation go?"}
      </button>
      {error && <p className="card text-sm text-rose-800">{error}</p>}
    </div>
  );
}
