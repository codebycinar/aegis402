# Aegis402

An x402-native risk gate for autonomous agents on Casper. An agent should not
swap, lend, or buy a tokenized real-world asset without a risk check, and it
should pay for that check the same way it pays for anything else: per call, on
chain, with no API key. Aegis402 is a pay-per-call risk oracle plus an agent
skill that routes every trade through it, settled over the Casper x402
Facilitator.

Built for the Casper Agentic Buildathon 2026 (Agentic AI, with a focus on DeFi
and RWA).

## Why this shape

Risk and diligence data is close to the perfect use case for x402. It is
high value, wanted per request, and pointless to put behind a monthly
subscription that an autonomous agent cannot sign up for. So Aegis402 builds
both sides of the loop and shows the whole round trip: a request comes back as
HTTP 402 with a price, the agent signs an authorization, the facilitator settles
the payment on Casper, and only then does the agent get its answer.

The answer is a gate, not a number the agent has to interpret: trade, reduce, or
skip, with a capped allocation. An agent can act on it directly.

## How it works

```
agent ──MCP / LangChain──▶ aegis-skill (buyer)
                              │  GET /assess
                              ▼
                           aegis-oracle (seller, x402-gated)
                              │  402 → verify → settle
                              ▼
                           Casper x402 Facilitator  ──▶ on-chain CEP-18 transfer
                              ▲
                           risk engine: on-chain + market + RWA checklist
```

The skill is the buyer. It parses the 402 challenge, builds the
`TransferWithAuthorization` EIP-712 digest, signs it with the agent's Casper
secp256k1 key, and retries with the payment attached. The oracle is the seller.
It advertises a price, forwards the signed payment to the hosted facilitator for
verification and settlement, and then runs the risk engine behind the paywall.

We never run the facilitator or write any settlement crypto on the server. The
hosted facilitator does the signature verification and the on-chain transfer.
Everything we ship is TypeScript over HTTP.

### The risk engine

Behind the paywall, the oracle scores an asset from three sources and returns a
gate decision:

- On-chain signals from CSPR.cloud: contract age, holder count and
  concentration, liquidity depth, recent transfer anomalies.
- Market signals from CoinMarketCap: listing age, market cap, 24h volume, the
  Fear and Greed index.
- An RWA checklist drawn from real tokenized-asset failure modes: is maturity or
  redemption reachable, does escrow accounting stay consistent with the funded
  pool, can a holder always recover their claim. Any of these failing is a hard
  skip.

This is advisory diligence, not a security guarantee. It is meant to stop an
autonomous agent from walking into an obvious trap, not to certify an asset.

## Run it

No keys or tokens are needed for the demo and tests. Everything runs against an
in-repo mock facilitator.

```bash
npm install
npm test          # 15 tests across shared, oracle, skill
npm run demo      # end-to-end: agent pays, gets gated verdicts for 4 assets
```

To run the oracle and assess an asset from the terminal:

```bash
npm run oracle                              # seller on :4021
npm run assess --workspace skill -- <asset> --usd 1000
```

To expose the gate to an MCP-capable agent (Casper AI Toolkit, Claude, and so
on):

```bash
npm run mcp --workspace skill               # tools: assess_asset, gated_swap
```

## x402 signing, verified against the live facilitator

The one piece of real crypto is the payment signature, and it is confirmed
working against the hosted Casper facilitator (`/verify` returns valid). The
recipe, for anyone integrating Casper x402 from TypeScript:

- Digest: EIP-712 `TransferWithAuthorization`, with `from` and `to` as the
  33-byte Casper account hash encoded as an `address`, `value` and the validity
  window as `uint256`, and a `bytes32` nonce. The domain carries `name`,
  `version`, `chain_name`, and the asset `contract_package_hash`.
- Signature: Casper secp256k1 signs over `sha256(digest)`, canonical low-S, as
  `R || S`, sent on the wire as the algorithm tag `02` followed by the 64 byte
  signature.
- Payload: the chosen requirement is echoed back as `accepted`, and the
  facilitator reads the scheme from there.

The EIP-712 digest is built with the official `casper-eip-712` TypeScript
sources, vendored under `skill/src/eip712` because the package is not on npm.

## On-chain, live on testnet

The full loop is proven on Casper testnet, not just in mock. We deployed a CEP-18
payment token (the rail the agent pays in), and the hosted facilitator settles
each payment as a real `transfer_with_authorization` on chain.

- Payment token (CEP-18, `transfer_with_authorization`):
  package `a8d8eaa5dbb344f42c182e08dc7b4676376614ac379fe4f1040b4187e2f3698f`.
- AegisRegistry, our own Odra contract:
  package `120cab337dfaf063abcdbc64093d464a9eadb5b81c27c4f5ef6c34ac7499ebde`.
- Settlement, a full buyer-to-oracle-to-chain run, and an on-chain attestation
  all produce real transactions you can open in the explorer.

```bash
node --import tsx onchain/deploy-token.ts     # deploy the payment token (one time)
node --import tsx onchain/settle-test.ts       # sign + settle a payment on chain
node --import tsx onchain/e2e-real.ts          # agent → oracle → live settle → verdict
node --import tsx onchain/deploy-registry.ts    # deploy AegisRegistry (one time)
node --import tsx onchain/attest.ts             # publish a verdict to the registry on chain
```

These need `.env` filled in (a CSPR.cloud token and a funded `keys/agent.pem`).
The `onchain/cep18x402.wasm` rail is the reference token from make-software, used
unmodified as the unit of payment (see onchain/ATTRIBUTION.md). Gas note: the
install lane is capped near 812 CSPR per transaction on testnet, so the installs
run at an 800 CSPR budget.

### AegisRegistry, an on-chain identity for the oracle

The oracle does not just hand back a verdict and forget it. The same risk engine
that runs behind the paywall can publish a hash of each verdict to AegisRegistry,
our own Odra contract (`contract/`). The contract keeps the latest verdict hash
per asset and a per-assessor reputation counter that grows with every
attestation, so an oracle builds a verifiable on-chain track record. Because the
verdict engine is deterministic, anyone can recompute a verdict and check its
hash against what was posted. The contract carries CEP-96 metadata, so wallets
and explorers show its self-declared identity. `onchain/attest.ts` runs the full
link: compute a verdict, hash it, and record it on chain.

## Layout

```
shared/   x402 protocol types + the deterministic risk engine + verdict hashing
oracle/   the seller: Express + x402 middleware + signal gathering
skill/    the buyer: signer, x402 client, agent API, MCP + LangChain surfaces
contract/ AegisRegistry, our Odra contract (attestation + reputation + CEP-96)
onchain/  deploy + settle + attest scripts (casper-js-sdk)
demo/     a runnable end-to-end walkthrough
```

## Status and honesty

The full buyer to seller to gate loop works, is tested, and runs live on Casper
testnet. The x402 signature is validated against the real facilitator, the
payment token is deployed, and a complete agent-to-oracle assessment settles a
real on-chain transfer. A mock facilitator is also included so the project runs
end to end with zero setup, for demos and CI.

The risk engine is a useful first line of defense, not a guarantee. Verdicts are
deterministic and reproducible so an agent and an on-chain attestation can agree.

## License

MIT.
