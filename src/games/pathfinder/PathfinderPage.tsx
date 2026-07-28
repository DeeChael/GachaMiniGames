// ============================================================
// 邦布维修 2.0（绝区零 · 寻路）—— 菜单 + 游戏
// WASD / 方向键 / 点击相邻格移动；走过的格子不能重走，
// 倒着走可以回退；踩旋转按钮把所有未经过的管道顺时针转 90°
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { Cell, Dir, PathLevel } from './types';
import { DIRS, C, canPass, cellKey, kindAt, tubeAt } from './types';
import { CellBase, CheckpointTile, DenyTile, DestTile, GlowOverlay, PathArrow, RotateTile, StartTile, TubeTile } from './Tiles';
import { BUILTIN_LEVELS } from './levels';
import { decodePathLevel, encodePathLevel } from './shareCode';

const kOf = (c: Cell) => cellKey(c[0], c[1]);

const initRots = (level: PathLevel): Record<string, number> => {
  const rots: Record<string, number> = {};
  for (const t of level.tubes) rots[kOf(t.pos)] = t.rot;
  return rots;
};

// ---------------- 游戏主组件 ----------------

export function PathfinderGame({
  level,
  test = false,
  onExit,
  onBackToEditor,
}: {
  level: PathLevel;
  test?: boolean; // 编辑器试玩模式：通关后返回编辑器解锁分享码
  onExit: () => void;
  onBackToEditor?: () => void;
}) {
  const { rows, cols } = level;
  const [path, setPath] = useState<Cell[]>(() => [[...level.start]]);
  const [rots, setRots] = useState<Record<string, number>>(() => initRots(level));
  // 每一步对应的管道朝向历史（回退时恢复，即未经过的管道逆时针转回）
  const [rotsHistory, setRotsHistory] = useState<Record<string, number>[]>(() => [initRots(level)]);
  const [won, setWon] = useState(false);

  const pathKeys = useMemo(() => new Set(path.map(kOf)), [path]);
  const pos = path[path.length - 1];
  const passedCheckpoints = level.checkpoints.filter((c) => pathKeys.has(kOf(c))).length;

  const reset = () => {
    setPath([[...level.start]]);
    setRots(initRots(level));
    setRotsHistory([initRots(level)]);
    setWon(false);
  };

  const backtrack = () => {
    if (path.length <= 1) return;
    const nh = rotsHistory.slice(0, -1);
    setRotsHistory(nh);
    setRots(nh[nh.length - 1]); // 恢复上一步的管道朝向（踩旋转按钮造成的旋转被撤销）
    setPath((p) => p.slice(0, -1));
  };

  const tryMove = (dir: Dir) => {
    if (won) return;
    const to: Cell = [pos[0] + DIRS[dir][0], pos[1] + DIRS[dir][1]];
    const tk = kOf(to);
    // 回退：倒着走回上一格
    if (path.length > 1 && kOf(path[path.length - 2]) === tk) {
      backtrack();
      return;
    }
    if (pathKeys.has(tk)) return; // 走过的格子不能重走
    // 没有踩完所有检查点不能进入终点
    if (kindAt(level, to[0], to[1]) === 'dest' && !level.checkpoints.every((c) => pathKeys.has(kOf(c)))) return;
    if (!canPass(level, rots, pos, dir)) return;
    // 走上旋转按钮：所有还未经过的管道顺时针旋转
    const nRots = { ...rots };
    if (kindAt(level, to[0], to[1]) === 'rotate') {
      for (const t of level.tubes) {
        const k = kOf(t.pos);
        if (!pathKeys.has(k)) nRots[k] = (nRots[k] ?? t.rot) + 1;
      }
    }
    setRots(nRots);
    setRotsHistory((h) => [...h, nRots]);
    setPath((p) => [...p, to]);
    if (
      kindAt(level, to[0], to[1]) === 'dest' &&
      level.checkpoints.every((c) => pathKeys.has(kOf(c)))
    ) {
      setTimeout(() => setWon(true), 350);
    }
  };

  const undo = backtrack;

  // 键盘：WASD / 方向键移动，Z / Backspace 回退，R 重置
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      const dirMap: Record<string, Dir> = {
        w: 0, arrowup: 0, d: 1, arrowright: 1, s: 2, arrowdown: 2, a: 3, arrowleft: 3,
      };
      if (dirMap[k] !== undefined) {
        e.preventDefault();
        tryMove(dirMap[k]);
      } else if (k === 'z' || k === 'backspace') {
        e.preventDefault();
        undo();
      } else if (k === 'r') {
        reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, rots, won]);

  const cs = Math.max(40, Math.min(72, Math.floor(Math.min(680 / cols, 500 / rows))));
  const gap = Math.max(4, cs * 0.08);

  // 点击相邻格移动
  const clickCell = (x: number, y: number) => {
    const dx = x - pos[0];
    const dy = y - pos[1];
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    tryMove((dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0) as Dir);
  };

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col items-center bg-[#0a0f0d] px-4 py-8 text-neutral-300 select-none">
      {/* 顶部信息栏 */}
      <div className="mb-6 flex w-full max-w-6xl items-center justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 邦布维修 2.0{test && ' · 试玩'}</div>
          <h2 className="mt-1 text-2xl font-medium text-neutral-100">{level.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={path.length <= 1} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-30">
            ← 回退 (Z)
          </button>
          <button onClick={reset} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            ↺ 重置 (R)
          </button>
          {test ? (
            <button onClick={onBackToEditor} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
              ← 返回编辑器
            </button>
          ) : (
            <button onClick={onExit} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
              ✕ 返回
            </button>
          )}
        </div>
      </div>

      {/* 检查点计数（没有检查点时不显示） */}
      {level.checkpoints.length > 0 && (
        <div className="mb-4 flex items-center gap-2 border border-[#f5a623]/40 bg-[#121917] px-4 py-1.5">
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
          <g stroke={C.orange} strokeWidth={2.6} strokeLinecap="round">
            <path d="M5 5 L19 19 M19 5 L5 19" />
          </g>
          <g fill={C.orange}>
            <circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
          </g>
        </svg>
        <span className="text-base font-bold text-[#f5a623]">
          {String(passedCheckpoints).padStart(2, '0')}/{String(level.checkpoints.length).padStart(2, '0')}
        </span>
        </div>
      )}

      {/* 棋盘 */}
      <div className="rounded-lg border border-[#1e3a3a] bg-[#0b1a20] p-3" style={{ boxShadow: '0 0 50px rgba(0,0,0,0.6)' }}>
        <div className="relative" style={{ width: cols * (cs + gap) - gap, height: rows * (cs + gap) - gap }}>
          {Array.from({ length: rows }, (_, y) =>
            Array.from({ length: cols }, (_, x) => {
              const k = cellKey(x, y);
              const kind = kindAt(level, x, y);
              const passed = pathKeys.has(k);
              const current = pos[0] === x && pos[1] === y;
              const tube = tubeAt(level, x, y);
              return (
                <div
                  key={k}
                  onClick={() => clickCell(x, y)}
                  className="absolute"
                  style={{ left: x * (cs + gap), top: y * (cs + gap), width: cs, height: cs, cursor: Math.abs(x - pos[0]) + Math.abs(y - pos[1]) === 1 ? 'pointer' : 'default' }}
                >
                  <CellBase s={cs} passed={passed && kind !== 'start'} corners={kind === 'normal'} />
                  {kind === 'start' && <StartTile s={cs} />}
                  {kind === 'dest' && <DestTile s={cs} arrived={won || passed} />}
                  {kind === 'checkpoint' && <CheckpointTile s={cs} passed={passed} />}
                  {kind === 'deny' && <DenyTile />}
                  {kind === 'rotate' && <RotateTile passed={passed} />}
                  {tube && <TubeTile s={cs} kind={tube.kind} rot={rots[k] ?? tube.rot} passed={passed} />}
                  {/* 当前所在格的白色辉光（起点也有） */}
                  {current && <GlowOverlay s={cs} />}
                </div>
              );
            }),
          )}
          {/* 路径箭头：两个相邻格子之间的白色三角（居中于交界处） */}
          {path.slice(1).map((c, i) => {
            const prev = path[i];
            const dir: Dir = c[0] > prev[0] ? 1 : c[0] < prev[0] ? 3 : c[1] > prev[1] ? 2 : 0;
            const mx = (prev[0] + c[0] + 1) / 2;
            const my = (prev[1] + c[1] + 1) / 2;
            const as = cs * 0.55;
            return (
              <div key={`${kOf(c)}-arrow`} className="absolute" style={{ left: mx * (cs + gap) - as / 2, top: my * (cs + gap) - as / 2 }}>
                <PathArrow s={as} dir={dir} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 text-sm text-neutral-500">WASD / 方向键 / 点击相邻格移动</div>

      {/* 胜利遮罩 */}
      {won && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="border border-[#19d8a0]/50 bg-[#0c1410] px-12 py-10 text-center" style={{ boxShadow: '0 0 60px rgba(25,216,160,0.25)' }}>
            <div className="mb-2 text-xs tracking-[0.4em] text-[#19d8a0]/70">// REPAIR COMPLETE</div>
            <div className="mb-8 text-3xl font-medium text-[#7dedc8]">维修完成</div>
            <div className="flex justify-center gap-3">
              {test ? (
                <button
                  onClick={onBackToEditor}
                  className="border border-[#19d8a0]/60 bg-[#19d8a0]/10 px-5 py-2.5 text-sm text-[#19d8a0] hover:bg-[#19d8a0]/20"
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

export default function PathfinderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 初始关卡：编辑器试玩（state）或分享码链接（?code=）
  const initial = useMemo(() => {
    const st = location.state as { level?: PathLevel; test?: boolean; editor?: unknown } | null;
    if (st?.level) return { level: st.level, test: !!st.test, editor: st.editor ?? null, error: '' };
    const code = searchParams.get('code');
    if (!code) return { level: null as PathLevel | null, test: false, editor: null as unknown, error: '' };
    try {
      return { level: decodePathLevel(code), test: false, editor: null as unknown, error: '' };
    } catch (e) {
      return { level: null as PathLevel | null, test: false, editor: null as unknown, error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [level, setLevel] = useState<PathLevel | null>(initial.level);
  const [test, setTest] = useState(initial.test);
  const [editorState, setEditorState] = useState<unknown>(initial.editor);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(initial.error);

  const startWithCode = () => {
    try {
      setLevel(decodePathLevel(codeInput));
      setCodeError('');
    } catch (e) {
      setCodeError((e as Error).message);
    }
  };

  if (level) {
    return (
      <PathfinderGame
        key={`${encodePathLevel(level)}-${test}`}
        level={level}
        test={test}
        onExit={() => {
          setLevel(null);
          setTest(false);
          setEditorState(null);
        }}
        onBackToEditor={() => navigate('/pathfinder/editor', { state: { editor: editorState } })}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0a0f0d] px-4 py-12 text-neutral-300">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 绝区零</div>
          <h1 className="mt-2 text-3xl font-medium text-neutral-100">邦布维修 2.0</h1>
          <p className="mt-3 text-base text-neutral-500">
            从起点出发经过所有检查点到达终点。走过的格子不能重走，可以倒着走回退；管道只能从开口进出，旋转按钮会把未经过的管道顺时针转 90°
          </p>
        </div>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">游玩分享关卡</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="粘贴分享码（ZPF1_ 开头）"
              className="flex-1 border border-neutral-800 bg-[#121917] px-4 py-3 text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-[#19d8a0]/50"
            />
            <button
              onClick={startWithCode}
              className="border border-[#19d8a0]/60 bg-[#19d8a0]/10 px-7 py-3 text-base text-[#19d8a0] hover:bg-[#19d8a0]/20"
            >
              开始
            </button>
            <button
              onClick={() => navigate('/pathfinder/editor')}
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
                className="border border-neutral-800 bg-[#121917] px-5 py-5 text-left hover:border-[#19d8a0]/50"
              >
                <div className="text-base text-neutral-200">{lv.name}</div>
                <div className="mt-2 text-xs text-neutral-600">
                  {lv.cols}×{lv.rows} · {lv.checkpoints.length} 检查点 · {lv.tubes.length} 管道
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
