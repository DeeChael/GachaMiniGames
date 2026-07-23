// ============================================================
// 浮空回收 —— 分享码编解码（纯前端实现）
// 格式：EBL1_ + base64url( UTF-8 JSON )
// ============================================================

import type { BalloonLevel, BalloonValue, Cell } from './types';
import { BALLOON_VALUES, GRID, cellKey } from './types';

const PREFIX = 'EBL1_';

interface PackedLevel {
  v: 1;
  n: string;
  p: string; // 可放置格 "x,y;x,y;..."
  b: BalloonValue[]; // 气球升力值列表
}

const packCells = (cells: Cell[]) => cells.map(([x, y]) => `${x},${y}`).join(';');

function unpackCells(s: string): Cell[] {
  if (!s) return [];
  return s.split(';').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return [x, y] as Cell;
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
export function encodeBalloonLevel(level: BalloonLevel): string {
  const packed: PackedLevel = {
    v: 1,
    n: level.name || '自定义关卡',
    p: packCells(level.placeable),
    b: level.balloons,
  };
  return PREFIX + toBase64Url(JSON.stringify(packed));
}

/** 解析分享码；失败时抛出带中文信息的 Error */
export function decodeBalloonLevel(code: string): BalloonLevel {
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

  const placeable = unpackCells(typeof packed.p === 'string' ? packed.p : '');
  const seen = new Set<string>();
  for (const [x, y] of placeable) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= GRID || y >= GRID) {
      throw new Error('分享码内容无效：可放置格越界');
    }
    const k = cellKey(x, y);
    if (seen.has(k)) throw new Error('分享码内容无效：可放置格重复');
    seen.add(k);
  }
  const balloons = (Array.isArray(packed.b) ? packed.b : []).filter((b): b is BalloonValue =>
    BALLOON_VALUES.includes(b),
  );
  if (balloons.length === 0) throw new Error('分享码内容无效：至少需要一个气球');
  if (placeable.length < balloons.length) {
    throw new Error('分享码内容无效：可放置格数量小于气球数量');
  }

  return {
    name: typeof packed.n === 'string' && packed.n ? packed.n.slice(0, 24) : '分享关卡',
    placeable,
    balloons,
  };
}
