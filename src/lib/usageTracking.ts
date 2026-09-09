import { prisma } from "@/lib/prisma";
import { MODEL_PRICING } from "@/lib/anthropic";

export type ApiCallActivity =
  | "analyzeCompany"
  | "analyzeJobFit"
  | "importJobPosting"
  | "generateSuggestions"
  | "extractPerson"
  | "mergePerson"
  | "captureSharedConnections"
  | "candidateProfileExtract"
  | "candidateProfileChangeset"
  | "candidateProfileApply"
  | "chat"
  | "generateInterviewGuide";

interface Usage {
  input_tokens: number | null;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

interface RecordApiCallArgs {
  activity: ApiCallActivity;
  model: string;
  usage: Usage;
  companyId?: number;
  jobPostingId?: number;
  isRerun?: boolean;
}

// Logs one Anthropic API call right after it resolves. costUsd is computed once,
// here, from the price constants in lib/anthropic.ts — a historical snapshot that
// a later price-constant correction must never retroactively rewrite.
export async function recordApiCall({
  activity,
  model,
  usage,
  companyId,
  jobPostingId,
  isRerun = false,
}: RecordApiCallArgs) {
  const pricing = MODEL_PRICING[model];
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;

  const costUsd = pricing
    ? (inputTokens * pricing.inputPerMTok + outputTokens * pricing.outputPerMTok) / 1_000_000
    : 0;

  await prisma.apiCall.create({
    data: {
      activity,
      model,
      companyId,
      jobPostingId,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      costUsd,
      isRerun,
    },
  });
}
