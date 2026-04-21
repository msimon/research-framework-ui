import 'server-only';
import { z } from 'zod';
import { baseConfig } from '@/shared/config/config.base';
import { publicConfig } from '@/shared/config/public.config';

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
});

const result = serverEnvSchema.safeParse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});

if (!result.success) {
  const details = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid server environment variables:\n${details}`);
}

const env = result.data;

export const serverConfig = {
  app: publicConfig.app,
  supabase: {
    ...publicConfig.supabase,
    secretKey: env.SUPABASE_SECRET_KEY,
  },
  llm: {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    model: baseConfig.llm.model,
    thinkingBudgetTokens: baseConfig.llm.thinkingBudgetTokens,
  },
} as const;
