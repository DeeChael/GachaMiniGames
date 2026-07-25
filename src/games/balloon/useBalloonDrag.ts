// ============================================================
// 浮空回收 —— 气球拖拽 hook（游戏页与编辑器共用）
// 从库存拖入网格放置；拖动已放置的气球可移动，拖出网格即取下
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { BalloonValue } from './types';

export interface BalloonDrag {
  value: BalloonValue;
  from: string | null; // 移动已放置气球时的来源格 key（null = 来自库存）
  pointer: { x: number; y: number };
  hover: { x: number; y: number } | null;
  valid: boolean;
  inside: boolean; // 指针是否在网格区域内
}

export function useBalloonDrag({
  boardRef,
  grid,
  step,
  cell,
  project,
  canDrop,
  onDrop,
  onRemove,
}: {
  boardRef: RefObject<HTMLDivElement | null>;
  grid: number; // 棋盘边长
  step: number; // 格距（格宽 + 缝隙）
  cell: number; // 格宽
  /** 屏幕坐标（棋盘容器相对）→ 棋盘平面坐标（棋盘 3D 倾斜时用于修正命中） */
  project?: (lx: number, ly: number) => { x: number; y: number } | null;
  canDrop: (x: number, y: number, from: string | null) => boolean;
  onDrop: (value: BalloonValue, from: string | null, x: number, y: number) => void;
  onRemove: (from: string) => void;
}) {
  const [drag, setDrag] = useState<BalloonDrag | null>(null);
  const dragRef = useRef<BalloonDrag | null>(null);
  useEffect(() => { dragRef.current = drag; }, [drag]);

  const update = useCallback(
    (clientX: number, clientY: number, d: BalloonDrag): BalloonDrag => {
      const board = boardRef.current;
      if (!board) {
        return { ...d, pointer: { x: clientX, y: clientY }, hover: null, valid: false, inside: false };
      }
      const rect = board.getBoundingClientRect();
      const lx = clientX - rect.left;
      const ly = clientY - rect.top;
      const inside = lx >= 0 && ly >= 0 && lx <= rect.width && ly <= rect.height;
      let hover: BalloonDrag['hover'] = null;
      let valid = false;
      if (inside) {
        // 棋盘倾斜时先把屏幕坐标逆投影回棋盘平面
        const p = project ? project(lx, ly) : { x: lx, y: ly };
        if (p) {
          const gx = Math.floor(p.x / step);
          const gy = Math.floor(p.y / step);
          // 指针落在缝隙里不算悬停任何格子
          if (gx >= 0 && gx < grid && gy >= 0 && gy < grid && p.x - gx * step <= cell && p.y - gy * step <= cell) {
            hover = { x: gx, y: gy };
            valid = canDrop(gx, gy, d.from);
          }
        }
      }
      return { ...d, pointer: { x: clientX, y: clientY }, hover, valid, inside };
    },
    [boardRef, grid, step, cell, project, canDrop],
  );

  const startDrag = useCallback(
    (value: BalloonValue, from: string | null, clientX: number, clientY: number) => {
      setDrag(
        update(clientX, clientY, {
          value,
          from,
          pointer: { x: clientX, y: clientY },
          hover: null,
          valid: false,
          inside: false,
        }),
      );
    },
    [update],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => setDrag((d) => (d ? update(e.clientX, e.clientY, d) : d));
    const onUp = (e: PointerEvent) => {
      // 注意：副作用不能放在 setDrag 的 updater 里（StrictMode 会双调用）
      const d = dragRef.current;
      if (!d) return;
      const f = update(e.clientX, e.clientY, d);
      if (f.hover && f.valid) {
        onDrop(f.value, f.from, f.hover.x, f.hover.y);
      } else if (f.from && !f.inside) {
        // 已放置的气球被拖出网格：取下
        onRemove(f.from);
      }
      setDrag(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag !== null, update, onDrop, onRemove]);

  return { drag, startDrag };
}
