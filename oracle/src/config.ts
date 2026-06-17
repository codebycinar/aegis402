import "dotenv/config";
import type { PaymentRequirement, CasperNetwork } from "@aegis402/shared";

const env = (k: string, fallback = ""): string => process.env[k]?.trim() ?? fallback;

export interface OracleConfig {
  port: number;
  network: CasperNetwork;
  facilitatorUrl: string;
  facilitatorToken: string;
  mockFacilitator: boolean;
  payee: string;
  price: string;
  asset: {
    package: string;
    name: string;
    version: string;
    decimals: string;
  };
  csprCloud: { token: string; restUrl: string };
  cmcApiKey: string;
}

export function loadConfig(): OracleConfig {
  const facilitatorToken = env("X402_FACILITATOR_TOKEN") || env("CSPR_CLOUD_TOKEN");
  return {
    port: Number(env("ORACLE_PORT", "4021")),
    network: env("CASPER_NETWORK", "casper:casper-test"),
    facilitatorUrl: env("X402_FACILITATOR_URL", "https://x402-facilitator.cspr.cloud"),
    facilitatorToken,
    mockFacilitator: env("AEGIS_MOCK_FACILITATOR", "0") === "1",
    payee: env("ORACLE_PAYEE_ADDRESS"),
    price: env("X402_PRICE", "7500000000"),
    asset: {
      package: env("X402_ASSET_PACKAGE"),
      name: env("X402_ASSET_NAME"),
      version: env("X402_ASSET_VERSION", "1"),
      decimals: env("X402_ASSET_DECIMALS", "9"),
    },
    csprCloud: {
      token: env("CSPR_CLOUD_TOKEN"),
      restUrl: env("CSPR_CLOUD_REST_URL", "https://node.testnet.cspr.cloud"),
    },
    cmcApiKey: env("CMC_API_KEY"),
  };
}

/** The single payment option this oracle advertises in its 402 response. */
export function paymentRequirement(cfg: OracleConfig): PaymentRequirement {
  return {
    scheme: "exact",
    network: cfg.network,
    asset: cfg.asset.package,
    amount: cfg.price,
    payTo: cfg.payee,
    maxTimeoutSeconds: 900,
    extra: {
      name: cfg.asset.name,
      version: cfg.asset.version,
      decimals: cfg.asset.decimals,
    },
  };
}
