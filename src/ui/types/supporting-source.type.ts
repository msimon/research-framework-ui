// A web_search result URL the model considered but did not directly cite.
// Persisted as part of the `supporting_sources` JSONB array on
// `deep_research_turns` and `landscapes`.
export type SupportingSource = { url: string; title: string | null };
