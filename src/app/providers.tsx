'use client';

import { useEffect, type ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.location.hostname === 'localhost') {
      const url = new URL(window.location.href);
      url.hostname = '127.0.0.1';
      window.location.replace(url.toString());
    }
  }, []);

  return <>{children}</>;
}
