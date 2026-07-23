// ============================================================
// 溢彩画 —— 分享码编解码（纯前端实现）
// 格式：WCF1_ + base64url( UTF-8 JSON )
// ============================================================

import type { CellKind, FillColor, FillLevel } from './types';
import { ALL_COLORS, isFillColor, validateFillLevel } from './types';

const PREFIX = 'WCF1_';

const COLOR_CODE: Record<FillColor, string> = { blue: 'b', red: 'r', yellow: 'y', green: 'g' };
const CODE_COLOR: Record<string, FillColor> = { b: 'blue', r: 'red', y: 'yellow', g: 'green' };

interface PackedLevel {
  v: 1;
  n: string;
  r: number;
  c: number;
  t: FillColor;
  s: number;
  g: string; // 逐行拼接的格子：b/r/y/g 颜色，# 不可填色
}

const packCells = (cells: CellKind[][]): string =>
  cells.map((row) => row.map((k) => (k === 'blocked' ? '#' : isFillColor(k) ? COLOR_CODE[k] : '.')).join('')).join('');

function unpackCells(g: string, rows: number, cols: number): CellKind[][] {
  const cells: CellKind[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: CellKind[] = [];
    for (let x = 0; x < cols; x++) {
      const ch = g[y * cols + x];
      row.push(ch === '#' ? 'blocked' : CODE_COLOR[ch] ?? null);
    }
    cells.push(row);
  }
  return cells;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 把关卡编码为分享码 */
export function encodeFillLevel(level: FillLevel): string {
  const packed: PackedLevel = {
    v: 1,
    n: level.name || '自定义关卡',
    r: level.rows,
    c: level.cols,
    t: level.target,
    s: level.steps,
    g: packCells(level.cells),
  };
  return PREFIX + toBase64Url(JSON.stringify(packed));
}

/** 解析分享码；失败时抛出带中文信息的 Error */
export function decodeFillLevel(code: string): FillLevel {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) {
    throw new Error(`分享码应以 ${PREFIX} 开头`);
  }
  let packed: PackedLevel;
  try {
    packed = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length)));
  } catch {
    throw new Error('分享码无法解析，请检查是否完整复制');
  }
  if (packed.v !== 1) throw new Error('分享码版本不受支持');

  const level: FillLevel = {
    name: typeof packed.n === 'string' && packed.n ? packed.n.slice(0, 24) : '分享关卡',
    rows: packed.r,
    cols: packed.c,
    target: ALL_COLORS.includes(packed.t) ? packed.t : 'blue',
    steps: packed.s,
    cells: unpackCells(typeof packed.g === 'string' ? packed.g : '', packed.r, packed.c),
  };

  const errors = validateFillLevel(level);
  if (errors.length > 0) {
    throw new Error(`分享码内容无效：${errors[0]}`);
  }
  return level;
}
