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

export const anthropicProviderOptions = {
  effort: serverConfig.llm.effort,
} satisfies AnthropicProviderOptions;
