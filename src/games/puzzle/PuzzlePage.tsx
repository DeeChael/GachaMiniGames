// ============================================================
// 拼图游戏页面 —— 明日方舟：终末地「源石电路模块」复刻
// 颜色是解谜条件：每行 / 每列有按颜色的数量要求
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { Cell, ColorCount, Level, PieceColor } from './types';
import {
  ALL_COLORS,
  PIECE_COLORS,
  cellKey,
  centroidCell,
  normalizeCells,
  rotateCells,
  shapeBounds,
} from './types';
import { BUILTIN_LEVELS } from './levels';
import { decodeLevel, encodeLevel } from './shareCode';
import { generateRandomLevel, type RandomDifficulty } from './random';

// ---------------- 通用：形状 SVG 预览 ----------------

export function ShapeSvg({
  cells,
  color,
  cell = 14,
  opacity = 1,
  locked = false,
}: {
  cells: Cell[];
  color: PieceColor;
  cell?: number;
  opacity?: number;
  locked?: boolean;
}) {
  const { w, h } = shapeBounds(cells);
  const set = new Set(cells.map(([x, y]) => cellKey(x, y)));
  const c = PIECE_COLORS[color];
  return (
    <svg
      width={w * cell}
      height={h * cell}
      viewBox={`0 0 ${w * cell} ${h * cell}`}
      style={{ display: 'block', opacity, filter: locked ? 'saturate(0.55) brightness(0.85)' : undefined }}
    >
      {cells.map(([x, y]) => {
        const borders: string[] = [];
        const px = x * cell;
        const py = y * cell;
        if (!set.has(cellKey(x, y - 1))) borders.push(`M${px},${py} H${px + cell}`);
        if (!set.has(cellKey(x, y + 1))) borders.push(`M${px},${py + cell} H${px + cell}`);
        if (!set.has(cellKey(x - 1, y))) borders.push(`M${px},${py} V${py + cell}`);
        if (!set.has(cellKey(x + 1, y))) borders.push(`M${px + cell},${py} V${py + cell}`);
        return (
          <g key={`${x}-${y}`}>
            <rect x={px + 0.5} y={py + 0.5} width={cell - 1} height={cell - 1} fill={c.main} fillOpacity={locked ? 0.45 : 0.85} />
            <path d={borders.join(' ')} stroke={c.main} strokeWidth={1.6} fill="none" />
          </g>
        );
      })}
    </svg>
  );
}

// ---------------- 游戏状态 ----------------

interface GamePiece {
  id: string;
  baseCells: Cell[];
  color: PieceColor;
  locked: boolean;
}

interface Placement {
  x: number;
  y: number;
  rotation: number;
}

interface DragState {
  pieceId: string;
  rotation: number;
  grab: Cell;
  prev: Placement | null; // 拖拽前的位置（null = 来自托盘）
  pointer: { x: number; y: number };
  hover: { x: number; y: number } | null;
  valid: boolean;
  inside: boolean; // 指针是否在棋盘区域内（松手时不在则放回库存）
}

function buildPieces(level: Level): { pieces: GamePiece[]; placements: Record<string, Placement | null> } {
  const pieces: GamePiece[] = [];
  const placements: Record<string, Placement | null> = {};
  level.pieces.forEach((p, i) => {
    const id = `p${i}`;
    pieces.push({ id, baseCells: normalizeCells(p.cells), color: p.color, locked: !!p.locked });
    placements[id] = p.locked ? { x: p.x ?? 0, y: p.y ?? 0, rotation: 0 } : null;
  });
  return { pieces, placements };
}

// ---------------- 彩色指示条 ----------------
// 列提示（顶部）：多种颜色并排分组，整体向下对齐（贴近棋盘）
// 行提示（左侧）：多种颜色上下分组，整体向右对齐（贴近棋盘）
// 超出需求的数量显示为红色警示条

function ColorBars({
  req,
  filled,
  vertical,
  barLen,
  maxGroupWidth,
}: {
  req: ColorCount;
  filled: ColorCount;
  vertical: boolean; // true = 列提示（水平条竖向堆叠），false = 行提示（竖直条横向排列）
  barLen: number;
  maxGroupWidth: number; // 每组可用的最大宽度（列提示时受格子宽度约束）
}) {
  // 需求为 0 但被放置了该颜色时，也要显示对应的（纯红色超标）指示组
  const groups = ALL_COLORS.filter((c) => (req[c] ?? 0) > 0 || (filled[c] ?? 0) > 0);
  const complete = groups.every((c) => (filled[c] ?? 0) === (req[c] ?? 0)) && groups.length > 0;
  const groupGap = 6;
  const groupW = groups.length > 0 ? Math.max(5, Math.min(barLen, (maxGroupWidth - groupGap * (groups.length - 1)) / groups.length)) : barLen;
  return (
    <div
      className={`flex ${vertical ? 'flex-row items-end justify-center' : 'flex-col items-end justify-center'}`}
      style={{ gap: groupGap }}
    >
      {groups.map((c) => {
        const need = req[c] ?? 0;
        const have = filled[c] ?? 0;
        const overflow = Math.max(0, have - need);
        const col = PIECE_COLORS[c];
        return (
          <div key={c} className={`flex ${vertical ? 'flex-col-reverse' : 'flex-row'}`} style={{ gap: 3 }}>
            {Array.from({ length: need }, (_, i) => {
              const lit = i < Math.min(have, need);
              return (
                <div
                  key={i}
                  style={{
                    width: vertical ? groupW : 5,
                    height: vertical ? 5 : groupW,
                    background: lit ? col.main : col.dim,
                    boxShadow: lit && complete ? `0 0 6px ${col.main}` : undefined,
                  }}
                />
              );
            })}
            {Array.from({ length: overflow }, (_, i) => (
              <div
                key={`o${i}`}
                style={{
                  width: vertical ? groupW : 5,
                  height: vertical ? 5 : groupW,
                  background: '#e04b3a',
                  boxShadow: '0 0 6px rgba(224,75,58,0.9)',
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- 游戏主组件 ----------------

export function PuzzleGame({ level, onExit, onRestart }: { level: Level; onExit: () => void; onRestart: () => void }) {
  const { rows, cols } = level;
  const { pieces, placements: initialPlacements } = useMemo(() => buildPieces(level), [level]);
  const [placements, setPlacements] = useState<Record<string, Placement | null>>(initialPlacements);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  useEffect(() => { dragRef.current = drag; }, [drag]);
  const [won, setWon] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const cellSize = Math.max(30, Math.min(58, Math.floor(680 / Math.max(cols, rows))));
  const barLen = Math.min(22, Math.max(12, cellSize * 0.42));
  const blockedSet = useMemo(() => new Set(level.blocked.map(([x, y]) => cellKey(x, y))), [level]);

  // 当前占据情况：key -> 颜色（正在拖拽的拼图不占格）
  const occupancy = useMemo(() => {
    const map = new Map<string, PieceColor>();
    for (const p of pieces) {
      const pl = placements[p.id];
      if (!pl) continue;
      if (drag?.pieceId === p.id) continue;
      for (const [cx, cy] of rotateCells(p.baseCells, pl.rotation)) {
        map.set(cellKey(pl.x + cx, pl.y + cy), p.color);
      }
    }
    return map;
  }, [pieces, placements, drag]);

  // 每行 / 每列已填的按颜色数量
  const { rowFilled, colFilled } = useMemo(() => {
    const rowFilled: ColorCount[] = Array.from({ length: rows }, () => ({}));
    const colFilled: ColorCount[] = Array.from({ length: cols }, () => ({}));
    for (const [k, color] of occupancy) {
      const [x, y] = k.split(',').map(Number);
      rowFilled[y][color] = (rowFilled[y][color] ?? 0) + 1;
      colFilled[x][color] = (colFilled[x][color] ?? 0) + 1;
    }
    return { rowFilled, colFilled };
  }, [occupancy, rows, cols]);

  const pieceCells = useCallback(
    (p: GamePiece, rotation: number) => rotateCells(p.baseCells, rotation),
    [],
  );

  const checkValid = useCallback(
    (p: GamePiece, x: number, y: number, rotation: number) => {
      for (const [cx, cy] of pieceCells(p, rotation)) {
        const gx = x + cx;
        const gy = y + cy;
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false;
        const k = cellKey(gx, gy);
        if (blockedSet.has(k)) return false;
        if (occupancy.has(k)) return false;
      }
      return true;
    },
    [pieceCells, cols, rows, blockedSet, occupancy],
  );

  // 胜利判定：所有行列的颜色数量要求完全匹配（关卡允许留空格，不要求全填满）
  useEffect(() => {
    if (drag) return;
    const match = (req: ColorCount[], filled: ColorCount[]) =>
      req.every((r, i) => ALL_COLORS.every((c) => (r[c] ?? 0) === (filled[i][c] ?? 0)));
    const hasAnyReq = level.rowReq.some((r) => ALL_COLORS.some((c) => (r[c] ?? 0) > 0));
    if (hasAnyReq && match(level.rowReq, rowFilled) && match(level.colReq, colFilled)) {
      const t = setTimeout(() => setWon(true), 250);
      return () => clearTimeout(t);
    }
  }, [occupancy, drag, level, rowFilled, colFilled]);

  // ---------------- 拖拽逻辑 ----------------
  // 吸附：以「抓手格中心」为锚点，round 到最近格，幽灵与吸附位置 1:1 对齐

  const updateHover = useCallback(
    (clientX: number, clientY: number, d: DragState): DragState => {
      const board = boardRef.current;
      if (!board) return { ...d, pointer: { x: clientX, y: clientY }, hover: null, valid: false, inside: false };
      const rect = board.getBoundingClientRect();
      const p = pieces.find((pp) => pp.id === d.pieceId)!;
      const cells = pieceCells(p, d.rotation);
      const grabCell = cells.some(([cx, cy]) => cx === d.grab[0] && cy === d.grab[1]) ? d.grab : cells[0];
      const fx = (clientX - rect.left) / cellSize;
      const fy = (clientY - rect.top) / cellSize;
      const bx = Math.round(fx - (grabCell[0] + 0.5));
      const by = Math.round(fy - (grabCell[1] + 0.5));
      // 以抓手格中心是否落在棋盘内为准（留半格余量）
      const inside = fx >= -0.5 && fy >= -0.5 && fx <= cols + 0.5 && fy <= rows + 0.5;
      const hover = { x: bx, y: by };
      const valid = inside && checkValid(p, bx, by, d.rotation);
      return { ...d, pointer: { x: clientX, y: clientY }, hover, valid, inside };
    },
    [pieces, pieceCells, cellSize, checkValid, cols, rows],
  );

  const startDrag = useCallback(
    (pieceId: string, clientX: number, clientY: number, grabCell?: Cell) => {
      const p = pieces.find((pp) => pp.id === pieceId)!;
      if (p.locked) return;
      const prev = placements[pieceId];
      const rotation = prev?.rotation ?? 0;
      const cells = pieceCells(p, rotation);
      const { w, h } = shapeBounds(cells);
      const grab: Cell = grabCell ?? [Math.floor((w - 1) / 2), Math.floor((h - 1) / 2)];
      const d0: DragState = {
        pieceId, rotation, grab, prev,
        pointer: { x: clientX, y: clientY }, hover: null, valid: false, inside: false,
      };
      setDrag(updateHover(clientX, clientY, d0));
    },
    [pieces, placements, pieceCells, updateHover],
  );

  const rotateDragState = useCallback(
    (d: DragState): DragState => {
      const rotation = d.rotation + 1;
      const p = pieces.find((pp) => pp.id === d.pieceId)!;
      const { w, h } = shapeBounds(pieceCells(p, rotation));
      const grab: Cell = [Math.floor((w - 1) / 2), Math.floor((h - 1) / 2)];
      return updateHover(d.pointer.x, d.pointer.y, { ...d, rotation, grab });
    },
    [pieces, pieceCells, updateHover],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => setDrag((d) => (d ? updateHover(e.clientX, e.clientY, d) : d));
    const onUp = (e: PointerEvent) => {
      // 注意：副作用不能放在 setDrag 的 updater 里（StrictMode 会双调用）
      const d = dragRef.current;
      if (!d) return;
      const finalD = updateHover(e.clientX, e.clientY, d);
      if (finalD.inside && finalD.valid && finalD.hover) {
        // 放在棋盘内的合法位置
        setPlacements((pl) => ({ ...pl, [d.pieceId]: { x: finalD.hover!.x, y: finalD.hover!.y, rotation: d.rotation } }));
      } else if (!finalD.inside) {
        // 拖到网格外：放回库存
        setPlacements((pl) => ({ ...pl, [d.pieceId]: null }));
      }
      // 棋盘内但不合法：回到原位置（不改动 placements）
      setDrag(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setDrag((d) => (d ? rotateDragState(d) : null));
      } else if (e.key === 'Escape') {
        setDrag(null);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag !== null, updateHover, rotateDragState]);

  const reset = () => {
    setPlacements(initialPlacements);
    setDrag(null);
    setWon(false);
  };

  const trayPieces = pieces.filter((p) => !p.locked && !placements[p.id]);
  const dragPiece = drag ? pieces.find((p) => p.id === drag.pieceId)! : null;

  const hoverCells: Cell[] = drag && dragPiece && drag.hover
    ? pieceCells(dragPiece, drag.rotation).map(([cx, cy]) => [drag.hover!.x + cx, drag.hover!.y + cy] as Cell)
    : [];

  const IND = 150; // 指示条区域尺寸

  return (
    <div className="flex min-h-[calc(100vh-61px)] flex-col items-center bg-[#0b0e09] px-4 py-8 text-neutral-300 select-none">
      {/* 顶部信息栏 */}
      <div className="mb-6 flex w-full max-w-6xl items-center justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 设备修复</div>
          <h2 className="mt-1 text-2xl font-medium text-neutral-100">{level.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {drag && (
            <button
              onClick={() => setDrag((d) => (d ? rotateDragState(d) : null))}
              className="border border-[#a6e22e]/60 bg-[#a6e22e]/10 px-4 py-2 text-sm text-[#a6e22e] hover:bg-[#a6e22e]/20"
            >
              ⟳ 旋转 (R)
            </button>
          )}
          <button onClick={reset} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            ↺ 重置
          </button>
          <button onClick={onRestart} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            换一关
          </button>
          <button onClick={onExit} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            ✕ 退出
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-6xl flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        {/* 棋盘区 */}
        <div className="relative" style={{ paddingLeft: IND, paddingTop: IND }}>
          {/* 列指示条（顶部，按颜色分组） */}
          <div className="absolute top-0 flex" style={{ left: IND, height: IND - 8 }}>
            {Array.from({ length: cols }, (_, x) => (
              <div key={x} className="flex items-end justify-center" style={{ width: cellSize }}>
                <ColorBars req={level.colReq[x]} filled={colFilled[x]} vertical barLen={barLen} maxGroupWidth={cellSize - 4} />
              </div>
            ))}
          </div>
          {/* 行指示条（左侧，按颜色分组） */}
          <div className="absolute flex flex-col" style={{ top: IND, left: 0, width: IND - 8 }}>
            {Array.from({ length: rows }, (_, y) => (
              <div key={y} className="flex items-center justify-end" style={{ height: cellSize }}>
                <ColorBars req={level.rowReq[y]} filled={rowFilled[y]} vertical={false} barLen={barLen} maxGroupWidth={IND - 12} />
              </div>
            ))}
          </div>

          {/* 棋盘本体 */}
          <div
            ref={boardRef}
            className="relative border-2 border-neutral-700/80 bg-[#11150e]"
            style={{ width: cols * cellSize, height: rows * cellSize, boxShadow: '0 0 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.5)' }}
          >
            {/* 空格底纹 */}
            {Array.from({ length: rows }, (_, y) =>
              Array.from({ length: cols }, (_, x) => {
                const k = cellKey(x, y);
                if (blockedSet.has(k)) {
                  return (
                    <div
                      key={k}
                      className="absolute flex items-center justify-center"
                      style={{
                        left: x * cellSize, top: y * cellSize, width: cellSize, height: cellSize,
                        background: 'repeating-linear-gradient(45deg, #23272a 0 4px, #191c1e 4px 8px)',
                        border: '1px solid #2e3336',
                      }}
                    >
                      <span className="text-neutral-500" style={{ fontSize: cellSize * 0.55 }}>⊘</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={k}
                    className="absolute"
                    style={{
                      left: x * cellSize, top: y * cellSize, width: cellSize, height: cellSize,
                      background:
                        'linear-gradient(45deg, transparent 46%, #232a1c 46%, #232a1c 54%, transparent 54%),' +
                        'linear-gradient(-45deg, transparent 46%, #232a1c 46%, #232a1c 54%, transparent 54%)',
                      border: '1px solid rgba(60,70,50,0.25)',
                    }}
                  />
                );
              }),
            )}

            {/* 悬停高亮 */}
            {drag && drag.hover && hoverCells.map(([hx, hy], i) => (
              <div
                key={`h${i}`}
                className="pointer-events-none absolute"
                style={{
                  left: hx * cellSize, top: hy * cellSize, width: cellSize, height: cellSize,
                  border: `3px solid ${drag.valid ? PIECE_COLORS[dragPiece!.color].main : '#e04b3a'}`,
                  background: drag.valid ? PIECE_COLORS[dragPiece!.color].glow : 'rgba(224,75,58,0.25)',
                  zIndex: 5,
                }}
              />
            ))}

            {/* 已放置拼图 */}
            {pieces.map((p) => {
              const pl = placements[p.id];
              if (!pl || drag?.pieceId === p.id) return null;
              const cells = pieceCells(p, pl.rotation);
              const set = new Set(cells.map(([cx, cy]) => cellKey(cx, cy)));
              const c = PIECE_COLORS[p.color];
              const lockAt = p.locked ? centroidCell(cells) : null;
              return cells.map(([cx, cy]) => {
                const gx = pl.x + cx;
                const gy = pl.y + cy;
                const borders: React.CSSProperties = {};
                const bw = 3;
                // 内描边：沿形状外轮廓在格子内侧描一圈，用比本体高亮的颜色
                const inner: string[] = [];
                const iw = 2;
                if (!set.has(cellKey(cx, cy - 1))) {
                  borders.borderTop = `${bw}px solid ${c.main}`;
                  inner.push(`inset 0 ${iw}px 0 0 ${c.light}`);
                }
                if (!set.has(cellKey(cx, cy + 1))) {
                  borders.borderBottom = `${bw}px solid ${c.main}`;
                  inner.push(`inset 0 -${iw}px 0 0 ${c.light}`);
                }
                if (!set.has(cellKey(cx - 1, cy))) {
                  borders.borderLeft = `${bw}px solid ${c.main}`;
                  inner.push(`inset ${iw}px 0 0 0 ${c.light}`);
                }
                if (!set.has(cellKey(cx + 1, cy))) {
                  borders.borderRight = `${bw}px solid ${c.main}`;
                  inner.push(`inset -${iw}px 0 0 0 ${c.light}`);
                }
                if (!p.locked) inner.push(`inset 0 0 ${cellSize / 3}px rgba(255,255,255,0.18)`);
                return (
                  <div
                    key={`${p.id}-${cx}-${cy}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      startDrag(p.id, e.clientX, e.clientY, [cx, cy]);
                    }}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: gx * cellSize, top: gy * cellSize, width: cellSize, height: cellSize,
                      background: c.main,
                      opacity: p.locked ? 0.5 : 0.88,
                      cursor: p.locked ? 'not-allowed' : 'grab',
                      touchAction: 'none',
                      zIndex: 4,
                      boxShadow: inner.join(', '),
                      ...borders,
                    }}
                  >
                    {p.locked && lockAt && cx === lockAt[0] && cy === lockAt[1] && (
                      <span style={{ fontSize: cellSize * 0.5, color: 'rgba(0,0,0,0.65)' }}>🔒</span>
                    )}
                  </div>
                );
              });
            })}
          </div>

          <div className="mt-4 text-center text-sm tracking-wider text-neutral-500">
            拖拽拼图放入网格 · 按 R 旋转 · 拖出网格放回库存 · 行列颜色指示全部点亮即完成
          </div>
        </div>

        {/* 托盘 */}
        <div className="w-full max-w-md lg:w-72">
          <div className="border border-neutral-800 bg-[#14170f]/80">
            <div className="border-b border-neutral-800 px-4 py-3 text-xs tracking-[0.25em] text-neutral-500">
              元件库存 · {trayPieces.length}
            </div>
            <div className="grid max-h-[480px] grid-cols-3 gap-3 overflow-y-auto p-4 lg:grid-cols-2">
              {trayPieces.map((p) => (
                <div
                  key={p.id}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    startDrag(p.id, e.clientX, e.clientY);
                  }}
                  className="flex aspect-square cursor-grab items-center justify-center border border-neutral-800 bg-[#1a1e13] hover:border-neutral-600"
                  style={{ touchAction: 'none' }}
                >
                  <ShapeSvg cells={p.baseCells} color={p.color} cell={trayPieces.length > 6 ? 13 : 17} />
                </div>
              ))}
              {trayPieces.length === 0 && !won && (
                <div className="col-span-3 py-8 text-center text-sm text-neutral-600 lg:col-span-2">
                  全部放置完毕
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 拖拽跟随幽灵：抓手格中心对齐指针，与吸附位置 1:1 */}
      {drag && dragPiece && (
        <div className="pointer-events-none fixed z-50" style={{ left: drag.pointer.x, top: drag.pointer.y }}>
          <div
            style={{
              transform: `translate(${-(drag.grab[0] + 0.5) * cellSize}px, ${-(drag.grab[1] + 0.5) * cellSize}px)`,
            }}
          >
            <ShapeSvg cells={pieceCells(dragPiece, drag.rotation)} color={dragPiece.color} cell={cellSize} opacity={0.75} />
          </div>
        </div>
      )}

      {/* 胜利遮罩 */}
      {won && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="border border-[#a6e22e]/50 bg-[#101408] px-12 py-10 text-center" style={{ boxShadow: '0 0 60px rgba(166,226,46,0.25)' }}>
            <div className="mb-2 text-xs tracking-[0.4em] text-[#a6e22e]/70">// REPAIR COMPLETE</div>
            <div className="mb-8 text-3xl font-medium text-[#d6f28a]">修复完成</div>
            <div className="flex justify-center gap-3">
              <button onClick={() => { reset(); }} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                再玩一次
              </button>
              <button onClick={onRestart} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                换一关
              </button>
              <button onClick={onExit} className="border border-[#a6e22e]/60 bg-[#a6e22e]/10 px-5 py-2.5 text-sm text-[#a6e22e] hover:bg-[#a6e22e]/20">
                返回菜单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- 拼图模块入口（菜单 + 游戏） ----------------

export default function PuzzlePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [level, setLevel] = useState<Level | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [restartKey, setRestartKey] = useState(0);

  // 支持 ?code= 直接进入分享关卡
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      try {
        setLevel(decodeLevel(code));
      } catch (e) {
        setCodeError((e as Error).message);
      }
    }
  }, [searchParams]);

  const startWithCode = () => {
    try {
      setLevel(decodeLevel(codeInput));
      setCodeError('');
    } catch (e) {
      setCodeError((e as Error).message);
    }
  };

  if (level) {
    return (
      <PuzzleGame
        key={`${encodeLevel(level)}-${restartKey}`}
        level={level}
        onExit={() => setLevel(null)}
        onRestart={() => {
          setLevel(null);
          setRestartKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-61px)] bg-[#0b0e09] px-4 py-12 text-neutral-300">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 明日方舟：终末地</div>
          <h1 className="mt-2 text-3xl font-medium text-neutral-100">电路修复 · 源石电路模块</h1>
          <p className="mt-3 text-base text-neutral-500">
            拖拽元件填满网格，让每行每列的颜色数量与指示完全一致，修复源石电路。
          </p>
        </div>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">游玩分享关卡</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="粘贴分享码（EPZ2_ 开头）"
              className="flex-1 border border-neutral-800 bg-[#14170f] px-4 py-3 text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-[#a6e22e]/50"
            />
            <button
              onClick={startWithCode}
              className="border border-[#a6e22e]/60 bg-[#a6e22e]/10 px-7 py-3 text-base text-[#a6e22e] hover:bg-[#a6e22e]/20"
            >
              开始
            </button>
            <button
              onClick={() => navigate('/puzzle/editor')}
              className="border border-neutral-700 px-7 py-3 text-base text-neutral-300 hover:border-neutral-500"
            >
              ✚ 创建关卡
            </button>
          </div>
          {codeError && <div className="mt-2 text-sm text-red-400">{codeError}</div>}
        </section>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">随机关卡</h3>
          <div className="flex flex-wrap gap-3">
            {([['easy', '简单'], ['normal', '普通'], ['hard', '困难']] as [RandomDifficulty, string][]).map(([d, label]) => (
              <button
                key={d}
                onClick={() => setLevel(generateRandomLevel(d))}
                className="border border-neutral-800 bg-[#14170f] px-7 py-4 text-base text-neutral-300 hover:border-[#a6e22e]/50 hover:text-[#d6f28a]"
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">内置关卡</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {BUILTIN_LEVELS.map((lv, i) => (
              <button
                key={i}
                onClick={() => setLevel(lv)}
                className="border border-neutral-800 bg-[#14170f] px-5 py-5 text-left hover:border-[#a6e22e]/50"
              >
                <div className="text-base text-neutral-200">{lv.name}</div>
                <div className="mt-2 text-xs text-neutral-600">
                  {lv.cols}×{lv.rows} · {lv.pieces.length} 块
                  {lv.blocked.length > 0 && ` · ${lv.blocked.length} 禁用格`}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
