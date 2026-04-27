import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  compiler: {
    removeConsole: process.env.NEXT_PUBLIC_APP_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();
