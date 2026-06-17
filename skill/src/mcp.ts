/**
 * Aegis402 MCP server — exposes the risk gate to any MCP-capable agent
 * (Casper AI Toolkit, Claude, etc.) over stdio.
 *
 * Tools:
 *   - assess_asset: pay the x402 oracle and return a risk verdict.
 *   - gated_swap:   gate an intended trade; returns the cleared USD size.
 *
 * Run: npm run mcp   (needs ORACLE_URL + AGENT_KEY_PATH in the environment)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { makeContext, configFromEnv, assessAsset, gatedSwap, type SkillContext } from "./skill.js";

let _ctx: SkillContext | null = null;
function ctx(): SkillContext {
  if (!_ctx) _ctx = makeContext(configFromEnv());
  return _ctx;
}

const rwaShape = {
  rwa: z.boolean().optional().describe("treat the asset as a tokenized RWA"),
  maturityReachable: z.boolean().optional(),
  escrowConsistent: z.boolean().optional(),
  distributionHealthy: z.boolean().optional(),
  holderClaimRecoverable: z.boolean().optional(),
  auditReferenced: z.boolean().optional(),
};

function rwaFrom(a: Record<string, unknown>) {
  if (!a.rwa) return {};
  return {
    rwa: true as const,
    rwaSignals: {
      maturityReachable: a.maturityReachable as boolean | undefined,
      escrowConsistent: a.escrowConsistent as boolean | undefined,
      distributionHealthy: a.distributionHealthy as boolean | undefined,
      holderClaimRecoverable: a.holderClaimRecoverable as boolean | undefined,
      auditReferenced: a.auditReferenced as boolean | undefined,
    },
  };
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: "aegis402", version: "0.1.0" });

  server.tool(
    "assess_asset",
    "Pay the Aegis402 x402 risk oracle (micro-payment, settled on Casper) and return a risk verdict (trade/reduce/skip) for a Casper asset or tokenized RWA.",
    {
      asset: z.string().describe("CEP-18 contract package hash (64-hex) or asset id"),
      symbol: z.string().optional(),
      isQuoteAsset: z.boolean().optional().describe("blue-chip/quote asset (e.g. CSPR, USDC)"),
      ...rwaShape,
    },
    async (a) => {
      const r = await assessAsset(ctx(), { asset: a.asset, symbol: a.symbol, isQuoteAsset: a.isQuoteAsset, ...rwaFrom(a) });
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "gated_swap",
    "Gate an intended trade through the risk oracle. Returns whether to execute, reduce, or block, plus the USD size the agent is cleared to deploy.",
    {
      asset: z.string().describe("CEP-18 contract package hash (64-hex) or asset id"),
      amountUsd: z.number().describe("intended notional in USD"),
      symbol: z.string().optional(),
      isQuoteAsset: z.boolean().optional(),
      ...rwaShape,
    },
    async (a) => {
      const r = await gatedSwap(ctx(), { asset: a.asset, amountUsd: a.amountUsd, symbol: a.symbol, isQuoteAsset: a.isQuoteAsset, ...rwaFrom(a) });
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  return server;
}

const isMain = process.argv[1]?.endsWith("mcp.ts") || process.argv[1]?.endsWith("mcp.js");
if (isMain) {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
  console.error("aegis402 MCP server ready on stdio");
}
