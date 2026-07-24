// ============================================================
// 预言算碑 —— 棋盘组件（SVG）
// 16×16 格点（小菱形标识），线框 step=2（9 根线），
// 圆形裁切（直径 = 棋盘边长）；拼图用 evenodd 路径一次绘出，
// 重叠区域实时抵消为空；目标图案以 30% 黄色垫在拼图下方。
// 拖拽中的拼图也参与合成，相交镂空效果实时可见；
// 编辑器摆放步可在拖动时按 R 旋转拼图
// ============================================================

import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { PlacedPiece, Pt, Rot } from './types';
import { BOARD, compositePolys, fitsOnBoard, isRotatable, pieceHitsCorner, piecePoly, pointInPoly, rotatedShape, shapeById } from './types';

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
  /** 从任意指针位置开始拖拽指定拼图；center 时让拼图居中跟随指针（用于从形状库拖入） */
  beginDrag: (id: string, clientX: number, clientY: number, center?: boolean) => void;
}

interface DragState {
  id: string;
  offX: number; // 抓取点相对拼图原点的偏移
  offY: number;
  fx: number; // 当前浮动位置（格，未取整）
  fy: number;
  rot: Rot; // 拖拽中的旋转状态（按 R 改变）
}

const polysToPath = (polys: Pt[][]) =>
  polys.map((poly) => `M${poly.map(([x, y]) => `${x},${y}`).join('L')}Z`).join('');

const SrBoard = forwardRef<
  BoardHandle,
  {
    size: number; // 显示边长（px）
    pieces: PlacedPiece[];
    target?: TargetPiece[]; // 黄色目标图案（默认 30% 透明度垫在拼图下方）
    targetOpacity?: number; // 目标图案填充透明度，默认 0.3
    interactive?: boolean; // 可拖拽
    rotatable?: boolean; // 拖拽时可按 R 旋转（仅编辑器摆放步）
    restrictCorners?: boolean; // 松开时若与四角 2×2 禁区相交，视为非法移动并回退
    showOutlines?: boolean; // 显示每块拼图的描边（目标预览时关闭）
    onDrop?: (id: string, x: number, y: number, rot: Rot, inside: boolean) => void;
  }
>(function SrBoard(
  { size, pieces, target, targetOpacity = 0.3, interactive = false, rotatable = false, restrictCorners = false, showOutlines = true, onDrop },
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

  const dimsOf = (shape: string, rot: Rot) => rotatedShape(shapeById(shape)!, rot);

  // 让拼图始终完整留在棋盘内（跟随指针滑到边缘为止）
  const clampDrag = (d: DragState): DragState => {
    const piece = pieces.find((p) => p.id === d.id);
    if (!piece) return d;
    const { w, h } = dimsOf(piece.shape, d.rot);
    return {
      ...d,
      fx: Math.max(0, Math.min(BOARD - w, d.fx)),
      fy: Math.max(0, Math.min(BOARD - h, d.fy)),
    };
  };

  // 当前挂载的 window 监听，用 ref 保证移除时引用一致
  const listenersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; key: (e: KeyboardEvent) => void } | null>(null);

  const removeListeners = () => {
    if (listenersRef.current) {
      window.removeEventListener('pointermove', listenersRef.current.move);
      window.removeEventListener('pointerup', listenersRef.current.up);
      window.removeEventListener('keydown', listenersRef.current.key);
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
    const { w, h } = dimsOf(piece.shape, d.rot);
    const x = Math.max(0, Math.min(BOARD - w, Math.round(d.fx)));
    const y = Math.max(0, Math.min(BOARD - h, Math.round(d.fy)));
    // 与四角 2×2 禁区（圆形裁切后看不见的方格）相交：非法移动，回退到原位置
    if (restrictCorners && fitsOnBoard(piece.shape, d.rot, x, y) && pieceHitsCorner(piece.shape, d.rot, x, y)) return;
    const [gx, gy] = toGrid(clientX, clientY);
    const inside = gx >= -PAD && gx <= BOARD + PAD && gy >= -PAD && gy <= BOARD + PAD;
    onDrop?.(d.id, x, y, d.rot, inside);
  };

  const beginDragAt = (id: string, clientX: number, clientY: number, center = false) => {
    const piece = pieces.find((p) => p.id === id);
    const s = piece && shapeById(piece.shape);
    if (!piece || !s) return;
    const [gx, gy] = toGrid(clientX, clientY);
    const { w, h } = dimsOf(piece.shape, piece.rot);
    // center：让拼图中心对准指针（形状库拖入）；否则保持抓取点偏移
    const offX = center ? w / 2 : gx - piece.x;
    const offY = center ? h / 2 : gy - piece.y;
    setDragBoth(clampDrag({ id, offX, offY, fx: gx - offX, fy: gy - offY, rot: piece.rot }));
    removeListeners();
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const [mx, my] = toGrid(e.clientX, e.clientY);
      setDragBoth(clampDrag({ ...d, fx: mx - d.offX, fy: my - d.offY }));
    };
    const up = (e: PointerEvent) => endDrag(e.clientX, e.clientY);
    // 拖动时按 R 旋转：保持抓取点在拼图内的相对位置不变；旋转后重合的图形（正方形、菱形）不可旋转
    const key = (e: KeyboardEvent) => {
      if (!rotatable || (e.key !== 'r' && e.key !== 'R')) return;
      const d = dragRef.current;
      const p = d && pieces.find((q) => q.id === d.id);
      if (!d || !p || !isRotatable(p.shape)) return;
      const rot = ((d.rot + 1) % 4) as Rot;
      const oldDims = dimsOf(p.shape, d.rot);
      const newDims = dimsOf(p.shape, rot);
      const offX2 = (d.offX / oldDims.w) * newDims.w;
      const offY2 = (d.offY / oldDims.h) * newDims.h;
      setDragBoth(clampDrag({ ...d, rot, offX: offX2, offY: offY2, fx: d.fx + d.offX - offX2, fy: d.fy + d.offY - offY2 }));
    };
    listenersRef.current = { move, up, key };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', key);
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

  // 拖拽中的拼图以浮动位置参与合成，相交镂空实时可见
  const live = drag
    ? pieces.map((p) => (p.id === drag.id ? { ...p, x: drag.fx, y: drag.fy, rot: drag.rot } : p))
    : pieces;

  const compositePath = polysToPath(compositePolys(live));
  const targetPath = target ? polysToPath(compositePolys(target)) : '';
  const dragPoly = drag
    ? (() => {
        const p = pieces.find((q) => q.id === drag.id);
        return p ? piecePoly(p.shape, drag.rot, drag.fx, drag.fy) : null;
      })()
    : null;

  // 点按拾取：从最上层（数组末尾）开始找包含指针的拼图
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !interactive) return;
    const [gx, gy] = toGrid(e.clientX, e.clientY);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      const poly = piecePoly(p.shape, p.rot, p.x, p.y);
      if (poly && pointInPoly(gx, gy, poly)) {
        e.preventDefault();
        beginDragAt(p.id, e.clientX, e.clientY);
        return;
      }
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

        {/* 目标图案：黄色填充，垫在拼图下方 */}
        {targetPath && <path d={targetPath} fill="#f2c14e" opacity={targetOpacity} fillRule="evenodd" />}

        {/* 拼图 XOR 合成：evenodd 让重叠部分实时显示为空 */}
        {compositePath && (
          <path d={compositePath} fill={`url(#piece${uid})`} fillRule="evenodd" stroke="#ffe9b0" strokeWidth={0.03} strokeOpacity={0.35} />
        )}

        {/* 每块拼图的描边，便于辨认个体与重叠边界 */}
        {showOutlines &&
          live.map((p) => {
            const poly = piecePoly(p.shape, p.rot, p.x, p.y);
            if (!poly) return null;
            const isDragged = p.id === drag?.id;
            return (
              <path
                key={p.id}
                d={polysToPath([poly])}
                fill="none"
                stroke={isDragged ? '#fff3c8' : '#ffe1a0'}
                strokeWidth={isDragged ? 0.09 : 0.045}
                strokeOpacity={isDragged ? 0.95 : 0.5}
              />
            );
          })}

      </g>

      {/* 拖拽中的拼图高亮描边：放在裁切层之外，拖出圆形视野（编辑摆放步）时仍可见 */}
      {dragPoly && (
        <path d={polysToPath([dragPoly])} fill="none" stroke="#ffffff" strokeWidth={0.06} strokeOpacity={0.9} strokeDasharray="0.2 0.14" />
      )}
    </svg>
  );
});

export default SrBoard;
