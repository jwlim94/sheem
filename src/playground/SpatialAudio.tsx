import { useRef, useState, useEffect } from 'react';
import { PositionalAudio, Html } from '@react-three/drei';
import type { PositionalAudio as PositionalAudioType } from 'three';

// 오디오 소스 설정
const AUDIO_SOURCES = [
  {
    id: 'light-rain',
    label: '잔잔한 빗소리',
    url: '/sounds/rain.mp3',
    position: [-5, 0.5, 0] as [number, number, number],
    color: '#00aaff',
    refDistance: 3,
    maxDistance: 15,
  },
  {
    id: 'metal-rain',
    label: '양철 지붕',
    url: '/sounds/rain-metal.mp3',
    position: [0, 2, -5] as [number, number, number],
    color: '#888888',
    refDistance: 2,
    maxDistance: 10,
  },
  {
    id: 'thunder',
    label: '천둥',
    url: '/sounds/thunder.mp3',
    position: [0, 5, 5] as [number, number, number],
    color: '#ffcc00',
    refDistance: 5,
    maxDistance: 30,
  },
];

export function SpatialAudio() {
  const [audioEnabled, setAudioEnabled] = useState(false);

  return (
    <group>
      {/* 오디오 활성화 버튼 (한 번만 클릭하면 전체 활성화) */}
      {!audioEnabled && (
        <group position={[0, 3, 0]}>
          <mesh onClick={() => setAudioEnabled(true)}>
            <boxGeometry args={[2, 0.5, 0.5]} />
            <meshStandardMaterial color="#22c55e" />
          </mesh>
          <Html center position={[0, 0.5, 0]}>
            <div
              style={{
                color: 'white',
                background: '#22c55e',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              클릭하여 오디오 시작
            </div>
          </Html>
        </group>
      )}

      {/* 각 오디오 소스 */}
      {AUDIO_SOURCES.map((source) => (
        <AudioSource key={source.id} {...source} enabled={audioEnabled} />
      ))}
    </group>
  );
}

function AudioSource({
  label,
  url,
  position,
  color,
  refDistance,
  maxDistance,
  enabled,
}: {
  label: string;
  url: string;
  position: [number, number, number];
  color: string;
  refDistance: number;
  maxDistance: number;
  enabled: boolean;
}) {
  const audioRef = useRef<PositionalAudioType>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.setRefDistance(refDistance);
      audio.setRolloffFactor(1);
      audio.setMaxDistance(maxDistance);
    }
  }, [refDistance, maxDistance]);

  return (
    <group position={position}>
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

      {/* 오디오 */}
      {enabled && (
        <PositionalAudio
          ref={audioRef}
          url={url}
          distance={refDistance}
          loop
          autoplay
        />
      )}
    </group>
  );
}
