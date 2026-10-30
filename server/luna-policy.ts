// Deployed candidate only. Historical isolated comparisons retain their limits.
export const LUNA_DEPLOYED_PROMPT = 'catalog-rank-luna-v14-fast';
export const LUNA_TARGETED_RANKING_INSTRUCTION =
  'Select six to eight useful distinct videos before ordering; retain supporting methods when reranking. Distinguish questions the counterparty may ask you from questions you will ask them. For the former, prioritize demos that evaluate your material from their perspective and generate their questions, alongside rehearsal, before research or more practice for other audiences. Missing tool tags do not outweigh direct content evidence. Keep complementary workflows in later ranks rather than shrinking to only direct matches. Never pad with weak videos. Check all positions for repeats.';
export const LUNA_DEPLOYED_MAX_INPUT = 50_000;
export const LUNA_DEPLOYED_MAX_OUTPUT = 1_000;
export const LUNA_DEPLOYED_RESERVATION = 11_000;
// Jason added $1 on October 30. The existing ledger and charges are not reset.
export const LUNA_TOTAL_ALLOWANCE = 2_000_000;
