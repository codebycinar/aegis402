import { readFileSync } from "node:fs";
import { createPrivateKey, createHash } from "node:crypto";
import { secp256k1 } from "@noble/curves/secp256k1";
import { blake2b } from "@noble/hashes/blake2b";

/**
 * Casper secp256k1 signer for the x402 "exact" scheme.
 *
 * Loads an ED-style PEM secret key (as exported by Casper Wallet), derives the
 * Casper public key + account hash, and signs a raw 32-byte EIP-712 digest into
 * the facilitator's expected `[algo_byte][r||s]` 65-byte form.
 *
 * Only secp256k1 (algo tag 0x02) is implemented here — that is what our agent
 * account uses. The secret never leaves this process.
 */
const ALGO_TAG_SECP256K1 = "02";

function toHex(b: Uint8Array): string {
  return Buffer.from(b).toString("hex");
}

/** Extract the 32-byte private scalar from a PEM (SEC1 or PKCS8) secp256k1 key. */
function privateScalarFromPem(pem: string): Uint8Array {
  const key = createPrivateKey({ key: pem, format: "pem" });
  const jwk = key.export({ format: "jwk" }) as { crv?: string; d?: string };
  if (!jwk.d) throw new Error("PEM did not yield a private scalar (d)");
  if (jwk.crv && jwk.crv !== "secp256k1") {
    throw new Error(`unexpected curve ${jwk.crv}; this signer is secp256k1-only`);
  }
  const d = Buffer.from(jwk.d, "base64url");
  // left-pad to 32 bytes
  const scalar = new Uint8Array(32);
  scalar.set(d.subarray(Math.max(0, d.length - 32)), 32 - Math.min(32, d.length));
  return scalar;
}

export interface CasperSigner {
  /** Casper public key, algo-tagged: "02" + 33-byte compressed key (68 hex). */
  publicKeyHex: string;
  /** 32-byte account hash (64 hex), no prefix. */
  accountHash: string;
  /** x402 wire account form: "00" + accountHash (66 hex). */
  accountAddress: string;
  /** Sign a 32-byte digest → "02" + r||s (130 hex). */
  signDigest(digest: Uint8Array): string;
}

export function loadSigner(pemPath: string): CasperSigner {
  const pem = readFileSync(pemPath, "utf8");
  const priv = privateScalarFromPem(pem);

  const compressed = secp256k1.getPublicKey(priv, true); // 33 bytes, SEC1 02/03 prefix
  const publicKeyHex = ALGO_TAG_SECP256K1 + toHex(compressed); // Casper tag 02 + compressed

  // Casper account hash = blake2b256( algo_name + 0x00 + public_key_bytes )
  const preimage = new Uint8Array([...Buffer.from("secp256k1", "utf8"), 0x00, ...compressed]);
  const accountHash = toHex(blake2b(preimage, { dkLen: 32 }));

  return {
    publicKeyHex,
    accountHash,
    accountAddress: "00" + accountHash,
    signDigest(digest: Uint8Array): string {
      if (digest.length !== 32) throw new Error(`digest must be 32 bytes, got ${digest.length}`);
      // Casper secp256k1 (casper-go-sdk): ECDSA over sha256(message), canonical
      // low-S, signature = R||S. The keypair wrapper strips the 0x02 algo tag
      // before verifying, so the wire form is "02" + R||S (65 bytes).
      const h = createHash("sha256").update(digest).digest();
      const sig = secp256k1.sign(h, priv, { lowS: true });
      return ALGO_TAG_SECP256K1 + toHex(sig.toCompactRawBytes()); // 02 + R||S
    },
  };
}
