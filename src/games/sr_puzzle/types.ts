// ============================================================
// 预言算碑（崩坏：星穹铁道）— 核心类型与几何逻辑
// 16×16 棋盘，拼图之间可以重叠：重叠部分按 XOR（异或）抵消
// 显示为空，第三块压上去又会显示。移动拼图拼出目标图案即通关
// ============================================================

/** 格点坐标：[x, y]，x 向右，y 向下，单位一格 */
export type Pt = [number, number];

/** 形状定义：在 w×h 网格上按顺序连接整数格点形成多边形（首尾自动闭合） */
export interface Shape {
  id: string;
  name: string;
  w: number;
  h: number;
  points: Pt[];
}

// 形状列表来自 references/starrail-puzzle/puzzle.md，固定不可自定义
// 注：文档中「正方形 1」的点 (0,0)(0,4)(4,4)(0,0) 连出来是三角形，
// 与名称矛盾，这里按名称取完整正方形
export const SHAPES: Shape[] = [
  { id: 'tri1', name: '三角形 1', w: 4, h: 2, points: [[2, 0], [0, 2], [4, 2]] },
  { id: 'sq1', name: '正方形 1', w: 4, h: 4, points: [[0, 0], [4, 0], [4, 4], [0, 4]] },
  { id: 'tri2', name: '三角形 2', w: 4, h: 4, points: [[0, 0], [0, 4], [4, 0]] },
  { id: 'dia1', name: '菱形 1', w: 4, h: 4, points: [[2, 0], [0, 2], [2, 4], [4, 2]] },
  { id: 'dia2', name: '菱形 2', w: 6, h: 6, points: [[3, 0], [0, 3], [3, 6], [6, 3]] },
  { id: 'tri3', name: '三角形 3', w: 6, h: 3, points: [[3, 0], [0, 3], [6, 3]] },
  { id: 'trap1', name: '梯形 1', w: 4, h: 6, points: [[2, 0], [0, 2], [0, 6], [4, 2]] },
];

export const shapeById = (id: string): Shape | undefined => SHAPES.find((s) => s.id === id);

/** 棋盘边长（格），固定 16×16 */
export const BOARD = 16;
/** 一关最多拼图片数 */
export const MAX_PIECES = 12;

/** 旋转：90° 的倍数（编辑时可旋转，游玩时不可旋转，关卡保存旋转状态） */
export type Rot = 0 | 1 | 2 | 3;

export const isRot = (r: unknown): r is Rot => r === 0 || r === 1 || r === 2 || r === 3;

/** 旋转后的形状：每转 90°，点 (x,y) → (h−y, x)，宽高互换 */
export function rotatedShape(shape: Shape, rot: Rot): { w: number; h: number; points: Pt[] } {
  let { w, h, points } = shape;
  for (let i = 0; i < rot; i++) {
    points = points.map(([x, y]): Pt => [h - y, x]);
    [w, h] = [h, w];
  }
  return { w, h, points };
}

/** 关卡里的一块拼图：tx,ty 为目标（摆好）位置，x,y 为开局（打散）位置 */
export interface SrPiece {
  shape: string;
  rot: Rot;
  tx: number;
  ty: number;
  x: number;
  y: number;
}

/** 关卡定义：目标图案 = 所有拼图在 (tx,ty) 处的 XOR 合成 */
export interface SrLevel {
  name: string;
  pieces: SrPiece[];
}

/** 棋盘上一个已放置的拼图（游玩 / 编辑中的实时状态） */
export interface PlacedPiece {
  id: string;
  shape: string;
  rot: Rot;
  x: number;
  y: number;
}

/** 拼图多边形（棋盘坐标）；形状未知返回 null */
export function piecePoly(shape: string, rot: Rot, x: number, y: number): Pt[] | null {
  const s = shapeById(shape);
  if (!s) return null;
  return rotatedShape(s, rot).points.map(([px, py]): Pt => [px + x, py + y]);
}

/** 一组拼图的 XOR 合成多边形列表（未知形状跳过） */
export function compositePolys(pieces: { shape: string; rot: Rot; x: number; y: number }[]): Pt[][] {
  const out: Pt[][] = [];
  for (const p of pieces) {
    const poly = piecePoly(p.shape, p.rot, p.x, p.y);
    if (poly) out.push(poly);
  }
  return out;
}

/** 点是否在多边形内（射线法，用于拖拽拾取） */
export function pointInPoly(px: number, py: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------- 图案相等判定（采样 XOR 奇偶） ----------------

const SAMPLES = 64; // 每格 4 个采样点
/** 采样坐标：取小格中心并加固定微小偏移，确定性避开多边形边线 */
const sampleAt = (i: number) => ((i + 0.5) * BOARD) / SAMPLES + 0.0013;

/**
 * 把一组多边形在棋盘上的 XOR 合成采样成 01 串。
 * 对每个采样点统计所有多边形边的射线穿越次数，奇 = 实，偶 = 空，
 * 天然实现「重叠为空、三层重叠又显示」的抵消规则。
 * 同一合成结果无论由哪些多边形叠出，采样式样都一致（边线上零测集除外），
 * 因此可用于「拼出目标图案」的胜利判定。
 */
export function compositeKey(polys: Pt[][]): string {
  const bits: string[] = [];
  for (let sy = 0; sy < SAMPLES; sy++) {
    const py = sampleAt(sy);
    for (let sx = 0; sx < SAMPLES; sx++) {
      const px = sampleAt(sx);
      let parity = 0;
      for (const poly of polys) {
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i];
          const [xj, yj] = poly[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) parity ^= 1;
        }
      }
      bits.push(parity ? '1' : '0');
    }
  }
  return bits.join('');
}

/** 拼图摆放是否超出棋盘，返回 clamp 后的坐标范围供参考 */
export function fitsOnBoard(shape: string, rot: Rot, x: number, y: number): boolean {
  const s = shapeById(shape);
  if (!s) return false;
  const { w, h } = rotatedShape(s, rot);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x + w <= BOARD && y + h <= BOARD;
}

/** 结构校验：形状存在、旋转合法、位置为整数且不出棋盘（编辑器摆放步也用它） */
export function validatePlacements(pieces: { shape: string; rot: Rot; x: number; y: number }[]): string[] {
  const errors: string[] = [];
  if (pieces.length === 0) errors.push('至少摆放一块拼图');
  if (pieces.length > MAX_PIECES) errors.push(`拼图最多 ${MAX_PIECES} 块`);
  pieces.forEach((p, i) => {
    if (!shapeById(p.shape)) errors.push(`第 ${i + 1} 块拼图形状未知`);
    else if (!isRot(p.rot)) errors.push(`第 ${i + 1} 块拼图旋转状态非法`);
    else if (!fitsOnBoard(p.shape, p.rot, p.x, p.y)) errors.push(`第 ${i + 1} 块拼图（${shapeById(p.shape)!.name}）超出棋盘`);
  });
  return [...new Set(errors)];
}

/** 关卡整体验校：结构 + 目标图案非空 + 打散后不与目标相同（否则玩家进入直接通关） */
export function validateSrLevel(level: SrLevel): string[] {
  const errors = validatePlacements(level.pieces.map((p) => ({ shape: p.shape, rot: p.rot, x: p.tx, y: p.ty })));
  errors.push(...validatePlacements(level.pieces.map((p) => ({ shape: p.shape, rot: p.rot, x: p.x, y: p.y }))).filter((e) => !errors.includes(e)));
  if (errors.length > 0) return errors;
  const targetKey = compositeKey(compositePolys(level.pieces.map((p) => ({ ...p, x: p.tx, y: p.ty }))));
  if (!targetKey.includes('1')) errors.push('目标图案为空，至少让拼图覆盖一格');
  const startKey = compositeKey(compositePolys(level.pieces));
  if (startKey === targetKey) errors.push('打散后的图案与目标相同，玩家进入会直接通关');
  return [...new Set(errors)];
}
