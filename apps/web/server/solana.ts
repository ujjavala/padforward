// Real Solana devnet integration (dev/demo purposes).
//
// When SOLANA_DEVNET=1 (or SOLANA_DONOR_SECRET is set), SOL donations submit a
// REAL transaction to Solana devnet: a Memo-program transaction recording the
// donation, signed by a server-side donor keypair. Costs only the ~5000-lamport
// fee, funded via devnet airdrops. If devnet is unreachable or unfunded, we
// fall back to the simulated signature so the flow never breaks.
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const MIN_BALANCE_LAMPORTS = 100_000; // enough for many memo fees
const AIRDROP_LAMPORTS = 1_000_000_000; // 1 SOL

interface SolanaGlobals {
  __padforwardSolanaKeypair?: Keypair;
  __padforwardSolanaConn?: Connection;
}

export function devnetEnabled(): boolean {
  return process.env.SOLANA_DEVNET === "1" || !!process.env.SOLANA_DONOR_SECRET;
}

function getConnection(): Connection {
  const g = globalThis as SolanaGlobals;
  g.__padforwardSolanaConn ??= new Connection(
    process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet"),
    "confirmed"
  );
  return g.__padforwardSolanaConn;
}

function getDonorKeypair(): Keypair {
  const g = globalThis as SolanaGlobals;
  if (g.__padforwardSolanaKeypair) return g.__padforwardSolanaKeypair;
  const secret = process.env.SOLANA_DONOR_SECRET;
  g.__padforwardSolanaKeypair = secret
    ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)))
    : Keypair.generate(); // ephemeral per cold start; funded by airdrop
  return g.__padforwardSolanaKeypair;
}

async function ensureFunded(conn: Connection, payer: Keypair): Promise<void> {
  const balance = await conn.getBalance(payer.publicKey);
  if (balance >= MIN_BALANCE_LAMPORTS) return;
  const sig = await conn.requestAirdrop(payer.publicKey, AIRDROP_LAMPORTS);
  const latest = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ signature: sig, ...latest }, "confirmed");
}

export interface DevnetTxResult {
  signature: string;
  explorerUrl: string;
}

/**
 * Record a donation on Solana devnet as a Memo transaction.
 * Throws on failure — callers should fall back to simulation.
 */
export async function recordDonationOnDevnet(
  quantity: number,
  solAmount: number,
  stationName: string
): Promise<DevnetTxResult> {
  const conn = getConnection();
  const payer = getDonorKeypair();
  await ensureFunded(conn, payer);

  const memo = `PadForward donation: ${quantity} pad(s) (${solAmount} SOL) -> ${stationName}`;
  const ix = new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
    data: Buffer.from(memo, "utf8"),
  });

  const latest = await conn.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: payer.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(ix);
  tx.sign(payer);

  const signature = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction({ signature, ...latest }, "confirmed");

  return {
    signature,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  };
}
