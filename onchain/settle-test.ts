/**
 * Real x402 settlement: sign a payment with the agent key and have the hosted
 * facilitator settle it on-chain (a real CEP-18 transfer_with_authorization of
 * our deployed AX402 token). Prints the on-chain transaction hash.
 *
 *   node --import tsx onchain/settle-test.ts
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import type { PaymentRequirement, FacilitatorSettleResponse } from "@aegis402/shared";
import { loadSigner } from "../skill/src/signer.js";
import { buildPaymentEnvelope } from "../skill/src/x402-client.js";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const FAC = (process.env.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud").trim();
const TOKEN = (process.env.X402_FACILITATOR_TOKEN || process.env.CSPR_CLOUD_TOKEN || "").trim();
const KEY = fileURLToPath(new URL("../" + (process.env.AGENT_KEY_PATH ?? "./keys/agent.pem").replace(/^\.\//, ""), import.meta.url));

async function main() {
  if (!TOKEN) throw new Error("missing CSPR_CLOUD_TOKEN");
  const signer = loadSigner(KEY);

  const req: PaymentRequirement = {
    scheme: "exact",
    network: process.env.CASPER_NETWORK ?? "casper:casper-test",
    asset: (process.env.X402_ASSET_PACKAGE ?? "").trim(),
    amount: (process.env.X402_PRICE ?? "7500000000").trim(),
    payTo: (process.env.ORACLE_PAYEE_ADDRESS ?? "").trim(),
    maxTimeoutSeconds: 900,
    extra: {
      name: (process.env.X402_ASSET_NAME ?? "").trim(),
      version: (process.env.X402_ASSET_VERSION ?? "1").trim(),
      decimals: (process.env.X402_ASSET_DECIMALS ?? "9").trim(),
    },
  };
  console.log("asset :", req.asset);
  console.log("payer :", signer.accountAddress);
  console.log("payTo :", req.payTo);
  console.log("amount:", req.amount, `(${req.extra?.name})`);

  const envelope = buildPaymentEnvelope(signer, req);

  const res = await fetch(`${FAC}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ paymentPayload: envelope, paymentRequirements: req }),
  });
  const body = (await res.json()) as FacilitatorSettleResponse;
  console.log("\n=== facilitator /settle ===");
  console.log("HTTP", res.status);
  console.log(body);

  if (body.success) {
    console.log("\n✅ REAL ON-CHAIN SETTLEMENT");
    console.log("tx:", body.transaction);
    console.log("explorer: https://testnet.cspr.live/transaction/" + body.transaction);
  } else {
    console.log("\n❌ settle failed:", body.errorReason, body.errorMessage);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("error:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
