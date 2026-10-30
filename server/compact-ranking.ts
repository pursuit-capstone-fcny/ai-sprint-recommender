import {
  RANK_OUTPUT_INSTRUCTION,
  UNTRUSTED_INPUT_INSTRUCTION,
  type ProviderBody,
} from './anthropic';
import {
  LUNA_GOAL_ELIGIBILITY_INSTRUCTION,
  LUNA_TARGETED_RANKING_INSTRUCTION,
} from './luna-policy';

const catalogFields = [
  'position',
  'title',
  'description',
  'functionAreas',
  'tasks',
  'tools',
] as const;
export function compactRanking(body: ProviderBody) {
  return {
    system:
      body.request.system
        .replace(UNTRUSTED_INPUT_INSTRUCTION, LUNA_GOAL_ELIGIBILITY_INSTRUCTION)
        .replace(
          RANK_OUTPUT_INSTRUCTION,
          'Each catalog row uses the field order in catalogFields. Return one positions array containing six to eight useful, distinct catalog positions when available, best match first. Choose the strongest three direct matches first. Then review the remaining catalog for demonstrations of other requested activities and directly useful supporting steps: preparing inputs, producing or checking the deliverable, or using the result. A second demonstration of the same task can be useful when it teaches a different practical method. Before stopping below six, check for these complementary matches across the whole catalog, including transferable workflows from another function area or tool. Among equally useful choices, prefer different existing primary task tags. Never invent task tags or add a weak match for diversity. Return fewer only when the catalog lacks further useful matches, and an empty array when none fit. Never pad with unrelated videos. Recheck that every position is distinct. Copy the integer position provided for each item; never invent a position or return IDs, titles, URLs, or explanations.',
        ) + ` ${LUNA_TARGETED_RANKING_INSTRUCTION}`,
    content: JSON.stringify({
      ...body.data,
      catalogFields,
      catalog: body.data.catalog.map((item) =>
        catalogFields.map((field) => item[field]),
      ),
    }),
  };
}
