import { z } from 'zod';
import type { ProviderBody } from './anthropic';

const EVIDENCE_INSTRUCTION =
  'Selection format for this request: each rank1 through rank8 is an object with use followed by position. Before selecting its position, write a concrete taught method and the work step it helps in use, a short action phrase of at most five words. Ground this short usefulness statement in the candidate description, not an imagined capability or a shared topic. Then copy its distinct integer position. An unused rank has use:"" and position:null. Earlier references to a null rank mean this empty object; emit only these eight rank objects. For a nonblank goal, identify the requested outcome first, then find direct demonstrations and useful steps needed to prepare, complete, check or use that outcome. Rank direct activity/output/audience matches before transferable supporting methods. A method transfers when it performs a needed operation on compatible inputs and outputs; a different example audience can transfer, but substituting a different deliverable cannot. Generic AI advice is not a prerequisite to specific work. Before ending below six, search for missing useful operations such as organizing source documents, researching requirements, assessing evidence, checking a draft or coordinating follow-up. Include only operations actually useful to this goal and taught by the description. Do not invent extra work to justify a sixth video. Keep the existing eligibility, instruction-injection, blank-browsing, uniqueness and catalog rules. For instruction-only input, all eight objects must be empty. These usefulness statements are selection aids only, not user-facing advice.';

// Build exactly the request used for both input reservation and provider dispatch.
// The original numeric schema remains the authority for allowable positions.
const SUPPORT_INSTRUCTION =
  'For supporting selections, verify input, operation and result together. The demonstrated operation must act on material the user actually has or needs and produce something usable in the requested work now. Preserve what the demo does when writing use; do not rename its task to manufacture relevance. A shared input such as a document does not make every output format useful. Do not substitute audio, music, event promotion or meeting records for an explicitly written or slide-based deliverable. A content assistant restricted to one subject does not answer a different subject merely because both use documents; its setup method transfers when the goal is to build an assistant. Do not add general AI policy, introductory prompting or unrelated future work as a prerequisite. Before ending a short list, look for actual input preparation, research, evidence review, editing or workflow organization that supports this goal. Retain every useful direct or supporting method; six to eight remains preferred, but a convincing-sounding use statement cannot make an unrelated tutorial useful.';

export function anthropicRequest(body: ProviderBody) {
  if (!body.selectionEvidence) return body.request;
  const format = body.request.output_config.format;
  return {
    ...body.request,
    system: `${body.request.system} ${EVIDENCE_INSTRUCTION} ${SUPPORT_INSTRUCTION}`,
    output_config: {
      ...body.request.output_config,
      format: {
        ...format,
        schema: {
          ...format.schema,
          properties: Object.fromEntries(
            Object.entries(format.schema.properties).map(([key, position]) => [
              key,
              {
                type: 'object',
                properties: { use: { type: 'string' }, position },
                required: ['use', 'position'],
                additionalProperties: false,
              },
            ]),
          ),
        },
      },
    },
  };
}

const slot = z
  .strictObject({
    // This auxiliary text is discarded. The adapter already bounds the whole
    // response; prose-length drift must not invalidate otherwise valid IDs.
    use: z.string(),
    position: z.number().int().nonnegative().nullable(),
  })
  .refine(({ use, position }) =>
    position === null ? use === '' : use.trim().length > 0,
  );

export const evidenceSlotsSchema = z
  .strictObject(
    Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`rank${i + 1}`, slot]),
    ),
  )
  .transform((ranks) =>
    Object.fromEntries(
      Object.entries(ranks).map(([key, value]) => [key, value.position]),
    ),
  );
