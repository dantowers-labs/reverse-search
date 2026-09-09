import Anthropic from "@anthropic-ai/sdk";

// Resolves credentials from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile.
export const anthropic = new Anthropic();

// Two tiers, both overridable via env. CLAUDE_MODEL is for calls that require real
// judgment (clustering people into role groups, positioning-gap analysis, chat).
// CLAUDE_FAST_MODEL is for mechanical structured extraction (reading fields off a
// screenshot/PDF) — this is the highest-volume call in the app, scaling with every
// profile captured, and doesn't need frontier-tier reasoning to do well.
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5";
export const CLAUDE_FAST_MODEL = process.env.CLAUDE_FAST_MODEL ?? "claude-haiku-4-5";

// $ per million tokens, env-overridable. Defaults are best-effort published rates —
// verify against the Anthropic console before trusting the Admin screen's dollar
// figures for real decisions; a price-constant edit only affects calls logged after
// the edit, never rewrites the cost already stored on past ApiCall rows.
export const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-opus-5": {
    inputPerMTok: Number(process.env.CLAUDE_MODEL_PRICE_IN_PER_MTOK ?? 5),
    outputPerMTok: Number(process.env.CLAUDE_MODEL_PRICE_OUT_PER_MTOK ?? 25),
  },
  "claude-haiku-4-5": {
    inputPerMTok: Number(process.env.CLAUDE_FAST_MODEL_PRICE_IN_PER_MTOK ?? 1),
    outputPerMTok: Number(process.env.CLAUDE_FAST_MODEL_PRICE_OUT_PER_MTOK ?? 5),
  },
};
