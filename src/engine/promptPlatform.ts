import { languageTokens, promptWords } from './promptLanguage';
import { promptPolarity } from './promptPolarity';

/** A request for an application's own controls requires that platform, even outside the dictionary. */
export function requiredPlatform(prompt: string) {
  const name = '([A-Z][A-Za-z0-9-]*(?:\\s+[A-Z][A-Za-z0-9-]*)*)';
  const positive = promptPolarity(promptWords(prompt)).positiveWords.join(' ');
  const matches = [
    ...prompt.matchAll(
      new RegExp(
        `\\b(?:actual|native)\\s+${name}\\s+(?:screens?|controls?|interface|formulas?)\\b`,
        'g',
      ),
    ),
    ...prompt.matchAll(new RegExp(`\\b${name}['’]s own\\b`, 'g')),
  ];
  const app = /\b(?:built[ -]in\s+)?([A-Z][a-zA-Z]+)\s+app\b/.exec(prompt);
  if (
    app &&
    /\b(?:only|actual controls|own controls|own formula|without switching|native)\b/i.test(
      positive,
    )
  )
    matches.push(app);
  return matches.find((match) =>
    usesRequiredPlatform([positive], match[0]),
  )?.[1];
}

export function usesRequiredPlatform(
  tools: readonly string[],
  required: string,
) {
  const parts = languageTokens(required);
  return tools.some((tool) => {
    const words = languageTokens(tool);
    return words.some((_, start) =>
      parts.every((part, offset) => words[start + offset] === part),
    );
  });
}
