# DoraHacks BUIDL form values — Aegis402

Casper Agentic Buildathon 2026 (Qualification Round). Fill these into the
DoraHacks BUIDL form when submitting.

## Basics
- Name: Aegis402
- Tagline / one-liner: An x402-native risk gate for autonomous Casper agents. Agents pay per check before they trade.
- Track: Casper Innovation Track (Agentic AI, focus on DeFi + RWA)
- Category: Crypto / Web3, AI Agent
- Is this an AI Agent? Yes (an agent skill: pay-per-call risk gate, exposed via MCP and LangChain)

## Vision (≤256 chars)
Autonomous agents move real money but have no native way to pay for a risk check before they act. Aegis402 makes diligence a pay-per-call x402 service on Casper, so any agent can gate a trade with a verifiable on-chain micro-payment.

## Description
See DESCRIBE.md (paste its body into the "Describe your BUIDL" markdown field).

## Tech / ecosystem tags
- Casper, x402, CSPR.cloud, MCP (Model Context Protocol), LangChain, TypeScript
- Odra (smart contract), CEP-96 (contract metadata), CEP-18 (payment token)
- EIP-712 (casper-eip-712), secp256k1 (casper-go-sdk compatible), casper-js-sdk

## Links
- GitHub: (push the repo public, then paste the URL)
- Demo video: (record ~3 min, see DEMO_SCRIPT.md)

## Submission checklist (from the rules)
- [x] Open-source GitHub repo with README (README.md) — push it public, then paste the URL
- [x] Working prototype on Casper Testnet with a transaction-producing on-chain component
      DONE. On testnet (testnet.cspr.live/transaction/<hash>):
      - CEP-18 payment token: package a8d8eaa5dbb344f42c182e08dc7b4676376614ac379fe4f1040b4187e2f3698f
      - AegisRegistry (our own Odra contract, CEP-96): package 120cab337dfaf063abcdbc64093d464a9eadb5b81c27c4f5ef6c34ac7499ebde
      - real x402 settlement: d30ebbb46d31c89b6eac940169addfd2c89abb744da067348e8746a9606ca604
      - full agent→oracle→on-chain: 203d963cdb962aebf09dc1e36afa36cd63694a5e49a64d6dfd0838ad542175b7
      - on-chain attestation (oracle verdict → registry): 9a1e1787b5c0ae5e0e69870427f2eae83aa67023ea8b283b777a43f8f346a5fd
- [ ] Public demo video walkthrough (record ~3 min, see DEMO_SCRIPT.md)
- [ ] Register the BUIDL on DoraHacks (solo)
- [ ] Socials in place (judging rewards a real project with a launch plan)

## Team
Solo builder. Writing code since 2008; background in software engineering and
smart-contract security review. Built Aegis402 end to end for this buildathon.

## Notes for the submitter
- The repo runs with no setup: npm install, npm test (15 pass), npm run demo.
- The x402 signing is verified against the live testnet facilitator.
- Cash prize pool is 30k USD; the rest of the 150k is x402 ecosystem credits and
  in-kind. Size expectations accordingly.
