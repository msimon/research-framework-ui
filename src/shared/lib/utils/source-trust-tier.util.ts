export type TrustTier = 'high' | 'medium' | 'low' | 'unknown';

export function trustTier(score: number | undefined | null): TrustTier {
  if (score === undefined || score === null) return 'unknown';
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}
