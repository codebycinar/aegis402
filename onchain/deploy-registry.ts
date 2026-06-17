/**
 * Deploy AegisRegistry (our own Odra contract) to Casper testnet.
 * Stores per-asset verdict hashes + per-assessor reputation, with CEP-96
 * contract metadata for an on-chain self-declared identity.
 *
 *   node --import tsx onchain/deploy-registry.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrivateKey, KeyAlgorithm, SessionBuilder, Args, CLValue, RpcClient, HttpHandler } from "casper-js-sdk";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const KEY = fileURLToPath(new URL("../" + (process.env.AGENT_KEY_PATH ?? "./keys/agent.pem").replace(/^\.\//, ""), import.meta.url));
const RPC = (process.env.CASPER_RPC_URL ?? "https://node.testnet.casper.network/rpc").trim();
const WASM = fileURLToPath(new URL("../contract/wasm/AegisRegistry.wasm", import.meta.url));
const PKG_KEY_NAME = "AEGIS_REGISTRY_package_hash";
const someStr = (s: string) => CLValue.newCLOption(CLValue.newCLString(s));

async function main() {
  const key = PrivateKey.fromPem(readFileSync(KEY, "utf8"), KeyAlgorithm.SECP256K1);
  const wasm = new Uint8Array(readFileSync(WASM));
  console.log("deployer:", key.publicKey.toHex(), "· wasm bytes:", wasm.length);

  const args = Args.fromMap({
    contract_name: someStr("Aegis402 Registry"),
    contract_description: someStr("On-chain attestation + reputation for the Aegis402 risk oracle"),
    contract_icon_uri: someStr("https://raw.githubusercontent.com/codebycinar/aegis402/main/assets/logo.png"),
    contract_project_uri: someStr("https://github.com/codebycinar/aegis402"),
    odra_cfg_is_upgradable: CLValue.newCLValueBool(true),
    odra_cfg_is_upgrade: CLValue.newCLValueBool(false),
    odra_cfg_allow_key_override: CLValue.newCLValueBool(true),
    odra_cfg_package_hash_key_name: CLValue.newCLString(PKG_KEY_NAME),
  });

  const tx = new SessionBuilder()
    .from(key.publicKey)
    .chainName("casper-test")
    .wasm(wasm)
    .installOrUpgrade()
    .runtimeArgs(args)
    .payment(Number(process.env.DEPLOY_PAYMENT_MOTES ?? 800_000_000_000))
    .build();
  tx.sign(key);

  const rpc = new RpcClient(new HttpHandler(RPC));
  const res = await rpc.putTransaction(tx);
  const hash = (res.transactionHash as { toHex?: () => string }).toHex?.() ?? String(res.transactionHash);
  console.log("TX_HASH=" + hash);
  console.log("explorer: https://testnet.cspr.live/transaction/" + hash);
  console.log("package hash named key:", PKG_KEY_NAME);
}

main().catch((e) => {
  console.error("deploy error:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
