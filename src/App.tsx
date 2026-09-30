import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SheemApp } from './sheem/SheemApp';
import './App.css';

const Playground = lazy(() =>
  import('./playground/Playground').then((m) => ({ default: m.Playground }))
);
const Lab = lazy(() =>
  import('./playground/Lab').then((m) => ({ default: m.Lab }))
);
const CharacterTest = lazy(() =>
  import('./playground/CharacterTest').then((m) => ({
    default: m.CharacterTest,
  }))
);
const Vanilla = lazy(() =>
  import('./sheem/_vanilla/SheemAppVanilla').then((m) => ({
    default: m.SheemAppVanilla,
  }))
);
const MovementPrototype = lazy(() =>
  import('./sheem/MovementPrototype').then((m) => ({
    default: m.MovementPrototype,
  }))
);
function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div role="status" style={{ padding: 32, color: '#fff' }}>
            Loading…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<SheemApp />} />
          <Route path="/vanilla" element={<Vanilla />} />
          <Route path="/playground/movement" element={<MovementPrototype />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/playground/lab" element={<Lab />} />
          <Route path="/playground/character" element={<CharacterTest />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
export default App;
