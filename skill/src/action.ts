/**
 * CLI: assess an asset (or gate a swap) from the terminal — a generic action
 * surface mirroring the MCP/LangChain tools.
 *
 *   npm run assess -- <asset> [--symbol SYM] [--quote] [--rwa] [--usd 1000]
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { makeContext, configFromEnv, assessAsset, gatedSwap } from "./skill.js";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

function parseArgs(argv: string[]) {
  const a = argv.slice(2);
  const out: Record<string, string | boolean> = {};
  let asset = "";
  for (let i = 0; i < a.length; i++) {
    const t = a[i]!;
    if (t === "--quote") out.quote = true;
    else if (t === "--rwa") out.rwa = true;
    else if (t === "--symbol") out.symbol = a[++i] ?? "";
    else if (t === "--usd") out.usd = a[++i] ?? "";
    else if (!t.startsWith("--")) asset = t;
  }
  return { asset, out };
}

async function main() {
  const { asset, out } = parseArgs(process.argv);
  if (!asset) {
    console.error("usage: npm run assess -- <asset> [--symbol SYM] [--quote] [--rwa] [--usd 1000]");
    process.exitCode = 1;
    return;
  }
  const ctx = makeContext(configFromEnv());
  const base = { asset, symbol: out.symbol as string | undefined, isQuoteAsset: !!out.quote, rwa: !!out.rwa };

  if (out.usd) {
    const r = await gatedSwap(ctx, { ...base, amountUsd: Number(out.usd) });
    console.log(JSON.stringify(r, null, 2));
  } else {
    const r = await assessAsset(ctx, base);
    console.log(JSON.stringify(r, null, 2));
  }
}

main().catch((e) => {
  console.error("error:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
