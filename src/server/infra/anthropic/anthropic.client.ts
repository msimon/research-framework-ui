import 'server-only';
import { type AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';

import { serverConfig } from '@/shared/config/server.config';

let cached: ReturnType<typeof createAnthropic> | null = null;

function getProvider() {
  if (!cached) cached = createAnthropic({ apiKey: serverConfig.llm.anthropicApiKey });
  return cached;
}

export function anthropicModel() {
  return getProvider()(serverConfig.llm.model);
}

export function anthropicWebSearchTool(options?: { maxUses?: number }) {
  return getProvider().tools.webSearch_20250305({ maxUses: options?.maxUses ?? 5 });
}

export const anthropicProviderOptions = {
  effort: serverConfig.llm.effort,
} satisfies AnthropicProviderOptions;
