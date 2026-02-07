import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Game } from './lib/Game';
import { Playground } from './playground';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 프로덕션 게임 */}
        <Route path="/" element={<Game />} />

        {/* 실험용 플레이그라운드 */}
        <Route path="/playground" element={<Playground />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
