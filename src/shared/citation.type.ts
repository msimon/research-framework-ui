// Shape of a single citation event captured from Anthropic's
// `web_search_result_location` blocks during streaming. Stored in the
// `citation_map` JSONB column on `deep_research_turns` and `landscapes`,
// then read at render time to compute `[N]` brackets via URL lookup
// against the entity-scoped sources list.
export type CitationEntry = { url: string; cited_text: string };
