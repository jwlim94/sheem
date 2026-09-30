import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AnimationMixer, Mesh } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const RABBIT_MODEL_URL = '/models/rabbit/sheem-rabbit-v8.glb';

/** Y-up, facing +Z, feet at zero; 1.70 m including ears. */
export function RabbitModel({ idle = true }: { idle?: boolean }) {
  const { scene, animations } = useGLTF(RABBIT_MODEL_URL);
  // Each instance owns its skeleton; immutable geometry/materials stay in the cache.
  const rabbit = useMemo(() => {
    const instance = clone(scene);
    instance.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return instance;
  }, [scene]);
  const mixer = useRef<AnimationMixer | null>(null);

  useEffect(() => {
    const ownedMixer = new AnimationMixer(rabbit);
    const clip = animations.find((animation) => animation.name === 'Idle');
    if (clip) ownedMixer.clipAction(clip).play();
    mixer.current = ownedMixer;
    return () => {
      ownedMixer.stopAllAction();
      ownedMixer.uncacheRoot(rabbit);
      mixer.current = null;
    };
  }, [rabbit, animations]);

  useFrame((_, delta) => {
    if (idle) mixer.current?.update(Math.min(delta, 0.05));
  });
  return <primitive object={rabbit} dispose={null} />;
}
