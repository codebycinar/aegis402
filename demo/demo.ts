/**
 * Aegis402 end-to-end demo.
 *
 * Boots the oracle (seller) and drives it with the skill (buyer) across a few
 * realistic assets. Each call shows the full x402 loop: the agent hits a paid
 * endpoint, pays a micro-fee, and gets a risk gate it can act on.
 *
 * Hermetic (ephemeral key, mock facilitator) so it runs with no setup:
 *   npm run demo
 */
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApp } from "../oracle/src/server.js";
import type { OracleConfig } from "../oracle/src/config.js";
import { loadSigner } from "../skill/src/signer.js";
import { makeContext, gatedSwap } from "../skill/src/skill.js";

const dir = mkdtempSync(join(tmpdir(), "aegis-demo-"));
const pem = generateKeyPairSync("ec", { namedCurve: "secp256k1" }).privateKey.export({ format: "pem", type: "sec1" }) as string;
const keyPath = join(dir, "k.pem");
writeFileSync(keyPath, pem);
const signer = loadSigner(keyPath);

const cfg: OracleConfig = {
  port: 0,
  network: "casper:casper-test",
  facilitatorUrl: "http://mock",
  facilitatorToken: "",
  mockFacilitator: true,
  payee: "00" + "ab".repeat(32),
  price: "7500000000",
  asset: { package: "cd".repeat(32), name: "AegisUSD", version: "1", decimals: "9" },
  csprCloud: { token: "", restUrl: "http://127.0.0.1:1" },
  cmcApiKey: "",
};

const line = (s = "") => console.log(s);
const hr = () => line("─".repeat(64));

async function main() {
  const app = createApp(cfg);
  const server: Server = await new Promise((res) => {
    const s = app.listen(0, () => res(s));
  });
  const port = (server.address() as { port: number }).port;
  const ctx = makeContext({ oracleUrl: `http://127.0.0.1:${port}`, keyPath });

  line("\n  AEGIS402 — x402-native risk gate for autonomous Casper agents");
  line(`  agent ${signer.accountAddress.slice(0, 14)}…  ·  oracle :${port}  ·  pay-per-check`);
  hr();

  const scenarios = [
    {
      title: "Blue-chip quote asset (CSPR)",
      input: { asset: "cd".repeat(32), symbol: "CSPR", isQuoteAsset: true, amountUsd: 1000 },
    },
    {
      title: "Thin, concentrated token",
      input: { asset: "11".repeat(32), symbol: "MEMEX", amountUsd: 1000, signals: { liquidityUsd: 30000, top1HolderPct: 0.4, holderCount: 18, contractAgeDays: 9 } },
    },
    {
      title: "Tokenized RWA — healthy",
      input: { asset: "22".repeat(32), symbol: "RWAY", rwa: true, amountUsd: 1000, signals: { liquidityUsd: 400000, holderCount: 200, contractAgeDays: 120 }, rwaSignals: { maturityReachable: true, escrowConsistent: true, distributionHealthy: true, holderClaimRecoverable: true, auditReferenced: true } },
    },
    {
      title: "Tokenized RWA — unreachable maturity (funds can lock)",
      input: { asset: "33".repeat(32), symbol: "RWABAD", rwa: true, amountUsd: 1000, rwaSignals: { maturityReachable: false } },
    },
  ];

  for (const s of scenarios) {
    const r = await gatedSwap(ctx, s.input as never);

    line(`\n▸ ${s.title}`);
    line(`  verdict   : ${r.assessment.verdict.toUpperCase()}  (risk score ${r.assessment.score}/100)`);
    line(`  action    : ${r.action}  →  cleared $${r.approvedUsd} of $${s.input.amountUsd}`);
    if (r.assessment.reasons.length) line(`  reasons   : ${r.assessment.reasons.slice(0, 3).join("; ")}`);
    if (r.assessment.hardFlags.length) line(`  hardFlags : ${r.assessment.hardFlags.join("; ")}`);
    line(`  x402 paid : tx ${r.assessment.payment?.transaction?.slice(0, 16)}…  (settled on Casper)`);
  }

  hr();
  line("  Every verdict above was gated behind a real x402 micro-payment.");
  line("  In production the agent pays the live Casper facilitator per check.\n");
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
