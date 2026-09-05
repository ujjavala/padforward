"""Solana payment service.

Demo mode (default, no keys needed): simulates a devnet transfer and
returns a deterministic-looking transaction signature. The interface is
designed so a real implementation using solana-py / @solana/web3.js and
an RPC endpoint can be dropped in without changing callers.
"""
import secrets
import string

from app.schemas.schemas import SolQuoteOut

# Demo pricing — fixed so the flow is reproducible without a price oracle.
SOL_PRICE_USD = 150.0
PAD_PRICE_USD = 0.30
NETWORK = "devnet (simulated)"

_BASE58 = string.ascii_letters.replace("l", "").replace("I", "").replace("O", "") + "123456789"


def quote(quantity: int) -> SolQuoteOut:
    """Quote how much SOL funds `quantity` pads."""
    sol_amount = round(quantity * PAD_PRICE_USD / SOL_PRICE_USD, 6)
    return SolQuoteOut(
        quantity=quantity,
        sol_amount=sol_amount,
        sol_price_usd=SOL_PRICE_USD,
        pad_price_usd=PAD_PRICE_USD,
        network=NETWORK,
        demo=True,
    )


def process_payment(quantity: int, wallet_address: str | None) -> tuple[float, str]:
    """Simulate a SOL transfer; returns (sol_amount, tx_signature).

    A real implementation would build and confirm a transfer on-chain and
    return the confirmed signature.
    """
    sol_amount = quote(quantity).sol_amount
    signature = "".join(secrets.choice(_BASE58) for _ in range(88))
    return sol_amount, signature
