import express from "express";
import { assess, type RwaSignals } from "@aegis402/shared";
import { loadConfig, paymentRequirement, type OracleConfig } from "./config.js";
import { makeFacilitator } from "./facilitator.js";
import { requirePayment, type PaidRequest } from "./x402-middleware.js";
import { gatherSignals, type AssessRequest } from "./signals.js";

export function createApp(cfg: OracleConfig = loadConfig()) {
  const app = express();
  app.use(express.json());

  const requirement = paymentRequirement(cfg);
  const facilitator = makeFacilitator(cfg);

  // Open liveness probe.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "aegis402-oracle", mock: cfg.mockFacilitator, network: cfg.network });
  });

  // The paid risk endpoint. The agent pays per call; behind the paywall we run
  // the risk engine over gathered signals and return a gate decision.
  app.get("/assess", requirePayment(requirement, facilitator), async (req: PaidRequest, res) => {
    const q = req.query;
    const assessReq: AssessRequest = {
      asset: String(q.asset ?? ""),
      symbol: q.symbol ? String(q.symbol) : undefined,
      isQuoteAsset: q.isQuote === "1" || q.isQuote === "true",
      rwa: parseRwa(q),
      overrides: parseOverrides(q),
    };
    if (!assessReq.asset) {
      res.status(400).json({ error: "missing ?asset=<package-hash|id>" });
      return;
    }
    const signals = await gatherSignals(assessReq, cfg);
    const verdict = assess(signals);
    res.json({
      asset: assessReq.asset,
      verdict: verdict.verdict,
      score: verdict.score,
      maxAllocationPct: verdict.maxAllocationPct,
      reasons: verdict.reasons,
      hardFlags: verdict.hardFlags,
      payment: req.x402, // { payer, transaction }
      network: cfg.network,
    });
  });

  return app;
}

function parseRwa(q: express.Request["query"]): RwaSignals | undefined {
  if (q.rwa !== "1" && q.rwa !== "true") return undefined;
  const bool = (v: unknown): boolean | undefined =>
    v === undefined ? undefined : v === "1" || v === "true";
  return {
    isRwa: true,
    maturityReachable: bool(q.maturityReachable),
    escrowConsistent: bool(q.escrowConsistent),
    distributionHealthy: bool(q.distributionHealthy),
    holderClaimRecoverable: bool(q.holderClaimRecoverable),
    auditReferenced: bool(q.auditReferenced),
  };
}

function parseOverrides(q: express.Request["query"]): AssessRequest["overrides"] {
  const num = (v: unknown): number | undefined => (v === undefined ? undefined : Number(v));
  const onchain: Record<string, unknown> = {};
  if (q.liquidityUsd !== undefined) onchain.liquidityUsd = num(q.liquidityUsd);
  if (q.top1HolderPct !== undefined) onchain.top1HolderPct = num(q.top1HolderPct);
  if (q.holderCount !== undefined) onchain.holderCount = num(q.holderCount);
  if (q.contractAgeDays !== undefined) onchain.contractAgeDays = num(q.contractAgeDays);
  return Object.keys(onchain).length ? { onchain: onchain as never } : undefined;
}

// Boot when run directly.
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("server.ts");
if (isMain) {
  const cfg = loadConfig();
  const app = createApp(cfg);
  app.listen(cfg.port, () => {
    console.log(`aegis402-oracle on :${cfg.port} (mock=${cfg.mockFacilitator}, network=${cfg.network})`);
  });
}
