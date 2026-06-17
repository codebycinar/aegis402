// @ts-nocheck -- vendored third-party (casper-ecosystem/casper-eip-712); not type-checked
import type { TypeDefinitions } from "./types.js";
import { keccak256 } from "./keccak.js";
import { fromHex } from "./utils.js";
import { hashStruct } from "./hash.js";

/**
 * Encode an address as a 32-byte EIP-712 slot.
 *
 * - 20-byte (Ethereum) addresses are left-padded with 12 zero bytes.
 * - 33-byte (Casper) addresses are encoded as keccak256 of the full 33-byte
 *   value (1-byte type prefix + 32-byte hash). The prefix distinguishes
 *   AccountHash (0x00) from PackageHash (0x01).
 */
export function encodeAddress(hex: string): Uint8Array {
  const bytes = fromHex(hex);
  if (bytes.length === 20) {
    const encoded = new Uint8Array(32);
    encoded.set(bytes, 12);
    return encoded;
  }
  if (bytes.length === 33) {
    return keccak256(bytes);
  }
  throw new Error(`Address must be 20 or 33 bytes, got ${bytes.length}`);
}

/**
 * Encode a uint256 value as 32-byte big-endian.
 * Accepts: bigint, 0x-prefixed 32-byte hex string, or number.
 */
export function encodeUint256(value: string | bigint | number): Uint8Array {
  if (typeof value === "string") {
    const bytes = fromHex(value);
    if (bytes.length > 32) throw new Error(`uint256 value too large: ${bytes.length} bytes`);
    const encoded = new Uint8Array(32);
    encoded.set(bytes, 32 - bytes.length);
    return encoded;
  }
  const n = BigInt(value);
  const encoded = new Uint8Array(32);
  let remaining = n;
  for (let i = 31; i >= 0; i--) {
    encoded[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return encoded;
}

/**
 * Encode a uint64 value as 32-byte big-endian (convenience for chainId etc.).
 */
export function encodeUint64(value: number | bigint): Uint8Array {
  return encodeUint256(BigInt(value));
}

/**
 * Encode a bytes32 value (0x-prefixed 32-byte hex). Returns the raw 32 bytes.
 */
export function encodeBytes32(hex: string): Uint8Array {
  const bytes = fromHex(hex);
  if (bytes.length !== 32) throw new Error(`bytes32 must be 32 bytes, got ${bytes.length}`);
  return bytes;
}

/**
 * Encode a dynamic string per EIP-712: keccak256(UTF-8 bytes).
 */
export function encodeString(value: string): Uint8Array {
  return keccak256(new TextEncoder().encode(value));
}

/**
 * Encode dynamic bytes per EIP-712: keccak256(bytes).
 */
export function encodeBytes(value: Uint8Array | string): Uint8Array {
  const data = typeof value === "string" ? fromHex(value) : value;
  return keccak256(data);
}

/**
 * Encode a boolean as a 32-byte value (0 or 1 in the last byte).
 */
export function encodeBool(value: boolean): Uint8Array {
  const encoded = new Uint8Array(32);
  encoded[31] = value ? 1 : 0;
  return encoded;
}

/**
 * Encode a single typed field value per EIP-712 rules.
 */
function assertIntegerLikeValue(type: string, value: unknown): asserts value is string | bigint | number {
  if (typeof value === "string" || typeof value === "bigint" || typeof value === "number") {
    return;
  }
  throw new Error(`${type} value must be a string, bigint, or number`);
}

export function encodeField(
  type: string,
  value: unknown,
  types?: TypeDefinitions,
): Uint8Array {
  switch (type) {
    case "address":
      return encodeAddress(String(value));
    case "uint256":
      assertIntegerLikeValue(type, value);
      return encodeUint256(value);
    case "bytes32":
      return encodeBytes32(String(value));
    case "string":
      return encodeString(String(value));
    case "bytes":
      return encodeBytes(value instanceof Uint8Array ? value : String(value));
    case "bool":
      return encodeBool(Boolean(value));
    default:
      if (type.startsWith("uint") || type.startsWith("int")) {
        assertIntegerLikeValue(type, value);
        return encodeUint256(value);
      }
      // TODO: support fixed-size bytes1..bytes31 if/when callers need them.
      // EIP-712 encodes these as the raw value right-padded to 32 bytes.
      if (types?.[type]) {
        return hashStruct(type, types, value as Record<string, unknown>);
      }
      throw new Error(`Unsupported EIP-712 type: ${type}`);
  }
}
