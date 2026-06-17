/**
 * Aegis402 agent skill — the buyer-side, agent-facing API.
 *
 * An autonomous agent uses these two capabilities:
 *  - assessAsset:  pay the x402 risk oracle per call and get a gate decision.
 *  - gatedSwap:    wrap an intended trade so it only proceeds if risk allows,
 *                  with the allocation capped by the oracle's verdict.
 *
 * The x402 micro-payment is handled transparently (402 → sign → settle).
 */
import { loadSigner, type CasperSigner } from "./signer.js";
import { fetchPaid } from "./x402-client.js";

export interface SkillContext {
  oracleUrl: string;
  signer: CasperSigner;
}

export interface SkillConfig {
  oracleUrl: string;
  keyPath: string;
}

export function makeContext(cfg: SkillConfig): SkillContext {
  return { oracleUrl: cfg.oracleUrl.replace(/\/+$/, ""), signer: loadSigner(cfg.keyPath) };
}

export function configFromEnv(env = process.env): SkillConfig {
  return {
    oracleUrl: (env.ORACLE_URL ?? "http://localhost:4021").trim(),
    keyPath: (env.AGENT_KEY_PATH ?? "./keys/agent.pem").trim(),
  };
}

export type Verdict = "trade" | "reduce" | "skip";

export interface AssessQuery {
  /** CEP-18 contract package hash (64-hex) or an asset id/symbol. */
  asset: string;
  symbol?: string;
  isQuoteAsset?: boolean;
  /** Mark the asset as a tokenized RWA to engage the RWA checklist. */
  rwa?: boolean;
  rwaSignals?: {
    maturityReachable?: boolean;
    escrowConsistent?: boolean;
    distributionHealthy?: boolean;
    holderClaimRecoverable?: boolean;
    auditReferenced?: boolean;
  };
  /** Optional on-chain signals the agent already holds (the oracle uses these as overrides). */
  signals?: {
    liquidityUsd?: number;
    top1HolderPct?: number;
    holderCount?: number;
    contractAgeDays?: number;
  };
}

export interface AssessResult {
  asset: string;
  verdict: Verdict;
  score: number;
  maxAllocationPct: number;
  reasons: string[];
  hardFlags: string[];
  payment?: { payer: string; transaction: string };
  network?: string;
}

function buildAssessUrl(ctx: SkillContext, q: AssessQuery): string {
  const p = new URLSearchParams();
  p.set("asset", q.asset);
  if (q.symbol) p.set("symbol", q.symbol);
  if (q.isQuoteAsset) p.set("isQuote", "1");
  if (q.rwa) {
    p.set("rwa", "1");
    const s = q.rwaSignals ?? {};
    for (const [k, v] of Object.entries(s)) if (v !== undefined) p.set(k, v ? "1" : "0");
  }
  if (q.signals) {
    for (const [k, v] of Object.entries(q.signals)) if (v !== undefined) p.set(k, String(v));
  }
  return `${ctx.oracleUrl}/assess?${p.toString()}`;
}

/** Pay the oracle (x402) and return its risk verdict. */
export async function assessAsset(ctx: SkillContext, q: AssessQuery): Promise<AssessResult> {
  const res = await fetchPaid(buildAssessUrl(ctx, q), ctx.signer);
  if (res.status !== 200) {
    throw new Error(`oracle returned HTTP ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body as AssessResult;
}

export interface GatedSwapInput extends AssessQuery {
  /** Intended notional in USD the agent wants to deploy. */
  amountUsd: number;
}

export interface GatedSwapResult {
  allowed: boolean;
  action: "execute" | "reduce" | "block";
  /** USD notional the agent is cleared to deploy after the gate. */
  approvedUsd: number;
  assessment: AssessResult;
  note: string;
}

/**
 * Gate an intended trade through the risk oracle. The agent pays per check; the
 * verdict decides whether to execute in full, execute a reduced size, or block.
 * (Executing the actual CSPR.trade swap is the agent's responsibility — this
 * returns the cleared size so the agent never over-commits to a risky asset.)
 */
export async function gatedSwap(ctx: SkillContext, input: GatedSwapInput): Promise<GatedSwapResult> {
  const a = await assessAsset(ctx, input);
  const approvedUsd = Math.round(((input.amountUsd * a.maxAllocationPct) / 100) * 100) / 100;
  if (a.verdict === "skip") {
    return { allowed: false, action: "block", approvedUsd: 0, assessment: a, note: `Blocked: ${a.hardFlags.join("; ") || a.reasons.slice(0, 2).join("; ")}` };
  }
  if (a.verdict === "reduce") {
    return { allowed: true, action: "reduce", approvedUsd, assessment: a, note: `Reduced to ${a.maxAllocationPct}% (${approvedUsd} of ${input.amountUsd} USD) — risk score ${a.score}` };
  }
  return { allowed: true, action: "execute", approvedUsd: input.amountUsd, assessment: a, note: `Cleared: risk score ${a.score}` };
}
