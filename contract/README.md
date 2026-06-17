# AegisRegistry

Our own Odra smart contract for Casper: an on-chain attestation and reputation
registry for the Aegis402 risk oracle.

An assessor records a risk verdict for an asset by posting a hash of the
assessment. The contract keeps the latest hash per asset and a per-assessor
reputation counter that grows with every attestation, giving an oracle a
verifiable on-chain track record. Contract metadata follows CEP-96, so wallets
and explorers display an authentic self-declared identity.

## Entry points

- `attest(asset: String, verdict_hash: String) -> u64` — record a verdict hash
  for an asset and bump the caller's reputation; returns the new count. Emits
  `Attested { assessor, asset, reputation }`.
- `reputation_of(assessor: Address) -> u64`
- `latest_of(asset: String) -> Option<String>`
- `total_attestations() -> u64`
- CEP-96 getters: `contract_name`, `contract_description`, `contract_icon_uri`,
  `contract_project_uri`.

## Build and test

```bash
cargo odra build         # produces wasm/AegisRegistry.wasm
cargo odra test          # host unit tests (see toolchain note below)
```

The contract's behavior is verified on chain: a live `attest` transaction on
testnet stored a verdict hash and incremented the assessor's reputation
(`9a1e1787b5c0ae5e0e69870427f2eae83aa67023ea8b283b777a43f8f346a5fd`). The host
unit tests in `src/lib.rs` document the same behavior; running them needs a
`casper-types`-compatible toolchain (the version pulled by the host test backend
does not compile under every recent nightly). The wasm build and on-chain
deployment are unaffected.

Casper does not accept bulk-memory wasm. If your wasm-opt is older than binaryen
123 (which ships `--llvm-memory-copy-fill-lowering`), lower it explicitly before
deploying:

```bash
wasm-opt --llvm-memory-copy-fill-lowering --signext-lowering -Oz \
  wasm/AegisRegistry.wasm -o wasm/AegisRegistry.wasm
```

Deploy with `onchain/deploy-registry.ts` from the repo root.

## Deployed (testnet)

Package hash `120cab337dfaf063abcdbc64093d464a9eadb5b81c27c4f5ef6c34ac7499ebde`.
