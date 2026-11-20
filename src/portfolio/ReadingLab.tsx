/* eslint-disable react-hooks/immutability -- Dev controls intentionally edit the shared imperative animation state. */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { ReadingState } from './reading';

/** Explicit development-only motion review; never shown in the visitor flow. */
export function ReadingLab({ reading }: { reading: RefObject<ReadingState> }) {
  const [sample, setSample] = useState({ progress: 0, error: 0 });
  useEffect(() => {
    const state = reading.current;
    state.labView = 'three-quarter';
    const timer = window.setInterval(
      () =>
        setSample({
          progress: reading.current.book,
          error: reading.current.contactError,
        }),
      150
    );
    return () => {
      window.clearInterval(timer);
      state.labView = '';
    };
  }, [reading]);
  const scrub = (book: number) => {
    const s = reading.current;
    s.phase = 'seated';
    s.seat = 1;
    s.turn = 1;
    s.camera = 1;
    s.zoom = 0;
    s.book = book;
  };
  return (
    <aside
      style={{
        position: 'fixed',
        left: 20,
        bottom: 90,
        zIndex: 40,
        background: '#fffbea',
        padding: 18,
        borderRadius: 16,
        width: 300,
        color: '#263d36',
        fontSize: 13,
      }}
      aria-label="Reading motion lab"
    >
      <strong>Reading motion lab</strong>
      <p>Elbow / wrist rig · hand-attached book</p>
      <label>
        Pickup → open ({Math.round(sample.progress * 100)}%)
        <input
          aria-label="Reading progress"
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={sample.progress}
          onChange={(e) => {
            const book = Number(e.target.value);
            scrub(book);
            setSample((v) => ({ ...v, progress: book }));
          }}
          style={{ width: '100%' }}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          onClick={() => {
            scrub(0);
            reading.current.phase = 'unpacking';
          }}
        >
          Play
        </button>
        <button
          onClick={() => {
            scrub(1);
            reading.current.phase = 'packing';
          }}
        >
          Return
        </button>
        {(['front', 'side', 'three-quarter'] as const).map((view) => (
          <button
            key={view}
            onClick={() => {
              reading.current.labView = view;
            }}
          >
            {view}
          </button>
        ))}
      </div>
      <p>Locked cover contact error: {(sample.error * 1000).toFixed(2)} mm</p>
    </aside>
  );
}
