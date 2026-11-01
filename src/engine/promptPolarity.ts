/** Bounded clause exclusions shared by task, material, format and keyword parsing. */
export function promptPolarity(words: string[]) {
  const excluded = new Set<number>();
  const boundaries = new Set(['\u0000', '\u0001', 'but', 'however', 'instead']);
  for (let start = 0; start < words.length; start += 1) {
    const word = words[start];
    const alternative =
      (word === 'instead' && words[start + 1] === 'of') ||
      (word === 'rather' && words[start + 1] === 'than');
    if (
      !alternative &&
      ![
        'not',
        'no',
        'without',
        'avoid',
        'exclude',
        'excluding',
        'never',
      ].includes(word)
    )
      continue;
    const roleQualifier = words.findIndex(
      (part, index) =>
        index > start &&
        index < start + 15 &&
        ['treating', 'treat', 'assuming', 'assume'].includes(part),
    );
    // Rejecting how a practice partner behaves does not reject the rehearsal itself.
    if (
      word === 'not' &&
      words[start + 1] === 'want' &&
      roleQualifier > start &&
      words.slice(start + 2, roleQualifier).includes('partner') &&
      words.slice(start + 2, roleQualifier).includes('practice') &&
      !words.slice(start, roleQualifier).some((part) => boundaries.has(part))
    ) {
      excluded.add(start);
      let end = roleQualifier;
      while (end < words.length && !boundaries.has(words[end]))
        excluded.add(end++);
      continue;
    }
    const following = words.slice(start + 1, start + 5);
    const clauseStart =
      Math.max(
        words.lastIndexOf('\u0000', start - 1),
        words.lastIndexOf('\u0001', start - 1),
      ) + 1;
    const prefix = words.slice(clauseStart, start);
    // Additive comparisons and lack of experience do not reject a tool/task.
    if (
      (word === 'not' && following[0] === 'only') ||
      // "People will not read the guide" describes the audience, not rejected input.
      (word === 'not' &&
        (prefix.at(-1) === 'will' ||
          (['do', 'does'].includes(prefix.at(-1) ?? '') &&
            prefix
              .slice(0, -1)
              .some((part) =>
                [
                  'i',
                  'we',
                  'they',
                  'people',
                  'staff',
                  'team',
                  'volunteer',
                  'learner',
                  'reader',
                ].includes(part),
              ))) &&
        ['read', 'reading'].includes(following[0])) ||
      // A topic such as "explain what we should and should not upload" is
      // discussing a rule, not excluding the topic from recommendations.
      (word === 'not' &&
        prefix.some((part) => ['what', 'which'].includes(part)) &&
        prefix.some((part) =>
          ['explaining', 'explain', 'about', 'understand'].includes(part),
        )) ||
      (word === 'no' &&
        following.some((part) =>
          ['experience', 'knowledge', 'training'].includes(part),
        )) ||
      // A lack of time to read a source does not reject its application or subject.
      (word === 'not' &&
        following[0] === 'have' &&
        following.slice(1).includes('time') &&
        words
          .slice(start + 1, start + 8)
          .some((part) => ['read', 'reading', 'review'].includes(part))) ||
      (word === 'not' &&
        /^(?:really )?(?:know|sure|understand|familiar)\b/.test(
          following.join(' '),
        ))
    )
      continue;
    let end = start + 1;
    while (end < words.length) {
      if (boundaries.has(words[end])) break;
      if (
        ['i', 'we', 'please'].includes(words[end]) &&
        ['need', 'want', 'would', 'prefer', 'use', 'show'].includes(
          words[end + 1],
        )
      )
        break;
      if (
        words[end] === 'and' &&
        ['then', 'please', 'instead'].includes(words[end + 1])
      )
        break;
      end += 1;
    }
    for (let index = start; index < end; index += 1) excluded.add(index);
  }
  return {
    excluded,
    isExcluded: (start: number, end: number) =>
      words.slice(start, end).some((_, offset) => excluded.has(start + offset)),
    positiveWords: words.map((word, index) =>
      excluded.has(index) ? '' : word,
    ),
  };
}
