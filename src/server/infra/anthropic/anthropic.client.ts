import 'server-only';
import { type AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';

import { serverConfig } from '@/shared/config/server.config';

const provider = createAnthropic({ apiKey: serverConfig.llm.anthropicApiKey });

export function anthropicModel() {
  return provider(serverConfig.llm.model);
}

export function anthropicClassifierModel() {
  return provider(serverConfig.llm.classifierModel);
}

export function anthropicWebSearchTool(options?: { maxUses?: number }) {
  return provider.tools.webSearch_20250305({ maxUses: options?.maxUses ?? 5 });
}

export const anthropicProviderOptions = {
  thinking: { type: 'adaptive', display: 'omitted' },
  effort: serverConfig.llm.effort,
} satisfies AnthropicProviderOptions;

// Haiku doesn't support adaptive thinking, but a modest fixed budget lets
// the classifier sanity-check its own structured output before it lands —
// it has been observed leaking JSON-syntax fragments into the `url` field,
// and having room to think gives it a chance to catch that mid-emission.
export const anthropicClassifierProviderOptions = {
  thinking: { type: 'enabled', budgetTokens: 4096 },
} satisfies AnthropicProviderOptions;
