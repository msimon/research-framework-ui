export type SourceTrust = {
  url: string;
  domain: string;
  category: string;
  trust_score: number;
  rationale: string;
};

export type SourceTrustMap = Record<string, SourceTrust>;
