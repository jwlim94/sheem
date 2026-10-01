import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AnimationAction,
  AnimationMixer,
  Bone,
  Group,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createSoleClearance } from './soleClearance';
import { createRabbitBlink } from './rabbitBlink';

export const RABBIT_MODEL_URL = '/models/rabbit/sheem-rabbit-v65.glb';

// Match the V14 stance travel while keeping movement speed unchanged.
export const RABBIT_WALK_SPEED = 1.05;

export const RABBIT_RUN_GAIT_SPEED = 0.575 / 0.28;

const GAIT_NAMES = ['Walk', 'Run'] as const;

export type RabbitMotion = 'Idle' | 'Walk' | 'Run';
export type RabbitDrive = {
  motion: RabbitMotion;
  timeScale: number;
  reset?: number;
};

/** Y-up, facing +Z, feet at zero; about 1.45 m including ears. */
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
  const blink = useRef<ReturnType<typeof createRabbitBlink> | null>(null);
  useEffect(() => {
    const ownedBlink = createRabbitBlink(rabbit);
    blink.current = ownedBlink;
    return () => {
      ownedBlink.dispose();
      blink.current = null;
    };
  }, [rabbit]);
  const support = useRef<Group>(null);
  const soleClearance = useMemo(
    () => createSoleClearance(rabbit, ['FootL', 'FootR', 'Foot.L', 'Foot.R']),
    [rabbit]
  );

  // Capture the displayed pose on input changes, including interrupted stops.
  // This lets the final raised foot land instead of slowing a gait almost to zero.
  const transition = useMemo(() => {
    const poses: {
      bone: Bone;
      position: Vector3;
      rotation: Quaternion;
      scale: Vector3;
      targetPosition: Vector3;
      targetRotation: Quaternion;
      targetScale: Vector3;
    }[] = [];
    rabbit.traverse((object) => {
      if (object instanceof Bone)
        poses.push({
          bone: object,
          position: object.position.clone(),
          rotation: object.quaternion.clone(),
          scale: object.scale.clone(),
          targetPosition: object.position.clone(),
          targetRotation: object.quaternion.clone(),
          targetScale: object.scale.clone(),
        });
    });
    return {
      poses,
      body: poses.find(({ bone }) => bone.name === 'Body')?.bone,
      tilt: new Quaternion(),
      axis: new Vector3(1, 0, 0),
    };
  }, [rabbit]);

  const timing = useRef({
    elapsed: 1,
    duration: 0,
    kind: 'none' as 'none' | 'start' | 'stop',
    reset: 0,
    applied: false,
  });

  const currentAction = useRef<AnimationAction | null>(null);
  const gait = useRef({ phase: 0, runWeight: 0, fromWeight: 0, elapsed: 0.18 });

  useEffect(() => {
    const ownedMixer = new AnimationMixer(rabbit);
    const ownedTiming = timing.current;
    mixer.current = ownedMixer;
    return () => {
      ownedMixer.stopAllAction();
      ownedMixer.uncacheRoot(rabbit);
      currentAction.current = null;
      ownedTiming.applied = false;
      ownedTiming.kind = 'none';
      ownedTiming.duration = 0;
      mixer.current = null;
    };
  }, [rabbit, animations, transition]);

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
    const dt = Math.min(delta, 0.05);
    blink.current?.update(dt);
    if (drive) {
      const hardReset = (drive.current.reset ?? 0) !== timing.current.reset;
      timing.current.reset = drive.current.reset ?? 0;
      const clip = animations.find(
        (animation) => animation.name === drive.current.motion
      );
      if (clip) {
        const next = ownedMixer.clipAction(clip);
        if (next !== currentAction.current || hardReset) {
          const previous = currentAction.current;
          const stopping = drive.current.motion === 'Idle';
          const starting = previous?.getClip().name === 'Idle';
          if (hardReset || stopping || starting) {
            for (const pose of transition.poses) {
              pose.position.copy(pose.bone.position);
              pose.rotation.copy(pose.bone.quaternion);
              pose.scale.copy(pose.bone.scale);
            }
            if (timing.current.applied) {
              for (const pose of transition.poses) {
                pose.bone.position.copy(pose.targetPosition);
                pose.bone.quaternion.copy(pose.targetRotation);
                pose.bone.scale.copy(pose.targetScale);
              }
              timing.current.applied = false;
            }
            ownedMixer.stopAllAction();
            next.reset().stopFading().setEffectiveWeight(1).play();
            timing.current.kind = hardReset
              ? 'none'
              : stopping
                ? 'stop'
                : 'start';
            timing.current.elapsed = 0;
            timing.current.duration = hardReset ? 0 : stopping ? 0.28 : 0.2;
            gait.current.phase = 0;
            gait.current.runWeight = drive.current.motion === 'Run' ? 1 : 0;
            gait.current.fromWeight = gait.current.runWeight;
            gait.current.elapsed = 0.18;
          } else {
            // Keep the displayed blend when a transition is interrupted.
            gait.current.fromWeight = gait.current.runWeight;
            gait.current.elapsed = 0;
            next.stopFading().play();
          }
          currentAction.current = next;
        }
        next.setEffectiveTimeScale(
          drive.current.motion !== 'Idle' ? drive.current.timeScale : 1
        );
        if (drive.current.motion !== 'Idle') {
          const cycle = gait.current;
          cycle.elapsed = Math.min(0.18, cycle.elapsed + dt);
          const t = cycle.elapsed / 0.18;
          const target = drive.current.motion === 'Run' ? 1 : 0;
          cycle.runWeight =
            cycle.fromWeight +
            (target - cycle.fromWeight) * t * t * (3 - 2 * t);
          const speed =
            drive.current.timeScale *
            (target ? RABBIT_RUN_GAIT_SPEED : RABBIT_WALK_SPEED);
          // Both clips start with the same supporting foot. Use one phase and
          // the blended stride distance, rather than two competing clocks.
          let stride = 0;
          for (const name of GAIT_NAMES) {
            const gaitClip = animations.find(
              (animation) => animation.name === name
            );
            if (!gaitClip) continue;
            const weight =
              name === 'Run' ? cycle.runWeight : 1 - cycle.runWeight;
            stride +=
              weight *
              gaitClip.duration *
              (name === 'Run' ? RABBIT_RUN_GAIT_SPEED : RABBIT_WALK_SPEED);
          }
          const cadence = stride > 0 ? speed / stride : 0;
          for (const name of GAIT_NAMES) {
            const gaitClip = animations.find(
              (animation) => animation.name === name
            );
            if (!gaitClip) continue;
            const action = ownedMixer.clipAction(gaitClip);
            action.enabled = true;
            action
              .stopFading()
              .setEffectiveWeight(
                name === 'Run' ? cycle.runWeight : 1 - cycle.runWeight
              )
              .setEffectiveTimeScale(cadence * gaitClip.duration)
              .play();
            action.time = cycle.phase * gaitClip.duration;
          }
          cycle.phase = (cycle.phase + cadence * dt) % 1;
        }
      }
    }
    // AnimationMixer skips writes for unchanged tracks. Restore its last target
    // before updating so procedural blending never feeds back into the next pose.
    if (timing.current.applied) {
      for (const pose of transition.poses) {
        pose.bone.position.copy(pose.targetPosition);
        pose.bone.quaternion.copy(pose.targetRotation);
        pose.bone.scale.copy(pose.targetScale);
      }
      timing.current.applied = false;
    }
    ownedMixer.update(dt);
    if (drive && timing.current.duration > 0) {
      timing.current.elapsed = Math.min(
        timing.current.elapsed + dt,
        timing.current.duration
      );
      const progress = timing.current.elapsed / timing.current.duration;
      const blend = progress * progress * (3 - 2 * progress);
      for (const pose of transition.poses) {
        const { bone, position, rotation, scale } = pose;
        pose.targetPosition.copy(bone.position);
        pose.targetRotation.copy(bone.quaternion);
        pose.targetScale.copy(bone.scale);
        bone.position.lerp(position, 1 - blend);
        bone.quaternion.slerp(rotation, 1 - blend);
        bone.scale.lerp(scale, 1 - blend);
      }
      if (transition.body) {
        const pulse = Math.sin(Math.PI * progress);
        // Small chest weight shift, not a whole-avatar lean that lifts the soles.
        transition.tilt.setFromAxisAngle(
          transition.axis,
          (timing.current.kind === 'start' ? 0.055 : -0.025) * pulse
        );
        transition.body.quaternion.multiply(transition.tilt);
      }
      timing.current.applied = true;
      if (progress === 1) timing.current.duration = 0;
    }
    // Joint interpolation can briefly dip a rounded sole through its support
    // plane; lift the displayed pose by only that deficit, without stretching.
    if (support.current) support.current.position.y = soleClearance();
  });
  return (
    <group ref={support}>
      <primitive object={rabbit} dispose={null} />
    </group>
  );
}
