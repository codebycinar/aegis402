# Aegis402 — an x402-native risk-oracle agent for Casper

> Casper Agentic Buildathon 2026 — Qualification Round (DoraHacks).
> **One unified "Casper Innovation Track"**: Agentic AI with emphasis on DeFi + RWA.
> **Qualification deadline: 2026-06-30** (~13 days). Final Round: Jul 6–19.

## Prize reality (don't over-read the headline)

$150k total = **$30k cash** + $100k x402 ecosystem credits (spend-on-Casper, not
direct income) + $20k in-kind. The real cash pool is $30k. Build for the win,
but size expectations to the $30k cash.

## How you advance

Two paths out of Qualification: (a) **top-3 community votes on the CSPR.fans app**
skip the jury entirely; (b) **Builder Merit** — any project that meets technical
eligibility (working prototype on Casper Testnet with a transaction-producing
on-chain component) advances to the Final Round jury. We target (b) as the
floor and treat (a) as upside (needs social push).

## Originality rule — rewrite, don't copy

"All code and content must be **original and newly developed for the Buildathon**."
TradeGuard/GuardSkill are our own prior IP but were NOT written for this event,
so we **reference their architecture and rewrite fresh for Casper** — no
wholesale file copies. Most surface (x402, CSPR.cloud, oracle, Odra contract) is
net-new anyway.

## This concept matches official example direction #2

The buildathon's own suggested build #2 is "RWA Oracle Agents with verifiable
on-chain identity + reputation score." That validates the direction AND means
rivals will build it — so we differentiate on the **x402-monetized pay-per-call
gate** (agent pays to check before it transacts) plus an **on-chain reputation**
contract, not just a data-posting oracle.

## One-liner

An autonomous agent should not swap, lend, or buy a tokenized RWA without a
risk check — and it should pay for that check the same way it pays for anything
else: per call, on-chain, no API key. **Aegis402 is a pay-per-call risk oracle
(seller) plus an agent skill that gates every Casper transaction through it
(buyer), settled over the x402 Facilitator.** It closes the full x402 loop with
a use case judges can feel: an agent paying a few cents to avoid a bad trade.

## Why this wins

- **It is the x402 story, not a bolt-on.** Risk/diligence data is the textbook
  case for x402: high-value, per-request, no-subscription, machine-to-machine.
  We demo the *complete* round trip — request → `402` → sign → settle on-chain →
  data — with both sides built.
- **Spans 3 of 4 tracks.** Monetized service = DeFi & Payments. Autonomous
  self-protecting agent = Agentic AI. The oracle also scores tokenized-RWA
  products = RWA Tokenization.
- **~70% is already built and tested.** The verdict engine, MCP surface,
  LangChain tool, and market layer port directly from TradeGuard/GuardSkill
  (21/21 + 7/7 passing). The genuinely new surface is small and the SDKs exist.
- **Honest + verifiable.** Every settlement is a real testnet deploy hash the
  judges can open in the explorer.

## Architecture

```
            ┌─────────────────────────────┐
            │  Autonomous agent (LLM)     │
            │  "Should I swap X on        │
            │   CSPR.trade?"              │
            └──────────────┬──────────────┘
                           │ MCP / Agent Skill call
            ┌──────────────▼──────────────┐
   BUYER →  │  aegis-skill (TypeScript)   │   our code, reused scaffolding
            │  - wraps CSPR.trade actions │
            │  - calls the risk oracle    │
            │  - x402 client: parse 402,  │
            │    build+sign EIP-712 auth, │
            │    retry with payment       │
            └──────────────┬──────────────┘
                           │ GET /assess?asset=… (HTTP)
            ┌──────────────▼──────────────┐
  SELLER →  │  aegis-oracle (TypeScript)  │   our code
            │  Express + x402 middleware  │
            │  402 → requirements         │
            │  on pay → verify+settle     │
            │  behind paywall: RISK ENGINE│
            └───────┬─────────────┬───────┘
                    │             │
       /verify /settle        risk signals
                    │             │
       ┌────────────▼───┐  ┌──────▼─────────────────────┐
       │  x402          │  │ CSPR.cloud (on-chain) +     │
       │  Facilitator   │  │ CMC (market) + heuristics   │
       │  (SPONSORED,   │  └─────────────────────────────┘
       │   hosted by    │
       │   Casper)      │  → on-chain CEP-18 transfer_with_authorization
       └────────────────┘
```

We never run the facilitator or write any Go/Rust. The sponsored facilitator
does all signing-verification and the on-chain settlement deploy. Our two
processes are plain TypeScript over HTTP.

## The x402 loop (grounded in the real protocol)

Verified against `make-software/casper-x402` (`docs/api-reference.md`,
`examples/csprclick-x402/src/x402-utils.ts`) on 2026-06-17.

1. Buyer `GET /assess?asset=…` with no payment → seller replies `402` with a
   `PaymentRequiredHeader`:
   `{ x402Version: 2, error, resource{url}, accepts: [PaymentRequirement] }`
   where `PaymentRequirement = { scheme:"exact", network:"casper:casper-test",
   asset:<CEP-18 package hash>, amount:"<base units>", payTo:"00<64hex>",
   maxTimeoutSeconds, extra:{name, version, decimals} }`.
2. Buyer builds `ExactCasperAuthorization { from, to=payTo, value=amount,
   validAfter=now-600, validBefore=now+maxTimeout, nonce=<32 rand bytes> }`,
   computes the `TransferWithAuthorization` EIP-712 digest, and signs it.
3. Buyer retries with the base64-JSON `ExactCasperPayload { signature,
   publicKey, authorization }` in the `PAYMENT-SIGNATURE` header.
4. Seller forwards `{paymentPayload, paymentRequirements}` to the facilitator
   `POST /verify` then `POST /settle`. On `success:true` (returns a Casper
   deploy hash), the seller runs the risk engine and returns `200` + verdict.

### The one piece of new crypto — and why it's low-risk

Signing step 2 needs the Casper `TransferWithAuthorization` EIP-712 digest and
an ed25519 signature. Both have official TypeScript support:

- **`casper-ecosystem/casper-eip-712`** ships a `js/` package (51 KB TS) that
  produces the exact digest the facilitator verifies.
- **`casper-ecosystem/casper-js-sdk`** (TS, updated 2026-05) does ed25519
  keypair signing, returning the `[algo_byte][64 raw bytes]` 65-byte form the
  facilitator expects.

Mitigation ladder if the JS digest fights us: (a) port the 60-line
`x402-utils.ts` browser flow to headless; (b) last resort, shell out to the
repo's working Go client for the payment step only. Either keeps the demo real.

## Reuse map (what we are NOT rebuilding)

| Component | Source | Change |
|---|---|---|
| Verdict engine (trade/reduce/skip + score + maxAllocationPct) | TradeGuard `tradeguard.ts` | re-point inputs to Casper signals |
| Market context (CMC age/cap/volume, Fear&Greed) | TradeGuard `cmc.ts` | unchanged |
| MCP server surface | TradeGuard/GuardSkill `mcp.ts` | new tools: `assess_asset`, `gated_swap` |
| LangChain tool wrapper | `langchain.ts` | unchanged shape |
| Generic action/CLI + tests harness | `action.ts`, `test/` | extend |
| On-chain risk signals | GuardSkill `analyze.ts` (EVM) | replace with CSPR.cloud queries |

New code: `aegis-oracle` (Express + x402 middleware + risk aggregation),
`aegis-skill` x402 client (parse/sign/retry), CSPR.cloud signal adapter,
CSPR.trade action wrapper, demo.

## Risk engine (behind the paywall)

Per asset, returns `{ verdict: trade|reduce|skip, score, reasons[],
maxAllocationPct }` from:

- **On-chain (CSPR.cloud):** contract age, holder concentration, liquidity
  depth, recent transfer anomalies, deploy/owner history.
- **Market (CMC):** listing age, market cap, 24h volume, Fear & Greed.
- **RWA add-on:** for tokenized-RWA products, flags maturity/yield-claim
  mechanics (the exact failure classes we just audited: escrow-vs-pool drift,
  unreachable maturity, distribution stalls) as a checklist score.

This is advisory, not a security guarantee — stated plainly in the README so we
never over-claim (house rule).

## On-chain component (the mandatory part + a judging criterion)

Two transaction-producing on-chain pieces, both on **Casper Testnet**:

1. **x402 settlement** — every paid `/assess` triggers a real CEP-18
   `transfer_with_authorization` on testnet (via the sponsored facilitator). This
   alone satisfies the "transaction-producing on-chain component" advancement bar.
2. **`AegisRegistry` Odra contract (Rust, kept tiny)** — the oracle posts a
   `keccak(assessment)` attestation + bumps its own reputation counter on-chain
   after each call. This nails the **"Working Smart Contracts: deployed contracts
   on Casper Testnet"** judging criterion with *our own* contract and delivers the
   "verifiable on-chain identity + reputation" from example direction #2. Scope is
   deliberately a storage/registry contract (store hash, increment counter, read
   reputation) — generated with help from `odra.dev/llms.txt`. If it slips, piece
   #1 still meets the floor; the contract is the score-booster, not the gate.

   **CEP-96 metadata (buildathon team explicitly recommended this).** Embed the
   Odra `Cep96` SubModule (`odradev/odra` `modules/src/cep96.rs`) — no custom code,
   just declare `pub metadata: SubModule<Cep96>` and call
   `self.metadata.init(Some("Aegis402 Registry"), Some(<desc>), Some(<icon_uri>),
   Some(<project_uri>))` in the constructor. It writes four immutable named keys
   (`contract_name/description/icon_uri/project_uri`) that wallets/explorers read
   via `query_global_state`, giving the contract an authentic, self-declared
   on-chain identity — exactly the "verifiable on-chain identity" the RWA-oracle
   direction asks for, and a free UX/identity signal the judges will see. Ref:
   CEP-96 spec `casper-network/ceps/text/0096-contract-metadata.md`.

## Deliverables (DoraHacks BUIDL submission)

- Public **open-source** GitHub repo (monorepo: `oracle/`, `skill/`, `contract/`,
  `shared/`, `demo/`) with a thorough `README` (docs + usage instructions — required).
- **Working prototype deployed on Casper Testnet** with the on-chain component above.
- **Public demo video** (required) — walkthrough of the project + the x402 gate.
- `DESCRIBE.md` (BUIDL description), `BUIDL_FORM.md` (field values), `assets/logo.png`.
- Socials/launch note (judging rewards "real project with socials in place").

## ~13-day plan (qualification deadline 2026-06-30)

- **D1–2 (now):** scaffold monorepo; **spike the x402 signing** end-to-end against
  the sponsored testnet facilitator (make-or-break — do it first); fresh-write the
  verdict engine for Casper; stub CSPR.cloud signals.
- **D3–5:** `aegis-oracle` Express + x402 middleware; real 402 → verify → settle
  on testnet; risk aggregation live; capture a real deploy hash.
- **D6–7:** `AegisRegistry` Odra contract — deploy to testnet, post attestation +
  reputation from the oracle.
- **D8–9:** `aegis-skill` MCP tools + CSPR.trade wrapper + gated-swap flow.
- **D10–11:** CSPR.cloud signal adapter (real testnet data); RWA checklist; tests (≥20).
- **D12:** README + diagram + DESCRIBE; record demo video.
- **D13:** buffer + submit on DoraHacks; post socials.

If the x402 spike fails on D1–2, we fall back to the mitigation ladder before
sinking time into the rest — no building on an unproven base.

## Division of labor

- **Claude:** the whole repo — oracle, skill, x402 client, signal adapters,
  tests, README/DESCRIBE/BUIDL_FORM, logo, demo script.
- **User:** Casper testnet wallet + funded test CSPR / x402 CEP-18 test tokens,
  facilitator API key from the buildathon, run the demo, record ≤3 min, submit
  on DoraHacks.

## Reference repos & SDKs (verified 2026-06-17)

Build-critical:
- **`make-software/casper-x402`** (Go, official, hosted facilitator) — protocol of
  record. We target the *sponsored hosted* facilitator; cloned to `Arge/_ref-casper-x402`.
  `docs/api-reference.md` = the exact 402/verify/settle shapes.
- **`odradev/casper-x402-poc`** (Rust/Odra/Axum) — Odra + x402 + EIP-712 + CEP-18
  `transfer_with_authorization` patterns. Reference for the on-chain/authorization shape.
- **`casper-ecosystem/casper-eip-712`** (`js/` TS pkg) — `TransferWithAuthorization`
  EIP-712 digest in TypeScript (our headless signing).
- **`casper-ecosystem/casper-js-sdk`** (TS) — ed25519 keypair + signing.
- **`odradev/odra`** (`modules/src/cep96.rs`) — Odra framework + CEP-96 module +
  `cargo-odra`. Our `AegisRegistry` contract toolchain.

Helpful references:
- **`odradev/candlekeep-mcp`** — Odra-team MCP server example (our skill's MCP surface).
- **`odradev/casper-trade`** — Uniswap-V2 DEX on Casper (the swap our agent gates).
- **`odradev/odradev-plugins`** — Odra Claude Code extensions (speed up contract work).
- **`casper-network/odra-tutorials`**, **`casper-network/docs-redux`** — official docs/tutorials.
- CSPR.cloud REST/Streaming/Node — `docs.cspr.cloud`; Casper MCP — `docs.cspr.cloud/agentic-tools/mcp-server`.

## Resolved (verified 2026-06-17)

- **Hosted facilitator** = `https://x402-facilitator.cspr.cloud` (testnet+mainnet;
  `/supported /verify /settle`; every endpoint requires `Authorization`).
- **CSPR.cloud testnet REST** = `https://node.testnet.cspr.cloud`; auth is a raw
  UUID in the `Authorization` header (no "Bearer"); same token authorizes the
  facilitator. Server-side only.
- **Testnet RPC** = `https://node.testnet.casper.network/rpc` (no auth, live).
- **Faucet** = `https://testnet.cspr.live/tools/faucet`.
- All baked into `.env.example`.

## Access token — RESOLVED (2026-06-17)

- Have a working **CSPR.cloud testnet access token** (in local `.env`, gitignored).
  Verified it authorizes BOTH `node.testnet.cspr.cloud` (REST) and
  `x402-facilitator.cspr.cloud` (`/supported` → testnet feePayer
  `81d557c9…072c3a`, `/health` ok). One token, sent as raw UUID in `Authorization`.
- **The facilitator does NOT dictate the payment asset** — `/supported` returns
  only the feePayer. The **seller (oracle) chooses the CEP-18 token** and
  advertises it in the 402 requirements; the facilitator settles any valid
  `transfer_with_authorization`. So we are NOT blocked on a buildathon test token.

## Payment asset — we deploy our own (removes a dependency, adds a contract)

Deploy our own **CEP-18 token with `transfer_with_authorization`** (EIP-3009
style) to testnet — reference `infra/local/deployer/Cep18X402.wasm` in
`make-software/casper-x402`, or the odra cep18 template. We mint test balance to
the agent account ourselves (no external faucet for the payment token). Bonus:
a second deployed contract = more "Working Smart Contracts" credit.

## CSPR.click — NOT needed

CSPR.click is a *frontend* wallet-connect SDK (browser apps). Our agent is
headless and signs with a local ED25519 keypair via `casper-js-sdk`. We use the
CSPR.cloud access token server-side directly. Skip the CSPR.click key.

## Still needed (small)

- Fund the **agent + payee accounts** with a little test CSPR for gas-adjacent
  ops (faucet `testnet.cspr.live/tools/faucet`); we generate the keypairs.
