'use client';

import { createContext, type ReactNode, useContext } from 'react';

import type { CitationEntry } from '@/shared/citation.type';

export type CitationSource = { url: string };

export type CitationContextValue = {
  citationMap: CitationEntry[];
  sources: CitationSource[];
};

const CitationContext = createContext<CitationContextValue | null>(null);

export function CitationProvider({ value, children }: { value: CitationContextValue; children: ReactNode }) {
  return <CitationContext.Provider value={value}>{children}</CitationContext.Provider>;
}

export function useCitations(): CitationContextValue | null {
  return useContext(CitationContext);
}
