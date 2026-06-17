import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import {
  encodePaymentHeader,
  PAYMENT_HEADER,
  type PaymentEnvelope,
  type PaymentRequiredHeader,
  type PaymentRequirement,
} from "@aegis402/shared";
import { createApp } from "../src/server.js";
import type { OracleConfig } from "../src/config.js";

const PAYEE = "00" + "ab".repeat(32);

const cfg: OracleConfig = {
  port: 0,
  network: "casper:casper-test",
  facilitatorUrl: "http://mock",
  facilitatorToken: "",
  mockFacilitator: true,
  payee: PAYEE,
  price: "7500000000",
  asset: { package: "cd".repeat(32), name: "TestX402", version: "1", decimals: "9" },
  csprCloud: { token: "", restUrl: "http://127.0.0.1:1" }, // instant ECONNREFUSED → signals degrade fast
  cmcApiKey: "",
};

let server: Server;
let base: string;

before(async () => {
  const app = createApp(cfg);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => server?.close());

function mockPayment(req: PaymentRequirement): PaymentEnvelope {
  const now = Math.floor(Date.now() / 1000);
  return {
    x402Version: 2,
    resource: { url: "test://assess" },
    accepted: req,
    payload: {
      signature: "ab".repeat(65),
      publicKey: "02" + "cd".repeat(33),
      authorization: {
        from: "00" + "11".repeat(32),
        to: req.payTo,
        value: req.amount,
        validAfter: String(now - 600),
        validBefore: String(now + 900),
        nonce: "ef".repeat(32),
      },
    },
  };
}

test("health is open", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  const j = (await r.json()) as { status: string; mock: boolean };
  assert.equal(j.status, "ok");
  assert.equal(j.mock, true);
});

test("no payment → 402 with payment requirement", async () => {
  const r = await fetch(`${base}/assess?asset=${"cd".repeat(32)}&symbol=CSPR&isQuote=1`);
  assert.equal(r.status, 402);
  const body = (await r.json()) as PaymentRequiredHeader;
  assert.equal(body.x402Version, 2);
  assert.equal(body.accepts.length, 1);
  assert.equal(body.accepts[0]?.payTo, PAYEE);
  assert.equal(body.accepts[0]?.amount, "7500000000");
});

test("valid payment → 200 with verdict + settlement receipt", async () => {
  // first fetch the requirement from the 402
  const challenge = await fetch(`${base}/assess?asset=${"cd".repeat(32)}&symbol=CSPR&isQuote=1`);
  const body = (await challenge.json()) as PaymentRequiredHeader;
  const req = body.accepts[0]!;

  const header = encodePaymentHeader(mockPayment(req));
  const paid = await fetch(`${base}/assess?asset=${"cd".repeat(32)}&symbol=CSPR&isQuote=1`, {
    headers: { [PAYMENT_HEADER]: header },
  });
  assert.equal(paid.status, 200);
  const j = (await paid.json()) as { verdict: string; payment?: { transaction: string }; score: number };
  assert.ok(["trade", "reduce", "skip"].includes(j.verdict));
  assert.equal(j.verdict, "trade"); // quote asset → trade
  assert.ok(j.payment?.transaction, "settlement transaction hash present");
});

test("RWA with unreachable maturity (paid) → skip", async () => {
  const challenge = await fetch(`${base}/assess?asset=${"cd".repeat(32)}&rwa=1&maturityReachable=0`);
  const req = ((await challenge.json()) as PaymentRequiredHeader).accepts[0]!;
  const paid = await fetch(`${base}/assess?asset=${"cd".repeat(32)}&rwa=1&maturityReachable=0`, {
    headers: { [PAYMENT_HEADER]: encodePaymentHeader(mockPayment(req)) },
  });
  const j = (await paid.json()) as { verdict: string; hardFlags: string[] };
  assert.equal(j.verdict, "skip");
  assert.ok(j.hardFlags.some((f) => /maturity/i.test(f)));
});

test("tampered amount → payment rejected", async () => {
  const challenge = await fetch(`${base}/assess?asset=${"cd".repeat(32)}`);
  const req = ((await challenge.json()) as PaymentRequiredHeader).accepts[0]!;
  const bad = mockPayment(req);
  bad.payload.authorization.value = "1"; // underpay
  const paid = await fetch(`${base}/assess?asset=${"cd".repeat(32)}`, {
    headers: { [PAYMENT_HEADER]: encodePaymentHeader(bad) },
  });
  assert.equal(paid.status, 402);
});
