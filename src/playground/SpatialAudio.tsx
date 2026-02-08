import { useRef, useEffect, useMemo, createContext, useContext } from 'react';
import { Html } from '@react-three/drei';
import { useControls, folder } from 'leva';
import { useFrame } from '@react-three/fiber';
import {
  Audio as ThreeAudio,
  PositionalAudio as ThreePositionalAudio,
  AudioListener,
  AudioLoader,
} from 'three';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { playerPosition } from './playerState';

// 오디오 소스 위치 (ducking 계산용)
const AUDIO_SOURCE_POSITIONS: Array<{ position: Vector3; duckRadius: number }> = [
  { position: new Vector3(7, 0.5, 3), duckRadius: 4 },    // 차 안
  { position: new Vector3(-5, 2, -4), duckRadius: 4 },     // 양철 지붕
  { position: new Vector3(-6, 1, 5), duckRadius: 5 },      // 텐트
  { position: new Vector3(5, 1, -6), duckRadius: 4 },      // 유리창
];

// 단일 AudioListener를 공유하기 위한 Context
const AudioListenerContext = createContext<AudioListener | null>(null);

// AudioListener를 플레이어 위치에 배치하는 프로바이더
function AudioListenerProvider({ children }: { children: React.ReactNode }) {
  const listenerGroupRef = useRef<Group>(null);
  const listener = useMemo(() => new AudioListener(), []);

  useEffect(() => {
    if (listenerGroupRef.current) {
      listenerGroupRef.current.add(listener);
    }
    return () => {
      listener.removeFromParent();
    };
  }, [listener]);

  // 매 프레임 플레이어 위치로 이동
  useFrame(() => {
    if (listenerGroupRef.current) {
      listenerGroupRef.current.position.copy(playerPosition);
    }
  });

  return (
    <AudioListenerContext.Provider value={listener}>
      {/* 리스너만 플레이어 위치를 따라감 (자식 소스는 영향 없음) */}
      <group ref={listenerGroupRef} />
      {children}
    </AudioListenerContext.Provider>
  );
}

export function SpatialAudio() {
  // 마스터 컨트롤
  const { audioEnabled } = useControls('Audio', {
    audioEnabled: { value: false, label: 'Audio On/Off' },
  });

  // 배경 빗소리 (비공간 - 어디서든 동일)
  const ambient = useControls('Audio', {
    'Background Rain': folder({
      ambientEnabled: { value: true, label: 'On/Off' },
      ambientVolume: { value: 0.1, min: 0, max: 1, step: 0.05, label: 'Volume' },
    }),
  });

  // 공간 오디오 소스 컨트롤
  const car = useControls('Audio', {
    'Inside Car': folder({
      carEnabled: { value: true, label: 'On/Off' },
      carVolume: { value: 1, min: 0, max: 1, step: 0.05, label: 'Volume' },
      carRefDistance: { value: 2, min: 0.5, max: 20, step: 0.5, label: 'Ref Distance' },
      carMaxDistance: { value: 8, min: 5, max: 100, step: 1, label: 'Max Distance' },
    }),
  });

  const tinRoof = useControls('Audio', {
    'Tin Roof': folder({
      tinEnabled: { value: true, label: 'On/Off' },
      tinVolume: { value: 1, min: 0, max: 1, step: 0.05, label: 'Volume' },
      tinRefDistance: { value: 2, min: 0.5, max: 20, step: 0.5, label: 'Ref Distance' },
      tinMaxDistance: { value: 10, min: 5, max: 100, step: 1, label: 'Max Distance' },
    }),
  });

  const tent = useControls('Audio', {
    'Tent in Forest': folder({
      tentEnabled: { value: true, label: 'On/Off' },
      tentVolume: { value: 1, min: 0, max: 1, step: 0.05, label: 'Volume' },
      tentRefDistance: { value: 3, min: 0.5, max: 20, step: 0.5, label: 'Ref Distance' },
      tentMaxDistance: { value: 12, min: 5, max: 100, step: 1, label: 'Max Distance' },
    }),
  });

  const windowGlass = useControls('Audio', {
    'Window Glass': folder({
      windowEnabled: { value: true, label: 'On/Off' },
      windowVolume: { value: 1, min: 0, max: 1, step: 0.05, label: 'Volume' },
      windowRefDistance: { value: 2, min: 0.5, max: 20, step: 0.5, label: 'Ref Distance' },
      windowMaxDistance: { value: 8, min: 5, max: 100, step: 1, label: 'Max Distance' },
    }),
  });

  const thunder = useControls('Audio', {
    'Thunder': folder({
      thunderEnabled: { value: true, label: 'On/Off' },
      thunderVolume: { value: 1, min: 0, max: 1, step: 0.05, label: 'Volume' },
      thunderRefDistance: { value: 5, min: 0.5, max: 20, step: 0.5, label: 'Ref Distance' },
      thunderMaxDistance: { value: 30, min: 5, max: 100, step: 1, label: 'Max Distance' },
    }),
  });

  return (
    <AudioListenerProvider>
      {/* 배경 빗소리 - 비공간, 어디서든 동일한 볼륨 */}
      <AmbientAudio
        url="/sounds/rain-heavy.mp3"
        enabled={audioEnabled && ambient.ambientEnabled}
        volume={ambient.ambientVolume}
      />

      {/* 공간 오디오 소스 - 플레이어 거리 기반 */}
      <AudioSource
        label="차 안 빗소리"
        url="/sounds/rain-inside-car.mp3"
        position={[7, 0.5, 3]}
        color="#cc4400"
        enabled={audioEnabled && car.carEnabled}
        volume={car.carVolume}
        refDistance={car.carRefDistance}
        maxDistance={car.carMaxDistance}
      />
      <AudioSource
        label="양철 지붕"
        url="/sounds/rain-on-tin-roof.mp3"
        position={[-5, 2, -4]}
        color="#888888"
        enabled={audioEnabled && tinRoof.tinEnabled}
        volume={tinRoof.tinVolume}
        refDistance={tinRoof.tinRefDistance}
        maxDistance={tinRoof.tinMaxDistance}
      />
      <AudioSource
        label="텐트 빗소리"
        url="/sounds/rain-on-tent-in-forest.mp3"
        position={[-6, 1, 5]}
        color="#33aa33"
        enabled={audioEnabled && tent.tentEnabled}
        volume={tent.tentVolume}
        refDistance={tent.tentRefDistance}
        maxDistance={tent.tentMaxDistance}
      />
      <AudioSource
        label="유리창 빗소리"
        url="/sounds/rain-on-window-glass.mp3"
        position={[5, 1, -6]}
        color="#66bbee"
        enabled={audioEnabled && windowGlass.windowEnabled}
        volume={windowGlass.windowVolume}
        refDistance={windowGlass.windowRefDistance}
        maxDistance={windowGlass.windowMaxDistance}
      />
      <AudioSource
        label="천둥"
        url="/sounds/thunder.mp3"
        position={[0, 5, 0]}
        color="#ffcc00"
        enabled={audioEnabled && thunder.thunderEnabled}
        volume={thunder.thunderVolume}
        refDistance={thunder.thunderRefDistance}
        maxDistance={thunder.thunderMaxDistance}
      />
    </AudioListenerProvider>
  );
}

// 비공간 오디오 - 어디서든 동일한 볼륨 (배경음) + 소스 근접 시 ducking
function AmbientAudio({
  url,
  volume,
  enabled,
}: {
  url: string;
  volume: number;
  enabled: boolean;
}) {
  const listener = useContext(AudioListenerContext);
  const audioRef = useRef<ThreeAudio | null>(null);
  const bufferLoaded = useRef(false);
  const baseVolume = useRef(volume);
  const enabledRef = useRef(enabled);

  // baseVolume을 Leva 값과 동기화
  useEffect(() => {
    baseVolume.current = volume;
  }, [volume]);

  // enabledRef를 항상 최신 값으로 동기화
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // 오디오 로드
  useEffect(() => {
    if (!listener) return;

    const audio = new ThreeAudio(listener);
    audioRef.current = audio;

    const loader = new AudioLoader();
    loader.load(url, (buffer) => {
      audio.setBuffer(buffer);
      audio.setLoop(true);
      audio.setVolume(volume);
      bufferLoaded.current = true;

      // enabledRef로 최신 상태 확인 (stale closure 방지)
      if (enabledRef.current && !audio.isPlaying) {
        audio.play();
      }
    });

    return () => {
      if (audio.isPlaying) audio.stop();
      audio.disconnect();
      bufferLoaded.current = false;
    };
    // volume/enabled는 별도 effect에서 관리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, listener]);

  // 매 프레임 ducking 계산: 소스에 가까우면 배경음 줄임
  useFrame(() => {
    const audio = audioRef.current;
    if (!audio || !bufferLoaded.current || !enabled) return;

    let duckFactor = 1; // 1 = 풀 볼륨, 0 = 음소거

    for (const source of AUDIO_SOURCE_POSITIONS) {
      const dist = playerPosition.distanceTo(source.position);
      if (dist < source.duckRadius) {
        // duckRadius 안에 있으면 거리에 비례해서 줄임
        // 소스 중심(dist=0) → 0, duckRadius 경계 → 1
        const factor = dist / source.duckRadius;
        duckFactor = Math.min(duckFactor, factor);
      }
    }

    audio.setVolume(baseVolume.current * duckFactor);
  });

  // 재생/정지
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !bufferLoaded.current) return;

    if (enabled && !audio.isPlaying) {
      audio.play();
    } else if (!enabled && audio.isPlaying) {
      audio.stop();
    }
  }, [enabled]);

  return null;
}

// 공간 오디오 - 플레이어와의 거리에 따라 볼륨 변화
function AudioSource({
  label,
  url,
  position,
  color,
  refDistance,
  maxDistance,
  volume,
  enabled,
}: {
  label: string;
  url: string;
  position: [number, number, number];
  color: string;
  refDistance: number;
  maxDistance: number;
  volume: number;
  enabled: boolean;
}) {
  const listener = useContext(AudioListenerContext);
  const groupRef = useRef<Group>(null);
  const audioRef = useRef<ThreePositionalAudio | null>(null);
  const bufferLoaded = useRef(false);
  const enabledRef = useRef(enabled);

  // enabledRef를 항상 최신 값으로 동기화
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // 오디오 로드 + 설정
  useEffect(() => {
    if (!listener || !groupRef.current) return;

    const audio = new ThreePositionalAudio(listener);
    audio.setDistanceModel('linear');
    audio.setRefDistance(refDistance);
    audio.setRolloffFactor(1);
    audio.setMaxDistance(maxDistance);
    audio.setVolume(volume);

    groupRef.current.add(audio);
    audioRef.current = audio;

    const loader = new AudioLoader();
    loader.load(url, (buffer) => {
      audio.setBuffer(buffer);
      audio.setLoop(true);
      bufferLoaded.current = true;

      // enabledRef로 최신 상태 확인 (stale closure 방지)
      if (enabledRef.current) {
        audio.play();
      }
    });

    return () => {
      if (audio.isPlaying) audio.stop();
      audio.disconnect();
      audio.removeFromParent();
      bufferLoaded.current = false;
    };
    // 파라미터 변경은 별도 effect에서 관리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, listener]);

  // 파라미터 변경 시 업데이트
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.setDistanceModel('linear');
      audio.setRefDistance(refDistance);
      audio.setRolloffFactor(1);
      audio.setMaxDistance(maxDistance);
      audio.setVolume(volume);
    }
  }, [refDistance, maxDistance, volume]);

  // 재생/정지
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !bufferLoaded.current) return;

    if (enabled && !audio.isPlaying) {
      audio.play();
    } else if (!enabled && audio.isPlaying) {
      audio.stop();
    }
  }, [enabled]);

  return (
    <group position={position}>
      {/* 오디오가 붙을 그룹 (world position 결정) */}
      <group ref={groupRef} />

      {/* 시각적 마커 */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color={enabled ? color : '#444'}
          emissive={enabled ? color : '#000'}
          emissiveIntensity={enabled ? 0.5 : 0}
        />
      </mesh>

      {/* 라벨 */}
      <Html center position={[0, 0.6, 0]}>
        <div
          style={{
            color: 'white',
            background: 'rgba(0,0,0,0.7)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}
