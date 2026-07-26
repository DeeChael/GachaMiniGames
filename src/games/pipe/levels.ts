// ============================================================
// 邦布维修 —— 内置关卡
// 校验：scripts/verify.ts 会检查合法性与解的通路
// ============================================================

import type { PipeLevel } from './types';

export const BUILTIN_LEVELS: PipeLevel[] = [
  {
    name: '初次维修',
    rows: 3,
    cols: 3,
    elements: {
      '0,1': { kind: 'source', color: 'yellow' },
      '1,1': { kind: 'bar', locked: false, colors: ['yellow', 'yellow'], rot: 0, startRot: 1 },
      '2,1': { kind: 'receiver', blocks: ['yellow', 'yellow', 'yellow', 'yellow'] },
    },
    lines: [
      { a: [0, 1], b: [1, 1] },
      { a: [1, 1], b: [2, 1] },
    ],
  },
  {
    name: '双色回路',
    rows: 3,
    cols: 4,
    elements: {
      '0,0': { kind: 'source', color: 'yellow' },
      '2,0': {
        kind: 'quad',
        locked: false,
        contacts: [false, false, true, true], // 局部：下、左
        blocks: ['yellow', 'yellow', 'yellow', 'yellow'],
        rot: 0,
        startRot: 1,
      },
      '2,1': { kind: 'receiver', blocks: ['yellow', 'yellow', 'yellow', 'yellow'] },
      '0,2': { kind: 'source', color: 'blue' },
      '1,2': { kind: 'bar', locked: false, colors: ['yellow', 'blue'], rot: 0, startRot: 1 },
      '3,2': { kind: 'receiver', blocks: ['yellow', 'yellow', 'yellow', 'yellow'] },
    },
    lines: [
      { a: [0, 0], b: [2, 0] },
      { a: [2, 0], b: [2, 1] },
      { a: [0, 2], b: [1, 2] },
      { a: [1, 2], b: [3, 2] },
    ],
  },
  {
    name: '锁与钥匙',
    rows: 3,
    cols: 3,
    elements: {
      '0,1': { kind: 'source', color: 'yellow' },
      '0,2': { kind: 'key', color: 'yellow', dir: 0 },
      '1,1': { kind: 'bar', locked: false, colors: ['yellow', 'yellow'], rot: 0, startRot: 1 },
      '2,1': {
        kind: 'quad',
        locked: true,
        contacts: [false, false, true, true], // 局部：下、左
        blocks: ['yellow', 'yellow', 'yellow', 'yellow'],
        rot: 0,
        startRot: 1,
      },
      '2,2': { kind: 'receiver', blocks: ['yellow', 'yellow', 'yellow', 'yellow'] },
    },
    lines: [
      { a: [0, 1], b: [0, 2] },
      { a: [0, 1], b: [1, 1] },
      { a: [1, 1], b: [2, 1] },
      { a: [2, 1], b: [2, 2] },
    ],
  },
];
