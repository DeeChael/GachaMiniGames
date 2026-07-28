// ============================================================
// 邦布维修 2.0 —— 内置关卡
// scripts/verify.ts 会用 DFS 复核可解性
// ============================================================

import type { PathLevel } from './types';

export const BUILTIN_LEVELS: PathLevel[] = [
  {
    name: '初次寻路',
    rows: 4,
    cols: 4,
    start: [0, 0],
    dest: [3, 3],
    denies: [[1, 1], [2, 1], [1, 3]],
    checkpoints: [[1, 2]],
    rotates: [],
    tubes: [],
  },
  {
    name: '旋转走廊',
    rows: 5,
    cols: 5,
    start: [0, 0],
    dest: [4, 4],
    denies: [[0, 2], [2, 1], [3, 1], [0, 3]],
    checkpoints: [[4, 0]],
    rotates: [[2, 2]],
    tubes: [
      // 直管：默认竖直，踩下旋转按钮后变水平
      { pos: [2, 3], kind: 'tube', rot: 1 },
      // L 管：默认上+右，旋转后变左+下
      { pos: [3, 3], kind: 'ltube', rot: 1 },
    ],
  },
  {
    name: '机关重重',
    rows: 5,
    cols: 5,
    start: [0, 4],
    dest: [4, 0],
    denies: [[1, 1], [3, 2], [3, 3]],
    checkpoints: [[0, 0], [4, 4]],
    rotates: [[2, 2]],
    tubes: [
      // L 管：左+下（在旋转按钮之前经过）
      { pos: [2, 0], kind: 'ltube', rot: 2 },
      // 直管：默认水平，踩下旋转按钮后变竖直
      { pos: [4, 2], kind: 'tube', rot: 0 },
    ],
  },
];
