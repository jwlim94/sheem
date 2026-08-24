import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Playground } from './playground';
import { Lab } from './playground/Lab';
import { CharacterTest } from './playground/CharacterTest';
import { SheemApp, SheemAppVanilla } from './sheem';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Sheem 본체 */}
        <Route path="/" element={<SheemApp />} />

        {/* 학습용: vanilla Three.js 버전 비교 */}
        <Route path="/vanilla" element={<SheemAppVanilla />} />

        {/* 실험/검증 자산 — 지형, 오디오, 캐릭터 */}
        <Route path="/playground" element={<Playground />} />
        <Route path="/playground/lab" element={<Lab />} />
        <Route path="/playground/character" element={<CharacterTest />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
