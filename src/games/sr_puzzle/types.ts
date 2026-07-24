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
  /** 是否可以旋转，默认 true；旋转 90° 后完全重合的图形（正方形、菱形）为 false */
  rotatable?: boolean;
}

// 形状列表来自 references/starrail-puzzle/puzzle.md，固定不可自定义
// 注：文档中「正方形 1」的点 (0,0)(0,4)(4,4)(0,0) 连出来是三角形，
// 与名称矛盾，这里按名称取完整正方形
export const SHAPES: Shape[] = [
  { id: 'tri1', name: '三角形 1', w: 4, h: 2, points: [[2, 0], [0, 2], [4, 2]] },
  { id: 'sq1', name: '正方形 1', w: 4, h: 4, points: [[0, 0], [4, 0], [4, 4], [0, 4]], rotatable: false },
  { id: 'tri2', name: '三角形 2', w: 4, h: 4, points: [[0, 0], [0, 4], [4, 0]] },
  { id: 'dia1', name: '菱形 1', w: 4, h: 4, points: [[2, 0], [0, 2], [2, 4], [4, 2]], rotatable: false },
  { id: 'dia2', name: '菱形 2', w: 6, h: 6, points: [[3, 0], [0, 3], [3, 6], [6, 3]], rotatable: false },
  { id: 'tri3', name: '三角形 3', w: 6, h: 3, points: [[3, 0], [0, 3], [6, 3]] },
  { id: 'trap1', name: '梯形 1', w: 4, h: 6, points: [[2, 0], [0, 2], [0, 6], [4, 2]] },
  { id: 'sq2', name: '正方形 2', w: 6, h: 6, points: [[0, 0], [6, 0], [6, 6], [0, 6]], rotatable: false },
];

export const shapeById = (id: string): Shape | undefined => SHAPES.find((s) => s.id === id);

/** 形状是否可旋转（默认可旋转） */
export const isRotatable = (id: string): boolean => shapeById(id)?.rotatable !== false;

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

/** 拼图摆放是否超出棋盘：位置为整数且整个包围盒在 16×16 内 */
export function fitsOnBoard(shape: string, rot: Rot, x: number, y: number): boolean {
  const s = shapeById(shape);
  if (!s) return false;
  const { w, h } = rotatedShape(s, rot);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x + w <= BOARD && y + h <= BOARD;
}

/** 四角禁区：圆形裁切后四角的 2×2 方格看不见，拼图不得与之相交（边界相接不算） */
const CORNER_SIZE = 2;
const CORNER_RECTS: [number, number][] = [
  [0, 0],
  [BOARD - CORNER_SIZE, 0],
  [0, BOARD - CORNER_SIZE],
  [BOARD - CORNER_SIZE, BOARD - CORNER_SIZE],
];

/** 凸多边形与轴对齐矩形是否相交（SAT 分离轴；仅边界相接返回 false） */
function polyIntersectsRect(poly: Pt[], rx: number, ry: number, rw: number): boolean {
  const rect: Pt[] = [[rx, ry], [rx + rw, ry], [rx + rw, ry + rw], [rx, ry + rw]];
  const axes: Pt[] = [[1, 0], [0, 1]];
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    axes.push([y2 - y1, -(x2 - x1)]); // 边的法线
  }
  for (const [ax, ay] of axes) {
    let pMin = Infinity, pMax = -Infinity, rMin = Infinity, rMax = -Infinity;
    for (const [x, y] of poly) {
      const v = x * ax + y * ay;
      if (v < pMin) pMin = v;
      if (v > pMax) pMax = v;
    }
    for (const [x, y] of rect) {
      const v = x * ax + y * ay;
      if (v < rMin) rMin = v;
      if (v > rMax) rMax = v;
    }
    if (pMax <= rMin + 1e-9 || rMax <= pMin + 1e-9) return false; // 存在分离轴（仅相接也算分离）
  }
  return true;
}

/** 拼图是否与四角 2×2 禁区相交（所有形状都是凸多边形，可用 SAT） */
export function pieceHitsCorner(shape: string, rot: Rot, x: number, y: number): boolean {
  const poly = piecePoly(shape, rot, x, y);
  if (!poly) return true;
  return CORNER_RECTS.some(([rx, ry]) => polyIntersectsRect(poly, rx, ry, CORNER_SIZE));
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

/** 四角禁区校验：拼图不得与四角 2×2 方格相交，否则会被圆形裁切看不见 */
export function validateCorners(pieces: { shape: string; rot: Rot; x: number; y: number }[]): string[] {
  const errors: string[] = [];
  pieces.forEach((p, i) => {
    if (shapeById(p.shape) && isRot(p.rot) && fitsOnBoard(p.shape, p.rot, p.x, p.y) && pieceHitsCorner(p.shape, p.rot, p.x, p.y)) {
      errors.push(`第 ${i + 1} 块拼图（${shapeById(p.shape)!.name}）与四角 2×2 区域相交`);
    }
  });
  return errors;
}

/** 关卡整体验校：结构 + 四角禁区 + 目标图案非空 + 打散后不与目标相同（否则玩家进入直接通关） */
export function validateSrLevel(level: SrLevel): string[] {
  const errors = validatePlacements(level.pieces.map((p) => ({ shape: p.shape, rot: p.rot, x: p.tx, y: p.ty })));
  errors.push(...validatePlacements(level.pieces.map((p) => ({ shape: p.shape, rot: p.rot, x: p.x, y: p.y }))).filter((e) => !errors.includes(e)));
  if (errors.length > 0) return errors;
  // 目标位置不得碰四角禁区，否则关卡无解；开局位置同理（否则看不见拼图）
  for (const p of level.pieces) {
    if (pieceHitsCorner(p.shape, p.rot, p.tx, p.ty)) errors.push(`拼图（${shapeById(p.shape)!.name}）的目标位置与四角 2×2 区域相交`);
    if (pieceHitsCorner(p.shape, p.rot, p.x, p.y)) errors.push(`拼图（${shapeById(p.shape)!.name}）的开局位置与四角 2×2 区域相交`);
  }
  if (errors.length > 0) return [...new Set(errors)];
  const targetKey = compositeKey(compositePolys(level.pieces.map((p) => ({ ...p, x: p.tx, y: p.ty }))));
  if (!targetKey.includes('1')) errors.push('目标图案为空，至少让拼图覆盖一格');
  const startKey = compositeKey(compositePolys(level.pieces));
  if (startKey === targetKey) errors.push('打散后的图案与目标相同，玩家进入会直接通关');
  return [...new Set(errors)];
}
