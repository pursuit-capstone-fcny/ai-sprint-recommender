import type { PublicCatalog } from '../src/contracts/publicCatalog';

// Exclude narrow task/output mismatches. Blank browsing keeps the catalog intact;
// unknown output types stay with the model. Tags, labels and rules are untouched.
export function haikuTaskScope(items: PublicCatalog['items'], goal: string) {
  const text = goal.normalize('NFKC').toLowerCase();
  if (!text.trim()) return items;
  const aiLearning =
    /\b(ai|artificial intelligence|chatgpt|copilot|claude|gemini)\b/.test(
      text,
    ) &&
    /\b(learn\w*|try|trying|adopt\w*|experimen\w*|responsib\w*|safe\w*|polic\w*|guidelin\w*|risks?|concerns?|basics|understand\w*)\b/.test(
      text,
    );
  const negotiating =
    /\b(negotiat\w*|purchas\w*|buy\w*|procure\w*|vendor\w*|pricing|prices?|market rates?|equipment)\b/.test(
      text,
    );
  const outputs = {
    audio: /\b(audio|podcasts?)\b/.test(text),
    song: /\b(songs?|lyrics?|music)\b/.test(text),
    flier: /\b(fliers?|flyers?|posters?|handouts?)\b/.test(text),
    presentation: /\b(slides?|decks?|presentations?)\b/.test(text),
    writing:
      /\b(reports?|applications?|social posts?|public updates?|letters?)\b/.test(
        text,
      ),
  };
  const specificOutput = Object.values(outputs).some(Boolean);
  const tracking = /\b(attendance|interventions?|records?|follow[- ]up)\b/.test(
    text,
  );
  const jobSeeking = /\b(jobs?|careers?|resumes?|cvs?|interviews?)\b/.test(
    text,
  );
  return items.filter((item) => {
    const tasks = item.tasks.map((task) => task.toLowerCase());
    if (
      tasks.length &&
      tasks.every((task) =>
        ['staff ai adoption', 'ai basics'].includes(task),
      ) &&
      !aiLearning
    )
      return false;
    if (
      tasks.includes('negotiation preparation') &&
      tasks.every((task) =>
        ['market research', 'negotiation preparation'].includes(task),
      ) &&
      !negotiating
    )
      return false;
    if (tasks.includes('job application drafting') && tracking && !jobSeeking)
      return false;
    if (!specificOutput) return true;
    const matchedOutput =
      (outputs.audio && tasks.includes('audio creation')) ||
      (outputs.song && tasks.includes('song creation')) ||
      (outputs.flier && tasks.includes('flier design')) ||
      (outputs.presentation && tasks.includes('presentation creation'));
    if (matchedOutput) return true;
    // These narrowly tagged deliverables should not substitute for an explicitly
    // different output. General design, editing and research methods remain eligible.
    return !tasks.some((task) =>
      ['audio creation', 'song creation', 'flier design'].includes(task),
    );
  });
}
