// One citation captured from Anthropic's `web_search_result_location` blocks
// during streaming. Stored in the `citation_map` JSONB column on
// `deep_research_turns` and `landscapes` in emission order.
//
// Bracket rendering is baked into the persisted markdown by the server
// (block-precise: brackets are appended at the end of each text content
// block where the API delivered citations), so the frontend doesn't need
// to translate citation_map entries into anchor positions.
export type CitationEntry = { url: string; title: string | null; cited_text: string };
