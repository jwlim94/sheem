import { Bone, Euler, Object3D, Quaternion, Vector3 } from 'three';
import type { ReadingState } from './reading';
import { ease, BOOK_LAP } from './reading';
import { createSeatContact } from './seatContact';
import { createArmIK } from './armIK';
import { bookScore, notebookTransform } from './bookChoreography';

/** Additive seat/reading choreography over the owned rabbit skeleton. */
export function createReadingPose(state: ReadingState, reduced: () => boolean) {
  let bones: Record<string, Bone> | null = null;
  let seatContact: ReturnType<typeof createSeatContact> | null = null;
  let primary: ReturnType<typeof createArmIK> | null = null;
  let secondary: ReturnType<typeof createArmIK> | null = null;
  const bookPosition = new Vector3(),
    bookRotation = new Quaternion(),
    grip = new Vector3();
  const handRotation = new Quaternion(),
    handWorld = new Quaternion(),
    inversePalm = new Quaternion();
  const primaryLocal = new Vector3(0.32, 0.1, 0.015).multiplyScalar(
    BOOK_LAP.scale
  );
  const palmRight = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    new Vector3(-0.8, 0, -0.6)
  );
  const palmLeft = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    new Vector3(0.8, 0, -0.6)
  );
  const poseEuler = new Euler(0, 0, 0, 'YXZ'),
    hinge = new Quaternion();
  const worldTilt = new Quaternion(),
    worldPose = new Quaternion(),
    worldParent = new Quaternion();
  const applyWorldTilt = (bone: Bone, x: number, y: number, z: number) => {
    worldTilt.setFromEuler(poseEuler.set(x, y, z, 'YXZ'));
    bone.getWorldQuaternion(worldPose);
    worldPose.premultiply(worldTilt);
    bone.parent!.getWorldQuaternion(worldParent);
    bone.quaternion.copy(worldParent.invert().multiply(worldPose));
    bone.updateWorldMatrix(false, true);
  };
  const axis = new Vector3(0, 1, 0),
    direction = new Vector3(),
    rotation = new Quaternion(),
    parent = new Quaternion(),
    tilt = new Quaternion(),
    footRotation = new Quaternion(),
    zAxis = new Vector3(0, 0, 1);
  const aim = (
    bone: Bone | undefined,
    x: number,
    y: number,
    z: number,
    weight: number
  ) => {
    if (!bone) return;
    // Targets are in actor/model axes, not the bone's rolled rest frame.
    direction.set(x, y, z).normalize();
    rotation.setFromUnitVectors(axis, direction);
    bone.parent!.getWorldQuaternion(parent);
    const root = bone;
    let model = root.parent;
    while (model && model.name !== 'portfolio-rabbit') model = model.parent;
    if (model) {
      const q = model.quaternion;
      rotation.premultiply(q);
    }
    rotation.premultiply(parent.invert());
    bone.quaternion.slerp(rotation, weight);
    bone.updateWorldMatrix(false, true);
  };
  return (model: Object3D, dt: number) => {
    if (!bones) {
      bones = {};
      model.traverse((o) => {
        if (o instanceof Bone) bones![o.name] = o;
      });
      seatContact = createSeatContact(model, bones.Body);
      primary = createArmIK(bones.ArmL, bones.ForearmL, bones.HandL, 1);
      secondary = createArmIK(bones.ArmR, bones.ForearmR, bones.HandR, -1);
    }
    state.bookAttached = false;
    state.contactError = 0;
    state.armReachError = 0;
    const seat = ease(state.seat);
    if (seat <= 0) return;
    if (!reduced()) state.elapsed += dt;
    model.updateWorldMatrix(true, true);
    // Forward thighs and hanging shins; feet retain their authored sole orientation.
    for (const side of ['L', 'R']) {
      const foot = bones[`Foot${side}`];
      foot?.getWorldQuaternion(footRotation);
      aim(bones[`Leg${side}`], side === 'L' ? 0.1 : -0.1, -0.1, 1, seat);
      aim(bones[`Shin${side}`], 0, -1, 0.13, seat);
      if (foot) {
        foot.parent!.getWorldQuaternion(parent);
        rotation.copy(parent).invert().multiply(footRotation);
        foot.quaternion.slerp(rotation, seat);
      }
    }
    const score = bookScore(state.book),
      notebook = notebookTransform(state.book);
    const lean = score.reach * (1 - score.carry);
    // Shift the shoulder toward the resting book before the hand approaches.
    // The hip remains on the seat; the body roll supplies the short rabbit's reach.
    if (bones.Body)
      applyWorldTilt(
        bones.Body,
        seat * (0.35 * score.carry - 0.1 * lean),
        0,
        -seat * 0.72 * lean
      );
    if (bones.Head)
      applyWorldTilt(
        bones.Head,
        seat * (0.06 + 0.08 * score.reach - 0.1 * score.carry),
        seat * 0.18 * lean,
        seat * 0.24 * lean
      );
    state.seatContactError = seatContact!(seat);
    aim(bones.ArmL, 0.18, -0.82, 0.48, seat);
    aim(bones.ArmR, -0.18, -0.82, 0.48, seat);
    model.updateWorldMatrix(true, true);
    bookPosition.set(notebook.x, notebook.y, notebook.z);
    bookRotation.setFromEuler(
      poseEuler.set(notebook.pitch, notebook.yaw, 0, 'YXZ')
    );
    grip.copy(primaryLocal).applyQuaternion(bookRotation).add(bookPosition);
    handRotation.copy(bookRotation).multiply(palmRight);
    const primaryError = primary!(grip, handRotation, score.reach * seat);
    state.armReachError = primaryError * score.reach;
    if (score.reach === 1) {
      bones.GripL.getWorldPosition(direction);
      state.contactError = direction.distanceTo(grip);
    }
    if (state.book >= 0.3 && seat > 0.999) {
      // At grasp the book becomes a rigid child of the real palm socket.
      // Derive both its position and orientation from the solved hand, never a
      // second unrelated animation curve. Reverse playback releases it on seat.
      bones.HandL.getWorldQuaternion(handWorld);
      inversePalm.copy(palmRight).invert();
      bookRotation.copy(handWorld).multiply(inversePalm);
      bones.GripL.getWorldPosition(grip);
      bookPosition
        .copy(grip)
        .sub(direction.copy(primaryLocal).applyQuaternion(bookRotation));
      bookPosition.toArray(state.heldBookPosition);
      bookRotation.toArray(state.heldBookQuaternion);
      state.bookAttached = true;
    }
    // The other paw meets the closed cover near the spine before opening it.
    // Its contact travels with the actual hinged cover throughout the opening.
    hinge.setFromAxisAngle(axis, Math.PI * (1 - score.open));
    grip
      .set(-(0.06 + 0.26 * ease((score.open - 0.6) / 0.4)), 0.1, 0.02)
      .multiplyScalar(BOOK_LAP.scale)
      .applyQuaternion(hinge)
      .applyQuaternion(bookRotation)
      .add(bookPosition);
    handRotation.copy(bookRotation).multiply(palmLeft);
    const secondaryError = secondary!(grip, handRotation, score.support * seat);
    state.armReachError = Math.max(
      state.armReachError,
      secondaryError * score.support
    );
    if (score.support === 1) {
      bones.GripR.getWorldPosition(direction);
      state.contactError = Math.max(
        state.contactError,
        direction.distanceTo(grip)
      );
    }
    for (const [name, sign] of [
      ['EarL', 1],
      ['EarR', -1],
    ] as const) {
      const ear = bones[name];
      if (!ear) continue;
      tilt.setFromAxisAngle(
        zAxis,
        seat * (sign * 0.025 + Math.sin(state.elapsed * 1.3 + sign) * 0.008)
      );
      ear.quaternion.multiply(tilt);
    }
  };
}
