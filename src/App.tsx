import { Routes, Route, Link } from 'react-router';
import Home from './pages/Home';
import PuzzlePage from './games/puzzle/PuzzlePage';
import EditorPage from './games/puzzle/EditorPage';

// 顶栏菜单：按二游分组，选项显示游戏 logo，悬停下拉显示小游戏名称
interface NavGame {
  game: string; // 所属二游
  logo: string;
  items: { name: string; path: string }[];
}

const NAV_MENU: NavGame[] = [
  {
    game: '明日方舟：终末地',
    logo: '/logos/endfield.png',
    items: [{ name: '拼图', path: '/puzzle' }],
  },
  // 后续二游在这里添加
];

export default function App() {
  return (
    <div className="min-h-screen bg-[#0b0e09] text-neutral-300">
      {/* 顶栏 */}
      <div className="sticky top-0 z-30 border-b border-neutral-800 bg-[#0b0e09]/90 backdrop-blur">
        <div className="relative mx-auto flex max-w-6xl items-center px-4 py-3">
          <Link to="/" className="text-xl font-bold tracking-wide text-neutral-100">
            二游小游戏合集
          </Link>
          <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
            {NAV_MENU.map((g) => (
              <div key={g.game} className="group relative">
                <button
                  title={g.game}
                  className="flex items-center rounded-md border border-transparent p-1.5 transition-colors group-hover:border-neutral-700 group-hover:bg-[#14170f]"
                >
                  <img src={g.logo} alt={g.game} className="h-7 w-auto rounded object-contain" />
                </button>
                {/* 下拉菜单（pt-1 桥接悬停间隙） */}
                <div className="invisible absolute left-0 top-full pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
                  <div className="min-w-32 border border-neutral-800 bg-[#14170f] py-1 shadow-lg shadow-black/50">
                    <div className="border-b border-neutral-800 px-4 py-1.5 text-[11px] tracking-wider text-neutral-500">
                      {g.game}
                    </div>
                    {g.items.map((it) => (
                      <Link
                        key={it.path}
                        to={it.path}
                        className="block px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-[#a6e22e]/10 hover:text-[#d6f28a]"
                      >
                        {it.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/puzzle" element={<PuzzlePage />} />
        <Route path="/puzzle/editor" element={<EditorPage />} />
      </Routes>
    </div>
  );
}
