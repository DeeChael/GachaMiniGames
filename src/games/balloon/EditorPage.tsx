// ============================================================
// 浮空回收 —— 关卡编辑器
// 左侧网格：切换可放置格 + 摆放气球（即关卡的解，必须升力平衡）
// 右侧：四种气球的 stepper 加减数量；所有气球都必须放上网格
// ============================================================

import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { BalloonLevel, BalloonValue, Placed } from './types';
import {
  BALLOON_INFO,
  BALLOON_VALUES,
  GRID,
  cellKey,
  cellShade,
  validateBalloonLevel,
} from './types';
import { BalloonIcon } from './BalloonPage';
import { encodeBalloonLevel } from './shareCode';
import { useBalloonDrag } from './useBalloonDrag';

type Tool = 'place' | 'toggle';

const CELL = 56;
const GAP = 8;
const STEP = CELL + GAP;

export default function BalloonEditorPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('我的关卡');
  const [placeable, setPlaceable] = useState<Set<string>>(
    () => new Set(Array.from({ length: GRID * GRID }, (_, i) => cellKey(i % GRID, Math.floor(i / GRID)))),
  );
  const [counts, setCounts] = useState<Record<BalloonValue, number>>({ 1: 0, 2: 0, 3: 0, 6: 0 });
  const [placed, setPlaced] = useState<Record<string, BalloonValue>>({});
  const [tool, setTool] = useState<Tool>('place');
  const boardRef = useRef<HTMLDivElement>(null);
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);

  const placedList: Placed[] = useMemo(
    () =>
      Object.entries(placed).map(([k, value]) => {
        const [x, y] = k.split(',').map(Number);
        return { x, y, value };
      }),
    [placed],
  );

  const level: BalloonLevel = useMemo(
    () => ({
      name: name.trim() || '自定义关卡',
      placeable: [...placeable].map((k) => k.split(',').map(Number) as [number, number]),
      balloons: BALLOON_VALUES.flatMap((v) => Array.from({ length: counts[v] }, () => v)),
    }),
    [name, placeable, counts],
  );

  const errors = validateBalloonLevel(level, placedList);

  const remaining = (v: BalloonValue) =>
    counts[v] - Object.values(placed).filter((b) => b === v).length;

  const bump = (v: BalloonValue, d: number) =>
    setCounts((c) => ({ ...c, [v]: Math.max(0, Math.min(12, c[v] + d)) }));

  // ---------------- 拖拽放置 ----------------

  const canDrop = useCallback(
    (x: number, y: number, from: string | null) => {
      const k = cellKey(x, y);
      return placeable.has(k) && (!placed[k] || k === from);
    },
    [placeable, placed],
  );
  const onDrop = useCallback(
    (value: BalloonValue, from: string | null, x: number, y: number) => {
      const k = cellKey(x, y);
      if (from === k) return; // 拖回原位
      // 从库存拖出且余量不足时，放置成功后库存自动 +1
      if (from === null) {
        const placedV = Object.values(placed).filter((b) => b === value).length;
        setCounts((c) => (placedV + 1 > c[value] ? { ...c, [value]: c[value] + 1 } : c));
      }
      setPlaced((p) => {
        const np = { ...p };
        if (from) delete np[from];
        np[k] = value;
        return np;
      });
    },
    [placed],
  );
  const onRemove = useCallback((from: string) => {
    setPlaced((p) => {
      const np = { ...p };
      delete np[from];
      return np;
    });
  }, []);
  const { drag, startDrag } = useBalloonDrag({ boardRef, step: STEP, cell: CELL, canDrop, onDrop, onRemove });

  const onCellClick = (x: number, y: number) => {
    if (tool !== 'toggle') return;
    const k = cellKey(x, y);
    if (placed[k]) return; // 有气球占着，先移除再切换
    setPlaceable((s) => {
      const ns = new Set(s);
      if (ns.has(k)) ns.delete(k);
      else ns.add(k);
      return ns;
    });
  };

  const play = () => {
    navigate('/balloon', { state: { level } });
  };

  const generate = () => {
    setShareCode(encodeBalloonLevel(level));
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
    <div className="min-h-[calc(100vh-65px)] bg-[#0b0e09] px-4 py-10 text-neutral-300 select-none">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.3em] text-neutral-500">// 浮空回收 · 关卡编辑器</div>
            <h1 className="mt-2 text-2xl font-medium text-neutral-100">制作我的关卡</h1>
          </div>
          <button onClick={() => navigate('/balloon')} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500">
            ✕ 返回
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* 左：网格 */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {toolBtn('place', '🎈 放置气球')}
              {toolBtn('toggle', '▦ 切换可放置格')}
            </div>
            <div className="mb-4 text-xs text-neutral-600">
              {tool === 'place' && '右侧气球行把气球拖进网格放置'}
              {tool === 'toggle' && '点击格子切换是否允许放置气球（有气球占用的格子需先移除气球）'}
            </div>

            <div
              ref={boardRef}
              className="relative inline-block"
              style={{ width: GRID * STEP - GAP, height: GRID * STEP - GAP }}
            >
              {Array.from({ length: GRID }, (_, y) =>
                Array.from({ length: GRID }, (_, x) => {
                  const k = cellKey(x, y);
                  const canPlace = placeable.has(k);
                  const b = placed[k];
                  return (
                    <div
                      key={k}
                      onClick={() => onCellClick(x, y)}
                      onPointerDown={(e) => {
                        if (tool === 'place' && b) {
                          e.preventDefault();
                          startDrag(b, k, e.clientX, e.clientY);
                        }
                      }}
                      className="absolute flex items-center justify-center"
                      style={{
                        left: x * STEP,
                        top: y * STEP,
                        width: CELL,
                        height: CELL,
                        background: cellShade(x, y),
                        border: canPlace ? '2px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.45)',
                        cursor: tool === 'toggle' ? 'pointer' : b ? 'grab' : 'default',
                        touchAction: 'none',
                        opacity: canPlace ? 1 : 0.55,
                      }}
                    >
                      {canPlace && !b && (
                        <span className="rounded-full" style={{ width: 7, height: 7, background: '#e8d44d', boxShadow: '0 0 5px #e8d44d' }} />
                      )}
                      {b && drag?.from !== k && <BalloonIcon value={b} size={CELL * 0.78} />}
                    </div>
                  );
                }),
              )}
              {/* 拖拽悬停高亮 */}
              {drag && drag.hover && (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: drag.hover.x * STEP,
                    top: drag.hover.y * STEP,
                    width: CELL,
                    height: CELL,
                    border: `3px solid ${drag.valid ? '#a6e22e' : '#e04b3a'}`,
                    background: drag.valid ? 'rgba(166,226,46,0.15)' : 'rgba(224,75,58,0.15)',
                    zIndex: 6,
                  }}
                />
              )}
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

            {/* 气球 stepper */}
            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">气球库存</label>
              <div className="space-y-2">
                {[...BALLOON_VALUES].reverse().map((v) => (
                  <div
                    key={v}
                    onPointerDown={(e) => {
                      if (tool === 'place') {
                        e.preventDefault();
                        startDrag(v, null, e.clientX, e.clientY);
                      }
                    }}
                    className={`flex w-full items-center gap-3 border border-neutral-800 px-3 py-2.5 transition-colors ${
                      tool === 'place' ? 'cursor-grab hover:border-neutral-600' : ''
                    }`}
                    style={{ touchAction: 'none' }}
                  >
                    <BalloonIcon value={v} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-neutral-200">{BALLOON_INFO[v].name}</div>
                      <div className="mt-0.5 text-xs text-neutral-500">
                        [升力...{v}⬆]{counts[v] > 0 && ` · 已放置 ${counts[v] - remaining(v)}/${counts[v]}`}
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => bump(v, -1)}
                        disabled={counts[v] === 0}
                        className="flex h-7 w-7 items-center justify-center border border-neutral-700 text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-base font-bold text-neutral-200">{counts[v]}</span>
                      <button
                        onClick={() => bump(v, 1)}
                        disabled={counts[v] >= 12}
                        className="flex h-7 w-7 items-center justify-center border border-neutral-700 text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                ))}
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
                <div className="mb-3 text-xs text-[#a6e22e]">✓ 关卡合法：气球全部放置且升力平衡</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={generate}
                  disabled={errors.length > 0}
                  className="flex-1 border border-[#a6e22e]/60 bg-[#a6e22e]/10 px-4 py-3 text-base text-[#a6e22e] hover:bg-[#a6e22e]/20 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  生成分享码
                </button>
                <button
                  onClick={play}
                  disabled={errors.length > 0}
                  className="flex-1 border border-neutral-700 px-4 py-3 text-base text-neutral-300 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  立即试玩 →
                </button>
              </div>
              {shareCode && (
                <div className="mt-4">
                  <textarea
                    readOnly
                    value={shareCode}
                    rows={3}
                    onFocus={(e) => e.target.select()}
                    className="w-full resize-none border border-neutral-800 bg-[#14170f] p-3 font-mono text-xs break-all text-neutral-400 outline-none"
                  />
                  <button
                    onClick={copyCode}
                    className="mt-2 w-full border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:border-neutral-500"
                  >
                    {copied ? '✓ 已复制' : '复制分享码'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 拖拽跟随幽灵 */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: drag.pointer.x - (CELL * 0.78) / 2, top: drag.pointer.y - (CELL * 0.78) / 2, opacity: 0.85 }}
        >
          <BalloonIcon value={drag.value} size={CELL * 0.78} />
        </div>
      )}
    </div>
  );
}
