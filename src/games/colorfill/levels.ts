// ============================================================
// 溢彩画 —— 内置关卡（转录自游戏内关卡）
// B=蓝 R=红 Y=黄 G=绿 #=不可填色
// ============================================================

import type { CellKind, FillColor, FillLevel } from './types';

const CHAR_KIND: Record<string, CellKind> = {
  B: 'blue',
  R: 'red',
  Y: 'yellow',
  G: 'green',
  '#': 'blocked',
};

function makeLevel(name: string, target: FillColor, steps: number, rows: string[]): FillLevel {
  return {
    name,
    target,
    steps,
    rows: rows.length,
    cols: rows[0].length,
    cells: rows.map((row) => [...row].map((ch) => CHAR_KIND[ch] ?? null)),
  };
}

export const BUILTIN_LEVELS: FillLevel[] = [
  makeLevel('贝奥海沟西边', 'blue', 7, [
    'BBRRBBRYYG',
    'BYYGGGBGRG',
    'RRBGRYGGRR',
    'RBBYRYRBBR',
    'RYGBBYRBYG',
    'YGGRRGGBGR',
    'BRYYGBRYYG',
    'BGGYBBRYGG',
  ]),
  makeLevel('贝奥海沟东南边', 'yellow', 5, [
    'RRRR#RBRRR',
    'RBBB#BBBBB',
    'RBRRYYYYBR',
    'RBRY##YY##',
    '##YY##YRBB',
    'BBYYYYRRBR',
    'BBBBB#BBRR',
    'BBBBB#BRRR',
  ]),
  makeLevel('地上旧址南边', 'red', 3, [
    'RRYGGGGGGR',
    'R#Y######R',
    'R#YBBBBY#R',
    'R#YBYYBY#R',
    'R#YBYYBY#R',
    'R#YBBBBY#R',
    'R######Y#R',
    'RGGGGGGYRR',
  ]),
];
