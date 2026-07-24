// ============================================================
// 预言算碑 —— 分享码编解码（纯前端实现）
// 格式：SPZ1_ + base64url( UTF-8 JSON )
// ============================================================

import type { Rot, SrLevel, SrPiece } from './types';
import { SHAPES, isRot, validateSrLevel } from './types';

const PREFIX = 'SPZ1_';

interface PackedLevel {
  v: 1;
  n: string;
  /** 每块拼图：[形状序号, 旋转, tx, ty, x, y] */
  p: [number, number, number, number, number, number][];
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
export function encodeSrLevel(level: SrLevel): string {
  const packed: PackedLevel = {
    v: 1,
    n: level.name || '自定义关卡',
    p: level.pieces.map((p) => [
      Math.max(0, SHAPES.findIndex((s) => s.id === p.shape)),
      p.rot,
      p.tx,
      p.ty,
      p.x,
      p.y,
    ]),
  };
  return PREFIX + toBase64Url(JSON.stringify(packed));
}

/** 解析分享码；失败时抛出带中文信息的 Error */
export function decodeSrLevel(code: string): SrLevel {
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
  if (!Array.isArray(packed.p)) throw new Error('分享码内容无效：缺少拼图数据');

  const pieces: SrPiece[] = packed.p.map((row) => {
    const [si, rot, tx, ty, x, y] = row;
    return {
      shape: SHAPES[si]?.id ?? '',
      rot: (isRot(rot) ? rot : 0) as Rot,
      tx,
      ty,
      x,
      y,
    };
  });
  const level: SrLevel = {
    name: typeof packed.n === 'string' && packed.n ? packed.n.slice(0, 24) : '分享关卡',
    pieces,
  };

  const errors = validateSrLevel(level);
  if (errors.length > 0) {
    throw new Error(`分享码内容无效：${errors[0]}`);
  }
  return level;
}
