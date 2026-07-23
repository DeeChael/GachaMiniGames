// ============================================================
// 分享码编解码 —— 纯前端实现
// 格式：EPZ2_ + base64url( UTF-8 JSON )
// v2：包含每行 / 每列的按颜色数量要求
// ============================================================

import type { Cell, ColorCount, Level, LevelPiece, PieceColor } from './types';
import { ALL_COLORS, normalizeCells, validateLevel } from './types';

const PREFIX = 'EPZ2_';

const COLOR_CODE: Record<PieceColor, string> = { green: 'g', cyan: 'c', orange: 'o' };
const CODE_COLOR: Record<string, PieceColor> = { g: 'green', c: 'cyan', o: 'orange' };

interface PackedPiece {
  s: string; // "x,y;x,y;..."
  c: PieceColor;
  l?: 1;
  x?: number;
  y?: number;
}

interface PackedLevel {
  v: 2;
  n: string;
  r: number;
  c: number;
  b: string; // blocked cells "x,y;x,y"
  p: PackedPiece[];
  rq: string[]; // 每行颜色需求，如 "g4,c2"
  cq: string[]; // 每列颜色需求
}

const packCells = (cells: Cell[]) => cells.map(([x, y]) => `${x},${y}`).join(';');

function unpackCells(s: string): Cell[] {
  if (!s) return [];
  return s.split(';').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return [x, y] as Cell;
  });
}

const packReq = (cc: ColorCount) =>
  ALL_COLORS.filter((c) => (cc[c] ?? 0) > 0).map((c) => `${COLOR_CODE[c]}${cc[c]}`).join(',');

function unpackReq(s: string): ColorCount {
  const out: ColorCount = {};
  if (!s) return out;
  for (const part of s.split(',')) {
    const color = CODE_COLOR[part[0]];
    const n = Number(part.slice(1));
    if (color && Number.isFinite(n) && n > 0) out[color] = n;
  }
  return out;
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
export function encodeLevel(level: Level): string {
  const packed: PackedLevel = {
    v: 2,
    n: level.name || '自定义关卡',
    r: level.rows,
    c: level.cols,
    b: packCells(level.blocked),
    p: level.pieces.map((p) => {
      const out: PackedPiece = { s: packCells(normalizeCells(p.cells)), c: p.color };
      if (p.locked) {
        out.l = 1;
        out.x = p.x ?? 0;
        out.y = p.y ?? 0;
      }
      return out;
    }),
    rq: level.rowReq.map(packReq),
    cq: level.colReq.map(packReq),
  };
  return PREFIX + toBase64Url(JSON.stringify(packed));
}

/** 解析分享码；失败时抛出带中文信息的 Error */
export function decodeLevel(code: string): Level {
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
  if (packed.v !== 2) throw new Error('分享码版本不受支持');

  const pieces: LevelPiece[] = packed.p.map((p) => {
    const base: LevelPiece = {
      cells: normalizeCells(unpackCells(p.s)),
      color: ALL_COLORS.includes(p.c) ? p.c : 'green',
    };
    if (p.l === 1) {
      base.locked = true;
      base.x = p.x ?? 0;
      base.y = p.y ?? 0;
    }
    return base;
  });

  const level: Level = {
    name: typeof packed.n === 'string' && packed.n ? packed.n.slice(0, 24) : '分享关卡',
    rows: packed.r,
    cols: packed.c,
    blocked: unpackCells(packed.b),
    pieces,
    rowReq: Array.isArray(packed.rq) ? packed.rq.map(unpackReq) : [],
    colReq: Array.isArray(packed.cq) ? packed.cq.map(unpackReq) : [],
  };

  const errors = validateLevel(level);
  if (errors.length > 0) {
    throw new Error(`分享码内容无效：${errors[0]}`);
  }
  return level;
}
