/**
 * Aegis402 risk verdict engine.
 *
 * Deterministic, explainable risk scoring for a Casper asset or tokenized-RWA
 * product. Lives behind the oracle's x402 paywall: an autonomous agent pays a
 * micro-fee, hands us signals, and gets back a gate decision it can act on.
 *
 * Written fresh for the Casper Agentic Buildathon (Agentic AI + DeFi/RWA).
 * Score is 0..100 where HIGHER = RISKIER. The verdict maps a risk score and a
 * set of hard disqualifiers to one of trade | reduce | skip, plus an allocation
 * ceiling the agent should respect.
 *
 * This is advisory diligence, not a security guarantee — see README.
 */

export type Verdict = "trade" | "reduce" | "skip";

/** On-chain signals, typically sourced from CSPR.cloud. All optional: absent = unknown. */
export interface OnChainSignals {
  /** Age of the asset's contract in days. Very new = riskier. */
  contractAgeDays?: number;
  /** Distinct holder count. Few holders = thin / capturable. */
  holderCount?: number;
  /** Share of supply held by the single largest holder, 0..1. */
  top1HolderPct?: number;
  /** Share of supply held by the top 10 holders, 0..1. */
  top10HolderPct?: number;
  /** On-chain liquidity depth in USD (e.g. DEX pool). */
  liquidityUsd?: number;
  /** True if an abnormal recent spike/dump in transfers was detected. */
  recentTransferAnomaly?: boolean;
  /** True if the contract source is verified/known. */
  verifiedContract?: boolean;
}

/** Market signals, typically from CoinMarketCap. */
export interface MarketSignals {
  listed?: boolean;
  marketCapUsd?: number;
  volume24hUsd?: number;
  listingAgeDays?: number;
  /** CMC Fear & Greed index 0..100 (low = fear). */
  fearGreed?: number;
}

/**
 * RWA diligence checklist — the failure classes that actually sink tokenized
 * yield/maturity products (distilled from real RWA contract reviews).
 * Each boolean is "is this property HEALTHY?". `undefined` = not assessed.
 */
export interface RwaSignals {
  isRwa: boolean;
  /** Maturity/redemption is reachable in normal operation (no stuck pointer). */
  maturityReachable?: boolean;
  /** Escrow accounting stays consistent with the funded pool (no drift/strand). */
  escrowConsistent?: boolean;
  /** Yield distribution completes without permanent stall. */
  distributionHealthy?: boolean;
  /** Custody/redemption claim is permissionlessly recoverable by the holder. */
  holderClaimRecoverable?: boolean;
  /** A recent third-party audit is referenced. */
  auditReferenced?: boolean;
}

export interface AssetMeta {
  symbol?: string;
  network: string;
  /** Quote/blue-chip assets (e.g. CSPR, USDC) bypass thin-liquidity penalties. */
  isQuoteAsset?: boolean;
}

export interface AssessmentInput {
  asset: AssetMeta;
  onchain?: OnChainSignals;
  market?: MarketSignals;
  rwa?: RwaSignals;
}

export interface Assessment {
  verdict: Verdict;
  /** 0..100, higher = riskier. */
  score: number;
  /** Allocation ceiling the agent should respect, 0..100 percent. */
  maxAllocationPct: number;
  reasons: string[];
  /** Hard disqualifiers that forced a skip, if any. */
  hardFlags: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Assess one asset. Pure function: same input → same verdict (so the agent and
 * the on-chain attestation are reproducible).
 */
export function assess(input: AssessmentInput): Assessment {
  const reasons: string[] = [];
  const hardFlags: string[] = [];
  let risk = 20; // neutral-unknown baseline

  const { onchain, market, rwa, asset } = input;

  // ---- RWA checklist: any unhealthy core property is a hard skip ----
  if (rwa?.isRwa) {
    if (rwa.maturityReachable === false) hardFlags.push("RWA maturity/redemption is not reachable (funds can lock)");
    if (rwa.escrowConsistent === false) hardFlags.push("RWA escrow accounting drifts from the funded pool");
    if (rwa.distributionHealthy === false) hardFlags.push("RWA yield distribution can permanently stall");
    if (rwa.holderClaimRecoverable === false) hardFlags.push("RWA holder claim is not permissionlessly recoverable");

    if (rwa.maturityReachable === true && rwa.escrowConsistent === true) {
      risk -= 8;
      reasons.push("RWA maturity reachable and escrow consistent");
    }
    if (rwa.auditReferenced === true) {
      risk -= 6;
      reasons.push("RWA references a third-party audit");
    } else if (rwa.auditReferenced === false) {
      risk += 8;
      reasons.push("RWA has no referenced audit");
    }
  }

  // ---- On-chain liquidity / concentration ----
  if (asset.isQuoteAsset) {
    risk -= 10;
    reasons.push("Recognized quote/blue-chip asset");
  } else if (onchain?.liquidityUsd !== undefined) {
    if (onchain.liquidityUsd <= 0) {
      hardFlags.push("No on-chain liquidity");
    } else if (onchain.liquidityUsd < 10_000) {
      risk += 22;
      reasons.push(`Very thin liquidity (~$${Math.round(onchain.liquidityUsd).toLocaleString()})`);
    } else if (onchain.liquidityUsd < 100_000) {
      risk += 10;
      reasons.push("Shallow liquidity");
    } else {
      risk -= 6;
      reasons.push("Healthy liquidity");
    }
  }

  if (onchain?.top1HolderPct !== undefined) {
    if (onchain.top1HolderPct >= 0.5) {
      risk += 20;
      reasons.push(`Single holder controls ${(onchain.top1HolderPct * 100).toFixed(0)}% of supply`);
    } else if (onchain.top1HolderPct >= 0.25) {
      risk += 10;
      reasons.push("High single-holder concentration");
    }
  }
  if (onchain?.top10HolderPct !== undefined && onchain.top10HolderPct >= 0.9) {
    risk += 10;
    reasons.push("Top-10 holders own >90% of supply");
  }

  if (onchain?.holderCount !== undefined && onchain.holderCount < 25 && !asset.isQuoteAsset) {
    risk += 8;
    reasons.push(`Few holders (${onchain.holderCount})`);
  }

  if (onchain?.contractAgeDays !== undefined) {
    if (onchain.contractAgeDays < 3) {
      risk += 14;
      reasons.push("Contract is brand new (<3d)");
    } else if (onchain.contractAgeDays < 30) {
      risk += 6;
      reasons.push("Contract is young (<30d)");
    } else if (onchain.contractAgeDays > 180) {
      risk -= 5;
      reasons.push("Established contract (>180d)");
    }
  }

  if (onchain?.recentTransferAnomaly) {
    risk += 12;
    reasons.push("Recent abnormal transfer activity");
  }
  if (onchain?.verifiedContract === false) {
    risk += 8;
    reasons.push("Unverified contract source");
  } else if (onchain?.verifiedContract === true) {
    risk -= 4;
  }

  // ---- Market context ----
  if (market) {
    if (market.listed === false) {
      risk += 6;
      reasons.push("Not listed on major market trackers");
    }
    if (market.marketCapUsd !== undefined && market.marketCapUsd > 5_000_000) {
      risk -= 12;
      reasons.push("Established market cap (>$5M)");
    }
    if (market.volume24hUsd !== undefined && market.volume24hUsd < 10_000 && !asset.isQuoteAsset) {
      risk += 8;
      reasons.push("Negligible 24h volume");
    }
    if (market.listingAgeDays !== undefined && market.listingAgeDays < 14) {
      risk += 6;
      reasons.push("Very recent listing (<14d)");
    }
    if (market.fearGreed !== undefined && market.fearGreed < 20) {
      risk += 5;
      reasons.push("Extreme-fear market regime");
    }
  }

  const score = clamp(Math.round(risk), 0, 100);

  // ---- Decision ----
  if (hardFlags.length > 0) {
    return { verdict: "skip", score: Math.max(score, 85), maxAllocationPct: 0, reasons, hardFlags };
  }
  let verdict: Verdict;
  let maxAllocationPct: number;
  if (score < 30) {
    verdict = "trade";
    maxAllocationPct = 100;
  } else if (score <= 65) {
    verdict = "reduce";
    // linearly taper the ceiling from ~70% down to ~15% across the reduce band
    maxAllocationPct = clamp(Math.round(70 - ((score - 30) / 35) * 55), 15, 70);
  } else {
    verdict = "skip";
    maxAllocationPct = 0;
  }

  return { verdict, score, maxAllocationPct, reasons, hardFlags };
}
