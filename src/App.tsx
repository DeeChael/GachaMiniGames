import { Routes, Route, Link, useLocation } from 'react-router';
import Home from './pages/Home';
import PuzzlePage from './games/puzzle/PuzzlePage';
import EditorPage from './games/puzzle/EditorPage';

export default function App() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-[#0b0e09] text-neutral-300">
      {/* 顶栏 */}
      <div className="sticky top-0 z-30 border-b border-neutral-800 bg-[#0b0e09]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-sm font-medium tracking-wide text-neutral-200">
            二游小游戏合集
          </Link>
          {!isHome && (
            <Link to="/" className="text-xs text-neutral-500 hover:text-neutral-300">
              ← 返回合集
            </Link>
          )}
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
