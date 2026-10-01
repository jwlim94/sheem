import { MathUtils, Vector3 } from 'three';
import { surfaceHeight } from '../title/landscape';

export const RABBIT_SPAWN = [-9, -25] as const;
export const RABBIT_RADIUS = 5.5;
export const RABBIT_SPEED = 1.8;
export const RABBIT_RUN_SPEED = 3.0;
export const RABBIT_CLEARING = [RABBIT_SPAWN[0], RABBIT_SPAWN[1], 7] as const;
export function createRabbitMovement() {
  return {
    position: new Vector3(
      RABBIT_SPAWN[0],
      surfaceHeight(...RABBIT_SPAWN),
      RABBIT_SPAWN[1]
    ),
    velocity: new Vector3(),
    yaw: Math.PI,
    speed: 0,
    stopping: false,
    brakeElapsed: 0,
    brakeVelocity: new Vector3(),
  };
}
export type RabbitMovement = ReturnType<typeof createRabbitMovement>;

/** Camera-relative input; mutates one owned state without frame allocations. */
export function stepRabbit(
  state: RabbitMovement,
  horizontal: number,
  forward: number,
  cameraYaw: number,
  delta: number,
  sprint = false
) {
  const dt = Math.min(Math.max(delta, 0), 0.05);
  if (dt === 0) return;
  const length = Math.hypot(horizontal, forward);
  const x = length ? horizontal / length : 0;
  const z = length ? forward / length : 0;
  const speed = sprint ? RABBIT_RUN_SPEED : RABBIT_SPEED;
  const targetX = (x * Math.cos(cameraYaw) - z * Math.sin(cameraYaw)) * speed;
  const targetZ = (-x * Math.sin(cameraYaw) - z * Math.cos(cameraYaw)) * speed;
  if (length) {
    state.stopping = false;
    // Steer from input even at rest, instead of chasing an already reversed velocity.
    const targetYaw = Math.atan2(targetX, targetZ);
    const angle = Math.atan2(
      Math.sin(targetYaw - state.yaw),
      Math.cos(targetYaw - state.yaw)
    );
    state.yaw += angle * (1 - Math.exp(-10 * dt));
    const remainingAngle = Math.abs(angle) * Math.exp(-10 * dt);
    // Small corrections keep their pace; sharp turns brake until aligned.
    const alignment =
      1 - MathUtils.smoothstep(remainingAngle, Math.PI / 6, Math.PI / 2);
    const currentSpeed = Math.hypot(state.velocity.x, state.velocity.z);
    const targetSpeed = speed * alignment;
    const blend =
      1 -
      Math.exp(-(alignment < 1 && targetSpeed < currentSpeed ? 18 : 12) * dt);
    const turningSpeed = MathUtils.lerp(currentSpeed, targetSpeed, blend);
    state.velocity.set(
      Math.sin(state.yaw) * turningSpeed,
      0,
      Math.cos(state.yaw) * turningSpeed
    );
  } else {
    if (!state.stopping) {
      state.stopping = true;
      state.brakeElapsed = 0;
      state.brakeVelocity.copy(state.velocity);
    }
    // Finish braking with the model's 0.28 s landing, with no long sliding tail.
    state.brakeElapsed = Math.min(0.28, state.brakeElapsed + dt);
    const remaining = 1 - state.brakeElapsed / 0.28;
    state.velocity
      .copy(state.brakeVelocity)
      .multiplyScalar(remaining * remaining);
  }
  const oldX = state.position.x,
    oldZ = state.position.z;
  state.position.addScaledVector(state.velocity, dt);
  const dx = state.position.x - RABBIT_SPAWN[0],
    dz = state.position.z - RABBIT_SPAWN[1];
  const distance = Math.hypot(dx, dz);
  if (distance > RABBIT_RADIUS) {
    state.position.x = RABBIT_SPAWN[0] + (dx / distance) * RABBIT_RADIUS;
    state.position.z = RABBIT_SPAWN[1] + (dz / distance) * RABBIT_RADIUS;
  }
  state.speed =
    Math.hypot(state.position.x - oldX, state.position.z - oldZ) / dt;
  state.position.y = surfaceHeight(state.position.x, state.position.z);
}
