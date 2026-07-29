// ============================================================
// 邦布维修（绝区零）—— 菜单 + 游戏
// 左键旋转中继器（上锁的需先把电通到钥匙点），
// 让电力沿连接线传到所有获电处即通关
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { Cell, Dir, PipeLevel } from './types';
import { DIRS, cellKey, dirToward, isRelay, simulate } from './types';
import { BarTile, KeyTile, LineTile, QuadTile, ReceiverTile, SourceTile } from './Tiles';
import { extentOf } from './types';
import { BUILTIN_LEVELS } from './levels';
import { decodePipeLevel, encodePipeLevel } from './shareCode';

const HOP_MS = 260; // 过电动画的每跳延迟

const startRotsOf = (level: PipeLevel): Record<string, number> => {
  const rots: Record<string, number> = {};
  for (const [k, el] of Object.entries(level.elements)) {
    if (isRelay(el)) rots[k] = el.startRot;
  }
  return rots;
};

// ---------------- 游戏主组件 ----------------

export function PipeGame({
  level,
  test = false,
  onExit,
  onBackToEditor,
}: {
  level: PipeLevel;
  test?: boolean; // 编辑器试玩模式：通关后返回编辑器解锁分享码
  onExit: () => void;
  onBackToEditor?: (passed: boolean) => void;
}) {
  const { rows, cols } = level;
  const [rots, setRots] = useState<Record<string, number>>(() => startRotsOf(level));
  const [won, setWon] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sim = useMemo(() => simulate(level, rots), [level, rots]);
  // 钥匙点一旦通电解锁，所有上锁中继器永久解锁（锁图标永久消失）
  const [unlockedOnce, setUnlockedOnce] = useState(false);

  useEffect(() => {
    if (sim.keyOn.size > 0 && !unlockedOnce) {
      setUnlockedOnce(true);
      setUnlocking(true);
      unlockTimer.current = setTimeout(() => setUnlocking(false), 500);
    }
  }, [sim.keyOn.size, unlockedOnce]);
  useEffect(
    () => () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    },
    [],
  );
  const unlocked = unlockedOnce;

  // 通关：等过电动画走完再弹出
  const maxHop = Math.max(0, ...sim.lineHop);
  useEffect(() => {
    if (!sim.done || won) return;
    const t = setTimeout(() => setWon(true), maxHop * HOP_MS + 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.done]);

  const reset = () => {
    setRots(startRotsOf(level));
    setWon(false);
    setUnlockedOnce(false);
  };

  // R 重置
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const cs = Math.max(36, Math.min(72, Math.floor(Math.min(720 / cols, 520 / rows))));
  const LINE_W = Math.max(5, cs * 0.07);
  const boardW = cols * cs;
  const boardH = rows * cs;

  const center = (c: Cell): [number, number] => [(c[0] + 0.5) * cs, (c[1] + 0.5) * cs];
  const extentAt = (k: string, dir: Dir): number => {
    const el = level.elements[k];
    if (!el) return 0;
    // 中继器所在格一律按最大半径（含触点伸出）避让
    if (isRelay(el)) return extentOf(el.kind, true);
    if (el.kind === 'key') return extentOf('key', el.dir === dir);
    return extentOf(el.kind, false);
  };

  // 某格子的亮灯延迟（由给它供电的线的 hop 决定）
  const delayOf = (k: string): number => {
    let h = 0;
    level.lines.forEach((l, i) => {
      if (sim.lineHop[i] < 0) return;
      if (cellKey(l.a[0], l.a[1]) === k || cellKey(l.b[0], l.b[1]) === k) {
        h = Math.max(h, sim.lineHop[i]);
      }
    });
    return h * HOP_MS;
  };

  const linesAt = (k: string): number[] => {
    const out: number[] = [];
    level.lines.forEach((l, i) => {
      if (cellKey(l.a[0], l.a[1]) === k || cellKey(l.b[0], l.b[1]) === k) out.push(i);
    });
    return out;
  };

  const sourceOn = (k: string) => linesAt(k).some((i) => sim.lineColors[i].size > 0);

  // 获电处：中环进度（已通电线数 / 总线数）与中心圆点
  const receiverProgress = (k: string): { progress: number; anyPower: boolean } => {
    const el = level.elements[k];
    if (!el || el.kind !== 'receiver') return { progress: 0, anyPower: false };
    const idxs = linesAt(k);
    const powered = idxs.filter((i) => {
      const l = level.lines[i];
      const d = cellKey(l.a[0], l.a[1]) === k ? dirToward(l.a, l.b) : dirToward(l.b, l.a);
      return sim.lineColors[i].has(el.blocks[d]);
    }).length;
    return {
      progress: idxs.length === 0 ? 0 : powered / idxs.length,
      anyPower: idxs.some((i) => sim.lineColors[i].size > 0),
    };
  };

  const rotateRelay = (k: string) => {
    if (won) return;
    const el = level.elements[k];
    if (!el || !isRelay(el)) return;
    if (el.locked && !unlocked) return; // 上锁的中继器不能旋转
    // 累计角度（不取模），保证旋转动画始终向前
    setRots((r) => ({ ...r, [k]: (r[k] ?? 0) + 1 }));
  };

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col items-center bg-[#0a0f0d] px-4 py-8 text-neutral-300 select-none">
      {/* 顶部信息栏 */}
      <div className="mb-6 flex w-full max-w-6xl items-center justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 邦布维修{test && ' · 试玩'}</div>
          <h2 className="mt-1 text-2xl font-medium text-neutral-100">{level.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            ↺ 重置 (R)
          </button>
          {test ? (
            <button onClick={() => onBackToEditor?.(false)} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
              ← 返回编辑器
            </button>
          ) : (
            <button onClick={onExit} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
              ✕ 返回
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 text-sm text-neutral-500">
        点击中继器旋转 90°，让电力传到所有获电处
        {Object.values(level.elements).some((e) => isRelay(e) && e.locked) && '；先把电通到钥匙点解锁上锁的中继器'}
      </div>

      {/* 棋盘（游玩时不显示格子线；点击中继器所在格任意位置都可旋转） */}
      <div className="rounded-lg border border-[#1e3a3a] bg-[#0d2424] p-3" style={{ boxShadow: '0 0 50px rgba(0,0,0,0.6), inset 0 0 40px rgba(10,40,40,0.4)' }}>
        <svg
          width={boardW}
          height={boardH}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const cx = Math.floor((e.clientX - rect.left) / cs);
            const cy = Math.floor((e.clientY - rect.top) / cs);
            if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) rotateRelay(cellKey(cx, cy));
          }}
        >
          {/* 连接线 */}
          {level.lines.map((l, i) => {
            const ka = cellKey(l.a[0], l.a[1]);
            const kb = cellKey(l.b[0], l.b[1]);
            const dirA = dirToward(l.a, l.b);
            const dirB = dirToward(l.b, l.a);
            const [ax, ay] = center(l.a);
            const [bx, by] = center(l.b);
            const ea = extentAt(ka, dirA) * cs + LINE_W;
            const eb = extentAt(kb, dirB) * cs + LINE_W;
            return (
              <LineTile
                key={i}
                x1={ax + DIRS[dirA][0] * ea}
                y1={ay + DIRS[dirA][1] * ea}
                x2={bx + DIRS[dirB][0] * eb}
                y2={by + DIRS[dirB][1] * eb}
                w={LINE_W}
                colors={sim.lineColors[i]}
                delay={Math.max(0, sim.lineHop[i]) * HOP_MS}
              />
            );
          })}
          {/* 控件 */}
          {Object.entries(level.elements).map(([k, el]) => {
            const [x, y] = k.split(',').map(Number);
            const delay = delayOf(k);
            const rotatable = isRelay(el) && (!el.locked || unlocked);
            return (
              <g key={k} transform={`translate(${x * cs}, ${y * cs})`} style={{ cursor: rotatable ? 'pointer' : 'default' }}>
                {el.kind === 'source' && <SourceTile s={cs} el={el} powered={sourceOn(k)} />}
                {el.kind === 'receiver' && (
                  <ReceiverTile
                    s={cs}
                    el={el}
                    lit={sim.lit[k] ?? new Set()}
                    progress={receiverProgress(k).progress}
                    anyPower={receiverProgress(k).anyPower}
                    delay={delay}
                  />
                )}
                {el.kind === 'bar' && (
                  <BarTile s={cs} el={el} rot={rots[k] ?? 0} on={sim.relayOn.has(k)} unlocking={el.locked && unlocking} unlocked={unlocked} delay={delay} />
                )}
                {el.kind === 'quad' && (
                  <QuadTile s={cs} el={el} rot={rots[k] ?? 0} on={sim.relayOn.has(k)} unlocking={el.locked && unlocking} unlocked={unlocked} delay={delay} />
                )}
                {el.kind === 'key' && <KeyTile s={cs} el={el} on={sim.keyOn.has(k)} delay={delay} />}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 胜利遮罩 */}
      {won && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="border border-[#7cee94]/50 bg-[#0c1410] px-12 py-10 text-center" style={{ boxShadow: '0 0 60px rgba(124,238,148,0.25)' }}>
            <div className="mb-2 text-xs tracking-[0.4em] text-[#7cee94]/70">// REPAIR COMPLETE</div>
            <div className="mb-8 text-3xl font-medium text-[#a8f2b8]">维修完成</div>
            <div className="flex justify-center gap-3">
              {test ? (
                <button
                  onClick={() => onBackToEditor?.(true)}
                  className="border border-[#7cee94]/60 bg-[#7cee94]/10 px-5 py-2.5 text-sm text-[#7cee94] hover:bg-[#7cee94]/20"
                >
                  ✓ 试玩通过，返回编辑器
                </button>
              ) : (
                <>
                  <button onClick={reset} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                    再玩一次
                  </button>
                  <button onClick={onExit} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                    返回
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- 模块入口（菜单 + 游戏） ----------------

export default function PipePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 初始关卡：编辑器试玩（state）或分享码链接（?code=）
  const initial = useMemo(() => {
    const st = location.state as { level?: PipeLevel; test?: boolean; editor?: unknown } | null;
    if (st?.level) return { level: st.level, test: !!st.test, editor: st.editor ?? null, error: '' };
    const code = searchParams.get('code');
    if (!code) return { level: null as PipeLevel | null, test: false, editor: null as unknown, error: '' };
    try {
      return { level: decodePipeLevel(code), test: false, editor: null as unknown, error: '' };
    } catch (e) {
      return { level: null as PipeLevel | null, test: false, editor: null as unknown, error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [level, setLevel] = useState<PipeLevel | null>(initial.level);
  const [test, setTest] = useState(initial.test);
  const [editorState, setEditorState] = useState<unknown>(initial.editor);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(initial.error);

  const startWithCode = () => {
    try {
      setLevel(decodePipeLevel(codeInput));
      setCodeError('');
    } catch (e) {
      setCodeError((e as Error).message);
    }
  };

  if (level) {
    return (
      <PipeGame
        key={`${encodePipeLevel(level)}-${test}`}
        level={level}
        test={test}
        onExit={() => {
          setLevel(null);
          setTest(false);
          setEditorState(null);
        }}
        onBackToEditor={(passed) => navigate('/pipe/editor', { state: { editor: editorState, passed } })}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0a0f0d] px-4 py-12 text-neutral-300">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 绝区零</div>
          <h1 className="mt-2 text-3xl font-medium text-neutral-100">邦布维修</h1>
          <p className="mt-3 text-base text-neutral-500">
            从电源传输所有电力到目标点，修复邦布
          </p>
        </div>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">游玩分享关卡</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="粘贴分享码（ZBP1_ 开头）"
              className="flex-1 border border-neutral-800 bg-[#121917] px-4 py-3 text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-[#7cee94]/50"
            />
            <button
              onClick={startWithCode}
              className="border border-[#7cee94]/60 bg-[#7cee94]/10 px-7 py-3 text-base text-[#7cee94] hover:bg-[#7cee94]/20"
            >
              开始
            </button>
            <button
              onClick={() => navigate('/pipe/editor')}
              className="border border-neutral-700 px-7 py-3 text-base text-neutral-300 hover:border-neutral-500"
            >
              ✚ 创建关卡
            </button>
          </div>
          {codeError && <div className="mt-2 text-sm text-red-400">{codeError}</div>}
        </section>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">内置关卡</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {BUILTIN_LEVELS.map((lv, i) => (
              <button
                key={i}
                onClick={() => setLevel(lv)}
                className="border border-neutral-800 bg-[#121917] px-5 py-5 text-left hover:border-[#7cee94]/50"
              >
                <div className="text-base text-neutral-200">{lv.name}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
