// ============================================================
// 黄金替罪羊 —— 分享码编解码（纯前端实现）
// 格式：SPJ2_ + base64url( UTF-8 JSON )
// v2：可开关平台为逐格独立默认状态；出生点/祭坛/按钮需落地校验
// ============================================================

import type { Cell, PlatLevel, ToggleColor } from './types';
import { MAX_COLS, MAX_ROWS, MIN_COLS, MIN_ROWS, validatePlatLevel } from './types';

const PREFIX = 'SPJ2_';

interface PackedLevel {
  v: 2;
  n: string;
  c: number; // cols
  r: number; // rows
  s: number; // steps
  sp: string; // 出生点 "x,y"
  al: string; // 祭坛 "x,y"
  p: string; // 平台 "x,y;x,y;..."
  ty: string; // 黄色可开关平台 "x,y,o;..."（o: 1=默认开 0=默认关）
  tb: string; // 蓝色可开关平台
  by: string; // 黄色按钮
  bb: string; // 蓝色按钮
  l: string; // 梯子
  pt: string; // 传送门 "x,y;x,y"（恰好两个，空 = 无）
  po: number; // 传送门默认状态：1 = 开
  ob: string; // 橙色按钮 "x,y"（空 = 无）
}

const packCells = (cells: Cell[]) => cells.map(([x, y]) => `${x},${y}`).join(';');

function unpackCells(s: string): Cell[] {
  if (!s) return [];
  return s.split(';').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return [x, y] as Cell;
  });
}

const packToggles = (defs: { pos: Cell; on: boolean }[]) =>
  defs.map((t) => `${t.pos[0]},${t.pos[1]},${t.on ? 1 : 0}`).join(';');

function unpackToggles(s: string, color: ToggleColor): { pos: Cell; color: ToggleColor; on: boolean }[] {
  if (!s) return [];
  return s.split(';').map((part) => {
    const [x, y, o] = part.split(',').map(Number);
    return { pos: [x, y] as Cell, color, on: o === 1 };
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
export function encodePlatLevel(level: PlatLevel): string {
  const packed: PackedLevel = {
    v: 2,
    n: level.name || '自定义关卡',
    c: level.cols,
    r: level.rows,
    s: level.steps,
    sp: packOne(level.spawn),
    al: packOne(level.altar),
    p: packCells(level.platforms),
    ty: packToggles(level.toggles.filter((t) => t.color === 'yellow')),
    tb: packToggles(level.toggles.filter((t) => t.color === 'blue')),
    by: packCells(level.buttons.filter((b) => b.color === 'yellow').map((b) => b.pos)),
    bb: packCells(level.buttons.filter((b) => b.color === 'blue').map((b) => b.pos)),
    l: packCells(level.ladders),
    pt: level.portals ? packCells(level.portals.pos) : '',
    po: level.portals?.open ? 1 : 0,
    ob: level.orangeButton ? packOne(level.orangeButton) : '',
  };
  return PREFIX + toBase64Url(JSON.stringify(packed));
}

/** 解析分享码；失败时抛出带中文信息的 Error */
export function decodePlatLevel(code: string): PlatLevel {
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

  const one = (s: string): Cell => {
    const [x, y] = String(s).split(',').map(Number);
    return [x, y] as Cell;
  };
  const level: PlatLevel = {
    name: typeof packed.n === 'string' && packed.n ? packed.n.slice(0, 24) : '分享关卡',
    cols: packed.c,
    rows: packed.r,
    steps: packed.s,
    spawn: one(packed.sp),
    altar: one(packed.al),
    platforms: unpackCells(typeof packed.p === 'string' ? packed.p : ''),
    toggles: [
      ...unpackToggles(typeof packed.ty === 'string' ? packed.ty : '', 'yellow'),
      ...unpackToggles(typeof packed.tb === 'string' ? packed.tb : '', 'blue'),
    ],
    buttons: [
      ...unpackCells(typeof packed.by === 'string' ? packed.by : '').map((pos) => ({ pos, color: 'yellow' as ToggleColor })),
      ...unpackCells(typeof packed.bb === 'string' ? packed.bb : '').map((pos) => ({ pos, color: 'blue' as ToggleColor })),
    ],
    ladders: unpackCells(typeof packed.l === 'string' ? packed.l : ''),
    portals:
      typeof packed.pt === 'string' && packed.pt
        ? { pos: unpackCells(packed.pt), open: packed.po === 1 }
        : null,
    orangeButton: typeof packed.ob === 'string' && packed.ob ? one(packed.ob) : null,
  };
  if (level.cols < MIN_COLS || level.cols > MAX_COLS || level.rows < MIN_ROWS || level.rows > MAX_ROWS) {
    throw new Error('分享码内容无效：场景尺寸超出范围');
  }
  const errors = validatePlatLevel(level);
  if (errors.length > 0) {
    throw new Error(`分享码内容无效：${errors[0]}`);
  }
  return level;
}
