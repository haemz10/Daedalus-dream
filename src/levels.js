/* Daedalus Dream — the fifteen story stages (drafted by tools/curate.cjs, verified by tools/verify.cjs).
 * See src/level.js for the map legend. Chapter = first digit.
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  DD.STAGES = [
    {
      id: '1-1', light: 2.7, par: 25, hints: ['hint.move','hint.shards'],
      map: [
        '*-o-o o-E',
        '|   | | |',
        'o o-o o o',
        '| |   | |',
        'o-o o-o-o',
        '  | |   |',
        'o-o-o o-*',
        '|     |  ',
        'o o-o-o-o',
        '| |     |',
        'S-o M-*-o'
      ],
      rot: []
    },
    {
      id: '1-2', light: 2.7, par: 30, hints: ['hint.tapMove','hint.zoom','hint.marble'],
      map: [
        'o-o-o-o-* E',
        '|     |   |',
        'o-* M o o-o',
        '|   | | | |',
        'o-o-o-o-o-o',
        '|       |  ',
        'o-o o-* o-o',
        '|   |     |',
        'o-o o-o-o *',
        '| | | | |  ',
        'o o o o o-o',
        '|     | | |',
        'o-o-o-o-o o',
        '    |     |',
        'o-o-S-o-o-o'
      ],
      rot: []
    },
    {
      id: '1-3', light: 2.7, par: 35, hints: ['hint.switch'],
      map: [
        'o-o-opo-o-*',
        '|   |   |  ',
        'opo T-o o o',
        'c c   |   |',
        'o o * o-o-o',
        'p | |   | |',
        'E o-opo-o *',
        'p       |  ',
        'o oco o-o-o',
        '| c | | c |',
        'o o S-o oco',
        'p         |',
        'o-o-o-o-Mpo'
      ],
      rot: []
    },
    {
      id: '1-4', light: 2.7, par: 35, hints: ['hint.balloon'],
      map: [
        'o *-o-o-o-o',
        '|   | |   |',
        'o-o-o-o-o o',
        '|     | | |',
        'o-o-o o-o o',
        '|   | | | |',
        'E o-o-o * o',
        '| |       |',
        'o o *-o o-o',
        '| | | | |  ',
        'o o o o-o-o',
        '| | |   | |',
        'M o o-o-o-o',
        '  | | | |  ',
        '*-o o-o-o-S'
      ],
      rot: [],
      balloons: [{'a':[5,2],'b':[1,2],'speed':1.08,'phase':0.34},{'a':[1,3],'b':[1,6],'speed':1.04,'phase':0.25}]
    },
    {
      id: '1-5', light: 2.7, par: 45, hints: [],
      map: [
        '* o Eco-o-o-o',
        '| | | | | | p',
        'o o-o o-o o o',
        '| |     | | |',
        'o-o-o-o-o o o',
        '|     p   | |',
        'o Mco-o-o-o *',
        'p |   |   |  ',
        'o-o o-o o-o-o',
        '    |   p   |',
        'o-*-o o-T *-o',
        '|   | |     |',
        'o o-o o-o-o o',
        '| c       | c',
        'o o-o-o *po o',
        '|   | |     |',
        'opo-o-S-o-o-o'
      ],
      rot: [],
      balloons: [{'a':[0,5],'b':[4,5],'speed':1.08,'phase':0.39},{'a':[0,1],'b':[6,1],'speed':0.98,'phase':0.21}]
    },
    {
      id: '2-1', light: 2.4, par: 30, hints: ['hint.rotate'],
      map: [
        'o o-o-o *-o',
        '| |   |   |',
        'o-o *-o M-R',
        '| |   | | |',
        'o o-o-o-o o',
        '|     | | |',
        'o E-o o-R-o',
        '| |   | | |',
        'o-o o-o o-o',
        '    |   | |',
        'o-o o *-o-o',
        '|   |      ',
        'o-S-o-o-o-o'
      ],
      rot: [['I',1],['L',3]]
    },
    {
      id: '2-2', light: 2.4, par: 40, hints: [],
      map: [
        'o-o-o-o-o-o-o',
        '| |   | |   |',
        'o o o o o o-R',
        '| | | |     |',
        'o * o-o o-o o',
        '|   | | p | |',
        'o-o-o * o-o E',
        '|   |   |    ',
        'o o-R-o-o-* o',
        '| | |       |',
        'o-opo-o-T *-o',
        '| |   | |   |',
        'o o-o-o o-o o',
        '| |       | p',
        'S-o-o-o-M o-o'
      ],
      rot: [['T',3],['L',3]]
    },
    {
      id: '2-3', light: 2.4, par: 40, hints: ['hint.hand'],
      map: [
        'o-opo-o-o-o-o',
        '| |     | | |',
        'o-o-oco o-* o',
        '|     |     |',
        'o *-o-o-o-o-o',
        '| | |       |',
        'o ococo o-o-T',
        '|     | |   |',
        'Epo-o-o o-o o',
        'p       | | |',
        'o o-o-o-o-o-o',
        '  |   | | c |',
        'Mco o-o * o o',
        '  | |     | |',
        '* o-o-o opo o',
        'c | | p | p |',
        'ocopo-o o o-S'
      ],
      rot: [],
      hands: {'every':[7,10],'warn':1.5}
    },
    {
      id: '2-4', light: 2.4, par: 40, hints: ['hint.oneway'],
      map: [
        '* o o-o E-o-o',
        '| | |       |',
        'o-o-o-o-o-o-o',
        '|   |   |   |',
        'o-o-o-o o o-o',
        '| |   | | |  ',
        'o o o-o-o<o *',
        '| |       | |',
        'o o-o-M o o-o',
        '|   |   | | |',
        'o-o o-o-o-o-o',
        '| | | |     |',
        'o-o o-o *-o o',
        '  | |     | |',
        '* o o<o-o o>o',
        '| |   | | | v',
        'o-o S-o-o o-o'
      ],
      rot: [],
      balloons: [{'a':[6,1],'b':[6,5],'speed':1.08,'phase':0.24}],
      hands: {'every':[8,12],'warn':1.5}
    },
    {
      id: '2-5', light: 2.4, par: 45, hints: ['hint.key'],
      map: [
        'o K o-o-o *-o',
        '| | | | |   |',
        'o o o-o-o o-o',
        '| | |   | | |',
        'o-o-o-o-o-o o',
        '| | | |   | |',
        'o-o o o-o o-o',
        '  | | | |   |',
        '*-o o o o-o-R',
        '    | |   | |',
        'M-o-o-o-o o o',
        '  | | | | | |',
        'o-o-o o o o o',
        '|     | | | #',
        'o-o-o-o o * o',
        '| |     |   |',
        'o o-o o o-o o',
        '|     |   | |',
        'o-S *-o-o-o E'
      ],
      rot: [['I',1]],
      hands: {'every':[7,10],'warn':1.45}
    },
    {
      id: '3-1', light: 2.15, par: 35, hints: ['hint.crumble'],
      map: [
        'o-E-o o-o o~o',
        '|   | | | | |',
        'o o o-o o~o o',
        '| | |   | | |',
        'o-o-o o-o * o',
        '  |   | ~   |',
        '*-o-o o-o~o-M',
        '    | |     |',
        'o-o-o o-o-o-o',
        '| |     |    ',
        'o o-o o-o *-o',
        '| | | |     |',
        'o-o-o o o-o o',
        '|   | | | | |',
        '* o-o-o-S-o-o'
      ],
      rot: [],
      balloons: [{'a':[3,0],'b':[3,5],'speed':1.07,'phase':0.12}]
    },
    {
      id: '3-2', light: 2.15, par: 35, hints: ['hint.portal'],
      map: [
        'o-o-* M-o-o-o',
        '|       |   |',
        'o-o-o-o>o o-o',
        '  |     | |  ',
        'o-o *-o-o E *',
        '|     | | | |',
        'o o-o-o o o A',
        '| | | | | ^ |',
        'o-o-o o o o-o',
        '| |   | | | v',
        'o o-o-o o-o-o',
        '| |   |     |',
        'o o-o-o-o o-o',
        '| |     | | |',
        'o o a-o o o o',
        '| |   | | | |',
        'o-S-o-o o-o *'
      ],
      rot: [],
      hands: {'every':[6.5,9.5],'warn':1.4}
    },
    {
      id: '3-3', light: 2.15, par: 45, hints: [],
      map: [
        'o-o-o-o-o M-o-o',
        '|   | | |   | |',
        'o a-o o-o-o o-o',
        '| |   |   | | |',
        'o * o-o-o-o-o o',
        '|   |   |     |',
        'o o-o-o-o o o-o',
        '| |   |   |   |',
        'o-o-o o o-o * E',
        '| |   | | | |  ',
        'o o-o * o o-o-o',
        '|   |   |   ~ ~',
        'o-o o-o o-o-o o',
        '  |   | |   | |',
        'o-o o o-o-o-o-o',
        '|   | | | | |  ',
        'o o~o-S o o o-o',
        '| |   | | | | |',
        '* o-A o-o-o-o *'
      ],
      rot: [],
      balloons: [{'a':[7,4],'b':[2,4],'speed':1.09,'phase':0.32},{'a':[1,6],'b':[7,6],'speed':1.09,'phase':0}]
    },
    {
      id: '3-4', light: 2.15, par: 55, hints: [],
      map: [
        'o-o-o-o-o-o-o-E',
        '| |     p |   p',
        'o o-o o-opo o o',
        '|   v | |   | |',
        'o o o-o o-o o o',
        'p |   |     | |',
        'o-o-oco o-* o-o',
        '|   | | |   p  ',
        '* * o-o o-o>o *',
        '  | | | |     |',
        'K-R o o-o-o-o-o',
        '| | | |       |',
        'oco T-o o-opo-o',
        '  | | | |   |  ',
        'opo o-o-o * o o',
        '| v |     | | |',
        'o-o o-o-o o o-o',
        '| |   # | c c c',
        'o ococo o o o o',
        '|     p | | | |',
        'S-o-o-o M o-o-o'
      ],
      rot: [['L',0]],
      balloons: [{'a':[3,5],'b':[3,1],'speed':1.14,'phase':0.79},{'a':[4,6],'b':[4,2],'speed':1.24,'phase':0.3}],
      hands: {'every':[5.5,8.5],'warn':1.35}
    },
    {
      id: '3-5', light: 2.15, par: 60, hints: ['hint.final'],
      map: [
        'o-o-o-o-o o-a o-R',
        '| |     | | | # |',
        '* o-opo T * o-o o',
        '      | |     | |',
        'o-* oco o o-oco o',
        '|   | | |     p |',
        'o o o o o o-o-o o',
        '| | |   |   | | |',
        'o-o-o-o~o * o o o',
        '  p |   c | | | |',
        'M o-oco o-o-o * E',
        'c p   | c   c    ',
        'o-o-o o o-o o-ocK',
        '| | | p   | |    ',
        'o o-o-o-o-o o-o o',
        '| p         |   |',
        'o-o-o-o-o-o o-o-o',
        '| | | | p |     |',
        'o-o o-o o oco o-o',
        '  | |     |   | |',
        'o-o-o-o opo-o-o o',
        '|     | p | |   |',
        'o-Apo S-o-o~o *-o'
      ],
      rot: [['L',3]],
      balloons: [{'a':[3,1],'b':[6,1],'speed':1.21,'phase':0.72},{'a':[7,6],'b':[2,6],'speed':1.12,'phase':0.52},{'a':[1,3],'b':[6,3],'speed':1.14,'phase':0.01}],
      hands: {'every':[4.5,7],'warn':1.25}
    }
  ];
  DD.CHAPTERS = [
    { n: 1, stages: ['1-1', '1-2', '1-3', '1-4', '1-5'] },
    { n: 2, stages: ['2-1', '2-2', '2-3', '2-4', '2-5'] },
    { n: 3, stages: ['3-1', '3-2', '3-3', '3-4', '3-5'] }
  ];
})();
