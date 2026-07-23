// ============================================================
// 关卡编辑器 —— 在棋盘上摆出「解」，行列颜色需求自动计算
// 支持拖拽 + 旋转（R）安放拼图；未锁定的拼图会成为玩家托盘里的元件
// 关卡允许留空格，不要求全部填满
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Cell, Level, PieceColor, Shape } from './types';
import {
  ALL_COLORS,
  MAX_GRID,
  MIN_GRID,
  PIECE_COLORS,
  cellKey,
  centroidCell,
  computeColorReq,
  isConnectedCells,
  normalizeCells,
  rotateCells,
  shapeBounds,
  validateLevel,
} from './types';
import { PRESET_SHAPES } from './presetShapes';
import { encodeLevel } from './shareCode';
import { ShapeSvg } from './PuzzlePage';

type Tool = 'place' | 'lock' | 'block' | 'erase';

/** 编辑器里的拼图：全部摆放在棋盘上（即关卡的解） */
interface EditorPiece {
  cells: Cell[];
  color: PieceColor;
  x: number;
  y: number;
  locked: boolean;
}

interface EditorDrag {
  mode: 'new' | 'move';
  index: number; // move 时的拼图下标
  cells: Cell[]; // 当前（旋转后的）形状
  color: PieceColor;
  grab: Cell;
  pointer: { x: number; y: number };
  hover: { x: number; y: number };
  valid: boolean;
  inside: boolean;
  moved: boolean;
}

export default function EditorPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('我的关卡');
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [pieces, setPieces] = useState<EditorPiece[]>([]);

  const [tool, setTool] = useState<Tool>('place');
  const [color, setColor] = useState<PieceColor>('green');
  const [customShapes, setCustomShapes] = useState<Shape[]>([]);
  const [customCells, setCustomCells] = useState<Set<string>>(new Set());

  const [drag, setDrag] = useState<EditorDrag | null>(null);
  const dragRef = useRef<EditorDrag | null>(null);
  useEffect(() => { dragRef.current = drag; }, [drag]);
  const boardRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);

  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);

  const allShapes = useMemo(() => [...PRESET_SHAPES, ...customShapes], [customShapes]);

  // 由棋盘上的解生成关卡（未锁定的拼图交给玩家拖动）
  const level: Level = useMemo(() => {
    const { rowReq, colReq } = computeColorReq(rows, cols, pieces);
    return {
      name: name.trim() || '自定义关卡',
      rows,
      cols,
      blocked: [...blocked].map((k) => k.split(',').map(Number) as Cell),
      pieces: pieces.map((p) => {
        if (p.locked) return { cells: p.cells, color: p.color, locked: true, x: p.x, y: p.y };
        return { cells: p.cells, color: p.color };
      }),
      rowReq,
      colReq,
    };
  }, [name, rows, cols, blocked, pieces]);

  const errors = validateLevel(level);
  const usedColors = new Set(pieces.map((p) => p.color));

  const clampSize = (v: number) => Math.max(MIN_GRID, Math.min(MAX_GRID, v));

  const resize = (newRows: number, newCols: number) => {
    setRows(newRows);
    setCols(newCols);
    setBlocked((b) => new Set([...b].filter((k) => {
      const [x, y] = k.split(',').map(Number);
      return x < newCols && y < newRows;
    })));
    setPieces((ps) =>
      ps.filter((p) => p.cells.every(([cx, cy]) => p.x + cx < newCols && p.y + cy < newRows)),
    );
  };

  // 占据情况（正在拖动的拼图不占格）
  const occupancy = useMemo(() => {
    const map = new Map<string, number>();
    pieces.forEach((p, i) => {
      if (drag?.mode === 'move' && drag.index === i) return;
      for (const [cx, cy] of p.cells) map.set(cellKey(p.x + cx, p.y + cy), i);
    });
    return map;
  }, [pieces, drag]);

  const cellSize = Math.max(30, Math.min(52, Math.floor(560 / Math.max(cols, rows))));

  // ---------------- 拖拽安放 ----------------

  const updateDrag = useCallback(
    (clientX: number, clientY: number, d: EditorDrag): EditorDrag => {
      const board = boardRef.current;
      if (!board) return { ...d, pointer: { x: clientX, y: clientY }, valid: false, inside: false };
      const rect = board.getBoundingClientRect();
      const grabCell = d.cells.some(([cx, cy]) => cx === d.grab[0] && cy === d.grab[1]) ? d.grab : d.cells[0];
      const fx = (clientX - rect.left) / cellSize;
      const fy = (clientY - rect.top) / cellSize;
      const bx = Math.round(fx - (grabCell[0] + 0.5));
      const by = Math.round(fy - (grabCell[1] + 0.5));
      const inside = fx >= -0.5 && fy >= -0.5 && fx <= cols + 0.5 && fy <= rows + 0.5;
      let valid = inside;
      if (valid) {
        for (const [cx, cy] of d.cells) {
          const gx = bx + cx;
          const gy = by + cy;
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) { valid = false; break; }
          const gk = cellKey(gx, gy);
          if (blocked.has(gk) || occupancy.has(gk)) { valid = false; break; }
        }
      }
      const moved = d.moved || Math.abs(clientX - d.pointer.x) + Math.abs(clientY - d.pointer.y) > 6;
      return { ...d, pointer: { x: clientX, y: clientY }, hover: { x: bx, y: by }, valid, inside, moved };
    },
    [cellSize, cols, rows, blocked, occupancy],
  );

  const startDrag = useCallback(
    (mode: 'new' | 'move', index: number, cells: Cell[], pieceColor: PieceColor, clientX: number, clientY: number, grabCell?: Cell) => {
      const { w, h } = shapeBounds(cells);
      const grab: Cell = grabCell ?? [Math.floor((w - 1) / 2), Math.floor((h - 1) / 2)];
      const d0: EditorDrag = {
        mode, index, cells, color: pieceColor, grab,
        pointer: { x: clientX, y: clientY }, hover: { x: 0, y: 0 }, valid: false, inside: false, moved: false,
      };
      setDrag(updateDrag(clientX, clientY, d0));
    },
    [updateDrag],
  );

  const rotateDrag = useCallback(() => {
    setDrag((d) => {
      if (!d) return null;
      const cells = rotateCells(d.cells, 1);
      const { w, h } = shapeBounds(cells);
      const grab: Cell = [Math.floor((w - 1) / 2), Math.floor((h - 1) / 2)];
      return updateDrag(d.pointer.x, d.pointer.y, { ...d, cells, grab, moved: true });
    });
  }, [updateDrag]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => setDrag((d) => (d ? updateDrag(e.clientX, e.clientY, d) : d));
    const onUp = (e: PointerEvent) => {
      // 注意：副作用不能放在 setDrag 的 updater 里（StrictMode 会双调用，导致重复添加拼图）
      const d = dragRef.current;
      if (!d) return;
      const finalD = updateDrag(e.clientX, e.clientY, d);
      if (finalD.moved) {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 0);
      }
      if (finalD.inside && finalD.valid) {
        if (finalD.mode === 'new') {
          setPieces((ps) => [...ps, { cells: finalD.cells, color: finalD.color, x: finalD.hover.x, y: finalD.hover.y, locked: false }]);
        } else {
          setPieces((ps) => ps.map((p, i) => (i === finalD.index ? { ...p, cells: finalD.cells, x: finalD.hover.x, y: finalD.hover.y } : p)));
        }
      } else if (!finalD.inside && finalD.mode === 'move') {
        // 拖出网格：从棋盘上移除这块拼图
        setPieces((ps) => ps.filter((_, i) => i !== finalD.index));
      }
      setDrag(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') rotateDrag();
      else if (e.key === 'Escape') setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag !== null, updateDrag, rotateDrag]);

  // ---------------- 棋盘点击（工具操作） ----------------

  const onCellClick = (x: number, y: number) => {
    if (suppressClick.current || drag) return;
    const k = cellKey(x, y);
    if (tool === 'block') {
      if (occupancy.has(k)) return;
      setBlocked((b) => {
        const nb = new Set(b);
        if (nb.has(k)) nb.delete(k);
        else nb.add(k);
        return nb;
      });
    } else if (tool === 'erase') {
      if (occupancy.has(k)) {
        const idx = occupancy.get(k)!;
        setPieces((ps) => ps.filter((_, i) => i !== idx));
      } else if (blocked.has(k)) {
        setBlocked((b) => {
          const nb = new Set(b);
          nb.delete(k);
          return nb;
        });
      }
    } else if (tool === 'lock') {
      if (occupancy.has(k)) {
        const idx = occupancy.get(k)!;
        setPieces((ps) => ps.map((p, i) => (i === idx ? { ...p, locked: !p.locked } : p)));
      }
    }
    // place 工具只支持拖拽放置（右键删除），点击空格不做事
  };

  // 右键棋盘上的拼图：直接删除
  const onCellContextMenu = (x: number, y: number) => {
    const idx = occupancy.get(cellKey(x, y));
    if (idx !== undefined) setPieces((ps) => ps.filter((_, i) => i !== idx));
  };

  const customCellsList = useMemo(
    () => [...customCells].map((k) => k.split(',').map(Number) as Cell),
    [customCells],
  );
  // 自定义形状要求所有方块四连通（上下左右相连）
  const customConnected = isConnectedCells(customCellsList);

  const saveCustomShape = () => {
    if (customCells.size === 0 || !customConnected) return;
    const cells = normalizeCells(customCellsList);
    const id = `custom-${Date.now()}`;
    setCustomShapes((cs) => [...cs, { id, name: `自定义 ${cs.length + 1}`, cells }]);
    setCustomCells(new Set());
  };

  const generate = () => {
    setShareCode(encodeLevel(level));
    setCopied(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
    } catch {
      // 剪贴板不可用时让用户手动复制
    }
  };

  const toolBtn = (t: Tool, label: string) => (
    <button
      onClick={() => setTool(t)}
      className={`border px-4 py-2 text-sm ${
        tool === t
          ? 'border-[#a6e22e]/70 bg-[#a6e22e]/10 text-[#a6e22e]'
          : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-[calc(100vh-61px)] bg-[#0b0e09] px-4 py-10 text-neutral-300 select-none">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.3em] text-neutral-500">// 电路修复 · 关卡编辑器</div>
            <h1 className="mt-2 text-2xl font-medium text-neutral-100">制作我的关卡</h1>
          </div>
          <button onClick={() => navigate('/puzzle')} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500">
            ✕ 返回
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* 左：棋盘 */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {toolBtn('place', '▣ 摆放')}
              {toolBtn('lock', '🔒 切换锁定')}
              {toolBtn('block', '⊘ 禁用格')}
              {toolBtn('erase', '⌫ 擦除')}
              {drag && (
                <button
                  onClick={rotateDrag}
                  className="border border-[#a6e22e]/60 bg-[#a6e22e]/10 px-4 py-2 text-sm text-[#a6e22e] hover:bg-[#a6e22e]/20"
                >
                  ⟳ 旋转 (R)
                </button>
              )}
            </div>
            <div className="mb-4 text-xs text-neutral-600">
              {tool === 'place' && '从右侧形状库将拼图拖入棋盘（R 键旋转），右键删除棋盘上的拼图'}
              {tool === 'lock' && '点击已放置的拼图，在「预放置锁定」与「玩家可拖动」之间切换'}
              {tool === 'block' && '点击空格切换禁用状态'}
              {tool === 'erase' && '点击拼图或禁用格将其移除'}
            </div>

            <div
              ref={boardRef}
              className="relative inline-block border-2 border-neutral-700/80 bg-[#11150e]"
              style={{ width: cols * cellSize, height: rows * cellSize }}
            >
              {Array.from({ length: rows }, (_, y) =>
                Array.from({ length: cols }, (_, x) => {
                  const k = cellKey(x, y);
                  const isBlocked = blocked.has(k);
                  const pieceIdx = occupancy.get(k);
                  const piece = pieceIdx !== undefined ? pieces[pieceIdx] : undefined;
                  const lockAt = piece?.locked ? centroidCell(piece.cells) : null;
                  return (
                    <div
                      key={k}
                      onClick={() => onCellClick(x, y)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onCellContextMenu(x, y);
                      }}
                      onPointerDown={(e) => {
                        if (tool === 'place' && piece && pieceIdx !== undefined) {
                          e.preventDefault();
                          const local: Cell = [x - piece.x, y - piece.y];
                          startDrag('move', pieceIdx, piece.cells, piece.color, e.clientX, e.clientY, local);
                        }
                      }}
                      className="absolute"
                      style={{
                        left: x * cellSize, top: y * cellSize, width: cellSize, height: cellSize,
                        cursor: tool === 'place' && piece ? 'grab' : 'pointer',
                        touchAction: 'none',
                        background: isBlocked
                          ? 'repeating-linear-gradient(45deg, #23272a 0 4px, #191c1e 4px 8px)'
                          : piece
                            ? PIECE_COLORS[piece.color].main
                            : 'linear-gradient(45deg, transparent 46%, #232a1c 46%, #232a1c 54%, transparent 54%),' +
                              'linear-gradient(-45deg, transparent 46%, #232a1c 46%, #232a1c 54%, transparent 54%)',
                        opacity: piece ? (piece.locked ? 0.5 : 0.85) : 1,
                        border: '1px solid rgba(60,70,50,0.35)',
                      }}
                    >
                      {isBlocked && (
                        <span className="flex h-full items-center justify-center text-neutral-500" style={{ fontSize: cellSize * 0.55 }}>⊘</span>
                      )}
                      {piece?.locked && lockAt && lockAt[0] === x - piece.x && lockAt[1] === y - piece.y && (
                        <span className="flex h-full items-center justify-center" style={{ fontSize: cellSize * 0.5, color: 'rgba(0,0,0,0.6)' }}>🔒</span>
                      )}
                    </div>
                  );
                }),
              )}

              {/* 拖拽悬停高亮 */}
              {drag && drag.inside && drag.cells.map(([cx, cy], i) => (
                <div
                  key={`h${i}`}
                  className="pointer-events-none absolute"
                  style={{
                    left: (drag.hover.x + cx) * cellSize,
                    top: (drag.hover.y + cy) * cellSize,
                    width: cellSize,
                    height: cellSize,
                    border: `3px solid ${drag.valid ? PIECE_COLORS[drag.color].main : '#e04b3a'}`,
                    background: drag.valid ? PIECE_COLORS[drag.color].glow : 'rgba(224,75,58,0.25)',
                    zIndex: 5,
                  }}
                />
              ))}
            </div>
          </div>

          {/* 右：配置 */}
          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">关卡名称</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                className="w-full border border-neutral-800 bg-[#14170f] px-4 py-2.5 text-base outline-none focus:border-[#a6e22e]/50"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">列数 (宽) {cols}</label>
                <input
                  type="range" min={MIN_GRID} max={MAX_GRID} value={cols}
                  onChange={(e) => resize(rows, clampSize(Number(e.target.value)))}
                  className="w-full accent-[#a6e22e]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">行数 (高) {rows}</label>
                <input
                  type="range" min={MIN_GRID} max={MAX_GRID} value={rows}
                  onChange={(e) => resize(clampSize(Number(e.target.value)), cols)}
                  className="w-full accent-[#a6e22e]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">
                拼图颜色（已用 {usedColors.size}/2 种）
              </label>
              <div className="flex gap-2">
                {ALL_COLORS.map((c) => {
                  const disabled = usedColors.size >= 2 && !usedColors.has(c);
                  return (
                    <button
                      key={c}
                      disabled={disabled}
                      onClick={() => setColor(c)}
                      className={`flex items-center gap-2 border px-4 py-2 text-sm ${
                        color === c ? 'border-neutral-400 text-neutral-100' : 'border-neutral-800 text-neutral-500'
                      } ${disabled ? 'cursor-not-allowed opacity-30' : ''}`}
                    >
                      <span className="inline-block h-3.5 w-3.5" style={{ background: PIECE_COLORS[c].main }} />
                      {PIECE_COLORS[c].name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">形状库</label>
              <div className="grid max-h-52 grid-cols-4 gap-2 overflow-y-auto border border-neutral-800 bg-[#14170f] p-3">
                {allShapes.map((s) => (
                  <button
                    key={s.id}
                    onPointerDown={(e) => {
                      if (usedColors.size >= 2 && !usedColors.has(color)) return;
                      e.preventDefault();
                      startDrag('new', -1, normalizeCells(s.cells), color, e.clientX, e.clientY);
                    }}
                    title={s.name}
                    className="flex aspect-square cursor-grab items-center justify-center border border-neutral-800 hover:border-neutral-600"
                    style={{ touchAction: 'none' }}
                  >
                    <ShapeSvg cells={s.cells} color={color} cell={10} />
                  </button>
                ))}
              </div>
            </div>

            {/* 已添加拼图列表 */}
            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">拼图清单</label>
              <div className="max-h-44 space-y-1.5 overflow-y-auto">
                {pieces.map((p, i) => (
                  <div key={i} className="flex items-center justify-between border border-neutral-800 bg-[#14170f] px-3 py-2">
                    <div className="flex items-center gap-3">
                      <ShapeSvg cells={p.cells} color={p.color} cell={7} locked={p.locked} />
                      <span className="text-xs text-neutral-500">
                        {p.cells.length} 格 · {p.locked ? '🔒 预放置' : '玩家可拖动'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPieces((ps) => ps.map((q, j) => (j === i ? { ...q, locked: !q.locked } : q)))}
                        className="px-1.5 text-neutral-500 hover:text-neutral-200"
                        title="切换锁定"
                      >
                        {p.locked ? '🔓' : '🔒'}
                      </button>
                      <button
                        onClick={() => setPieces((ps) => ps.filter((_, j) => j !== i))}
                        className="px-1.5 text-neutral-600 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {pieces.length === 0 && <div className="py-2 text-xs text-neutral-600">还没有拼图，从上方形状库拖入棋盘</div>}
              </div>
            </div>

            {/* 自定义形状 */}
            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">自定义形状</label>
              <div className="flex items-start gap-3">
                <div className="inline-block border border-neutral-800 bg-[#14170f] p-1.5">
                  {Array.from({ length: 5 }, (_, y) => (
                    <div key={y} className="flex">
                      {Array.from({ length: 5 }, (_, x) => {
                        const k = cellKey(x, y);
                        const on = customCells.has(k);
                        return (
                          <div
                            key={x}
                            onClick={() =>
                              setCustomCells((cc) => {
                                const nc = new Set(cc);
                                if (nc.has(k)) nc.delete(k);
                                else nc.add(k);
                                return nc;
                              })
                            }
                            className="cursor-pointer border border-neutral-800/60"
                            style={{ width: 32, height: 32, background: on ? PIECE_COLORS[color].main : 'transparent' }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={saveCustomShape}
                    disabled={customCells.size === 0 || !customConnected}
                    className="border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    保存为形状
                  </button>
                  {customCells.size > 0 && !customConnected && (
                    <div className="max-w-36 text-xs text-amber-400/90">方块之间必须相连（上下左右相邻）才能保存</div>
                  )}
                </div>
              </div>
            </div>

            {/* 校验 + 生成 */}
            <div className="border-t border-neutral-800 pt-5">
              {errors.length > 0 ? (
                <ul className="mb-3 space-y-1">
                  {errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-400">· {e}</li>
                  ))}
                </ul>
              ) : (
                <div className="mb-3 text-xs text-[#a6e22e]">✓ 关卡合法，可以生成分享码</div>
              )}
              <button
                onClick={generate}
                disabled={errors.length > 0}
                className="w-full border border-[#a6e22e]/60 bg-[#a6e22e]/10 px-4 py-3 text-base text-[#a6e22e] hover:bg-[#a6e22e]/20 disabled:cursor-not-allowed disabled:opacity-30"
              >
                生成分享码
              </button>
              {shareCode && (
                <div className="mt-4">
                  <textarea
                    readOnly
                    value={shareCode}
                    rows={3}
                    onFocus={(e) => e.target.select()}
                    className="w-full resize-none border border-neutral-800 bg-[#14170f] p-3 font-mono text-xs break-all text-neutral-400 outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={copyCode} className="flex-1 border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:border-neutral-500">
                      {copied ? '✓ 已复制' : '复制分享码'}
                    </button>
                    <button
                      onClick={() => navigate(`/puzzle?code=${encodeURIComponent(shareCode)}`)}
                      className="flex-1 border border-[#a6e22e]/60 bg-[#a6e22e]/10 px-4 py-2.5 text-sm text-[#a6e22e] hover:bg-[#a6e22e]/20"
                    >
                      立即试玩 →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 拖拽跟随幽灵 */}
      {drag && (
        <div className="pointer-events-none fixed z-50" style={{ left: drag.pointer.x, top: drag.pointer.y }}>
          <div style={{ transform: `translate(${-(drag.grab[0] + 0.5) * cellSize}px, ${-(drag.grab[1] + 0.5) * cellSize}px)` }}>
            <ShapeSvg cells={drag.cells} color={drag.color} cell={cellSize} opacity={0.75} />
          </div>
        </div>
      )}
    </div>
  );
}
