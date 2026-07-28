// ============================================================
// 邦布维修 2.0 —— 分享码编解码（纯前端实现）
// 格式：ZPF1_ + base64url( UTF-8 JSON )
// ============================================================

import type { Cell, PathLevel, TubeDef } from './types';
import { MAX_GRID, MIN_GRID, validatePathLevel } from './types';

const PREFIX = 'ZPF1_';

interface PackedLevel {
  v: 1;
  n: string;
  r: number;
  c: number;
  sp: string; // 起点 "x,y"
  ds: string; // 终点 "x,y"
  d: string; // 禁止方块 "x,y;..."
  k: string; // 检查点
  ro: string; // 旋转按钮
  t: string; // 管道 "x,y,kind,rot;..."（kind: 0=直管 1=L 管）
}

const packCells = (cells: Cell[]) => cells.map(([x, y]) => `${x},${y}`).join(';');

function unpackCells(s: string): Cell[] {
  if (!s) return [];
  return s.split(';').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return [x, y] as Cell;
  });
}

const packOne = (c: Cell) => `${c[0]},${c[1]}`;

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
export function encodePathLevel(level: PathLevel): string {
  const packed: PackedLevel = {
    v: 1,
    n: level.name || '自定义关卡',
    r: level.rows,
    c: level.cols,
    sp: packOne(level.start),
    ds: packOne(level.dest),
    d: packCells(level.denies),
    k: packCells(level.checkpoints),
    ro: packCells(level.rotates),
    t: level.tubes.map((t) => `${t.pos[0]},${t.pos[1]},${t.kind === 'ltube' ? 1 : 0},${t.rot}`).join(';'),
  };
  return PREFIX + toBase64Url(JSON.stringify(packed));
}

/** 解析分享码；失败时抛出带中文信息的 Error */
export function decodePathLevel(code: string): PathLevel {
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

  const one = (s: string): Cell => {
    const [x, y] = String(s).split(',').map(Number);
    return [x, y] as Cell;
  };
  const tubes: TubeDef[] = (typeof packed.t === 'string' && packed.t ? packed.t.split(';') : []).map((part) => {
    const [x, y, kind, rot] = part.split(',').map(Number);
    return { pos: [x, y] as Cell, kind: kind === 1 ? 'ltube' : 'tube', rot: rot % 4 };
  });
  const level: PathLevel = {
    name: typeof packed.n === 'string' && packed.n ? packed.n.slice(0, 24) : '分享关卡',
    rows: packed.r,
    cols: packed.c,
    start: one(packed.sp),
    dest: one(packed.ds),
    denies: unpackCells(typeof packed.d === 'string' ? packed.d : ''),
    checkpoints: unpackCells(typeof packed.k === 'string' ? packed.k : ''),
    rotates: unpackCells(typeof packed.ro === 'string' ? packed.ro : ''),
    tubes,
  };
  if (level.cols < MIN_GRID || level.cols > MAX_GRID || level.rows < MIN_GRID || level.rows > MAX_GRID) {
    throw new Error('分享码内容无效：棋盘大小超出范围');
  }
  const errors = validatePathLevel(level);
  if (errors.length > 0) {
    throw new Error(`分享码内容无效：${errors[0]}`);
  }
  return level;
}
