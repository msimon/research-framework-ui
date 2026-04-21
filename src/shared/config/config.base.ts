export const baseConfig = {
  app: {
    name: 'Research Framework',
    oauthCallbackPath: '/auth/callback',
  },
  supabase: {
    url: 'http://127.0.0.1:54321',
  },
  llm: {
    model: 'claude-opus-4-7',
    thinkingBudgetTokens: 8000,
  },
} as const;
