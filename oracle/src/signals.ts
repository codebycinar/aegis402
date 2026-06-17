import type { AssessmentInput, OnChainSignals, MarketSignals, RwaSignals, AssetMeta } from "@aegis402/shared";
import type { OracleConfig } from "./config.js";

/**
 * Gather risk signals for an asset. Best-effort: each source degrades to
 * `undefined` fields when unavailable (no token, not found, network error), and
 * the verdict engine treats unknowns conservatively.
 *
 * On-chain signals come from CSPR.cloud (contract package + token ownership).
 * Market signals come from CoinMarketCap when a key is set. For demo and tests,
 * an explicit `overrides` object can supply any signal directly.
 */
export interface AssessRequest {
  /** CEP-18 contract package hash (64 hex) or a known symbol. */
  asset: string;
  symbol?: string;
  isQuoteAsset?: boolean;
  rwa?: RwaSignals;
  overrides?: {
    onchain?: Partial<OnChainSignals>;
    market?: Partial<MarketSignals>;
  };
}

export async function gatherSignals(req: AssessRequest, cfg: OracleConfig): Promise<AssessmentInput> {
  const asset: AssetMeta = {
    symbol: req.symbol,
    network: cfg.network,
    isQuoteAsset: req.isQuoteAsset,
  };

  const onchain: OnChainSignals = {};
  const market: MarketSignals = {};

  if (/^[0-9a-fA-F]{64}$/.test(req.asset)) {
    Object.assign(onchain, await fetchOnChain(req.asset, cfg).catch(() => ({})));
  }
  if (cfg.cmcApiKey && req.symbol) {
    Object.assign(market, await fetchMarket(req.symbol, cfg).catch(() => ({})));
  }

  if (req.overrides?.onchain) Object.assign(onchain, req.overrides.onchain);
  if (req.overrides?.market) Object.assign(market, req.overrides.market);

  return {
    asset,
    onchain: Object.keys(onchain).length ? onchain : undefined,
    market: Object.keys(market).length ? market : undefined,
    rwa: req.rwa,
  };
}

/** Fetch with a hard timeout so a slow/unreachable source can't stall a paid request. */
function timeoutFetch(url: string, init: RequestInit = {}, ms = 3000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

async function csprCloud<T>(path: string, cfg: OracleConfig): Promise<T> {
  const res = await timeoutFetch(`${cfg.csprCloud.restUrl}${path}`, {
    headers: cfg.csprCloud.token ? { Authorization: cfg.csprCloud.token } : {},
  });
  if (!res.ok) throw new Error(`cspr.cloud ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

interface ContractPackageResp {
  data?: { latest_version_contract_hash?: string; timestamp?: string };
}
interface OwnershipResp {
  item_count?: number;
  data?: Array<{ balance?: string; account_hash?: string }>;
}

/** Pull contract age + holder count/concentration from CSPR.cloud. */
async function fetchOnChain(pkg: string, cfg: OracleConfig): Promise<Partial<OnChainSignals>> {
  const out: Partial<OnChainSignals> = {};
  const cp = await csprCloud<ContractPackageResp>(`/contract-packages/${pkg}`, cfg).catch(() => null);
  if (cp?.data?.timestamp) {
    const ageMs = Date.now() - new Date(cp.data.timestamp).getTime();
    out.contractAgeDays = Math.max(0, Math.floor(ageMs / 86_400_000));
    out.verifiedContract = true;
  }
  const own = await csprCloud<OwnershipResp>(
    `/contract-packages/${pkg}/fungible-token-ownership?page_size=10&order_by=balance&order_direction=DESC`,
    cfg,
  ).catch(() => null);
  if (own?.item_count !== undefined) out.holderCount = own.item_count;
  if (own?.data && own.data.length) {
    const balances = own.data.map((d) => Number(d.balance ?? 0)).filter((n) => Number.isFinite(n));
    const total = balances.reduce((a, b) => a + b, 0);
    if (total > 0) {
      out.top1HolderPct = (balances[0] ?? 0) / total;
      out.top10HolderPct = balances.slice(0, 10).reduce((a, b) => a + b, 0) / total;
    }
  }
  return out;
}

interface CmcQuoteResp {
  data?: Record<string, { date_added?: string; quote?: { USD?: { market_cap?: number; volume_24h?: number } } }>;
}

async function fetchMarket(symbol: string, cfg: OracleConfig): Promise<Partial<MarketSignals>> {
  const out: Partial<MarketSignals> = {};
  const res = await timeoutFetch(
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbol)}`,
    { headers: { "X-CMC_PRO_API_KEY": cfg.cmcApiKey } },
  );
  if (!res.ok) return out;
  const json = (await res.json()) as CmcQuoteResp;
  const entry = json.data?.[symbol];
  if (entry) {
    out.listed = true;
    const usd = entry.quote?.USD;
    if (usd?.market_cap !== undefined) out.marketCapUsd = usd.market_cap;
    if (usd?.volume_24h !== undefined) out.volume24hUsd = usd.volume_24h;
    if (entry.date_added) {
      out.listingAgeDays = Math.max(0, Math.floor((Date.now() - new Date(entry.date_added).getTime()) / 86_400_000));
    }
  }
  return out;
}
