# onchain/ — payment rail

`cep18x402.wasm` is the reference CEP-18 token with `transfer_with_authorization`
(EIP-3009 style) from the official **`make-software/casper-x402`** repo
(`infra/local/deployer/Cep18X402.wasm`). It is used unmodified as the x402
*payment asset* (the rail an agent pays in), not as part of Aegis402's own
product. Think of it like using a standard stablecoin as the unit of payment.

Aegis402's own on-chain contract is `AegisRegistry` (see contract/), which is
original to this project.

Upstream: https://github.com/make-software/casper-x402
