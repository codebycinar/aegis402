import type { Request, Response, NextFunction } from "express";
import {
  X402_VERSION,
  PAYMENT_HEADER,
  decodePaymentHeader,
  type PaymentRequiredHeader,
  type PaymentRequirement,
} from "@aegis402/shared";
import type { Facilitator } from "./facilitator.js";

/** Augmented request once payment has settled. */
export interface PaidRequest extends Request {
  x402?: { payer: string; transaction: string };
}

/**
 * Express middleware enforcing x402 "exact" payment on a route.
 *
 * No valid PAYMENT-SIGNATURE header → 402 with the payment requirement.
 * Valid header → verify + settle through the facilitator; on success attach
 * `req.x402 = { payer, transaction }` and continue to the handler.
 */
export function requirePayment(requirement: PaymentRequirement, facilitator: Facilitator) {
  return async (req: PaidRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.header(PAYMENT_HEADER);
    if (!header) {
      const body: PaymentRequiredHeader = {
        x402Version: X402_VERSION,
        error: "payment required",
        resource: { url: req.originalUrl, description: "Aegis402 risk assessment", mimeType: "application/json" },
        accepts: [requirement],
      };
      res.status(402).json(body);
      return;
    }

    let envelope;
    try {
      envelope = decodePaymentHeader(header);
    } catch {
      res.status(400).json({ error: "malformed PAYMENT-SIGNATURE header" });
      return;
    }

    try {
      const settled = await facilitator.settle(envelope, requirement);
      if (!settled.success) {
        res.status(402).json({ error: "payment not settled", reason: settled.errorReason, message: settled.errorMessage });
        return;
      }
      req.x402 = { payer: settled.payer ?? envelope.payload.authorization.from, transaction: settled.transaction };
      next();
    } catch (err) {
      res.status(502).json({ error: "facilitator error", message: err instanceof Error ? err.message : String(err) });
    }
  };
}
