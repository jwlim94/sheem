import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { AnimationMixer, Mesh } from 'three';
import type { AnimationAction } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { RabbitDrive, RabbitMotion } from './RabbitModel';

export const DUCK_MODEL_URL = '/models/duck/little-duck-animated-v2.glb';
export const DUCK_WALK_SPEED = 0.64;
export const DUCK_RUN_SPEED = 0.88 / 0.7;

export function DuckModel({
  playing = true,
  motion = 'Idle',
  drive,
}: {
  playing?: boolean;
  motion?: RabbitMotion;
  drive?: RefObject<RabbitDrive>;
}) {
  const { scene, animations } = useGLTF(DUCK_MODEL_URL);
  const model = useMemo(() => {
    const object = clone(scene);
    object.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return object;
  }, [scene]);
  const state = useRef<{
    mixer: AnimationMixer;
    action: AnimationAction | null;
    reset: number;
  } | null>(null);
  useEffect(() => {
    const mixer = new AnimationMixer(model);
    state.current = { mixer, action: null, reset: 0 };
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      state.current = null;
    };
  }, [model]);
  useFrame((_, delta) => {
    const current = state.current;
    if (!current) return;
    const clip = animations.find(
      (a) => a.name === (drive?.current.motion ?? motion)
    );
    if (!clip) return;
    const action = current.mixer.clipAction(clip);
    const reset = drive?.current.reset ?? 0;
    if (current.action !== action || current.reset !== reset) {
      if (current.reset !== reset) current.mixer.stopAllAction();
      else current.action?.fadeOut(0.18);
      action.reset().setEffectiveWeight(1).fadeIn(0.18).play();
      current.action = action;
      current.reset = reset;
    }
    action.setEffectiveTimeScale(drive?.current.timeScale ?? 1);
    if (playing) current.mixer.update(Math.min(delta, 0.05));
  });
  return <primitive object={model} dispose={null} />;
}
