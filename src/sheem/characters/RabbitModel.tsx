import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AnimationAction, AnimationMixer, Mesh } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const RABBIT_MODEL_URL = '/models/rabbit/sheem-rabbit-v14.glb';

// Match the V14 stance travel while keeping movement speed unchanged.
export const RABBIT_WALK_SPEED = 1.05;

export const RABBIT_RUN_GAIT_SPEED = 0.575 / 0.28;

export type RabbitMotion = 'Idle' | 'Walk' | 'Run';
export type RabbitDrive = { motion: RabbitMotion; timeScale: number };

/** Y-up, facing +Z, feet at zero; 1.70 m including ears. */
export function RabbitModel({
  playing = true,
  motion = 'Idle',
  drive,
}: {
  playing?: boolean;
  motion?: RabbitMotion;
  drive?: RefObject<RabbitDrive>;
}) {
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

  const currentAction = useRef<AnimationAction | null>(null);

  useEffect(() => {
    const ownedMixer = new AnimationMixer(rabbit);
    mixer.current = ownedMixer;
    return () => {
      ownedMixer.stopAllAction();
      ownedMixer.uncacheRoot(rabbit);
      currentAction.current = null;
      mixer.current = null;
    };
  }, [rabbit, animations]);

  useEffect(() => {
    const ownedMixer = mixer.current;
    const clip = animations.find((animation) => animation.name === motion);
    if (!ownedMixer || !clip) return;
    const next = ownedMixer.clipAction(clip);
    const previous = currentAction.current;
    if (next !== previous) {
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      if (previous) {
        previous.stopFading();
        if (playing) {
          previous.fadeOut(0.25);
          next.fadeIn(0.25);
        } else {
          previous.stop();
        }
      }
      currentAction.current = next;
      ownedMixer.update(0);
    }
  }, [motion, playing, rabbit, animations]);

  useFrame((_, delta) => {
    const ownedMixer = mixer.current;
    if (!ownedMixer || !playing) return;
    if (drive) {
      const clip = animations.find(
        (animation) => animation.name === drive.current.motion
      );
      if (clip) {
        const next = ownedMixer.clipAction(clip);
        if (next !== currentAction.current) {
          const previous = currentAction.current;
          next.reset().setEffectiveWeight(1).play();
          previous?.stopFading();
          previous?.fadeOut(0.18);
          next.fadeIn(0.18);
          currentAction.current = next;
        }
        next.setEffectiveTimeScale(
          drive.current.motion !== 'Idle' ? drive.current.timeScale : 1
        );
      }
    }
    ownedMixer.update(Math.min(delta, 0.05));
  });
  return <primitive object={rabbit} dispose={null} />;
}
