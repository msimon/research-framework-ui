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

// Haiku doesn't support `thinking: { type: 'adaptive' }` (that mode is
// Opus/Sonnet-only) and source-trust classification is a host-name lookup
// that doesn't benefit from extended thinking anyway, so the classifier
// runs with no provider options.
export const anthropicClassifierProviderOptions = {} satisfies AnthropicProviderOptions;
