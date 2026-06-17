// @ts-nocheck -- vendored third-party (casper-ecosystem/casper-eip-712); not type-checked
import type { TypeDefinitions } from "../types.js";

export interface PermitMessage extends Record<string, unknown> {
  owner: string;
  spender: string;
  value: string | bigint;
  nonce: string | bigint;
  deadline: string | bigint;
}

export const PermitTypes: TypeDefinitions = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};
