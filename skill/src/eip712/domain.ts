// @ts-nocheck -- vendored third-party (casper-ecosystem/casper-eip-712); not type-checked
import type { EIP712Domain, TypedField } from "./types.js";
import { keccak256 } from "./keccak.js";
import { encodeField } from "./encoding.js";
import { computeTypeHash } from "./type-hash.js";
import { buildTypeString } from "./type-string.js";

const STANDARD_DOMAIN_FIELDS: { key: string; name: string; type: string }[] = [
  { key: "name", name: "name", type: "string" },
  { key: "version", name: "version", type: "string" },
  { key: "chainId", name: "chainId", type: "uint256" },
  { key: "verifyingContract", name: "verifyingContract", type: "address" },
  { key: "salt", name: "salt", type: "bytes32" },
];

export const CASPER_DOMAIN_TYPES: TypedField[] = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chain_name", type: "string" },
  { name: "contract_package_hash", type: "bytes32" },
];

export function buildDomainTypeString(
  domain: EIP712Domain,
  domainTypes?: TypedField[],
): string {
  const fields = domainTypes ?? inferDomainTypes(domain);
  return buildTypeString("EIP712Domain", fields);
}

function inferDomainTypes(domain: EIP712Domain): TypedField[] {
  return STANDARD_DOMAIN_FIELDS
    .filter((f) => domain[f.key] !== undefined && domain[f.key] !== null)
    .map((f) => ({ name: f.name, type: f.type }));
}

export function buildDomain(
  name: string,
  version: string,
  chainName: string,
  contractPackageHash: string,
): EIP712Domain {
  return {
    name,
    version,
    chain_name: chainName,
    contract_package_hash: contractPackageHash,
  };
}

export function hashDomainSeparator(
  domain: EIP712Domain,
  domainTypes?: TypedField[],
): Uint8Array {
  const fields = domainTypes ?? inferDomainTypes(domain);
  const typeString = buildDomainTypeString(domain, fields);
  const typeHash = computeTypeHash(typeString);

  const parts: Uint8Array[] = [typeHash];
  for (const field of fields) {
    const value = domain[field.name];
    parts.push(encodeField(field.type, value));
  }

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const encoded = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    encoded.set(part, offset);
    offset += part.length;
  }

  return keccak256(encoded);
}
