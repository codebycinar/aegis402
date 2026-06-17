/**
 * Deploy the x402 payment-rail CEP-18 token to Casper testnet from the agent
 * account, and print the package hash. The initial supply lands on the deploying
 * account, so no separate mint is needed — the agent can immediately pay in it.
 *
 *   node --import tsx onchain/deploy-token.ts
 *
 * Needs in .env: AGENT_KEY_PATH (secp256k1 PEM), CASPER_RPC_URL.
 * Uses real testnet CSPR for gas (the agent account is faucet-funded).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import {
  PrivateKey,
  KeyAlgorithm,
  SessionBuilder,
  Args,
  CLValue,
  RpcClient,
  HttpHandler,
} from "casper-js-sdk";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const KEY_PATH = fileURLToPath(new URL("../" + (process.env.AGENT_KEY_PATH ?? "./keys/agent.pem").replace(/^\.\//, ""), import.meta.url));
const RPC = (process.env.CASPER_RPC_URL ?? "https://node.testnet.casper.network/rpc").trim();
const WASM = fileURLToPath(new URL("./cep18x402.wasm", import.meta.url));
const PKG_KEY_NAME = "AEGIS_X402_package_hash";

async function main() {
  const key = PrivateKey.fromPem(readFileSync(KEY_PATH, "utf8"), KeyAlgorithm.SECP256K1);
  const pub = key.publicKey;
  console.log("deployer public key:", pub.toHex());

  const wasm = new Uint8Array(readFileSync(WASM));
  console.log("wasm bytes:", wasm.length);

  const args = Args.fromMap({
    name: CLValue.newCLString("Aegis X402 Test Token"),
    symbol: CLValue.newCLString("AX402"),
    decimals: CLValue.newCLUint8(9),
    initial_supply: CLValue.newCLUInt256("1000000000000000"),
    chain_id: CLValue.newCLString("casper:casper-test"),
    odra_cfg_is_upgradable: CLValue.newCLValueBool(true),
    odra_cfg_is_upgrade: CLValue.newCLValueBool(false),
    odra_cfg_allow_key_override: CLValue.newCLValueBool(true),
    odra_cfg_package_hash_key_name: CLValue.newCLString(PKG_KEY_NAME),
  });

  const tx = new SessionBuilder()
    .from(pub)
    .chainName("casper-test")
    .wasm(wasm)
    .installOrUpgrade()
    .runtimeArgs(args)
    .payment(Number(process.env.DEPLOY_PAYMENT_MOTES ?? 1_000_000_000_000)) // default 1000 CSPR
    .build();

  tx.sign(key);

  const rpc = new RpcClient(new HttpHandler(RPC));
  console.log("submitting install transaction…");
  const res = await rpc.putTransaction(tx);
  const hash = (res.transactionHash as { toHex?: () => string }).toHex?.() ?? String(res.transactionHash);
  console.log("TX_HASH=" + hash);
  console.log("explorer: https://testnet.cspr.live/transaction/" + hash);
  console.log("poll with: onchain/check-tx.ts " + hash);
}

main().catch((e) => {
  console.error("deploy error:", e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});
