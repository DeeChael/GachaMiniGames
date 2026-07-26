// ============================================================
// 邦布维修 —— 分享码编解码（纯前端实现）
// 格式：ZBP1_ + base64url( UTF-8 JSON )
// ============================================================

import type { Cell, Dir, PipeColor, PipeElement, PipeLevel, PipeLine } from './types';
import { MAX_GRID, MIN_GRID, validatePipeLevel } from './types';

const PREFIX = 'ZBP1_';

interface PackedLevel {
  v: 1;
  n: string;
  r: number;
  c: number;
  e: string; // 控件 "x,y,类型,...;..."
  l: string; // 连接线 "x1,y1,x2,y2;..."
}

const c2n = (c: PipeColor) => (c === 'yellow' ? 0 : 1);
const n2c = (n: number): PipeColor => (n === 1 ? 'blue' : 'yellow');
const colorBits = (arr: PipeColor[]) => arr.map(c2n).join('');
const boolBits = (arr: boolean[]) => arr.map((v) => (v ? 1 : 0)).join('');
const unbits = (s: string, n: number): number[] => Array.from({ length: n }, (_, i) => (s[i] === '1' ? 1 : 0));

function packElements(elements: Record<string, PipeElement>): string {
  return Object.entries(elements)
    .map(([k, el]) => {
      const [x, y] = k.split(',');
      switch (el.kind) {
        case 'source':
          return `${x},${y},s,${c2n(el.color)}`;
        case 'receiver':
          return `${x},${y},r,${colorBits(el.blocks)}`;
        case 'bar':
          return `${x},${y},b,${el.locked ? 1 : 0},${colorBits(el.colors)},${el.rot},${el.startRot}`;
        case 'quad':
          return `${x},${y},q,${el.locked ? 1 : 0},${boolBits(el.contacts)},${colorBits(el.blocks)},${el.rot},${el.startRot}`;
        case 'key':
          return `${x},${y},k,${c2n(el.color)},${el.dir}`;
      }
    })
    .join(';');
}

function unpackElements(s: string): Record<string, PipeElement> {
  const out: Record<string, PipeElement> = {};
  if (!s) return out;
  for (const part of s.split(';')) {
    const f = part.split(',');
    const x = Number(f[0]);
    const y = Number(f[1]);
    const k = `${x},${y}`;
    switch (f[2]) {
      case 's':
        out[k] = { kind: 'source', color: n2c(Number(f[3])) };
        break;
      case 'r':
        out[k] = { kind: 'receiver', blocks: unbits(f[3] ?? '', 4).map(n2c) };
        break;
      case 'b': {
        const colors = unbits(f[4] ?? '', 2).map(n2c) as [PipeColor, PipeColor];
        out[k] = { kind: 'bar', locked: f[3] === '1', colors, rot: Number(f[5]) || 0, startRot: Number(f[6]) || 0 };
        break;
      }
      case 'q':
        out[k] = {
          kind: 'quad',
          locked: f[3] === '1',
          contacts: unbits(f[4] ?? '', 4).map(Boolean),
          blocks: unbits(f[5] ?? '', 4).map(n2c),
          rot: Number(f[6]) || 0,
          startRot: Number(f[7]) || 0,
        };
        break;
      case 'k':
        out[k] = { kind: 'key', color: n2c(Number(f[3])), dir: (Number(f[4]) % 4) as Dir };
        break;
    }
  }
  return out;
}

const packLines = (lines: PipeLine[]) => lines.map((l) => `${l.a[0]},${l.a[1]},${l.b[0]},${l.b[1]}`).join(';');

function unpackLines(s: string): PipeLine[] {
  if (!s) return [];
  return s.split(';').map((part) => {
    const [x1, y1, x2, y2] = part.split(',').map(Number);
    return { a: [x1, y1] as Cell, b: [x2, y2] as Cell };
  });
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
export function encodePipeLevel(level: PipeLevel): string {
  const packed: PackedLevel = {
    v: 1,
    n: level.name || '自定义关卡',
    r: level.rows,
    c: level.cols,
    e: packElements(level.elements),
    l: packLines(level.lines),
  };
  return PREFIX + toBase64Url(JSON.stringify(packed));
}

/** 解析分享码；失败时抛出带中文信息的 Error */
export function decodePipeLevel(code: string): PipeLevel {
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

  const level: PipeLevel = {
    name: typeof packed.n === 'string' && packed.n ? packed.n.slice(0, 24) : '分享关卡',
    rows: packed.r,
    cols: packed.c,
    elements: unpackElements(typeof packed.e === 'string' ? packed.e : ''),
    lines: unpackLines(typeof packed.l === 'string' ? packed.l : ''),
  };
  if (level.cols < MIN_GRID || level.cols > MAX_GRID || level.rows < MIN_GRID || level.rows > MAX_GRID) {
    throw new Error('分享码内容无效：棋盘大小超出范围');
  }
  const errors = validatePipeLevel(level);
  if (errors.length > 0) {
    throw new Error(`分享码内容无效：${errors[0]}`);
  }
  return level;
}
