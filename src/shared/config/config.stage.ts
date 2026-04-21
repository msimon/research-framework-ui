import type { AppStage } from '@/shared/config/config.types';

type StageOverrides = {
  app: {
    debugLogs: boolean;
  };
};

export const stageConfig: Record<AppStage, StageOverrides> = {
  local: {
    app: { debugLogs: true },
  },
  test: {
    app: { debugLogs: false },
  },
  development: {
    app: { debugLogs: true },
  },
  production: {
    app: { debugLogs: false },
  },
};
