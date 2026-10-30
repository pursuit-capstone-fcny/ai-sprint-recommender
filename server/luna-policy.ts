// Deployed candidate only. Historical isolated comparisons retain their limits.
export const LUNA_DEPLOYED_PROMPT = 'catalog-rank-luna-v13-fast';
export const LUNA_TARGETED_RANKING_INSTRUCTION =
  "For multi-part goals, use the first three ranks to cover the distinct requested activities with the most specific evidence available. For conversation preparation, anticipating the counterparty's questions and rehearsing responses are separate needs. Prefer demonstrations of that counterparty's perspective and realistic practice before general background research or additional role-plays for another audience. Keep transferable supporting videos in later ranks.";
export const LUNA_DEPLOYED_MAX_INPUT = 50_000;
export const LUNA_DEPLOYED_MAX_OUTPUT = 1_000;
export const LUNA_DEPLOYED_RESERVATION = 11_000;
// Jason added $1 on October 30. The existing ledger and charges are not reset.
export const LUNA_TOTAL_ALLOWANCE = 2_000_000;
