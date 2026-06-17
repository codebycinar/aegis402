import { test } from "node:test";
import assert from "node:assert/strict";
import { assess } from "../src/verdict.js";
import { encodePaymentHeader, decodePaymentHeader, type PaymentPayloadEnvelope } from "../src/x402.js";

test("healthy blue-chip quote asset → trade, full allocation", () => {
  const a = assess({
    asset: { symbol: "CSPR", network: "casper:casper-test", isQuoteAsset: true },
    onchain: { liquidityUsd: 2_000_000, contractAgeDays: 400, verifiedContract: true },
    market: { listed: true, marketCapUsd: 50_000_000, volume24hUsd: 5_000_000 },
  });
  assert.equal(a.verdict, "trade");
  assert.equal(a.maxAllocationPct, 100);
  assert.equal(a.hardFlags.length, 0);
});

test("no liquidity → hard skip regardless of other signals", () => {
  const a = assess({
    asset: { symbol: "RUG", network: "casper:casper-test" },
    onchain: { liquidityUsd: 0, holderCount: 500 },
    market: { listed: true, marketCapUsd: 9_999_999 },
  });
  assert.equal(a.verdict, "skip");
  assert.equal(a.maxAllocationPct, 0);
  assert.ok(a.hardFlags.some((f) => /liquidity/i.test(f)));
});

test("RWA with unreachable maturity → hard skip", () => {
  const a = assess({
    asset: { symbol: "RWAX", network: "casper:casper-test" },
    onchain: { liquidityUsd: 500_000, contractAgeDays: 90 },
    rwa: { isRwa: true, maturityReachable: false, escrowConsistent: true },
  });
  assert.equal(a.verdict, "skip");
  assert.ok(a.hardFlags.some((f) => /maturity/i.test(f)));
});

test("healthy RWA with audit → not skip, bounded by checklist", () => {
  const a = assess({
    asset: { symbol: "RWAY", network: "casper:casper-test" },
    onchain: { liquidityUsd: 300_000, contractAgeDays: 120, holderCount: 200, top1HolderPct: 0.1 },
    market: { listed: true, marketCapUsd: 8_000_000 },
    rwa: {
      isRwa: true,
      maturityReachable: true,
      escrowConsistent: true,
      distributionHealthy: true,
      holderClaimRecoverable: true,
      auditReferenced: true,
    },
  });
  assert.notEqual(a.verdict, "skip");
  assert.equal(a.hardFlags.length, 0);
});

test("thin liquidity + concentration → reduce with tapered ceiling", () => {
  const a = assess({
    asset: { symbol: "MIDX", network: "casper:casper-test" },
    onchain: { liquidityUsd: 40_000, top1HolderPct: 0.3, holderCount: 40, contractAgeDays: 20 },
    market: { listed: true, volume24hUsd: 50_000 },
  });
  assert.equal(a.verdict, "reduce");
  assert.ok(a.maxAllocationPct > 0 && a.maxAllocationPct < 100);
});

test("score is clamped to 0..100 and deterministic", () => {
  const input = {
    asset: { symbol: "Z", network: "casper:casper-test" },
    onchain: { liquidityUsd: 1, top1HolderPct: 0.9, top10HolderPct: 0.99, holderCount: 2, contractAgeDays: 0, recentTransferAnomaly: true, verifiedContract: false },
    market: { listed: false, volume24hUsd: 0, listingAgeDays: 1, fearGreed: 5 },
  } as const;
  const a = assess(input);
  const b = assess(input);
  assert.deepEqual(a, b);
  assert.ok(a.score >= 0 && a.score <= 100);
});

test("x402 payment header round-trips through base64", () => {
  const env: PaymentPayloadEnvelope = {
    x402Version: 2,
    scheme: "exact",
    network: "casper:casper-test",
    payload: {
      signature: "ab".repeat(65),
      publicKey: "01" + "cd".repeat(32),
      authorization: {
        from: "00" + "11".repeat(32),
        to: "00" + "22".repeat(32),
        value: "7500000000",
        validAfter: "1710000000",
        validBefore: "1710000900",
        nonce: "ef".repeat(32),
      },
    },
  };
  assert.deepEqual(decodePaymentHeader(encodePaymentHeader(env)), env);
});
