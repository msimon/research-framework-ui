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

// Source-trust classification is a host-name lookup most of the time, so
// adaptive thinking at medium effort lets the model skip deliberation on
// easy entries and spend tokens only on ambiguous ones (e.g. is a
// professional society a `standards-body` or `company`).
export const anthropicClassifierProviderOptions = {
  thinking: { type: 'adaptive', display: 'omitted' },
  effort: 'medium',
} satisfies AnthropicProviderOptions;
