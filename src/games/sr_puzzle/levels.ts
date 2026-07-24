// ============================================================
// 预言算碑 —— 内置关卡
// 目标图案 = 拼图在 (tx,ty) 处的 XOR 合成；(x,y) 为打散后的开局位置
// ============================================================

import type { SrLevel } from './types';

export const BUILTIN_LEVELS: SrLevel[] = [
  {
    name: '初露',
    pieces: [
      { shape: 'tri1', rot: 0, tx: 6, ty: 5, x: 1, y: 2 },
      { shape: 'sq1', rot: 0, tx: 6, ty: 8, x: 11, y: 11 },
    ],
  },
  {
    name: '浮沉',
    pieces: [
      { shape: 'dia1', rot: 0, tx: 5, ty: 6, x: 1, y: 11 },
      { shape: 'dia1', rot: 0, tx: 7, ty: 6, x: 11, y: 1 },
    ],
  },
  {
    name: '权衡',
    pieces: [
      { shape: 'sq1', rot: 0, tx: 6, ty: 6, x: 1, y: 1 },
      { shape: 'tri2', rot: 0, tx: 6, ty: 6, x: 11, y: 11 },
      { shape: 'dia1', rot: 0, tx: 6, ty: 6, x: 1, y: 11 },
    ],
  },
  {
    name: '隐路现形',
    pieces: [
      { shape: 'dia2', rot: 0, tx: 5, ty: 4, x: 9, y: 9 },
      { shape: 'tri1', rot: 0, tx: 6, ty: 2, x: 1, y: 13 },
      { shape: 'tri2', rot: 1, tx: 3, ty: 8, x: 11, y: 1 },
      { shape: 'sq1', rot: 0, tx: 8, ty: 8, x: 1, y: 9 },
    ],
  },
  {
    name: '建构激发',
    pieces: [
      { shape: 'trap1', rot: 0, tx: 6, ty: 5, x: 1, y: 1 },
      { shape: 'dia1', rot: 0, tx: 3, ty: 6, x: 11, y: 9 },
      { shape: 'dia1', rot: 0, tx: 9, ty: 6, x: 11, y: 1 },
      { shape: 'tri3', rot: 0, tx: 5, ty: 3, x: 5, y: 12 },
      { shape: 'sq1', rot: 0, tx: 6, ty: 8, x: 1, y: 9 },
    ],
  },
];
