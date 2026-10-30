import type { LearningFormatConfig } from '../learningFormat';
export const learningFormats: LearningFormatConfig = {
  formats: [
    {
      id: 'demo',
      label: 'Demonstration',
      aliases: [
        'demo',
        'demonstration',
        'live demo',
        'live demonstration',
        'demos',
        'demonstrations',
      ],
    },
    {
      id: 'walkthrough',
      label: 'Guided walkthrough',
      aliases: [
        'walkthrough',
        'walk through',
        'tutorial',
        'step by step tutorial',
        'step by step guide',
        'walkthroughs',
        'tutorials',
      ],
    },
    {
      id: 'presentation',
      label: 'Presentation or talk',
      aliases: [
        'presentation',
        'presentations',
        'lecture',
        'talk',
        'lectures',
        'talks',
      ],
      ambiguousArtifact: true,
    },
    {
      id: 'explainer',
      label: 'Conceptual explainer',
      aliases: [
        'explainer',
        'conceptual explanation',
        'overview',
        'explainers',
        'overviews',
      ],
      ambiguousArtifact: true,
    },
  ],
  videos: [
    {
      youtubeId: '3sui0H77srg',
      primary: 'presentation',
      secondary: ['explainer'],
    },
    {
      youtubeId: 'jWdB3uOYoug',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'MpkMYlaHU4k',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'VQRVNYS1m3g',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'ADF07rFbH8M',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'S_DQeIX2xz8',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'FMQJH3c5cLc',
      primary: 'presentation',
      secondary: ['explainer'],
    },
    {
      youtubeId: 'QblW0rArEME',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'Uz6W_hJloK8',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'rFhgVTsItlU',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'i22v2xwT6k4',
      primary: 'presentation',
      secondary: ['explainer'],
    },
    {
      youtubeId: 'NPl_WDdrKMU',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'Kv0C743lCUw',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '_wdiyBIC8uc',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'vzeAxozbV6w',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '6EWc3MgRNFg',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'UJZx6o69c-g',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: '6d2bKhdmqqA',
      primary: 'presentation',
      secondary: ['explainer'],
    },
    {
      youtubeId: '8ahFA8ECM4c',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '3oX_M8AcBXk',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'bxfxzx-_MME',
      primary: 'presentation',
      secondary: ['explainer'],
    },
    {
      youtubeId: 't1yNb7iV6g4',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'tAhSI5nok0s',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'AmVG-vTsBOc',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'YYxm3GCAK-0',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'DP0rtrJVOvM',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'AjI2GF1b6zo',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'gzxiw5xdPPI',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: '_9QqyTbwisc',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'nBAaIIz9QFg',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'BiOpGsijKl8',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'm0mI6_g0V2g',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'BEGWkv3nrk0',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'PUACowM_SdU',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'W-j725bzPJU',
      primary: 'presentation',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'DNfFMZxAI-0',
      primary: 'explainer',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'jm9ZaKY1taA',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '0qSXFbGrQ90',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'tHf5uDqVvzo',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'R3JQqOh4tUQ',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'sLAu2FqUZyE',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'smSNnphsmiw',
      primary: 'presentation',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'ZlfTvy2PT1w',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '6VQWti4-pLE',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '33a0qYtCMvc',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'tIekXJLsm8g',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'C7wclvAF0Mc',
      primary: 'presentation',
      secondary: ['explainer'],
    },
    {
      youtubeId: '9Np4JDDQvpA',
      primary: 'walkthrough',
      secondary: ['demo'],
    },
    {
      youtubeId: '7VjxCHhyAJE',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'WtEV-VSDLFg',
      primary: 'presentation',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'ShikWPoBRac',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'wu6DHIkJH7k',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'Xlvo2_eUBLo',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'fCAYTD-hgU8',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '4Wo_miqxgmE',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'VTycx1bgdPk',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'rjaMvND2IRU',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'M-MqULy0DqM',
      primary: 'presentation',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'UdWR8KKxVDU',
      primary: 'presentation',
      secondary: ['explainer'],
    },
    {
      youtubeId: 'ldd8wxVHvCw',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'ZMPLTq-ptrE',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: '4LMIC-v5xZ0',
      primary: 'presentation',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'dooZWSQCNSs',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'Q0Vr4PnGoe4',
      primary: 'explainer',
      secondary: [],
    },
    {
      youtubeId: 'YACIPFCbGV8',
      primary: 'walkthrough',
      secondary: ['explainer'],
    },
    {
      youtubeId: 'rtBkm7m6JCg',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '0kMuHMGvhBE',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '7IYj3W4PdPE',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'c5bL8ah2teE',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'cwCVpchJHB4',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'LCZZLOrfwXc',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'Hkj01weD_Hs',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'JzV9-_irHdI',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: '5vR5cPnqT-Q',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: '1yBNcKEISP0',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'lYzFro10bDM',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'dAqdQGqyNq8',
      primary: 'presentation',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'zTcrktnmv48',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'AMdAwWwdOzY',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '-zIvVmJ2XFw',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'kONzk7f2M5o',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'xpbFvf5lM-w',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: '_pM0ua51qRI',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: '89GrUhOThk4',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'Fz_zl467-QU',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'Z8yOypmasGg',
      primary: 'demo',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'rKn6KASMk50',
      primary: 'explainer',
      secondary: ['walkthrough'],
    },
    {
      youtubeId: 'maR3ZerQIJU',
      primary: 'walkthrough',
      secondary: [],
    },
    {
      youtubeId: 'wxJVc1q_nnY',
      primary: 'walkthrough',
      secondary: [],
    },
  ],
};
