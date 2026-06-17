// @ts-nocheck -- vendored third-party (casper-ecosystem/casper-eip-712); not type-checked
/**
 * EIP-712 domain object. Standard fields are auto-inferred;
 * custom Casper fields require explicit domainTypes.
 */
export interface EIP712Domain {
  name?: string;
  version?: string;
  chainId?: number | bigint;
  verifyingContract?: string;
  salt?: string;
  [key: string]: unknown;
}

/** A single field in a type definition. */
export interface TypedField {
  name: string;
  type: string;
}

/** Map of type name → array of fields. */
export type TypeDefinitions = Record<string, TypedField[]>;

/** Options for functions that accept custom domain types. */
export interface TypedDataOptions {
  domainTypes?: TypedField[];
}

/**
 * Casper-native domain helper shape mirroring the Rust crate's common fields.
 */
export interface CasperDomain extends EIP712Domain {
  name: string;
  version: string;
  chain_name: string;
  contract_package_hash: string;
}
