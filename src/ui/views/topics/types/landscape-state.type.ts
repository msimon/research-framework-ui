import type { CitationEntry } from '@/shared/citation.type';
import type { SupportingSource } from '@/shared/supporting-source.type';

export type LandscapeState = {
  id: string;
  content_md: string;
  citation_map: CitationEntry[];
  supporting_sources: SupportingSource[];
  status: 'pending' | 'streaming' | 'complete' | 'failed' | string;
  error_message: string | null;
  updated_at: string;
};
