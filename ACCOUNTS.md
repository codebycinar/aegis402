# Accounts & on-chain identifiers (PUBLIC info only)

> NEVER put a seed phrase or a secret key in this file. Only public keys,
> account hashes, and deployed contract hashes belong here.

## Agent / payer account (Casper Wallet, testnet)

- **algo:** secp256k1
- **public_key:** `0203ee211f64f2d84351fc71ef7f6428ee6da7a26138b4e50ea71021142b731dcc57`
- **account_hash:** `ec65692cc37e0b3e8874c557cb0726e1b60af8be8d9253b1fd932b32d669e9f0`
- **payTo / x402 form:** `00ec65692cc37e0b3e8874c557cb0726e1b60af8be8d9253b1fd932b32d669e9f0`
- **funded:** 5000 test CSPR (faucet, one-time) — verified via testnet RPC
  `query_balance` = 5000000000000 motes, 2026-06-17.
- **main_purse:** `uref-8556caa77e0d4d836bfb61637fe1369e70d8e2ad58c5b7061c51d3a114a585ae-007`
- role: signs x402 payment authorizations; also deployer for our testnet
  contracts (needs test CSPR via faucet). Secret key lives only at
  `keys/agent.pem` on the user's machine (gitignored), never shared.
- note: CSPR.cloud `/accounts/{key}` 404s for this account; the public testnet
  RPC (`node.testnet.casper.network/rpc`, auth-free) is the reliable data source.

## Payee / oracle account

- TODO: second testnet account that receives x402 payments (receive-only, no key
  needed). Can be a second Casper Wallet account.

## Deployed contracts (testnet)

- **CEP-18 x402 payment token** (package hash):
  `a8d8eaa5dbb344f42c182e08dc7b4676376614ac379fe4f1040b4187e2f3698f`
  - name "Aegis X402 Test Token", symbol AX402, decimals 9, initial_supply 1e15 (held by the agent account)
  - deployed 2026-06-17, install tx `6297ec55d68f3148129481b4b6172241efb3885198daf63ad4bd100d9c0d0a84` (cost 800 CSPR)
  - named key on agent account: `AEGIS_X402_package_hash`
- **AegisRegistry** (our own Odra contract, CEP-96 metadata) — package hash:
  `120cab337dfaf063abcdbc64093d464a9eadb5b81c27c4f5ef6c34ac7499ebde`
  - on-chain attestation + per-assessor reputation; deployed 2026-06-17,
    install tx `21caba2b289b41e136b448cf72e42fa192f3fbb725d277965659a1f99b2fc3cb` (800 CSPR)
  - named key on agent account: `AEGIS_REGISTRY_package_hash`

## On-chain proof transactions (testnet)

- CEP-18 token install: `6297ec55d68f3148129481b4b6172241efb3885198daf63ad4bd100d9c0d0a84`
- x402 real settlement: `d30ebbb46d31c89b6eac940169addfd2c89abb744da067348e8746a9606ca604`
- full agent→oracle→settle: `203d963cdb962aebf09dc1e36afa36cd63694a5e49a64d6dfd0838ad542175b7`
- AegisRegistry install: `21caba2b289b41e136b448cf72e42fa192f3fbb725d277965659a1f99b2fc3cb`
