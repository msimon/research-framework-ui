import { z } from 'zod';

const runtimeEnvSchema = z.object({
  NEXT_RUNTIME: z.enum(['nodejs', 'edge']).optional(),
});

const result = runtimeEnvSchema.safeParse({
  NEXT_RUNTIME: process.env.NEXT_RUNTIME,
});

if (!result.success) {
  const details = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid runtime environment:\n${details}`);
}

const env = result.data;

export const runtimeDetection = {
  nextRuntime: env.NEXT_RUNTIME,
} as const;
