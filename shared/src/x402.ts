/**
 * x402 protocol types for the Casper "exact" scheme.
 *
 * Mirrors the wire shapes accepted by the Casper x402 facilitator
 * (make-software/casper-x402, docs/api-reference.md) and the browser client
 * helpers (examples/csprclick-x402/src/x402-utils.ts), verified 2026-06-17.
 *
 * We never run the facilitator ourselves — the buildathon hosts a sponsored
 * one. These types describe what the oracle (seller) advertises in its 402
 * response and what the skill (buyer) signs and sends back.
 */

export const X402_VERSION = 2 as const;
export const SCHEME_EXACT = "exact" as const;

export const NETWORK_MAINNET = "casper:casper" as const;
export const NETWORK_TESTNET = "casper:casper-test" as const;
export type CasperNetwork = typeof NETWORK_MAINNET | typeof NETWORK_TESTNET | string;

/** One accepted way to pay, advertised by the seller in a 402 response. */
export interface PaymentRequirement {
  scheme: string; // "exact"
  network: CasperNetwork;
  /** 64-hex CEP-18 token contract package hash. */
  asset: string;
  /** Amount in base units, decimal string (e.g. "7500000000" at 9 decimals). */
  amount: string;
  /** 66-char Casper account hash "00<64hex>" that receives the payment. */
  payTo: string;
  maxTimeoutSeconds: number;
  /** name + version seed the EIP-712 domain; decimals/symbol are display hints. */
  extra?: {
    name?: string;
    version?: string;
    decimals?: string;
    symbol?: string;
  };
}

/** Body of the HTTP 402 response (base64-JSON in the WWW-Authenticate header, also returned as JSON body). */
export interface PaymentRequiredHeader {
  x402Version: number;
  error: string;
  resource: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: PaymentRequirement[];
}

/**
 * The transfer-with-authorization the buyer signs (EIP-3009-style, EIP-712 digest).
 * All numeric fields are decimal strings; nonce is 32 random bytes as 64-hex.
 */
export interface ExactCasperAuthorization {
  from: string; // "00<64hex>" buyer account hash
  to: string; // == requirement.payTo
  value: string; // == requirement.amount
  validAfter: string; // unix seconds, decimal string
  validBefore: string; // unix seconds, decimal string
  nonce: string; // 64-hex (32 bytes)
}

/** Signed payment payload (inner). signature = "02"+R||S (130 hex) for secp256k1. */
export interface ExactCasperPayload {
  signature: string; // 130-hex (65 bytes: [algo_byte][R||S])
  publicKey: string; // algo-prefixed hex ("01.."/"02..")
  authorization: ExactCasperAuthorization;
}

/**
 * The payment envelope the buyer sends (PAYMENT-SIGNATURE header, base64-JSON)
 * and the seller forwards to the facilitator as `paymentPayload`.
 *
 * Shape verified against the hosted facilitator via the official csprclick-x402
 * demo (2026-06-17): the chosen requirement is echoed back as `accepted`, and
 * the facilitator reads scheme/network from there — NOT from a top-level field.
 */
export interface PaymentEnvelope {
  x402Version: number;
  resource: { url: string };
  accepted: PaymentRequirement;
  payload: ExactCasperPayload;
}

export interface FacilitatorVerifyRequest {
  paymentPayload: PaymentEnvelope;
  paymentRequirements: PaymentRequirement;
}

export interface FacilitatorVerifyResponse {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
  invalidMessage?: string;
}

export interface FacilitatorSettleResponse {
  success: boolean;
  /** 64-hex Casper deploy/transaction hash on success. */
  transaction: string;
  network: CasperNetwork;
  payer?: string;
  errorReason?: string;
  errorMessage?: string;
}

/** Header the buyer sets on the paid retry, and the seller reads. */
export const PAYMENT_HEADER = "PAYMENT-SIGNATURE" as const;

export function encodePaymentHeader(envelope: PaymentEnvelope): string {
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64");
}

export function decodePaymentHeader(value: string): PaymentEnvelope {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as PaymentEnvelope;
}
