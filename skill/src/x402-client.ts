import { randomBytes } from "node:crypto";
import {
  PAYMENT_HEADER,
  encodePaymentHeader,
  type PaymentRequirement,
  type PaymentRequiredHeader,
  type ExactCasperAuthorization,
  type PaymentEnvelope,
} from "@aegis402/shared";
import { hashTypedData, buildDomain, CASPER_DOMAIN_TYPES } from "./eip712/index.js";
import type { TypeDefinitions } from "./eip712/types.js";
import type { CasperSigner } from "./signer.js";

/**
 * The exact typed-data the hosted Casper facilitator verifies, mirrored from the
 * official csprclick-x402 demo (examples/csprclick-x402/src/SignTypedData.tsx):
 * primaryType TransferWithAuthorization, from/to as `address` (33-byte Casper
 * AccountHash → keccak256), value/validAfter/validBefore as uint256, nonce bytes32.
 */
const TRANSFER_WITH_AUTHORIZATION_TYPES: TypeDefinitions = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

const now = () => Math.floor(Date.now() / 1000);

export function buildAuthorization(signer: CasperSigner, req: PaymentRequirement): ExactCasperAuthorization {
  const t = now();
  const timeout = Math.min(req.maxTimeoutSeconds || 900, 900);
  return {
    from: signer.accountAddress, // "00"+hash (33-byte AccountHash)
    to: req.payTo,
    value: req.amount,
    validAfter: String(t - 600),
    validBefore: String(t + timeout),
    nonce: randomBytes(32).toString("hex"),
  };
}

/** Build the TransferWithAuthorization EIP-712 digest the facilitator will verify. */
export function authorizationDigest(req: PaymentRequirement, auth: ExactCasperAuthorization): Uint8Array {
  const domain = buildDomain(
    req.extra?.name ?? "",
    req.extra?.version ?? "1",
    req.network, // chain_name, e.g. "casper:casper-test"
    req.asset, // contract_package_hash (bare 64-hex)
  );
  const message = {
    from: auth.from, // 33-byte AccountHash, NOT stripped
    to: auth.to,
    value: BigInt(auth.value),
    validAfter: BigInt(auth.validAfter),
    validBefore: BigInt(auth.validBefore),
    nonce: auth.nonce,
  };
  return hashTypedData(domain, TRANSFER_WITH_AUTHORIZATION_TYPES, "TransferWithAuthorization", message, {
    domainTypes: CASPER_DOMAIN_TYPES,
  });
}

export function buildPaymentEnvelope(signer: CasperSigner, req: PaymentRequirement, resourceUrl = ""): PaymentEnvelope {
  const authorization = buildAuthorization(signer, req);
  const digest = authorizationDigest(req, authorization);
  const signature = signer.signDigest(digest);
  return {
    x402Version: 2,
    resource: { url: resourceUrl },
    accepted: req,
    payload: { authorization, publicKey: signer.publicKeyHex, signature },
  };
}

export interface PaidResult {
  status: number;
  body: unknown;
  paid: boolean;
  payment?: PaymentEnvelope;
}

/**
 * Fetch a resource that may be x402-gated. On a 402, sign a payment for the
 * advertised requirement and retry once with the PAYMENT-SIGNATURE header.
 */
export async function fetchPaid(url: string, signer: CasperSigner): Promise<PaidResult> {
  const first = await fetch(url);
  if (first.status !== 402) {
    return { status: first.status, body: await first.json().catch(() => null), paid: false };
  }
  const challenge = (await first.json()) as PaymentRequiredHeader;
  const req = challenge.accepts?.[0];
  if (!req) throw new Error("402 had no payment requirement");

  const envelope = buildPaymentEnvelope(signer, req, url);
  const paid = await fetch(url, { headers: { [PAYMENT_HEADER]: encodePaymentHeader(envelope) } });
  return { status: paid.status, body: await paid.json().catch(() => null), paid: true, payment: envelope };
}
