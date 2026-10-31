import { normalizeTerm } from '../contracts/publicCatalog';
import {
  languageWord,
  type TaskIntentMention,
  type PromptLanguage,
} from './promptLanguage';
import type { ArtifactType } from './workflow';

const PRODUCE = new Set([
  'need',
  'want',
  'like',
  'create',
  'make',
  'build',
  'generate',
  'draft',
  'produce',
  'write',
  'prepare',
  'configure',
  'assemble',
  'design',
  'develop',
  'set',
  'apply',
  'suggest',
  'outline',
  'plan',
  'chart',
  'record',
  'revise',
  'return',
  'break',
  'find',
]);
const INPUT_ACTIONS = new Set([
  'summarize',
  'analyze',
  'compare',
  'proofread',
  'edit',
  'review',
  'translate',
  'debug',
  'adapt',
  'condense',
  'explore',
  'inspect',
  'read',
  'research',
  'reformat',
  'standardize',
  'structure',
  'clean',
  'organize',
  'audit',
  'refine',
  'improve',
  'test',
  'check',
  'turn',
  'convert',
  'repurpose',
  'use',
  'identify',
  'find',
  'correct',
  'explain',
  'reuse',
]);
const MODIFIERS = new Set([
  'long',
  'short',
  'brief',
  'concise',
  'existing',
  'original',
  'new',
  'first',
  'draft',
]);
interface MaterialMention {
  type: ArtifactType;
  start: number;
  end: number;
}

/** Interpret local predicates before selecting reviewed workflow pairs. */
export function interpretWorkflowIntent(
  artifacts: Map<string, ArtifactType>,
  words: string[],
  taskMentions: TaskIntentMention[],
  enabled: boolean,
  toolSpans: { start: number; end: number }[] = [],
  refinements: PromptLanguage['refinements'] = [],
) {
  const normalized = words.map(languageWord);
  const clauseStart = (index: number) =>
    normalized.lastIndexOf('\u0000', index - 1) + 1;
  const clauseEnd = (index: number) => {
    const end = normalized.indexOf('\u0000', index);
    return end < 0 ? words.length : end;
  };
  const toolAt = (index: number) =>
    toolSpans.some((span) => index >= span.start && index < span.end);
  const actions = new Set([
    ...PRODUCE,
    ...INPUT_ACTIONS,
    'ask',
    'answer',
    'have',
    'got',
    'upload',
    'supply',
    'provide',
    'paste',
    'sent',
    'received',
  ]);
  const verbAt = (index: number) => {
    if (toolAt(index)) return false;
    if (['not', 'no', 'without', 'avoid'].includes(normalized[index - 1]))
      return false;
    const word = normalized[index];
    if (word === 'like' && normalized[index - 1] !== 'would') return false;
    if (
      ['plan', 'chart', 'outline', 'record', 'answer', 'research'].includes(
        word,
      ) &&
      (['a', 'an', 'the', 'my', 'our', 'its', 'their', 'your'].includes(
        normalized[index - 1],
      ) ||
        PRODUCE.has(normalized[index - 1]))
    )
      return false;
    // "I have a draft document" uses draft as an adjective.
    if (
      (word === 'draft' || words[index] === 'written') &&
      normalized.slice(clauseStart(index), index).includes('have') &&
      !['to', 'then', 'and'].includes(normalized[index - 1])
    )
      return false;
    // A research report, work plan or writing sample can be input nouns.
    if (
      ['research', 'plan', 'write', 'outline', 'chart'].includes(word) &&
      [
        'a',
        'an',
        'the',
        'our',
        'my',
        'public',
        'web',
        'long',
        'work',
        'strategic',
        'weekly',
        'monthly',
        'action',
      ].includes(normalized[index - 1])
    )
      return false;
    return actions.has(word);
  };
  const lastVerb = (index: number) => {
    for (let i = index - 1; i >= clauseStart(index); i -= 1)
      if (verbAt(i)) return i;
    return -1;
  };
  const topicAt = (index: number) => {
    const prefix = normalized.slice(clauseStart(index), index);
    const topic = Math.max(
      prefix.lastIndexOf('about'),
      prefix.lastIndexOf('covering'),
      prefix.lastIndexOf('explaining'),
      prefix.includes('') && prefix[prefix.lastIndexOf('on') - 1] !== 'based'
        ? prefix.lastIndexOf('on')
        : -1,
    );
    return (
      topic >= 0 &&
      !prefix
        .slice(topic + 1)
        .some(
          (word) =>
            PRODUCE.has(word) ||
            INPUT_ACTIONS.has(word) ||
            ['into', 'to', 'from'].includes(word),
        )
    );
  };
  const artifactWord = (word: string) =>
    word.length > 4 && word.endsWith('ies')
      ? `${word.slice(0, -3)}y`
      : word.length > 3 && word.endsWith('s') && !/(ss|is|us)$/.test(word)
        ? word.slice(0, -1)
        : word;
  const materialWords = words.map(artifactWord);
  const aliases = [...artifacts.values()]
    .flatMap((type) =>
      type.aliases.map((alias) => ({
        type,
        tokens: normalizeTerm(alias.normalize('NFKC'))
          .split(' ')
          .filter(Boolean)
          .map(artifactWord),
      })),
    )
    .sort(
      (a, b) =>
        b.tokens.length - a.tokens.length ||
        (a.type.id < b.type.id ? -1 : a.type.id === b.type.id ? 0 : 1),
    );
  const occupied = new Set<number>();
  const materials: MaterialMention[] = [];
  if (enabled)
    for (const alias of aliases)
      for (
        let start = 0;
        start <= words.length - alias.tokens.length;
        start += 1
      ) {
        const end = start + alias.tokens.length;
        // A duration is not a meeting-minutes source, even when hyphenated.
        if (
          alias.type.id === 'minutes' &&
          /^\d+$|^(one|two|three|four|five|ten|fifteen|thirty|sixty)$/.test(
            normalized[start - 1] ?? '',
          )
        )
          continue;
        if (
          !alias.tokens.every(
            (part, offset) =>
              materialWords[start + offset] === part &&
              !occupied.has(start + offset) &&
              !toolAt(start + offset),
          ) ||
          topicAt(start)
        )
          continue;
        if (alias.tokens.length === 1 && verbAt(start)) continue;
        if (
          ['not', 'no', 'without', 'avoid', 'exclude', 'excluding'].includes(
            normalized[start - 1],
          )
        )
          continue;
        if (
          alias.type.id === 'answer' &&
          normalized
            .slice(Math.max(clauseStart(start), start - 3), end + 3)
            .some((word) => ['clarifying', 'clarify', 'missing'].includes(word))
        )
          continue;
        for (let i = start; i < end; i += 1) occupied.add(i);
        const governingVerb = lastVerb(start);
        const transformationDestination =
          governingVerb >= 0 &&
          [
            'condense',
            'turn',
            'convert',
            'repurpose',
            'adapt',
            'summarize',
          ].includes(normalized[governingVerb]) &&
          normalized
            .slice(governingVerb + 1, start)
            .some((word) => word === 'into' || word === 'to');
        const candidates =
          governingVerb >= 0 &&
          (PRODUCE.has(normalized[governingVerb]) || transformationDestination)
            ? taskMentions.filter(
                (mention) =>
                  mention.start <= start &&
                  mention.end >= end &&
                  mention.outputs?.length === 1 &&
                  artifacts
                    .get(mention.outputs[0])
                    ?.tasks.includes(mention.target),
              )
            : [];
        const narrowest = Math.min(
          ...candidates.map((mention) => mention.end - mention.start),
        );
        const specific = [
          ...new Set(
            candidates
              .filter((mention) => mention.end - mention.start === narrowest)
              .flatMap((mention) => mention.outputs ?? []),
          ),
        ];
        materials.push({
          type:
            specific.length === 1 ? artifacts.get(specific[0])! : alias.type,
          start,
          end,
        });
      }
  materials.sort((a, b) => a.start - b.start);
  const sources = new Set<MaterialMention>();
  const producedSources = new Set<MaterialMention>();
  const outputs = new Set<MaterialMention>();
  const sourceIds = new Set<string>();
  const outputIds = new Set<string>();
  const consumed = new Set<number>();

  // Only a local material complement licenses from/using/of. Tool complements do not.
  for (let index = 0; index < words.length && enabled; index += 1) {
    const word = normalized[index];
    const before = materials.filter((mention) => mention.end <= index);
    const after = materials.find(
      (mention) => mention.start > index && mention.start < clauseEnd(index),
    );
    const left = before.at(-1);
    if (!left || !after) continue;
    const gap = normalized.slice(index + 1, after.start);
    const localAfter =
      gap.length <= 4 &&
      !gap.some(
        (part, offset) =>
          toolAt(index + offset + 1) ||
          actions.has(part) ||
          [
            'and',
            'then',
            'but',
            'find',
            'identify',
            'understand',
            'learn',
            'see',
            'explain',
            'reuse',
          ].includes(part),
      );
    const localBefore =
      left.start >= clauseStart(index) && index - left.end <= 5;
    if (
      (word === 'into' || word === 'to') &&
      localAfter &&
      (word === 'into' ||
        left.end === index ||
        normalized
          .slice(Math.max(clauseStart(index), left.end), index)
          .some((part) =>
            ['turn', 'convert', 'repurpose', 'transform'].includes(part),
          ))
    ) {
      sources.add(left);
      if (
        PRODUCE.has(normalized[lastVerb(left.start)]) &&
        !normalized
          .slice(lastVerb(left.start), left.start)
          .includes('understand')
      )
        producedSources.add(left);
      outputs.add(after);
    }
    const leftVerb = lastVerb(left.start);
    if (
      ['from', 'using', 'on', 'of'].includes(word) &&
      localBefore &&
      localAfter &&
      (word !== 'on' || normalized[index - 1] === 'based') &&
      (word !== 'of' || left.type.verbs?.length) &&
      ((leftVerb >= 0 && PRODUCE.has(normalized[leftVerb])) ||
        ['summary', 'comparison'].includes(left.type.id))
    ) {
      outputs.add(left);
      sources.add(after);
    }
  }
  for (const mention of materials) {
    if (sources.has(mention) || outputs.has(mention)) continue;
    // A recording described as already made is source material, even after "need".
    if (
      mention.type.id === 'video' &&
      (normalized
        .slice(
          Math.max(clauseStart(mention.start), mention.start - 3),
          mention.start,
        )
        .includes('recorded') ||
        /^(?:(?:that|which|we|have|already) )*recorded\b/.test(
          normalized.slice(mention.end, mention.end + 6).join(' '),
        ))
    ) {
      sources.add(mention);
      continue;
    }
    const verb = lastVerb(mention.start);
    const word = normalized[verb];
    const prefix = normalized.slice(clauseStart(mention.start), mention.start);
    // A reference behind an existing artifact is input, not a production request.
    if (
      prefix.includes('behind') &&
      !prefix
        .slice(prefix.lastIndexOf('behind') + 1)
        .some((part) => PRODUCE.has(part))
    ) {
      sources.add(mention);
      continue;
    }
    const understanding = Math.max(
      ...['understand', 'learn', 'know'].map((word) =>
        prefix.lastIndexOf(word),
      ),
    );
    if (
      understanding >= 0 &&
      !prefix.slice(understanding + 1).some((part) => PRODUCE.has(part))
    )
      continue;
    // In "a brief for a policy" the policy names the brief's subject.
    const prior = materials
      .filter((other) => other.end <= mention.start)
      .at(-1);
    const subjectOfBrief =
      prior &&
      prior.type.id === 'context' &&
      normalized.slice(prior.end, mention.start).includes('for') &&
      verb < prior.start;
    if (subjectOfBrief) continue;
    if (
      word === 'organize' &&
      !normalized
        .slice(Math.max(0, mention.start - 2), mention.start)
        .some((part) => ['my', 'existing', 'our'].includes(part)) &&
      taskMentions.some(
        (task) =>
          task.procedural &&
          task.start <= mention.start &&
          task.end >= mention.end &&
          task.outputs?.includes(mention.type.id),
      )
    ) {
      outputs.add(mention);
      continue;
    }

    const previousOutput = [...outputs]
      .filter(
        (output) =>
          output.end <= mention.start &&
          output.start >= clauseStart(mention.start),
      )
      .at(-1);
    if (
      mention.type.id === 'document' &&
      normalized
        .slice(Math.max(0, mention.start - 3), mention.start)
        .includes('resulting') &&
      previousOutput
    )
      mention.type = previousOutput.type;
    const sharedProduction =
      verb >= 2 &&
      INPUT_ACTIONS.has(word) &&
      normalized[verb - 1] === 'and' &&
      PRODUCE.has(normalized[verb - 2]) &&
      verbAt(verb - 2);
    if (sharedProduction) {
      outputs.add(mention);
      continue;
    }

    const priorOutput = [...outputs]
      .filter((output) => output.end <= mention.start)
      .at(-1);
    if (
      priorOutput &&
      lastVerb(priorOutput.start) === verb &&
      normalized
        .slice(priorOutput.end, mention.start)
        .some((part) => ['and', 'or'].includes(part))
    ) {
      outputs.add(mention);
      continue;
    }
    if (
      word === 'find' &&
      mention.type.id === 'document' &&
      taskMentions.some((task) => task.target === 'Research')
    )
      sources.add(mention);
    else if (
      verb >= 0 &&
      [
        'have',
        'got',
        'upload',
        'supply',
        'provide',
        'paste',
        'sent',
        'received',
      ].includes(word)
    )
      sources.add(mention);
    else if (verb >= 0 && PRODUCE.has(word)) outputs.add(mention);
    else if (verb >= 0 && INPUT_ACTIONS.has(word)) {
      if (
        word === 'review' &&
        ['presentation', 'audio'].includes(mention.type.id)
      )
        outputs.add(mention);
      else sources.add(mention);
    } else if (
      verb >= 0 &&
      ['ask', 'answer'].includes(word) &&
      mention.type.id === 'answer'
    )
      outputs.add(mention);
    else if (
      mention.start <
      normalized.findIndex(
        (part, index) =>
          index >= clauseStart(mention.start) &&
          index < clauseEnd(mention.start) &&
          PRODUCE.has(part),
      )
    )
      sources.add(mention);
    // Source nouns at the start of a problem statement: "my code is failing".
    else if (['my', 'our', 'existing'].includes(normalized[mention.start - 1]))
      sources.add(mention);
  }
  const intermediate = new Set<MaterialMention>();
  const supporting = new Set<MaterialMention>();
  const ignored = new Set<MaterialMention>();
  // Configuration attributes and instructional scaffolding are not separate deliverables.
  for (const mention of materials) {
    if (
      mention.type.id === 'context' &&
      normalized[lastVerb(mention.start)] !== 'reuse' &&
      ![
        'work brief',
        'prompt',
        'prompts',
        'sample posts',
        'word',
        'pasted text',
        'public list',
      ].includes(words.slice(mention.start, mention.end).join(' '))
    ) {
      supporting.add(mention);
      sources.delete(mention);
      outputs.delete(mention);
    }
  }
  for (const output of outputs) {
    if (
      ['review', 'test', 'refine', 'check'].includes(
        normalized[lastVerb(output.start)],
      ) &&
      [...outputs].some(
        (other) =>
          other.start < output.start && other.type.id === output.type.id,
      )
    )
      intermediate.add(output);
    const parent = [...outputs].find(
      (other) =>
        other.end <= output.start &&
        other.start >= clauseStart(output.start) &&
        normalized
          .slice(other.end, output.start)
          .some((part) => ['with', 'containing', 'including'].includes(part)) &&
        !normalized
          .slice(other.end, output.start)
          .some((_, index) => verbAt(other.end + index)),
    );
    if (
      parent &&
      (['assistant', 'plan'].includes(parent.type.id) ||
        (output.type.id === 'checklist' &&
          ['document', 'proposal'].includes(parent.type.id)))
    ) {
      supporting.add(output);
      outputs.delete(output);
    }
  }
  for (const source of materials) {
    if (
      (source.type.supportingTasks ?? []).some((task) =>
        taskMentions.some((mention) => mention.target === task),
      ) &&
      [...sources].some(
        (other) =>
          other !== source &&
          (other.type.tasks ?? []).some((task) =>
            (source.type.supportingTasks ?? []).includes(task),
          ),
      )
    )
      supporting.add(source);
    if (!sources.has(source)) continue;
    if (
      source.type.id === 'context' &&
      !['have', 'got', 'upload', 'supply', 'provide', 'reuse'].includes(
        normalized[lastVerb(source.start)],
      ) &&
      [...sources].some(
        (other) => other.start < source.start && other.type.id !== 'context',
      ) &&
      !taskMentions.some(
        (task) =>
          task.start < source.start && task.outputs?.includes('context'),
      )
    )
      supporting.add(source);
    const earlierOutput = [...outputs].some(
      (output) =>
        output.start < source.start && output.type.id === source.type.id,
    );
    const earlierTaskOutput = taskMentions.some(
      (task) =>
        task.end < source.start &&
        task.outputs?.includes(source.type.id) &&
        !sources.has(
          materials.find(
            (material) =>
              task.start >= material.start && task.end <= material.end,
          )!,
        ),
    );
    const priorExistingInput = [...sources].some(
      (other) =>
        other !== source &&
        other.start < source.start &&
        other.type.id === source.type.id &&
        ['have', 'got', 'upload', 'provide', 'supply', 'paste'].includes(
          normalized[lastVerb(other.start)],
        ),
    );
    const earlierGeneratedReview =
      !priorExistingInput &&
      lastVerb(source.start) >= 0 &&
      ['review', 'test', 'refine', 'check'].includes(
        normalized[lastVerb(source.start)],
      ) &&
      [...outputs].some((output) => output.start < source.start);
    const producedSource = producedSources.has(source);
    if (
      earlierOutput ||
      earlierTaskOutput ||
      earlierGeneratedReview ||
      producedSource
    ) {
      intermediate.add(source);
      if (earlierGeneratedReview) outputs.add(source);
    }
    const container = [...sources].find(
      (other) =>
        other.end <= source.start &&
        other.start >= clauseStart(source.start) &&
        normalized
          .slice(other.end, source.start)
          .some((part) =>
            ['of', 'containing', 'describing', 'including'].includes(part),
          ) &&
        !normalized
          .slice(other.end, source.start)
          .some((_, index) => verbAt(other.end + index)),
    );
    if (container) ignored.add(source);
    const action = lastVerb(source.start);
    if (
      action >= 0 &&
      normalized[action - 1] === 'for' &&
      normalized.slice(clauseStart(source.start), action).includes('setup')
    )
      supporting.add(source);
    if (
      normalized[lastVerb(source.start)] === 'use' &&
      [...sources].some(
        (other) =>
          other.start < source.start && other.type.id !== source.type.id,
      )
    )
      supporting.add(source);
  }
  // Adjacent noun modifiers belong to the head material: policy documents, research reports.
  const secondaryHeads = new Set<MaterialMention>();
  for (let i = 0; i < materials.length - 1; i += 1) {
    const left = materials[i],
      right = materials[i + 1];
    if (
      right.start - left.end <= 1 &&
      !normalized
        .slice(left.end, right.start)
        .some((word) =>
          ['and', 'or', 'plus', 'into', 'to', 'from'].includes(word),
        ) &&
      (sources.has(left) || sources.has(right)) &&
      !outputs.has(left) &&
      !outputs.has(right)
    ) {
      sources.add(left);
      sources.add(right);
      if (supporting.has(right)) secondaryHeads.add(right);
      else secondaryHeads.add(left);
    }
  }
  const sourceContains = (span: { start: number; end: number }) =>
    [...sources]
      .filter((source) => !intermediate.has(source) && !supporting.has(source))
      .some((source) => {
        let start = source.start;
        while (
          start > clauseStart(source.start) &&
          source.start - start < 5 &&
          !verbAt(start - 1) &&
          ![
            'and',
            'or',
            'from',
            'using',
            'with',
            'to',
            'into',
            'of',
            'for',
            'in',
            'by',
            'on',
            'through',
            'as',
            'that',
            'which',
            'plus',
            '\u0000',
          ].includes(normalized[start - 1])
        )
          start -= 1;
        return span.start >= start && span.end <= source.end;
      });
  const isSourceTask = (mention: TaskIntentMention) =>
    (sourceContains(mention) ||
      [...supporting].some(
        (material) =>
          mention.start >= material.start && mention.end <= material.end,
      )) &&
    !(mention.contextSpans ?? []).some((span) => !sourceContains(span));
  const eligibleTargets = new Set(
    taskMentions
      .filter((mention) => !isSourceTask(mention))
      .map((mention) => mention.target),
  );
  for (const output of outputs) {
    if (
      (output.type.supportingTasks ?? []).some(
        (task) =>
          eligibleTargets.has(task) &&
          taskMentions.some(
            (mention) =>
              mention.target === task &&
              mention.outputs &&
              !mention.outputs.includes(output.type.id),
          ),
      )
    ) {
      supporting.add(output);
      outputs.delete(output);
    }
  }
  const suppressedTasks = new Set(
    (refinements ?? [])
      .filter(
        (rule) =>
          rule.whenAll.every((task) => eligibleTargets.has(task)) &&
          !(rule.unlessAny ?? []).some((task) => eligibleTargets.has(task)) &&
          !(
            rule.implicitOnly &&
            taskMentions.some(
              (mention) =>
                mention.target === rule.task &&
                mention.natural &&
                !isSourceTask(mention),
            )
          ),
      )
      .map((rule) => rule.task),
  );
  for (const source of sources)
    if (
      !secondaryHeads.has(source) &&
      !intermediate.has(source) &&
      !supporting.has(source) &&
      !ignored.has(source)
    )
      sourceIds.add(source.type.id);
  for (const output of outputs) outputIds.add(output.type.id);
  const inputVerbs = new Map<string, string[]>();
  for (const artifact of artifacts.values())
    for (const verb of artifact.verbs ?? [])
      inputVerbs.set(languageWord(verb), [
        ...(inputVerbs.get(languageWord(verb)) ?? []),
        artifact.id,
      ]);
  if (enabled)
    for (let i = 0; i < words.length; i += 1)
      if (verbAt(i) && inputVerbs.has(normalized[i])) {
        for (const output of inputVerbs.get(normalized[i])!)
          outputIds.add(output);
        consumed.add(i);
      }
  const hasMaterialSource = sourceIds.size > 0;
  if (enabled)
    for (const mention of taskMentions) {
      if (
        isSourceTask(mention) ||
        (topicAt(mention.start) &&
          !(mention.procedural && words.includes(''))) ||
        (suppressedTasks.has(mention.target) &&
          !(refinements ?? []).some(
            (rule) =>
              rule.task === mention.target &&
              rule.retainOutputs &&
              rule.whenAll.every((task) => eligibleTargets.has(task)) &&
              !(rule.unlessAny ?? []).some((task) => eligibleTargets.has(task)),
          ))
      )
        continue;
      // Explicit creation of slides about policy must not infer a policy draft too.
      if (
        !mention.outputs &&
        taskMentions.some(
          (other) => other.target === mention.target && other.outputs,
        )
      )
        continue;
      const implied =
        mention.outputs ??
        [...artifacts.values()]
          .filter((artifact) => artifact.tasks.includes(mention.target))
          .map((artifact) => artifact.id);
      for (const output of implied) outputIds.add(output);
      if (
        (!hasMaterialSource || mention.implicitSourceAlongside) &&
        mention.implicitSource
      )
        sourceIds.add(mention.implicitSource);
    }
  for (const mention of [...sources, ...outputs, ...supporting]) {
    let start = mention.start;
    while (start > 0 && MODIFIERS.has(normalized[start - 1])) start -= 1;
    for (let i = start; i < mention.end; i += 1) consumed.add(i);
  }
  return {
    sourceTypes: [...sourceIds].sort(),
    outputTypes: [...outputIds].sort(),
    consumed,
    isSourceTask,
    suppressedTasks,
    explicitSource: sourceIds.size > 0,
    preferReview:
      normalized.includes('understand') &&
      normalized.some((word) =>
        ['introductory', 'introduction'].includes(word),
      ) &&
      !normalized.some(
        (word, index) =>
          [
            'create',
            'build',
            'generate',
            'write',
            'draft',
            'turn',
            'convert',
          ].includes(word) && verbAt(index),
      ),
    explicitSourceTypes: new Set(
      [...sources]
        .filter(
          (source) =>
            !secondaryHeads.has(source) &&
            !intermediate.has(source) &&
            !supporting.has(source) &&
            !ignored.has(source),
        )
        .map((source) => source.type.id),
    ),
    intermediateTypes: [
      ...new Set([...intermediate].map((mention) => mention.type.id)),
    ].sort(),
    supportingTypes: [
      ...new Set([...supporting, ...ignored].map((mention) => mention.type.id)),
    ].sort(),
  };
}
