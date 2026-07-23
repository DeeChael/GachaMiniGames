import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { decodeLevel } from '../games/puzzle/shareCode';
import { decodeBalloonLevel } from '../games/balloon/shareCode';
import { decodePlatLevel } from '../games/platjump/shareCode';
import { decodeFillLevel } from '../games/colorfill/shareCode';

interface GameEntry {
  name: string;
  game: string; // 所属二游
  logo: string;
  path: string;
  ready: boolean;
}

const GAMES: GameEntry[] = [
  {
    name: '电路修复',
    game: '明日方舟：终末地',
    logo: `${import.meta.env.BASE_URL}logos/endfield.png`,
    path: '/puzzle',
    ready: true,
  },
  {
    name: '浮空回收',
    game: '明日方舟：终末地',
    logo: `${import.meta.env.BASE_URL}logos/endfield.png`,
    path: '/balloon',
    ready: true,
  },
  {
    name: '黄金替罪羊',
    game: '崩坏：星穹铁道',
    logo: `${import.meta.env.BASE_URL}logos/starrail.png`,
    path: '/platjump',
    ready: true,
  },
  {
    name: '溢彩画',
    game: '鸣潮',
    logo: `${import.meta.env.BASE_URL}logos/wuwa.png`,
    path: '/colorfill',
    ready: true,
  },
  // 后续小游戏在这里添加
];

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  // 检测分享码属于哪个游戏并跳转
  const startWithCode = () => {
    const v = code.trim();
    if (!v) {
      setCodeError('');
      return;
    }
    if (v.startsWith('EPZ2_')) {
      try {
        decodeLevel(v);
        navigate(`/puzzle?code=${encodeURIComponent(v)}`);
      } catch (e) {
        setCodeError((e as Error).message);
      }
      return;
    }
    if (v.startsWith('EBL1_')) {
      try {
        decodeBalloonLevel(v);
        navigate(`/balloon?code=${encodeURIComponent(v)}`);
      } catch (e) {
        setCodeError((e as Error).message);
      }
      return;
    }
    if (v.startsWith('SPJ2_')) {
      try {
        decodePlatLevel(v);
        navigate(`/platjump?code=${encodeURIComponent(v)}`);
      } catch (e) {
        setCodeError((e as Error).message);
      }
      return;
    }
    if (v.startsWith('WCF1_')) {
      try {
        decodeFillLevel(v);
        navigate(`/colorfill?code=${encodeURIComponent(v)}`);
      } catch (e) {
        setCodeError((e as Error).message);
      }
      return;
    }
    setCodeError('无法识别的分享码（支持 EPZ2_ / EBL1_ / SPJ2_ / WCF1_ 开头）');
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-12">
        <div className="text-xs tracking-[0.3em] text-neutral-500">// GACHA MINIGAMES</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-100">
          二游小游戏合集
        </h1>
      </header>

      <div className="mb-12">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') startWithCode();
            }}
            placeholder="粘贴分享码，自动识别游戏"
            className="flex-1 border border-neutral-800 bg-[#1a1c1f] px-4 py-3 text-base text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          />
          <button
            onClick={startWithCode}
            className="border border-neutral-600 bg-neutral-800/60 px-7 py-3 text-base text-neutral-100 hover:border-neutral-400"
          >
            开始
          </button>
        </div>
        {codeError && <div className="mt-2 text-sm text-red-400">{codeError}</div>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => (
          <Link
            key={g.path}
            to={g.path}
            className="group flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-[#1a1c1f] p-5 transition-colors hover:border-neutral-600"
          >
            <div className="min-w-0">
              <div className="text-lg font-medium text-neutral-100 group-hover:text-white">
                {g.name}
              </div>
              <div className="mt-1 truncate text-xs text-neutral-500">{g.game}</div>
              <div className="mt-3 inline-block rounded-full border border-neutral-700 px-2.5 py-0.5 text-[11px] text-neutral-500 group-hover:border-neutral-500 group-hover:text-neutral-300">
                开始游玩 →
              </div>
            </div>
            <img
              src={g.logo}
              alt={g.game}
              className="h-16 w-16 shrink-0 rounded-lg object-contain"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
