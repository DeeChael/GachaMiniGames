import { Routes, Route, Link, useLocation } from 'react-router';
import Home from './pages/Home';
import PuzzlePage from './games/puzzle/PuzzlePage';
import EditorPage from './games/puzzle/EditorPage';
import BalloonPage from './games/balloon/BalloonPage';
import BalloonEditorPage from './games/balloon/EditorPage';
import PlatjumpPage from './games/platjump/PlatjumpPage';
import PlatjumpEditorPage from './games/platjump/EditorPage';

// 顶栏菜单：按二游分组，选项显示游戏 logo，悬停下拉显示小游戏名称
interface NavGame {
  game: string; // 所属二游
  logo: string;
  items: { name: string; path: string }[];
}

const NAV_MENU: NavGame[] = [
  {
    game: '明日方舟：终末地',
    logo: `${import.meta.env.BASE_URL}logos/endfield.png`,
    items: [
      { name: '电路修复', path: '/puzzle' },
      { name: '浮空回收', path: '/balloon' },
    ],
  },
  {
    game: '崩坏：星穹铁道',
    logo: `${import.meta.env.BASE_URL}logos/starrail.png`,
    items: [{ name: '黄金替罪羊', path: '/platjump' }],
  },
  // 后续二游在这里添加
];

/** 按页面切换暗色主题：主页灰色系，终末地绿黑，星穹铁道蓝黑 */
const THEMES = {
  home: { bg: '#111214', panel: '#1a1c1f' },
  endfield: { bg: '#0b0e09', panel: '#14170f' },
  starrail: { bg: '#0a0f1a', panel: '#141a28' },
} as const;

export default function App() {
  const { pathname } = useLocation();
  const theme = pathname.startsWith('/platjump')
    ? THEMES.starrail
    : pathname === '/'
      ? THEMES.home
      : THEMES.endfield;

  return (
    <div className="min-h-screen text-neutral-300" style={{ background: theme.bg }}>
      {/* 顶栏 */}
      <div
        className="sticky top-0 z-30 border-b border-neutral-800 backdrop-blur"
        style={{ background: `${theme.bg}e6` }}
      >
        <div className="relative mx-auto flex max-w-6xl items-center px-4 py-3">
          <Link to="/" className="text-xl font-bold tracking-wide text-neutral-100">
            二游小游戏合集
          </Link>
          <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
            {NAV_MENU.map((g) => (
              <div key={g.game} className="group relative">
                <button
                  title={g.game}
                  className="flex items-center rounded-md border border-transparent p-1.5 transition-colors group-hover:border-neutral-700"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.panel)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <img src={g.logo} alt={g.game} className="h-7 w-auto rounded object-contain" />
                </button>
                {/* 下拉菜单（pt-1 桥接悬停间隙） */}
                <div className="invisible absolute left-0 top-full pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
                  <div
                    className="min-w-32 border border-neutral-800 py-1 shadow-lg shadow-black/50"
                    style={{ background: theme.panel }}
                  >
                    <div className="border-b border-neutral-800 px-4 py-1.5 text-[11px] tracking-wider text-neutral-500">
                      {g.game}
                    </div>
                    {g.items.map((it) => (
                      <Link
                        key={it.path}
                        to={it.path}
                        className="block px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-neutral-100"
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
        <Route path="/balloon" element={<BalloonPage />} />
        <Route path="/balloon/editor" element={<BalloonEditorPage />} />
        <Route path="/platjump" element={<PlatjumpPage />} />
        <Route path="/platjump/editor" element={<PlatjumpEditorPage />} />
      </Routes>
    </div>
  );
}
