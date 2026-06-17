/**
 * Make-or-break spike: prove our TypeScript x402 signing is byte-compatible with
 * the hosted Casper facilitator's verifier — WITHOUT deploying any token yet.
 *
 * We build a payment for a synthetic requirement and POST it to the REAL
 * facilitator /verify (which checks the signature but does not settle on-chain).
 * isValid:true means the whole signing path (PEM → digest → secp256k1) is correct.
 *
 * Run: npm run spike   (needs CSPR_CLOUD_TOKEN + AGENT_KEY_PATH in ../.env)
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import type { PaymentRequirement, FacilitatorVerifyResponse } from "@aegis402/shared";
import { loadSigner } from "./signer.js";
import { buildPaymentEnvelope } from "./x402-client.js";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const FACILITATOR = (process.env.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud").trim();
const TOKEN = (process.env.X402_FACILITATOR_TOKEN || process.env.CSPR_CLOUD_TOKEN || "").trim();
const KEY_PATH = (process.env.AGENT_KEY_PATH ?? "./keys/agent.pem").trim();
const NETWORK = (process.env.CASPER_NETWORK ?? "casper:casper-test").trim();
const EXPECTED_PUBKEY = "0203ee211f64f2d84351fc71ef7f6428ee6da7a26138b4e50ea71021142b731dcc57";

async function main() {
  if (!TOKEN) throw new Error("missing CSPR_CLOUD_TOKEN / X402_FACILITATOR_TOKEN in .env");

  // key path is relative to repo root
  const keyAbs = fileURLToPath(new URL("../../" + KEY_PATH.replace(/^\.\//, ""), import.meta.url));
  const signer = loadSigner(keyAbs);

  console.log("derived publicKey :", signer.publicKeyHex);
  console.log("expected publicKey:", EXPECTED_PUBKEY);
  console.log("pubkey match      :", signer.publicKeyHex.toLowerCase() === EXPECTED_PUBKEY.toLowerCase() ? "✓" : "✗ MISMATCH");
  console.log("account hash      :", signer.accountHash);

  const req: PaymentRequirement = {
    scheme: "exact",
    network: NETWORK,
    asset: "11".repeat(32), // synthetic asset; /verify checks the signature, not on-chain existence
    amount: "7500000000",
    payTo: signer.accountAddress, // self-pay is fine for a verify-only check
    maxTimeoutSeconds: 900,
    extra: { name: "AegisUSD", version: "1", decimals: "9" },
  };

  const envelope = buildPaymentEnvelope(signer, req);
  console.log("\nsignature         :", envelope.payload.signature.slice(0, 20) + "…", `(${envelope.payload.signature.length / 2} bytes)`);

  const res = await fetch(`${FACILITATOR}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ paymentPayload: envelope, paymentRequirements: req }),
  });

  const text = await res.text();
  let parsed: FacilitatorVerifyResponse | null = null;
  try { parsed = JSON.parse(text) as FacilitatorVerifyResponse; } catch { /* keep raw */ }

  console.log("\n=== facilitator /verify ===");
  console.log("HTTP", res.status);
  console.log(parsed ?? text.slice(0, 400));

  if (parsed?.isValid) {
    console.log("\n✅ SPIKE PASSED — our TS signing is facilitator-valid. Safe to build the rest.");
  } else {
    console.log("\n❌ SPIKE FAILED — reason:", parsed?.invalidReason ?? "(see above)");
    console.log("   Iterate the domain/encoding in x402-client.ts against this reason.");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("spike error:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
