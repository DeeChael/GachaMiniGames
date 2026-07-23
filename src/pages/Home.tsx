import { Link } from 'react-router';

interface GameEntry {
  name: string;
  game: string; // 所属二游
  logo: string;
  path: string;
  ready: boolean;
}

const GAMES: GameEntry[] = [
  {
    name: '拼图',
    game: '明日方舟：终末地',
    logo: '/logos/endfield.png',
    path: '/puzzle',
    ready: true,
  },
  // 后续小游戏在这里添加
];

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-12">
        <div className="text-xs tracking-[0.3em] text-neutral-500">// GACHA MINIGAMES</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-100">
          二游小游戏合集
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => (
          <Link
            key={g.path}
            to={g.path}
            className="group flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-[#14170f] p-5 transition-colors hover:border-[#a6e22e]/50"
          >
            <div className="min-w-0">
              <div className="text-lg font-medium text-neutral-100 group-hover:text-[#d6f28a]">
                {g.name}
              </div>
              <div className="mt-1 truncate text-xs text-neutral-500">{g.game}</div>
              <div className="mt-3 inline-block rounded-full border border-neutral-700 px-2.5 py-0.5 text-[11px] text-neutral-500 group-hover:border-[#a6e22e]/60 group-hover:text-[#a6e22e]">
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
