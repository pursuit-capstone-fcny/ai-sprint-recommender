import { describe, expect, it } from 'vitest';
import { IntakeProfileSchema } from './intakeProfile';

describe('IntakeProfileSchema', () => {
  it('accepts a null functionArea to mean "Not sure"', () => {
    expect(() =>
      IntakeProfileSchema.parse({
        functionArea: null,
        goalWords: ['grant', 'report'],
        tools: ['ChatGPT'],
      }),
    ).not.toThrow();
  });

  it('accepts an empty goalWords array', () => {
    expect(() =>
      IntakeProfileSchema.parse({
        functionArea: 'Fundraising',
        goalWords: [],
        tools: [],
      }),
    ).not.toThrow();
  });
});
