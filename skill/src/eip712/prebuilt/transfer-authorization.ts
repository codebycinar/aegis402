// @ts-nocheck -- vendored third-party (casper-ecosystem/casper-eip-712); not type-checked
import type { TypeDefinitions } from "../types.js";

/**
 * EIP-712 type definitions for the Casper-native `TransferAuthorization` struct.
 *
 * Matches the Rust crate's `casper_native::TransferAuthorization` exactly.
 * `from` and `to` are 32-byte Casper `AccountHash` values (hex-encoded).
 */
export const TransferAuthorizationTypes: TypeDefinitions = {
  TransferAuthorization: [
    { name: "from", type: "bytes32" },
    { name: "to", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "valid_after", type: "uint64" },
    { name: "valid_before", type: "uint64" },
    { name: "nonce", type: "bytes32" },
  ],
};

export interface TransferAuthorizationMessage extends Record<string, unknown> {
  /** 0x-prefixed 32-byte hex AccountHash of the sender. */
  from: string;
  /** 0x-prefixed 32-byte hex AccountHash of the recipient. */
  to: string;
  /** Transfer amount as bigint or 0x-prefixed 32-byte hex (U256). */
  value: string | bigint;
  /** Unix timestamp (seconds) before which the authorization is invalid. */
  valid_after: number | bigint;
  /** Unix timestamp (seconds) after which the authorization expires. */
  valid_before: number | bigint;
  /** 0x-prefixed 32-byte hex replay-protection nonce. */
  nonce: string;
}

/**
 * EIP-712 type definitions for the Casper-native `BatchTransferAuthorization` struct.
 *
 * Matches the Rust crate's `casper_native::BatchTransferAuthorization` exactly.
 * The `transfers` field is an array of `BatchEntry` structs.
 */
export const BatchTransferAuthorizationTypes: TypeDefinitions = {
  BatchTransferAuthorization: [
    { name: "from", type: "bytes32" },
    { name: "transfers", type: "BatchEntry[]" },
    { name: "valid_after", type: "uint64" },
    { name: "valid_before", type: "uint64" },
    { name: "nonce", type: "bytes32" },
  ],
  BatchEntry: [
    { name: "to", type: "bytes32" },
    { name: "value", type: "uint256" },
  ],
};

export interface BatchEntryMessage extends Record<string, unknown> {
  /** 0x-prefixed 32-byte hex AccountHash of the recipient. */
  to: string;
  /** Transfer amount as bigint or 0x-prefixed 32-byte hex (U256). */
  value: string | bigint;
}

export interface BatchTransferAuthorizationMessage extends Record<string, unknown> {
  /** 0x-prefixed 32-byte hex AccountHash of the sender. */
  from: string;
  /** Ordered list of transfer entries. */
  transfers: BatchEntryMessage[];
  /** Unix timestamp (seconds) before which the authorization is invalid. */
  valid_after: number | bigint;
  /** Unix timestamp (seconds) after which the authorization expires. */
  valid_before: number | bigint;
  /** 0x-prefixed 32-byte hex replay-protection nonce. */
  nonce: string;
}
