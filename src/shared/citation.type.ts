// One source captured during streaming from Anthropic's web_search results.
// Stored in the `citation_map` JSONB column on `deep_research_turns` and
// `landscapes` in emission order (NOT deduplicated). The model emits cite
// tags like `<cite index="X-Y">...</cite>` where X is the 1-indexed position
// in this list — the bracket renderer parses X to look the URL up here, then
// finds that URL's position in the deduplicated displayed sources list to
// compute the bracket number.
export type CitationEntry = { url: string; title: string | null };
