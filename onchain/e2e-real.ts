/**
 * Full real end-to-end: the agent skill calls the oracle, the oracle settles the
 * x402 payment on the LIVE Casper facilitator, and returns a risk verdict tied to
 * a real on-chain transaction. One paid assessment, start to finish.
 *
 *   node --import tsx onchain/e2e-real.ts
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import { createApp } from "../oracle/src/server.js";
import { loadConfig } from "../oracle/src/config.js";
import { makeContext, assessAsset } from "../skill/src/skill.js";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

async function main() {
  const cfg = { ...loadConfig(), mockFacilitator: false };
  console.log("oracle: real facilitator", cfg.facilitatorUrl, "· asset", cfg.asset.package.slice(0, 12) + "…");

  const app = createApp(cfg);
  const server: Server = await new Promise((res) => {
    const s = app.listen(0, () => res(s));
  });
  const port = (server.address() as { port: number }).port;

  const keyPath = fileURLToPath(new URL("../" + (process.env.AGENT_KEY_PATH ?? "./keys/agent.pem").replace(/^\.\//, ""), import.meta.url));
  const ctx = makeContext({ oracleUrl: `http://127.0.0.1:${port}`, keyPath });

  console.log("agent assessing asset (pays the oracle over x402)…\n");
  const r = await assessAsset(ctx, { asset: cfg.asset.package, symbol: "AX402" });

  console.log("verdict        :", r.verdict, `(score ${r.score})`);
  console.log("maxAllocation  :", r.maxAllocationPct + "%");
  console.log("reasons        :", r.reasons.join("; ") || "(none)");
  console.log("x402 payer     :", r.payment?.payer);
  console.log("on-chain settle:", r.payment?.transaction);
  console.log("explorer       : https://testnet.cspr.live/transaction/" + r.payment?.transaction);

  server.close();
}

main().catch((e) => {
  console.error("error:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
