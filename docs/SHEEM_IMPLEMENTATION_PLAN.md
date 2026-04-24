# Sheem 구현 계획

> 위치 기반 ASMR 멀티플레이어 힐링 웹 앱

---

## MVP 구현 단계

### Phase 1: 프로젝트 셋업 ✅

- [x] React + Vite 초기화
- [x] 의존성 설치 (R3F, Drei, react-spring 등)
- [x] 폴더 구조 설정
- [x] TypeScript 설정
- [x] ESLint 설정

### Phase 1.5: R3F 플레이그라운드 (학습/실험) ✅

> Three.js/R3F에 익숙해지기 위한 실험 환경
>
> **참고**: `src/playground/`는 실험용 코드. 프로덕션 코드는 `src/lib/`에 별도 작성.

- [x] 기본 도형 렌더링 (Box, Sphere 등) → `BasicShapes.tsx`
- [x] 조명 테스트 (ambient, directional, point) → `Lights.tsx`
- [x] 카메라 조작 테스트 (OrbitControls) → 테스트 완료
- [x] 애니메이션 테스트 (useFrame, React Spring) → `SpringAnimation.tsx`
- [x] 3D 모델 로딩 테스트 (useGLTF) → `ModelLoader.tsx`
- [x] PositionalAudio 테스트 ⭐ → `SpatialAudio.tsx`
- [x] 키보드 입력 테스트 (KeyboardControls) → `CharacterController.tsx`
- [x] 캐릭터 이동 프로토타입 → `CharacterController.tsx` (카메라 팔로우 포함)
- [x] **사운드 레이어링 테스트** ⭐ → 여러 PositionalAudio 동시 재생 확인
- [x] **3D 캐릭터 모델 + 애니메이션 테스트** → useGLTF/useAnimations 통합
  - GLTF 모델 로드 및 애니메이션 전환 (Idle ↔ Walk)
  - 동적 액션 스팟 시스템 (GLTF 내장 애니메이션 자동 감지 → 맵에 트리거 배치)
  - https://quaternius.com/packs/ultimatedanimatedcharacter.html

**목표**: 본격 개발 전에 R3F 감 잡기 ✅ 완료!

**학습 성과**:

- PositionalAudio + 캐릭터 기반 AudioListener 작동 확인
- 다중 사운드 소스 레이어링 성공
- 거리 기반 볼륨 조절 (refDistance, maxDistance) 이해
- GLTF 모델의 애니메이션을 useAnimations로 제어 (fadeIn/fadeOut 전환)
- 모델 교체 시 코드 변경 최소화 확인 (경로만 변경하면 됨)

### Phase 2: Playground MVP (모든 기능을 Playground에서 먼저 구현)

> **전략**: `src/playground/`에서 모든 MVP 기능을 먼저 구현 + 어드민 패널로 실시간 조절.
> 검증 완료 후 `src/lib/`로 정리하여 프로덕션 배포.

**캐릭터 방향:**

- 젤다 BotW 풍 환경 → 2~3등신 스타일화된 인간형 캐릭터
- MVP: 무료 에셋 (Quaternius Ultimate Animated Character Pack)
- 추후: 자체 캐릭터 모델링 (Blender) → 브랜드 아이덴티티 확립
- 현재 플레이스홀더: `Knight_Golden_Male.gltf`

**Phase 2-1: 어드민 패널 + 통합 씬** ✅

- [x] 프로덕션 코드 구조 설정 (`src/lib/`, React Router)
- [x] 라우트 분리 (`/playground`, `/playground/lab`, `/playground/character`)
- [x] CharacterController 정리 (액션 스팟 → `/playground/character`로 분리)
- [x] 캐릭터 + 오디오 통합 씬 (같은 Canvas, 카메라 팔로우 + AudioListener 연동)
- [x] 어드민 패널 UI (Leva)
  - 오디오: 개별 볼륨, refDistance, maxDistance 슬라이더, On/Off 토글
  - 캐릭터: 이동 속도, 모델 스케일, 모델 선택 드롭다운 (Knight/Wizard/Worker/Viking)
  - 카메라: 오프셋(높이/거리) 조절

**Phase 2-2: 빗소리 + 환경 사운드** ✅

- [x] 고품질 빗소리 에셋 수집 (Freesound/Pixabay)
  - rain-heavy, rain-inside-car, rain-on-tin-roof, rain-on-tent-in-forest, rain-on-window-glass, thunder
  - FFmpeg EBU R128 (-16 LUFS) 정규화로 파일 간 볼륨 통일
- [x] drei PositionalAudio → Three.js Audio API 직접 사용으로 전환
- [x] AudioListenerProvider: 플레이어 위치에 AudioListener 배치 (카메라 아닌 플레이어 기준)
  - `playerState.ts` 공유 상태로 CharacterController ↔ SpatialAudio 연동
  - React Context로 단일 AudioListener 공유
- [x] 비공간 배경음 (AmbientAudio): 어디서든 동일한 볼륨의 배경 빗소리
- [x] 공간 오디오 5소스 (AudioSource): 거리 기반 볼륨 (linear distance model, maxDistance 밖 음소거)
- [x] 배경음 Ducking: 플레이어가 소스 근처 진입 시 배경음 자동 감소 (duckRadius 기반)
- [x] Stale closure 방지: enabledRef로 큰 파일 로드 완료 시 최신 상태 참조
- [x] 어드민 패널: 소스별 On/Off, Volume, Ref Distance, Max Distance 개별 컨트롤

**Phase 2-3: 맵/환경**

- [ ] 맵 컨셉 결정 (비 오는 골목, 카페 등)
- [ ] 무료 에셋으로 간단한 맵 구성 (Sketchfab, Quaternius)
- [ ] GLB 맵 로드 + 캐릭터 이동 연동
- [ ] 구역(존) 설정 및 사운드 소스 배치
- [ ] 어드민에서 사운드 존 시각화/편집

**Phase 2-4: 멀티플레이어**

- [ ] Colyseus 서버 셋업
- [ ] 플레이어 상태 스키마 정의
- [ ] 클라이언트-서버 연결
- [ ] 플레이어 위치 동기화
- [ ] 다른 플레이어 캐릭터 표시
- [ ] 닉네임 표시

**Phase 2-5: UI + 채팅**

- [ ] 닉네임 입력 화면
- [ ] 채팅 UI (좌측 하단)
- [ ] 채팅 기능 구현
- [ ] 설정 UI (볼륨 조절)

### Phase 3: 프로덕션 전환 및 배포

> Playground에서 MVP 검증 완료 후 진행

- [ ] Playground 코드 → `src/lib/` 프로덕션 코드로 정리
- [ ] 어드민 패널 제거 (또는 `/admin` 라우트로 분리)
- [ ] 자체 캐릭터 모델 적용 (Blender 제작 or 외주)
- [ ] 성능 최적화
- [ ] Vercel 배포 (프론트엔드)
- [ ] Railway/Fly.io 배포 (Colyseus 서버)
- [ ] 도메인 연결

---

## 추천 개발 순서

```
Phase 1 + 1.5: 셋업 + 기술 검증 ✅ 완료!
        ↓
Phase 2: Playground MVP (모든 기능 구현 + 어드민 패널)
  2-1: 어드민 패널 + 통합 씬
  2-2: 빗소리 + 환경 사운드
  2-3: 맵/환경
  2-4: 멀티플레이어
  2-5: UI + 채팅
        ↓
Phase 3: 프로덕션 전환 + 배포
```

**핵심 전략**: Playground에서 전부 만들고 검증 → 만족스러우면 프로덕션으로 전환

---

## 기술 스택 요약

| 영역         | 기술                                     |
| ------------ | ---------------------------------------- |
| 프론트엔드   | React + Vite + TypeScript + React Router |
| 3D           | React Three Fiber + Drei                 |
| 애니메이션   | useFrame + React Spring                  |
| 오디오       | Three.js PositionalAudio                 |
| 멀티플레이어 | Colyseus                                 |
| 백엔드       | Node.js + Colyseus Server                |
| 배포         | Vercel + Railway/Fly.io                  |

---

## 폴더 구조 (예상)

```
sheem/
├── src/
│   ├── playground/           # 🧪 실험용 코드 (프로덕션 X)
│   │   ├── Playground.tsx
│   │   ├── BasicShapes.tsx
│   │   ├── SpatialAudio.tsx
│   │   └── ...
│   │
│   ├── lib/                  # 🚀 프로덕션 코드 (핵심 로직)
│   │   ├── audio/
│   │   │   ├── AudioManager.ts
│   │   │   └── SpatialAudioSource.tsx
│   │   ├── player/
│   │   │   ├── Player.tsx
│   │   │   └── PlayerController.ts
│   │   ├── world/
│   │   │   ├── Scene.tsx
│   │   │   └── Map.tsx
│   │   └── multiplayer/
│   │       └── colyseus.ts
│   │
│   ├── components/           # UI 컴포넌트
│   │   ├── Chat.tsx
│   │   ├── Settings.tsx
│   │   └── NicknameInput.tsx
│   │
│   ├── hooks/
│   │   ├── usePlayer.ts
│   │   ├── useMultiplayer.ts
│   │   └── useAudio.ts
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── server/                   # Colyseus 서버
│   ├── rooms/
│   │   └── GameRoom.ts
│   ├── schema/
│   │   └── GameState.ts
│   └── index.ts
│
├── public/
│   ├── models/               # 3D 모델 (GLB)
│   └── sounds/               # 오디오 파일
│
└── package.json
```

**코드 분리 원칙**:

- `src/playground/` → MVP 개발 + 어드민 패널 (모든 기능 먼저 여기서 구현)
- `src/lib/` → 프로덕션 코드 (Playground 검증 후 정리하여 이동)

**라우팅** (`react-router-dom`):
| URL | 컴포넌트 | 용도 |
|-----|---------|------|
| `/` | `Game.tsx` | 프로덕션 게임 (Phase 3에서 완성) |
| `/playground` | `Playground.tsx` | MVP 개발 + 어드민 환경 |
| `/playground/lab` | `Lab.tsx` | Phase 1.5 학습용 실험 코드 |
| `/playground/character` | `CharacterTest.tsx` | 캐릭터 애니메이션 테스트 (액션 스팟) |

---

## 마일스톤

| 마일스톤 | 목표                                          |
| -------- | --------------------------------------------- |
| M1       | 3D 환경에서 캐릭터 이동 ✅                     |
| M2       | Spatial Audio 작동 확인 ✅                     |
| M3       | Playground에서 어드민 패널 + 통합 씬 ✅        |
| M4       | 공간 오디오 시스템 + 빗소리 레이어링 ✅        |
| M5       | 멀티플레이어 연결                              |
| M6       | Playground MVP 완성 (전 기능 검증)             |
| M7       | 프로덕션 전환 + 배포                           |

---

_마지막 업데이트: 2026-02-08_
