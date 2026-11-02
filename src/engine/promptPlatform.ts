import { languageTokens, promptWords } from './promptLanguage';
import { promptPolarity } from './promptPolarity';

/** Native controls or an exclusive named application require that platform, even outside the dictionary. */
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
    ...prompt.matchAll(
      new RegExp(
        `\\b(?:use|using|work in)\\s+${name}\\b[^.!?]{0,100}\\bits\\s+[^.!?]{0,100}\\b(?:controls?|interface|screens?)\\b`,
        'g',
      ),
    ),
  ];
  const exclusive = [
    ...prompt.matchAll(
      new RegExp(`\\b(?:in|using|with|use)\\s+${name}\\s+only\\b`, 'g'),
    ),
    ...prompt.matchAll(
      new RegExp(`\\b(?:in|using|with|use)\\s+only\\s+${name}\\b`, 'g'),
    ),
  ];
  matches.push(
    ...exclusive.filter(
      (match) =>
        !/^(?:AI|English|Spanish|French|Mandarin|German|Arabic)$/.test(
          match[1],
        ),
    ),
  );
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
