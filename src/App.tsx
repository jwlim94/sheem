import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Game } from './lib/Game';
import { Playground } from './playground';
import { Lab } from './playground/Lab';
import { CharacterTest } from './playground/CharacterTest';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 프로덕션 게임 */}
        <Route path="/" element={<Game />} />

        {/* MVP 개발 + 어드민 환경 */}
        <Route path="/playground" element={<Playground />} />

        {/* 학습용 실험 코드 (Phase 1.5) */}
        <Route path="/playground/lab" element={<Lab />} />

        {/* 캐릭터 애니메이션 테스트 */}
        <Route path="/playground/character" element={<CharacterTest />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
