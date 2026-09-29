import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { MeadowScene } from './title/MeadowScene';
import { useAmbience } from './title/useAmbience';
import './title/title.css';

function FlowerMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      width={small ? 18 : 28}
      height={small ? 18 : 28}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 3c3 6 3 7 0 13C10 13 9 12 3 16c6 3 7 3 13 0-3 6-3 7 0 13 3-6 3-7 0-13 6 3 7 3 13 0-6-3-7-3-13 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}
function SoundIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
      {enabled ? (
        <>
          <path
            d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path d="m16 9 6 6m0-6-6 6" strokeLinecap="round" />
      )}
    </svg>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
export function SheemApp() {
  const [entered, setEntered] = useState(false);
  const enterButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const wasEntered = useRef(false);
  useEffect(() => {
    if (entered) backButton.current?.focus();
    else if (wasEntered.current) enterButton.current?.focus();
    wasEntered.current = entered;
  }, [entered]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(() => !supportsWebGL());
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const { enabled, error, toggle } = useAmbience();
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEntered(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <main
      className={`sheem-title ${entered ? 'is-entered' : ''} ${ready ? 'is-ready' : ''}`}
    >
      <div className="landscape" aria-hidden="true">
        {!failed && (
          <SceneBoundary onFailure={onFailure}>
            <Canvas
              shadows
              frameloop={reducedMotion ? 'demand' : 'always'}
              dpr={[1, 1.5]}
              camera={{ position: [-4, 19, 35], fov: 48, near: 0.1, far: 1300 }}
              gl={{
                antialias: true,
                alpha: false,
                powerPreference: 'high-performance',
              }}
              fallback={<span>WebGL을 지원하는 브라우저가 필요합니다.</span>}
              onCreated={({ gl }) => {
                gl.setClearColor('#bed3ca');
              }}
            >
              <Suspense fallback={null}>
                <MeadowScene
                  entered={entered}
                  reducedMotion={reducedMotion}
                  onReady={onReady}
                />
              </Suspense>
            </Canvas>
          </SceneBoundary>
        )}
      </div>
      <div className="cinematic-wash" aria-hidden="true" />
      <header className="title-header">
        <a className="brand" href="/" aria-label="Sheem 시작 화면">
          <FlowerMark />
          <span>sheem</span>
        </a>
        <span className="preview-label">
          <span /> EARLY PREVIEW
        </span>
      </header>
      {!entered ? (
        <>
          <section className="title-copy" aria-label="Sheem 소개">
            <p className="eyebrow">A LITTLE WORLD. A SLOWER MOMENT.</p>
            <h1>
              sheem<span className="wordmark-period">.</span>
            </h1>
            <p className="title-description">마음이 쉬어가는 작은 세상</p>
            <span className="title-rule" />
          </section>
          <section className="entry-controls" aria-label="초원 시작">
            <p className="invitation">어디로도 서두르지 않아도 괜찮아요.</p>
            <button
              ref={enterButton}
              className="enter-button"
              disabled={!ready || failed}
              onClick={() => setEntered(true)}
            >
              <span>
                {failed
                  ? '풍경을 불러오지 못했어요'
                  : ready
                    ? '시작하기'
                    : '초원을 준비하고 있어요'}
              </span>
              {ready && !failed ? (
                <svg
                  width="22"
                  height="16"
                  viewBox="0 0 22 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M1 8h19m-6-6 6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                </svg>
              ) : (
                <span className="loading-dot" />
              )}
            </button>
            <p className="entry-note">
              {failed
                ? 'WebGL을 지원하는 브라우저에서 다시 열어주세요.'
                : '가입 없이, 가벼운 마음으로.'}
            </p>
            {failed && (
              <button
                className="retry-button"
                onClick={() => window.location.reload()}
              >
                다시 시도
              </button>
            )}
          </section>
        </>
      ) : (
        <section className="explore-ui" aria-label="초원 둘러보기">
          <button
            ref={backButton}
            className="back-button"
            onClick={() => setEntered(false)}
          >
            ← 시작 화면
          </button>
          <div className="explore-hint">
            <FlowerMark small />
            <span>잠시, 이 풍경 속에 머물러요.</span>
            <small>드래그로 둘러보기 · 스크롤 또는 두 손가락으로 확대</small>
          </div>
        </section>
      )}
      <footer className="title-footer">
        <div className="world-caption">
          <span className="world-number">01</span>
          <div>
            <span className="world-name">THE MEADOW</span>
            <span className="world-detail">햇살이 머무는 초원</span>
          </div>
        </div>
        <div className="headphone-note">
          <svg
            width="15"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            aria-hidden="true"
          >
            <path d="M3 11V9a7 7 0 0 1 14 0v2M3 10H2v7h4v-7H3Zm14 0h1v7h-4v-7h3Z" />
          </svg>
          <span>헤드폰과 함께하면 더 좋아요</span>
        </div>
        <div className="sound-control">
          <button
            className="sound-button"
            onClick={() => void toggle()}
            aria-pressed={enabled}
            aria-label={enabled ? '배경 바람 소리 끄기' : '배경 바람 소리 켜기'}
          >
            <SoundIcon enabled={enabled} />
            <span>{enabled ? '소리 켜짐' : '소리 켜기'}</span>
            <span className={`sound-indicator ${enabled ? 'active' : ''}`} />
          </button>
          {error && (
            <span className="audio-error" role="status">
              소리를 켜려면 다시 눌러주세요.
            </span>
          )}
        </div>
      </footer>
      <span className="sr-only" role="status">
        {failed
          ? '3D 화면을 사용할 수 없습니다.'
          : ready
            ? '초원 준비 완료'
            : '초원 로딩 중'}
      </span>
    </main>
  );
}
