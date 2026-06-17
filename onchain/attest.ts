/**
 * Publish a risk verdict to AegisRegistry on chain — the link between the
 * oracle's risk engine and its on-chain identity. We compute a verdict with the
 * same engine that runs behind the oracle paywall, hash it, and call
 * `attest(asset, verdict_hash)` on the registry. Each attestation bumps the
 * assessor's on-chain reputation.
 *
 *   node --import tsx onchain/attest.ts [assetPackageHash]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { assess, assessmentHash } from "@aegis402/shared";
import { PrivateKey, KeyAlgorithm, ContractCallBuilder, Args, CLValue, RpcClient, HttpHandler } from "casper-js-sdk";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const PKG = (process.env.AEGIS_REGISTRY_PACKAGE ?? "").trim();
const RPC = (process.env.CASPER_RPC_URL ?? "https://node.testnet.casper.network/rpc").trim();
const NETWORK = (process.env.CASPER_NETWORK ?? "casper:casper-test").trim();
const KEY = fileURLToPath(new URL("../" + (process.env.AGENT_KEY_PATH ?? "./keys/agent.pem").replace(/^\.\//, ""), import.meta.url));

async function main() {
  if (!PKG) throw new Error("missing AEGIS_REGISTRY_PACKAGE in .env");
  const asset = (process.argv[2] ?? process.env.X402_ASSET_PACKAGE ?? "").trim();
  if (!asset) throw new Error("no asset to attest");

  // Verdict from the shared engine (the same one behind the oracle paywall).
  const verdict = assess({ asset: { symbol: "AX402", network: NETWORK, isQuoteAsset: true } });
  const hash = assessmentHash(asset, verdict);
  console.log("asset      :", asset);
  console.log("verdict     :", verdict.verdict, `(score ${verdict.score})`);
  console.log("verdict hash:", hash);

  const key = PrivateKey.fromPem(readFileSync(KEY, "utf8"), KeyAlgorithm.SECP256K1);
  const tx = new ContractCallBuilder()
    .from(key.publicKey)
    .chainName("casper-test")
    .byPackageHash(PKG)
    .entryPoint("attest")
    .runtimeArgs(Args.fromMap({ asset: CLValue.newCLString(asset), verdict_hash: CLValue.newCLString(hash) }))
    .payment(Number(process.env.ATTEST_PAYMENT_MOTES ?? 12_000_000_000)) // 12 CSPR
    .build();
  tx.sign(key);

  const rpc = new RpcClient(new HttpHandler(RPC));
  const res = await rpc.putTransaction(tx);
  const txHash = (res.transactionHash as { toHex?: () => string }).toHex?.() ?? String(res.transactionHash);
  console.log("\nattest TX_HASH=" + txHash);
  console.log("explorer: https://testnet.cspr.live/transaction/" + txHash);
}

main().catch((e) => {
  console.error("attest error:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
