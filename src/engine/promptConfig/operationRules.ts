import type { CandidateRequirement, OperationRule } from '../taskIntent';

export const candidate = (
  tasks: string[],
  priority = 100,
  extra: Omit<CandidateRequirement, 'tasks' | 'priority'> = {},
): CandidateRequirement => ({ tasks, priority, ...extra });
export const rule = (
  id: string,
  when: string[][],
  tasks: string[],
  source: string | undefined,
  outputs: string[],
  candidates: CandidateRequirement[],
  extra: Partial<OperationRule> = {},
): OperationRule => ({
  id,
  when,
  tasks,
  source,
  outputs,
  candidates,
  ...extra,
});
