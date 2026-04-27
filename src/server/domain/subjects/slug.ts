const FILLER_WORDS = new Set([
  'a',
  'an',
  'and',
  'but',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'without',
  'at',
  'by',
  'vs',
  'versus',
]);

export function deriveSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.split(' ').filter((t) => t && !FILLER_WORDS.has(t));
  const kept = tokens.slice(0, 6);
  const slug = kept.join('-').replace(/-+/g, '-');

  if (!slug) {
    return `subject-${Date.now().toString(36)}`;
  }

  return slug;
}

export function isLikelyProblemStatement(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return trimmed.split(/\s+/).length > 3 || /[.,!?]/.test(trimmed);
  return false;
}
