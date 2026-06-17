// @ts-nocheck -- vendored third-party (casper-ecosystem/casper-eip-712); not type-checked
import { keccak256 } from "./keccak.js";

/**
 * Compute the EIP-712 type hash for a canonical type string.
 */
export function computeTypeHash(typeString: string): Uint8Array {
  return keccak256(new TextEncoder().encode(typeString));
}
