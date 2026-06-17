# Aegis402 (BUIDL description)

Aegis402 is an x402-native risk gate for autonomous agents on Casper. It gives an
agent a simple rule it can live by: never put money into an asset without paying
for a risk check first, the same way it pays for any other service, per call and
on chain.

There are two halves and the project ships both. The seller is a pay-per-call
risk oracle. When an agent asks it to assess an asset, it answers with HTTP 402
and a price. The buyer is an agent skill that reads that challenge, signs a
Casper x402 payment authorization, and retries. The hosted Casper x402
Facilitator verifies the signature and settles the micro-payment on chain, and
only then does the oracle run its risk engine and return a verdict. The verdict
is a gate the agent can act on directly: trade, reduce, or skip, with a capped
position size.

The risk engine scores an asset from on-chain signals (contract age, holder
concentration, liquidity depth), market signals (listing age, market cap,
volume, fear and greed), and a real-world-asset checklist that flags the failure
modes that actually sink tokenized products, such as a maturity that can never be
reached or escrow accounting that drifts away from the funded pool. Any of those
is a hard skip.

This is a clean fit for x402 because diligence data is exactly the kind of
high-value, per-request information that does not belong behind a human
subscription. The project demonstrates the full x402 round trip with both sides
built, and the payment signature is verified working against the live Casper
facilitator. It surfaces to agents through MCP and LangChain, so it drops into
the Casper AI Toolkit or any agent framework.

The oracle also has an on-chain identity. AegisRegistry, our own Odra contract,
records a hash of each verdict and a per-assessor reputation counter that grows
with every attestation, so an oracle builds a verifiable track record on chain.
It carries CEP-96 metadata for a self-declared identity. Because the verdict
engine is deterministic, anyone can recompute a verdict and check its hash
against what was posted.

This is all live on Casper testnet, not a mock. We deployed the CEP-18 payment
token and the AegisRegistry contract, settle real x402 payments on chain through
the hosted facilitator, and publish verdicts to the registry. Every step has a
real transaction hash in the explorer.

It is honest about its limits. The risk verdict is advisory diligence, a first
line of defense against obvious traps, not a security certification. Verdicts are
deterministic so an agent and an on-chain attestation can always agree.

Stack: TypeScript end to end. EIP-712 digests via the official casper-eip-712
sources, secp256k1 signing matched to casper-go-sdk, payments over the hosted
x402 Facilitator, on-chain data from CSPR.cloud. Fifteen tests pass and an
end-to-end demo runs with no setup.
