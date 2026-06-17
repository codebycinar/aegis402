import type {
  PaymentEnvelope,
  PaymentRequirement,
  FacilitatorVerifyResponse,
  FacilitatorSettleResponse,
} from "@aegis402/shared";
import type { OracleConfig } from "./config.js";

/**
 * Thin client for the hosted Casper x402 facilitator
 * (https://x402-facilitator.cspr.cloud, /verify + /settle, raw-UUID Authorization).
 *
 * In mock mode (AEGIS_MOCK_FACILITATOR=1) we never touch the network: any
 * structurally-valid payload "settles" with a deterministic fake deploy hash.
 * This lets the whole oracle → skill loop run offline before tokens/balance land.
 */
export interface Facilitator {
  verify(env: PaymentEnvelope, req: PaymentRequirement): Promise<FacilitatorVerifyResponse>;
  settle(env: PaymentEnvelope, req: PaymentRequirement): Promise<FacilitatorSettleResponse>;
}

export function makeFacilitator(cfg: OracleConfig): Facilitator {
  if (cfg.mockFacilitator) return new MockFacilitator();
  return new HttpFacilitator(cfg);
}

class MockFacilitator implements Facilitator {
  private check(env: PaymentEnvelope, req: PaymentRequirement): string | null {
    const a = env.payload.authorization;
    if (env.accepted?.scheme !== "exact") return "unsupported_scheme";
    if (env.accepted?.network !== req.network) return "network_mismatch";
    if (a.to !== req.payTo) return "pay_to_mismatch";
    if (a.value !== req.amount) return "amount_mismatch";
    if (!/^(00|01)[0-9a-fA-F]{64}$/.test(a.from)) return "malformed_payload";
    const now = Math.floor(Date.now() / 1000);
    if (Number(a.validBefore) - now < 6) return "insufficient_time";
    if (!env.payload.signature || !env.payload.publicKey) return "invalid_signature";
    return null;
  }

  async verify(env: PaymentEnvelope, req: PaymentRequirement): Promise<FacilitatorVerifyResponse> {
    const reason = this.check(env, req);
    return reason
      ? { isValid: false, invalidReason: reason, invalidMessage: `mock: ${reason}` }
      : { isValid: true, payer: env.payload.authorization.from };
  }

  async settle(env: PaymentEnvelope, req: PaymentRequirement): Promise<FacilitatorSettleResponse> {
    const reason = this.check(env, req);
    if (reason) {
      return { success: false, errorReason: "verification_failed", errorMessage: `mock: ${reason}`, transaction: "", network: req.network };
    }
    // deterministic fake deploy hash from the nonce so it is stable per authorization
    const tx = env.payload.authorization.nonce.padEnd(64, "0").slice(0, 64);
    return { success: true, transaction: tx, network: req.network, payer: env.payload.authorization.from };
  }
}

class HttpFacilitator implements Facilitator {
  constructor(private cfg: OracleConfig) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.cfg.facilitatorUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.cfg.facilitatorToken ? { Authorization: this.cfg.facilitatorToken } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`facilitator ${path} -> HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  verify(env: PaymentEnvelope, req: PaymentRequirement) {
    return this.post<FacilitatorVerifyResponse>("/verify", { paymentPayload: env, paymentRequirements: req });
  }

  settle(env: PaymentEnvelope, req: PaymentRequirement) {
    return this.post<FacilitatorSettleResponse>("/settle", { paymentPayload: env, paymentRequirements: req });
  }
}
