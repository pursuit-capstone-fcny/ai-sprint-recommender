import type { CapabilityConstraint } from '../taskIntent';

/** A named method or hard environment needs matching teaching evidence, regardless of retrieval route. */
export const capabilityConstraints: readonly CapabilityConstraint[] = [
  { when: [['power query']], teaching: [['power query']] },
  {
    when: [
      ['outlook'],
      ['own control', 'native control'],
      ['attachment', 'filing'],
    ],
    tasks: ['Email automation'],
    tools: ['Microsoft Outlook'],
  },
  {
    when: [['voice cloning', 'lip sync', 'mouth movement', 'dubbing']],
    teaching: [['voice cloning', 'lip sync', 'dubbing']],
  },
  {
    when: [['forecast', 'time series', 'backtest']],
    teaching: [['forecast', 'time series', 'backtest']],
  },
  {
    when: [
      ['route', 'route planning'],
      ['capacity', 'time window'],
    ],
    teaching: [
      ['route', 'routing'],
      ['capacity', 'time window'],
    ],
  },
];
