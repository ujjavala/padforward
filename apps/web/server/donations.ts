// Solana payment + donation logic — ports of solana_service.py and
// donation_service.py. With SOLANA_DEVNET=1 (or SOLANA_DONOR_SECRET set), SOL
// donations submit a REAL Memo transaction to Solana devnet (see solana.ts);
// otherwise — or on devnet failure — the transfer is simulated.
import { randomInt } from "crypto";

import type { DonationResult, PaymentMethod, SolQuote, Station } from "../lib/types";
import { classifyNeed } from "./needScore";
import { recomputeNeedScore, deriveSupplyStatus, type StationRecord, type Store } from "./store";
import { toStationOut } from "./stations";
import { devnetEnabled, recordDonationOnDevnet } from "./solana";

// Demo pricing — fixed so the flow is reproducible without a price oracle.
const SOL_PRICE_USD = 150.0;
const PAD_PRICE_USD = 0.3;

const BASE58 =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";

export function solQuote(quantity: number): SolQuote {
  const sol_amount = Math.round((quantity * PAD_PRICE_USD) / SOL_PRICE_USD * 1e6) / 1e6;
  return {
    quantity,
    sol_amount,
    sol_price_usd: SOL_PRICE_USD,
    pad_price_usd: PAD_PRICE_USD,
    network: devnetEnabled() ? "devnet" : "devnet (simulated)",
    demo: !devnetEnabled(),
  };
}

async function processPayment(
  quantity: number,
  stationName: string
): Promise<{ solAmount: number; signature: string }> {
  const solAmount = solQuote(quantity).sol_amount;
  if (devnetEnabled()) {
    try {
      const tx = await recordDonationOnDevnet(quantity, solAmount, stationName);
      return { solAmount, signature: tx.signature };
    } catch {
      // devnet unreachable/unfunded — fall through to simulation
    }
  }
  let signature = "";
  for (let i = 0; i < 88; i++) signature += BASE58[randomInt(BASE58.length)];
  return { solAmount, signature };
}

export async function createDonation(
  store: Store,
  station: StationRecord,
  quantity: number,
  paymentMethod: PaymentMethod = "IN_PERSON",
  _walletAddress?: string | null
): Promise<DonationResult> {
  const before = {
    supply_status: station.supply_status,
    need_score: station.need_score,
    need_level: classifyNeed(station.need_score),
    current_supply: station.current_supply,
  };

  let solAmount: number | null = null;
  let txSignature: string | null = null;
  if (paymentMethod === "SOL") {
    const payment = await processPayment(quantity, station.name);
    solAmount = payment.solAmount;
    txSignature = payment.signature;
  }

  const now = new Date();
  const donation = {
    id: store.nextId++,
    station_id: station.id,
    quantity,
    status: "DELIVERED" as const,
    payment_method: paymentMethod,
    sol_amount: solAmount,
    tx_signature: txSignature,
    created_at: now,
  };
  store.donations.push(donation);

  station.current_supply += quantity;
  station.supply_status = deriveSupplyStatus(station.current_supply, true);
  station.last_restocked_at = now;
  station.last_verified_at = now;
  recomputeNeedScore(store, station);

  const after: Station = toStationOut(store, station);
  let message: string;
  if (paymentMethod === "SOL") {
    message =
      `Your ${solAmount} SOL funded ${quantity} pads at ${station.name}. ` +
      `Someone may need one of these today. Thank you for paying it forward.`;
  } else if (before.supply_status === "NONE" || before.supply_status === "UNKNOWN") {
    const statusLabel = after.supply_status
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    message =
      `${quantity} pads added to the PadForward network. ` +
      `${station.name} is now ${statusLabel}. ` +
      `Someone may need one of these today. Thank you for paying it forward.`;
  } else {
    message =
      `${quantity} pads are now available through the community network at ${station.name}. ` +
      `Thank you for paying it forward.`;
  }

  return {
    donation: {
      id: donation.id,
      station_id: donation.station_id,
      quantity: donation.quantity,
      status: donation.status,
      payment_method: donation.payment_method,
      sol_amount: donation.sol_amount,
      tx_signature: donation.tx_signature,
    },
    station_before: before,
    station_after: after,
    message,
  };
}
