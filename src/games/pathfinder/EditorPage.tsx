// ============================================================
// 邦布维修 2.0 —— 关卡编辑器
// 快捷键：1 起点 2 终点 3 禁止方块 4 检查点；Ctrl+1 旋转按钮
// Ctrl+2 直管 Ctrl+3 L 管；悬停管道按 R 调整默认朝向；右键清除
// 需要试玩通关才能生成分享码
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Cell, PathLevel, TubeDef } from './types';
import { MAX_GRID, MIN_GRID, cellKey, kindAt, tubeAt, validatePathLevel } from './types';
import { CellBase, CheckpointTile, DenyTile, DestTile, RotateTile, StartTile, TubeTile } from './Tiles';
import { encodePathLevel } from './shareCode';

type Tool = 'start' | 'dest' | 'deny' | 'checkpoint' | 'rotate' | 'tube' | 'ltube';

const TOOLS: [Tool, string, string][] = [
  ['start', '起点', '1'],
  ['dest', '终点', '2'],
  ['deny', '禁止方块', '3'],
  ['checkpoint', '检查点', '4'],
  ['rotate', '旋转按钮', '^1'],
  ['tube', '直管', '^2'],
  ['ltube', 'L 管', '^3'],
];

interface EditorState {
  name: string;
  rows: number;
  cols: number;
  start: Cell;
  dest: Cell;
  denies: string[];
  checkpoints: string[];
  rotates: string[];
  tubes: [string, { kind: 'tube' | 'ltube'; rot: number }][];
  testPassed: boolean;
}

const kOf = (c: Cell) => cellKey(c[0], c[1]);

export default function PathfinderEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // 试玩通关返回时：还原关卡并解锁分享码
  const init = useMemo(() => {
    const st = location.state as { editor?: EditorState; passed?: boolean } | null;
    if (!st?.editor) return null;
    return { editor: st.editor, passed: !!st.passed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState(init?.editor.name ?? '我的关卡');
  const [rows, setRows] = useState(init?.editor.rows ?? 6);
  const [cols, setCols] = useState(init?.editor.cols ?? 6);
  const [start, setStart] = useState<Cell>(init?.editor.start ?? [0, 0]);
  const [dest, setDest] = useState<Cell>(init?.editor.dest ?? [5, 5]);
  const [denies, setDenies] = useState<Set<string>>(new Set(init?.editor.denies ?? []));
  const [checkpoints, setCheckpoints] = useState<Set<string>>(new Set(init?.editor.checkpoints ?? []));
  const [rotates, setRotates] = useState<Set<string>>(new Set(init?.editor.rotates ?? []));
  const [tubes, setTubes] = useState<Map<string, { kind: 'tube' | 'ltube'; rot: number }>>(
    () => new Map(init?.editor.tubes ?? []),
  );
  const [testPassed, setTestPassed] = useState(init?.editor.testPassed ?? init?.passed ?? false);
  // 显示用的累计旋转角（驱动连续顺时针动画；逻辑朝向另存为 0~3）
  const [animRots, setAnimRots] = useState<Record<string, number>>({});

  const [tool, setTool] = useState<Tool>('deny');
  const [hover, setHover] = useState<Cell | null>(null);
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);

  const dirty = () => {
    setTestPassed(false);
    setShareCode('');
  };

  // 快捷键：1~4 前四个，Ctrl+1~3 后三个；悬停管道按 R 旋转默认朝向
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        if (hover) {
          const k = kOf(hover);
          const t = tubes.get(k);
          if (t) {
            dirty();
            setTubes((prev) => new Map(prev).set(k, { ...t, rot: (t.rot + 1) % 4 }));
            setAnimRots((prev) => ({ ...prev, [k]: (prev[k] ?? t.rot) + 1 }));
          }
        }
        return;
      }
      const n = Number(e.key);
      if (!n) return;
      if (e.ctrlKey || e.metaKey) {
        const idx = 4 + n - 1;
        if (idx < TOOLS.length) {
          e.preventDefault();
          setTool(TOOLS[idx][0]);
        }
      } else if (n <= 4) {
        setTool(TOOLS[n - 1][0]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hover, tubes]);

  // 一格只能有一种控件：放置时清掉同格其他控件
  const clearAt = (k: string) => {
    setDenies((s) => { const ns = new Set(s); ns.delete(k); return ns; });
    setCheckpoints((s) => { const ns = new Set(s); ns.delete(k); return ns; });
    setRotates((s) => { const ns = new Set(s); ns.delete(k); return ns; });
    setTubes((m) => { const nm = new Map(m); nm.delete(k); return nm; });
  };

  const clickCell = (x: number, y: number) => {
    dirty();
    const k = cellKey(x, y);
    switch (tool) {
      case 'start':
        clearAt(k);
        setStart([x, y]);
        return;
      case 'dest':
        clearAt(k);
        setDest([x, y]);
        return;
      case 'deny':
        if (k === kOf(start) || k === kOf(dest)) return;
        clearAt(k);
        setDenies((s) => { const ns = new Set(s); if (ns.has(k)) ns.delete(k); else ns.add(k); return ns; });
        return;
      case 'checkpoint':
        if (k === kOf(start) || k === kOf(dest)) return;
        clearAt(k);
        setCheckpoints((s) => { const ns = new Set(s); if (ns.has(k)) ns.delete(k); else ns.add(k); return ns; });
        return;
      case 'rotate':
        if (k === kOf(start) || k === kOf(dest)) return;
        clearAt(k);
        setRotates((s) => { const ns = new Set(s); if (ns.has(k)) ns.delete(k); else ns.add(k); return ns; });
        return;
      case 'tube':
      case 'ltube': {
        if (k === kOf(start) || k === kOf(dest)) return;
        const existing = tubes.get(k);
        clearAt(k);
        if (existing && existing.kind === tool) {
          // 同种管道再点一次：移除
          return;
        }
        // 默认朝向 0，悬停按 R 调整
        setTubes((m) => new Map(m).set(k, { kind: tool, rot: 0 }));
        return;
      }
    }
  };

  const clearCell = (x: number, y: number) => {
    const k = cellKey(x, y);
    if (k === kOf(start) || k === kOf(dest)) return; // 起点终点不能清
    dirty();
    clearAt(k);
  };

  const resize = (newCols: number, newRows: number) => {
    dirty();
    setCols(newCols);
    setRows(newRows);
    const inRange = (k: string) => {
      const [x, y] = k.split(',').map(Number);
      return x < newCols && y < newRows;
    };
    setDenies((s) => new Set([...s].filter(inRange)));
    setCheckpoints((s) => new Set([...s].filter(inRange)));
    setRotates((s) => new Set([...s].filter(inRange)));
    setTubes((m) => new Map([...m].filter(([k]) => inRange(k))));
    if (start[0] >= newCols || start[1] >= newRows) setStart([0, 0]);
    if (dest[0] >= newCols || dest[1] >= newRows) setDest([newCols - 1, newRows - 1]);
  };

  const level: PathLevel = useMemo(
    () => ({
      name: name.trim() || '自定义关卡',
      rows,
      cols,
      start,
      dest,
      denies: [...denies].map((k) => k.split(',').map(Number) as Cell),
      checkpoints: [...checkpoints].map((k) => k.split(',').map(Number) as Cell),
      rotates: [...rotates].map((k) => k.split(',').map(Number) as Cell),
      tubes: [...tubes].map(([k, t]): TubeDef => ({ pos: k.split(',').map(Number) as Cell, kind: t.kind, rot: t.rot })),
    }),
    [name, rows, cols, start, dest, denies, checkpoints, rotates, tubes],
  );

  const errors = useMemo(() => validatePathLevel(level), [level]);

  const editorState = (): EditorState => ({
    name, rows, cols, start, dest,
    denies: [...denies],
    checkpoints: [...checkpoints],
    rotates: [...rotates],
    tubes: [...tubes],
    testPassed,
  });

  const play = () => navigate('/pathfinder', { state: { level, test: true, editor: editorState() } });

  const generate = () => {
    setShareCode(encodePathLevel(level));
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

  const cs = Math.max(38, Math.min(60, Math.floor(Math.min(620 / cols, 440 / rows))));
  const gap = Math.max(4, cs * 0.08);

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#0a0f0d] px-4 py-10 text-neutral-300 select-none">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.3em] text-neutral-500">// 邦布维修 2.0 · 关卡编辑器</div>
            <h1 className="mt-2 text-2xl font-medium text-neutral-100">制作我的关卡</h1>
          </div>
          <button onClick={() => navigate('/pathfinder')} className="border border-neutral-700 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-500">
            ✕ 返回
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* 左：棋盘 */}
          <div>
            <div className="mb-3 grid grid-cols-4 gap-1.5">
              {TOOLS.map(([t, label, key]) => (
                <button
                  key={t}
                  onClick={() => setTool(t)}
                  className={`border px-1 py-1.5 text-xs ${
                    tool === t
                      ? 'border-[#19d8a0]/70 bg-[#19d8a0]/10 text-[#19d8a0]'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                  }`}
                >
                  <span className="mr-0.5 text-neutral-500">{key}</span>
                  {label}
                </button>
              ))}
              <div />
            </div>
            <div className="mb-4 text-xs text-neutral-600">
              点击放置；悬停管道按 R 调整默认朝向；右键清除格子控件
            </div>

            <div className="inline-block rounded-lg border border-[#1e3a3a] bg-[#0b1a20] p-3">
              <div className="relative" style={{ width: cols * (cs + gap) - gap, height: rows * (cs + gap) - gap }}>
                {Array.from({ length: rows }, (_, y) =>
                  Array.from({ length: cols }, (_, x) => {
                    const k = cellKey(x, y);
                    const kind = kindAt(level, x, y);
                    const tube = tubeAt(level, x, y);
                    const isHover = hover && hover[0] === x && hover[1] === y;
                    return (
                      <div
                        key={k}
                        onClick={() => clickCell(x, y)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          clearCell(x, y);
                        }}
                        onPointerEnter={() => setHover([x, y])}
                        onPointerLeave={() => setHover((h) => (h && h[0] === x && h[1] === y ? null : h))}
                        className="absolute cursor-pointer"
                        style={{ left: x * (cs + gap), top: y * (cs + gap), width: cs, height: cs }}
                      >
                        <CellBase s={cs} passed={false} corners={kind === 'normal'} />
                        {kind === 'start' && <StartTile s={cs} />}
                        {kind === 'dest' && <DestTile s={cs} arrived={false} />}
                        {kind === 'checkpoint' && <CheckpointTile s={cs} passed={false} />}
                        {kind === 'deny' && <DenyTile />}
                        {kind === 'rotate' && <RotateTile passed={false} />}
                        {tube && <TubeTile s={cs} kind={tube.kind} rot={animRots[k] ?? tube.rot} passed={false} />}
                        {isHover && (
                          <div className="absolute inset-0 rounded" style={{ border: '2px solid rgba(255,255,255,0.75)', pointerEvents: 'none' }} />
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          </div>

          {/* 右：配置 */}
          <div className="space-y-6">
            <div>
              <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">关卡名称</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value.slice(0, 24));
                  dirty();
                }}
                className="w-full border border-neutral-800 bg-[#121917] px-4 py-2.5 text-base outline-none focus:border-[#19d8a0]/50"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">长 (列) {cols}</label>
                <input
                  type="range" min={MIN_GRID} max={MAX_GRID} value={cols}
                  onChange={(e) => resize(Number(e.target.value), rows)}
                  className="w-full accent-[#19d8a0]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs tracking-widest text-neutral-500">高 (行) {rows}</label>
                <input
                  type="range" min={MIN_GRID} max={MAX_GRID} value={rows}
                  onChange={(e) => resize(cols, Number(e.target.value))}
                  className="w-full accent-[#19d8a0]"
                />
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-5">
              {errors.length > 0 ? (
                <ul className="mb-3 space-y-1">
                  {errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-400">· {e}</li>
                  ))}
                </ul>
              ) : (
                <div className="mb-3 text-xs text-[#19d8a0]">✓ 关卡合法且可解</div>
              )}
              <button
                onClick={play}
                disabled={errors.length > 0}
                className="w-full border border-neutral-700 px-4 py-3 text-base text-neutral-300 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ▶ 试玩
              </button>
              <button
                onClick={generate}
                disabled={errors.length > 0 || !testPassed}
                className="mt-2 w-full border border-[#19d8a0]/60 bg-[#19d8a0]/10 px-4 py-3 text-base text-[#19d8a0] hover:bg-[#19d8a0]/20 disabled:cursor-not-allowed disabled:opacity-30"
              >
                生成分享码
              </button>
              {!testPassed && errors.length === 0 && (
                <div className="mt-2 text-xs text-neutral-600">需要先「试玩」并通关一次，才能生成分享码</div>
              )}
              {shareCode && (
                <div className="mt-4">
                  <textarea
                    readOnly
                    value={shareCode}
                    rows={3}
                    onFocus={(e) => e.target.select()}
                    className="w-full resize-none border border-neutral-800 bg-[#121917] p-3 font-mono text-xs break-all text-neutral-400 outline-none"
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
    </div>
  );
}
