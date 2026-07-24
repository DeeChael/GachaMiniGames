// ============================================================
// 预言算碑 —— 棋盘组件（SVG）
// 16×16 格点（小菱形标识），线框 step=2（9 根线），
// 圆形裁切（直径 = 棋盘边长）；拼图用 evenodd 路径一次绘出，
// 重叠区域自动抵消为空；目标图案以 30% 黄色垫在拼图下方
// ============================================================

import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { PlacedPiece, Pt, Rot } from './types';
import { BOARD, compositePolys, piecePoly, pointInPoly, rotatedShape, shapeById } from './types';

const PAD = 1.1; // 圆环装饰预留的边距（格）
const VIEW = BOARD + PAD * 2;

/** 目标层拼图（无 id） */
export interface TargetPiece {
  shape: string;
  rot: Rot;
  x: number;
  y: number;
}

export interface BoardHandle {
  /** 从任意指针位置开始对指定拼图进行拖拽（用于从形状库拖入） */
  beginDrag: (id: string, clientX: number, clientY: number) => void;
}

interface DragState {
  id: string;
  offX: number; // 抓取点相对拼图原点的偏移
  offY: number;
  fx: number; // 当前浮动位置（格，未取整）
  fy: number;
}

const polysToPath = (polys: Pt[][]) =>
  polys.map((poly) => `M${poly.map(([x, y]) => `${x},${y}`).join('L')}Z`).join('');

const SrBoard = forwardRef<
  BoardHandle,
  {
    size: number; // 显示边长（px）
    pieces: PlacedPiece[];
    target?: TargetPiece[]; // 30% 黄色目标图案
    interactive?: boolean; // 可拖拽
    showOutlines?: boolean; // 显示每块拼图的描边（目标预览时关闭）
    selectedId?: string | null;
    onSelect?: (id: string | null) => void;
    onDrop?: (id: string, x: number, y: number, inside: boolean) => void;
  }
>(function SrBoard(
  { size, pieces, target, interactive = false, showOutlines = true, selectedId, onSelect, onDrop },
  ref,
) {
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // 客户端坐标 → 棋盘格坐标
  const toGrid = (clientX: number, clientY: number): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    const unit = rect.width / VIEW;
    return [(clientX - rect.left) / unit - PAD, (clientY - rect.top) / unit - PAD];
  };

  const setDragBoth = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  // 当前挂载的 window 监听，用 ref 保证移除时引用一致
  const listenersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void } | null>(null);

  const removeListeners = () => {
    if (listenersRef.current) {
      window.removeEventListener('pointermove', listenersRef.current.move);
      window.removeEventListener('pointerup', listenersRef.current.up);
      listenersRef.current = null;
    }
  };

  const endDrag = (clientX: number, clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    setDragBoth(null);
    removeListeners();
    const piece = pieces.find((p) => p.id === d.id);
    const s = piece && shapeById(piece.shape);
    if (!piece || !s) return;
    const { w, h } = rotatedShape(s, piece.rot);
    const x = Math.max(0, Math.min(BOARD - w, Math.round(d.fx)));
    const y = Math.max(0, Math.min(BOARD - h, Math.round(d.fy)));
    const [gx, gy] = toGrid(clientX, clientY);
    const inside = gx >= -PAD && gx <= BOARD + PAD && gy >= -PAD && gy <= BOARD + PAD;
    onDrop?.(d.id, x, y, inside);
  };

  const beginDragAt = (id: string, clientX: number, clientY: number) => {
    const piece = pieces.find((p) => p.id === id);
    if (!piece) return;
    const [gx, gy] = toGrid(clientX, clientY);
    setDragBoth({ id, offX: gx - piece.x, offY: gy - piece.y, fx: piece.x, fy: piece.y });
    removeListeners();
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const [mx, my] = toGrid(e.clientX, e.clientY);
      setDragBoth({ ...d, fx: mx - d.offX, fy: my - d.offY });
    };
    const up = (e: PointerEvent) => endDrag(e.clientX, e.clientY);
    listenersRef.current = { move, up };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // 卸载时清理 window 监听
  useEffect(() => removeListeners, []);

  useImperativeHandle(ref, () => ({ beginDrag: beginDragAt }));

  // 静态元素：格线（step 2，共 9 根）与格点小菱形
  const { linesPath, dotsPath } = useMemo(() => {
    let lines = '';
    for (let i = 0; i <= BOARD; i += 2) {
      lines += `M${i},0V${BOARD}M0,${i}H${BOARD}`;
    }
    let dots = '';
    const r = 0.07;
    for (let y = 0; y <= BOARD; y++) {
      for (let x = 0; x <= BOARD; x++) {
        dots += `M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`;
      }
    }
    return { linesPath: lines, dotsPath: dots };
  }, []);

  const visible = pieces.filter((p) => p.id !== drag?.id);
  const dragPiece = drag ? pieces.find((p) => p.id === drag.id) : null;

  const compositePath = polysToPath(compositePolys(visible));
  const targetPath = target ? polysToPath(compositePolys(target)) : '';
  const dragPath = dragPiece && drag ? polysToPath(compositePolys([{ ...dragPiece, x: drag.fx, y: drag.fy }])) : '';

  // 点按拾取：从最上层（数组末尾）开始找包含指针的拼图
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const [gx, gy] = toGrid(e.clientX, e.clientY);
    let hit: PlacedPiece | null = null;
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      const poly = piecePoly(p.shape, p.rot, p.x, p.y);
      if (poly && pointInPoly(gx, gy, poly)) {
        hit = p;
        break;
      }
    }
    onSelect?.(hit?.id ?? null);
    if (interactive && hit) {
      e.preventDefault();
      beginDragAt(hit.id, e.clientX, e.clientY);
    }
  };

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`${-PAD} ${-PAD} ${VIEW} ${VIEW}`}
      className={interactive ? 'cursor-grab touch-none' : ''}
      onPointerDown={onPointerDown}
    >
      <defs>
        <clipPath id={`clip${uid}`}>
          <circle cx={BOARD / 2} cy={BOARD / 2} r={BOARD / 2} />
        </clipPath>
        <radialGradient id={`bg${uid}`} cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="#181407" />
          <stop offset="70%" stopColor="#0d0e14" />
          <stop offset="100%" stopColor="#080b12" />
        </radialGradient>
        <linearGradient id={`piece${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6d47c" />
          <stop offset="100%" stopColor="#d9a83c" />
        </linearGradient>
      </defs>

      {/* 圆形外框 */}
      <circle cx={BOARD / 2} cy={BOARD / 2} r={BOARD / 2 + 0.42} fill="none" stroke="#3c5b78" strokeWidth={0.1} opacity={0.7} />
      <circle cx={BOARD / 2} cy={BOARD / 2} r={BOARD / 2 + 0.14} fill="none" stroke="#8fd0e8" strokeWidth={0.2} opacity={0.85} />

      <g clipPath={`url(#clip${uid})`}>
        <rect x={0} y={0} width={BOARD} height={BOARD} fill={`url(#bg${uid})`} />
        <path d={linesPath} stroke="#a8873c" strokeWidth={0.035} opacity={0.4} fill="none" />
        <path d={dotsPath} fill="#c8a44c" opacity={0.55} />

        {/* 目标图案：30% 黄色，垫在拼图下方 */}
        {targetPath && <path d={targetPath} fill="#f2c14e" opacity={0.3} fillRule="evenodd" />}

        {/* 拼图 XOR 合成：evenodd 让重叠部分显示为空 */}
        {compositePath && (
          <path d={compositePath} fill={`url(#piece${uid})`} fillRule="evenodd" stroke="#ffe9b0" strokeWidth={0.03} strokeOpacity={0.35} />
        )}

        {/* 每块拼图的描边，便于辨认个体与重叠边界 */}
        {showOutlines &&
          visible.map((p) => {
            const poly = piecePoly(p.shape, p.rot, p.x, p.y);
            if (!poly) return null;
            const sel = p.id === selectedId;
            return (
              <path
                key={p.id}
                d={polysToPath([poly])}
                fill="none"
                stroke={sel ? '#fff3c8' : '#ffe1a0'}
                strokeWidth={sel ? 0.09 : 0.045}
                strokeOpacity={sel ? 0.95 : 0.5}
              />
            );
          })}

        {/* 拖拽中的拼图 */}
        {dragPath && (
          <path d={dragPath} fill={`url(#piece${uid})`} fillOpacity={0.9} stroke="#fff2c0" strokeWidth={0.07} strokeOpacity={0.9} />
        )}
      </g>
    </svg>
  );
});

export default SrBoard;
