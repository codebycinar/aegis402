import { createHash } from "node:crypto";
import type { Assessment } from "./verdict.js";

/**
 * Deterministic 32-byte hash of a risk verdict, used as the on-chain attestation
 * payload in AegisRegistry. Because the verdict engine is deterministic, the same
 * inputs always produce the same hash, so an on-chain attestation can be checked
 * against a re-run of the assessment.
 */
export function assessmentHash(asset: string, a: Pick<Assessment, "verdict" | "score" | "maxAllocationPct">): string {
  const canonical = JSON.stringify({
    asset,
    verdict: a.verdict,
    score: a.score,
    maxAllocationPct: a.maxAllocationPct,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** The same hash as raw bytes (for contract args). */
export function assessmentHashBytes(asset: string, a: Pick<Assessment, "verdict" | "score" | "maxAllocationPct">): Uint8Array {
  return new Uint8Array(Buffer.from(assessmentHash(asset, a), "hex"));
}
