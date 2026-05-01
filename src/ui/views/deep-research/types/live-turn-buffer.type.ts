import type { CitationEntry } from '@/shared/citation.type';
import type { SupportingSource } from '@/shared/supporting-source.type';

export type LiveTurnBuffer = {
  text: string;
  reasoning: string;
  toolCalls: Array<{ id: string; name: string; query: string; resolved: boolean }>;
  citations: CitationEntry[];
  supporting: SupportingSource[];
};
