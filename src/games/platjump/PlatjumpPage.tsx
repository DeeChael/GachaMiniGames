// ============================================================
// 黄金替罪羊（崩坏：星穹铁道）—— 菜单 + 游戏
// WASD 控制金色角色，超过关卡步数后「过去的自己」复现你的前 N 步
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { Dir, PlatLevel } from './types';
import { TOGGLE_COLORS, cellKey } from './types';
import type { PlatState } from './engine';
import { buildCtx, createGame, heldButtons, stepGame, toggleCellOn } from './engine';
import { BUILTIN_LEVELS } from './levels';
import { decodePlatLevel } from './shareCode';
import {
  AltarTile,
  ButtonTile,
  LadderTile,
  NpcIcon,
  PlatformTile,
  PlayerIcon,
  SpawnTile,
  ToggleTile,
} from './Tiles';

// ---------------- 游戏主组件 ----------------

export function PlatjumpGame({
  level,
  test = false,
  onExit,
  onRestart,
}: {
  level: PlatLevel;
  test?: boolean; // 编辑器试玩模式：通关后返回编辑器解锁分享码
  onExit: () => void;
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  const ctx = useMemo(() => buildCtx(level), [level]);
  const [gs, setGs] = useState<PlatState>(() => createGame(level));
  // 各色按钮当前是否被踩住（决定可开关平台的有效状态）
  const held = heldButtons(ctx, gs.player, gs.npc);

  const cs = Math.max(28, Math.min(64, Math.floor(Math.min(760 / level.cols, 480 / level.rows))));
  const boardW = level.cols * cs;
  const boardH = level.rows * cs;

  const doStep = useCallback(
    (dir: Dir) => setGs((s) => stepGame(level, ctx, s, dir)),
    [level, ctx],
  );

  // 键盘 WASD 控制
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toUpperCase();
      if (k === 'W' || k === 'A' || k === 'S' || k === 'D') doStep(k as Dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doStep]);

  const reset = () => setGs(createGame(level));

  // 步数 HUD 状态
  const used = gs.history.length;
  const beforeShadow = Math.max(0, level.steps - used);
  const npcMoving = gs.npcSpawned && used - level.steps < level.steps && level.steps > 0;
  const flavor =
    gs.status !== 'playing'
      ? ''
      : !gs.npcSpawned
        ? `${beforeShadow} 步之后，过去的自己将化为敌人`
        : npcMoving || level.steps === 0
          ? '过去的自己，作为黑暗的化身出现'
          : '过去的自己走完了命运，不再前进';

  const posStyle = (c: [number, number]): React.CSSProperties => ({
    left: c[0] * cs,
    top: c[1] * cs,
    width: cs,
    height: cs,
    transition: 'left 0.16s ease-out, top 0.16s ease-out',
  });

  const pad = 28; // 场景周围边距
  const keyBtn = (d: Dir, label: string) => (
    <button
      onClick={() => doStep(d)}
      disabled={gs.status !== 'playing'}
      className="flex items-center justify-center border border-[#d8b44a]/50 bg-[#d8b44a]/10 text-[#e8d48a] hover:bg-[#d8b44a]/25 disabled:opacity-30"
      style={{ width: 52, height: 52, fontSize: 20 }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col items-center bg-[#0a0f1a] px-4 py-8 text-neutral-300 select-none">
      {/* 顶部信息栏 */}
      <div className="mb-5 flex w-full max-w-6xl items-center justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 黄金替罪羊{test && ' · 试玩'}</div>
          <h2 className="mt-1 text-2xl font-medium text-neutral-100">{level.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
            ↺ 重置
          </button>
          {test ? (
            <button
              onClick={() => navigate('/platjump/editor', { state: { level, passed: false } })}
              className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            >
              ← 返回编辑器
            </button>
          ) : (
            <>
              <button onClick={onRestart} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
                换一关
              </button>
              <button onClick={onExit} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
                ✕ 退出
              </button>
            </>
          )}
        </div>
      </div>

      {/* 步数 HUD */}
      <div className="mb-2 flex items-center gap-3 border border-[#d8b44a]/40 bg-[#141a28] px-5 py-2">
        <span style={{ fontSize: 20, filter: 'drop-shadow(0 0 6px rgba(232,196,64,0.8))' }}>🐑</span>
        <span className="text-lg font-bold text-[#e8d48a]">{beforeShadow}</span>
        <span className="flex gap-1.5">
          {Array.from({ length: level.steps }, (_, i) => (
            <span
              key={i}
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: i < Math.min(used, level.steps) ? '#d8b44a' : '#3a3630' }}
            />
          ))}
        </span>
      </div>
      <div className="mb-4 h-5 text-sm tracking-wider text-[#9db4d8]">{flavor}</div>

      <div className="flex items-end gap-8">
        {/* 屏幕 WASD 按钮 */}
        <div className="mb-2 grid grid-cols-3 gap-1.5" style={{ width: 172 }}>
          <div />
          {keyBtn('W', '▲')}
          <div />
          {keyBtn('A', '◀')}
          {keyBtn('S', '▼')}
          {keyBtn('D', '▶')}
        </div>

        {/* 场景（周围留边距） */}
        <div
          className="relative border border-[#2a3a58] bg-gradient-to-b from-[#101a30] to-[#0a1120]"
          style={{ width: boardW + pad * 2, height: boardH + pad * 2, boxShadow: '0 0 60px rgba(0,0,0,0.7), inset 0 0 40px rgba(20,40,90,0.3)' }}
        >
          <div className="absolute" style={{ left: pad, top: pad, width: boardW, height: boardH }}>
            {/* 瓦片层 */}
            {level.platforms.map(([x, y]) => (
              <div key={`p${x},${y}`} className="absolute" style={{ left: x * cs, top: y * cs, width: cs, height: cs }}>
                <PlatformTile cs={cs} />
              </div>
            ))}
            {level.toggles.map((t) => (
              <div key={`t${t.color}${t.pos}`} className="absolute" style={{ left: t.pos[0] * cs, top: t.pos[1] * cs, width: cs, height: cs }}>
                <ToggleTile cs={cs} color={t.color} on={toggleCellOn(ctx, held, t.pos[0], t.pos[1])} />
              </div>
            ))}
            {level.buttons.map((b) => (
              <div key={`b${b.color}${b.pos}`} className="absolute" style={{ left: b.pos[0] * cs, top: b.pos[1] * cs, width: cs, height: cs }}>
                <ButtonTile cs={cs} color={b.color} />
              </div>
            ))}
            {level.ladders.map(([x, y]) => (
              <div key={`l${x},${y}`} className="absolute" style={{ left: x * cs, top: y * cs, width: cs, height: cs }}>
                <LadderTile cs={cs} top={ctx.topRungs.has(cellKey(x, y))} />
              </div>
            ))}
            <div className="absolute" style={{ left: level.altar[0] * cs, top: level.altar[1] * cs, width: cs, height: cs }}>
              <AltarTile cs={cs} />
            </div>
            <div className="absolute" style={{ left: level.spawn[0] * cs, top: level.spawn[1] * cs, width: cs, height: cs }}>
              <SpawnTile cs={cs} />
            </div>

            {/* 角色层 */}
            {gs.npc && (
              <div className="absolute z-10 flex items-center justify-center" style={posStyle(gs.npc)}>
                <NpcIcon cs={cs} />
              </div>
            )}
            <div className="absolute z-20 flex items-center justify-center" style={posStyle(gs.player)}>
              <PlayerIcon cs={cs} />
            </div>
          </div>
        </div>
      </div>

      {/* 失败遮罩 */}
      {gs.status === 'lost' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="border border-red-500/50 bg-[#140c0c] px-12 py-10 text-center" style={{ boxShadow: '0 0 60px rgba(224,75,58,0.25)' }}>
            <div className="mb-2 text-xs tracking-[0.4em] text-red-400/70">// FALLEN</div>
            <div className="mb-8 text-3xl font-medium text-red-300">坠入深渊</div>
            <div className="flex justify-center gap-3">
              <button onClick={reset} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                ↺ 重试
              </button>
              {test ? (
                <button
                  onClick={() => navigate('/platjump/editor', { state: { level, passed: false } })}
                  className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400"
                >
                  ← 返回编辑器
                </button>
              ) : (
                <button onClick={onExit} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                  退出
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 胜利遮罩 */}
      {gs.status === 'won' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="border border-[#d8b44a]/50 bg-[#141008] px-12 py-10 text-center" style={{ boxShadow: '0 0 60px rgba(216,180,74,0.25)' }}>
            <div className="mb-2 text-xs tracking-[0.4em] text-[#d8b44a]/70">// ALTAR LIT</div>
            <div className="mb-8 text-3xl font-medium text-[#e8d48a]">点亮祭坛</div>
            <div className="flex justify-center gap-3">
              {test ? (
                <button
                  onClick={() => navigate('/platjump/editor', { state: { level, passed: true } })}
                  className="border border-[#d8b44a]/60 bg-[#d8b44a]/10 px-5 py-2.5 text-sm text-[#e8d48a] hover:bg-[#d8b44a]/20"
                >
                  ✓ 试玩通过，返回编辑器
                </button>
              ) : (
                <>
                  <button onClick={reset} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                    再玩一次
                  </button>
                  <button onClick={onRestart} className="border border-neutral-600 px-5 py-2.5 text-sm text-neutral-300 hover:border-neutral-400">
                    换一关
                  </button>
                  <button onClick={onExit} className="border border-[#d8b44a]/60 bg-[#d8b44a]/10 px-5 py-2.5 text-sm text-[#e8d48a] hover:bg-[#d8b44a]/20">
                    返回菜单
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

export default function PlatjumpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 初始关卡：编辑器试玩（state）或分享码链接（?code=）
  const initial = useMemo(() => {
    const st = location.state as { level?: PlatLevel; test?: boolean } | null;
    if (st?.level) return { level: st.level, test: !!st.test, error: '' };
    const code = searchParams.get('code');
    if (!code) return { level: null as PlatLevel | null, test: false, error: '' };
    try {
      return { level: decodePlatLevel(code), test: false, error: '' };
    } catch (e) {
      return { level: null as PlatLevel | null, test: false, error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [level, setLevel] = useState<PlatLevel | null>(initial.level);
  const [test] = useState(initial.test);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(initial.error);

  const startWithCode = () => {
    try {
      setLevel(decodePlatLevel(codeInput));
      setCodeError('');
    } catch (e) {
      setCodeError((e as Error).message);
    }
  };

  if (level) {
    return (
      <PlatjumpGame
        key={`${level.name}-${level.cols}x${level.rows}-${level.steps}`}
        level={level}
        test={test}
        onExit={() => setLevel(null)}
        onRestart={() => setLevel(null)}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0a0f1a] px-4 py-12 text-neutral-300">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <div className="text-xs tracking-[0.3em] text-neutral-500">// 崩坏：星穹铁道</div>
          <h1 className="mt-2 text-3xl font-medium text-neutral-100">黄金替罪羊</h1>
          <p className="mt-3 text-base text-neutral-500">
            规划命运，避开危险，点亮祭坛——超过步数之后，过去的自己将复现你的每一步
          </p>
        </div>

        <section className="mb-10">
          <h3 className="mb-4 text-sm tracking-[0.25em] text-neutral-500">游玩分享关卡</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="粘贴分享码（SPJ2_ 开头）"
              className="flex-1 border border-neutral-800 bg-[#141a28] px-4 py-3 text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-[#d8b44a]/50"
            />
            <button
              onClick={startWithCode}
              className="border border-[#d8b44a]/60 bg-[#d8b44a]/10 px-7 py-3 text-base text-[#e8d48a] hover:bg-[#d8b44a]/20"
            >
              开始
            </button>
            <button
              onClick={() => navigate('/platjump/editor')}
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
                className="border border-neutral-800 bg-[#141a28] px-5 py-5 text-left hover:border-[#d8b44a]/50"
              >
                <div className="text-base text-neutral-200">{lv.name}</div>
                <div className="mt-2 text-xs text-neutral-600">
                  {lv.cols}×{lv.rows} · {lv.steps} 步
                  {lv.toggles.length > 0 && ` · ${[...new Set(lv.toggles.map((t) => TOGGLE_COLORS[t.color].name))].join('/')}平台`}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
