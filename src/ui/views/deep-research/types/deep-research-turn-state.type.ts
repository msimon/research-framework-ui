import type { CitationEntry } from '@/shared/citation.type';
import type { SupportingSource } from '@/shared/supporting-source.type';

export type DeepResearchTurnState = {
  id: string;
  turn_number: number;
  user_text: string | null;
  findings_md: string | null;
  my_read_md: string | null;
  followup_question: string | null;
  reasoning_md: string | null;
  citation_map: CitationEntry[];
  supporting_sources: SupportingSource[];
  status: string;
  error_message: string | null;
};
