/**
 * LangChain tool wrapper for the Aegis402 risk gate, so the skill drops into any
 * LangChain agent. Each invocation pays the x402 oracle and returns the verdict.
 */
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { makeContext, configFromEnv, assessAsset, gatedSwap, type SkillContext } from "./skill.js";

export function makeAegisTools(ctx: SkillContext = makeContext(configFromEnv())) {
  const assess = new DynamicStructuredTool({
    name: "aegis_assess_asset",
    description:
      "Pay the Aegis402 x402 risk oracle and return a risk verdict (trade/reduce/skip) for a Casper asset or tokenized RWA before transacting.",
    schema: z.object({
      asset: z.string().describe("CEP-18 contract package hash (64-hex) or asset id"),
      symbol: z.string().optional(),
      isQuoteAsset: z.boolean().optional(),
      rwa: z.boolean().optional(),
    }),
    func: async (a) => JSON.stringify(await assessAsset(ctx, a)),
  });

  const gate = new DynamicStructuredTool({
    name: "aegis_gated_swap",
    description:
      "Gate an intended trade through the risk oracle; returns execute/reduce/block and the cleared USD size.",
    schema: z.object({
      asset: z.string(),
      amountUsd: z.number(),
      symbol: z.string().optional(),
      isQuoteAsset: z.boolean().optional(),
      rwa: z.boolean().optional(),
    }),
    func: async (a) => JSON.stringify(await gatedSwap(ctx, a)),
  });

  return [assess, gate];
}
