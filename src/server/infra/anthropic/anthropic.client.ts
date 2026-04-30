import 'server-only';
import { type AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';

import { serverConfig } from '@/shared/config/server.config';

const provider = createAnthropic({ apiKey: serverConfig.llm.anthropicApiKey });

export function anthropicModel() {
  return provider(serverConfig.llm.model);
}

export function anthropicWebSearchTool(options?: { maxUses?: number }) {
  return provider.tools.webSearch_20250305({ maxUses: options?.maxUses ?? 5 });
}

export const anthropicProviderOptions = {
  thinking: { type: 'adaptive', display: 'omitted' },
  effort: serverConfig.llm.effort,
} satisfies AnthropicProviderOptions;
