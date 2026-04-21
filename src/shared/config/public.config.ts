import { z } from 'zod';
import { baseConfig } from '@/shared/config/config.base';
import { stageConfig } from '@/shared/config/config.stage';
import type { AppStage } from '@/shared/config/config.types';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_ENV: z.string(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

function resolveAppStage(rawEnv: string | undefined): AppStage {
  if (!rawEnv) return 'local';

  const normalized = rawEnv.toLowerCase();
  if (normalized === 'prod' || normalized === 'production') return 'production';
  if (normalized === 'dev' || normalized === 'development') return 'development';
  if (normalized === 'test') return 'test';
  if (normalized === 'local') return 'local';
  throw new Error(
    `Invalid NEXT_PUBLIC_ENV value "${rawEnv}". Expected one of: local, test, development, dev, production, prod.`,
  );
}

const result = publicEnvSchema.safeParse({
  NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!result.success) {
  const details = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid public environment variables:\n${details}`);
}

const env = result.data;

const stage = resolveAppStage(env.NEXT_PUBLIC_ENV);
const stageOverrides = stageConfig[stage];

export const publicConfig = {
  app: {
    name: baseConfig.app.name,
    stage,
    isProduction: stage === 'production',
    oauthCallbackPath: baseConfig.app.oauthCallbackPath,
    debugLogs: stageOverrides.app.debugLogs,
  },
  supabase: {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
} as const;
