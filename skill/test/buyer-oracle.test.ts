import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApp } from "../../oracle/src/server.js";
import type { OracleConfig } from "../../oracle/src/config.js";
import { loadSigner } from "../src/signer.js";
import { fetchPaid } from "../src/x402-client.js";

// Ephemeral secp256k1 key so the test is hermetic (does not touch keys/agent.pem).
const dir = mkdtempSync(join(tmpdir(), "aegis-skill-"));
const pem = generateKeyPairSync("ec", { namedCurve: "secp256k1" }).privateKey.export({
  format: "pem",
  type: "sec1",
}) as string;
const keyPath = join(dir, "k.pem");
writeFileSync(keyPath, pem);
const signer = loadSigner(keyPath);

const ASSET = "cd".repeat(32);
const cfg: OracleConfig = {
  port: 0,
  network: "casper:casper-test",
  facilitatorUrl: "http://mock",
  facilitatorToken: "",
  mockFacilitator: true,
  payee: signer.accountAddress, // self-pay is fine for the mock facilitator
  price: "7500000000",
  asset: { package: ASSET, name: "AegisUSD", version: "1", decimals: "9" },
  csprCloud: { token: "", restUrl: "http://127.0.0.1:1" },
  cmcApiKey: "",
};

let server: Server;
let base: string;

before(async () => {
  const app = createApp(cfg);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      resolve();
    });
  });
});

after(() => server?.close());

test("signer derives a valid Casper secp256k1 identity", () => {
  assert.match(signer.publicKeyHex, /^02[0-9a-f]{66}$/);
  assert.match(signer.accountAddress, /^00[0-9a-f]{64}$/);
});

test("buyer fetchPaid → 402 → sign → oracle returns a paid verdict", async () => {
  const res = await fetchPaid(`${base}/assess?asset=${ASSET}&isQuote=1`, signer);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.paid, true);
  const body = res.body as { verdict: string; payment?: { transaction: string; payer: string } };
  assert.ok(["trade", "reduce", "skip"].includes(body.verdict));
  assert.ok(body.payment?.transaction, "settlement receipt present");
  assert.equal(body.payment?.payer, signer.accountAddress);
});

test("unpaid request is rejected by the gate", async () => {
  const r = await fetch(`${base}/assess?asset=${ASSET}`);
  assert.equal(r.status, 402);
});
