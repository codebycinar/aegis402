# Demo video script (~3 minutes)

A simple screen recording with voiceover. No editing tricks needed.

## 0:00 — The problem (20s)
"Autonomous agents are starting to move real money on chain. But they have no
native way to pay for a risk check before they act. Subscriptions and API keys
don't work for software that signs up for nothing. Aegis402 fixes that on
Casper."

## 0:20 — The idea (25s)
Show the README architecture diagram.
"Aegis402 is two halves. A risk oracle that charges per call over x402, and an
agent skill that pays it and gates every trade on the answer. The agent pays a
few cents, on chain, and gets back a decision: trade, reduce, or skip."

## 0:45 — Run the demo (60s)
Terminal: `npm run demo`.
Walk through the four lines as they print:
- "CSPR, a blue-chip quote asset, scores low. Trade, full size."
- "A thin, concentrated token. The gate reduces the position to a fraction."
- "A healthy tokenized RWA with a reachable maturity and an audit. Trade."
- "An RWA whose maturity can never be reached, so funds could lock. Hard skip,
  zero allocation."
"Every one of those was gated behind a real x402 micro-payment. You can see the
settlement transaction on each line."

## 1:45 — The x402 loop is real (40s)
Terminal: `npm run spike --workspace skill` (with .env configured).
"This isn't a mock. Here we sign a payment with a real Casper key and send it to
the live testnet facilitator. It returns valid. Our TypeScript signing is byte
compatible with Casper's x402 verifier."

## 2:25 — How agents use it (25s)
Show `npm run mcp` starting, and the two tools.
"The gate is exposed over MCP and LangChain, so it drops straight into the
Casper AI Toolkit or any agent. Two tools: assess an asset, or gate a swap."

## 2:50 — Close (15s)
"Aegis402. Diligence as a pay-per-call service, so an agent never trades blind.
Built on Casper for the Agentic Buildathon. Thanks for watching."

## Tips
- Keep the terminal font large.
- Run `npm test` once before recording so dependencies are warm.
- If showing the spike, make sure `.env` has the CSPR.cloud token and
  `keys/agent.pem` is in place.
