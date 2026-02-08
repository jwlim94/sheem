import { useRef, useEffect } from 'react';
import { PositionalAudio, Html } from '@react-three/drei';
import { useControls, folder } from 'leva';
import type { PositionalAudio as PositionalAudioType } from 'three';

export function SpatialAudio() {
  // 마스터 컨트롤
  const { audioEnabled } = useControls('Audio', {
    audioEnabled: { value: false, label: 'Audio On/Off' },
  });

  // 개별 오디오 소스 컨트롤
  const rain = useControls('Audio', {
    'Rain': folder({
      rainEnabled: { value: true, label: 'On/Off' },
      rainVolume: { value: 1, min: 0, max: 1, step: 0.05, label: 'Volume' },
      rainRefDistance: { value: 3, min: 0.5, max: 20, step: 0.5, label: 'Ref Distance' },
      rainMaxDistance: { value: 15, min: 5, max: 100, step: 1, label: 'Max Distance' },
    }),
  });

  const metalRain = useControls('Audio', {
    'Metal Rain': folder({
      metalEnabled: { value: true, label: 'On/Off' },
      metalVolume: { value: 1, min: 0, max: 1, step: 0.05, label: 'Volume' },
      metalRefDistance: { value: 2, min: 0.5, max: 20, step: 0.5, label: 'Ref Distance' },
      metalMaxDistance: { value: 10, min: 5, max: 100, step: 1, label: 'Max Distance' },
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
    <group>
      <AudioSource
        label="잔잔한 빗소리"
        url="/sounds/rain.mp3"
        position={[-5, 0.5, 0]}
        color="#00aaff"
        enabled={audioEnabled && rain.rainEnabled}
        volume={rain.rainVolume}
        refDistance={rain.rainRefDistance}
        maxDistance={rain.rainMaxDistance}
      />
      <AudioSource
        label="양철 지붕"
        url="/sounds/rain-metal.mp3"
        position={[0, 2, -5]}
        color="#888888"
        enabled={audioEnabled && metalRain.metalEnabled}
        volume={metalRain.metalVolume}
        refDistance={metalRain.metalRefDistance}
        maxDistance={metalRain.metalMaxDistance}
      />
      <AudioSource
        label="천둥"
        url="/sounds/thunder.mp3"
        position={[0, 5, 5]}
        color="#ffcc00"
        enabled={audioEnabled && thunder.thunderEnabled}
        volume={thunder.thunderVolume}
        refDistance={thunder.thunderRefDistance}
        maxDistance={thunder.thunderMaxDistance}
      />
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
  const audioRef = useRef<PositionalAudioType>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.setRefDistance(refDistance);
      audio.setRolloffFactor(1);
      audio.setMaxDistance(maxDistance);
      audio.setVolume(volume);
    }
  }, [refDistance, maxDistance, volume]);

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
