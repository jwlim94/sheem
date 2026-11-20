import { Bone, Quaternion, Vector3 } from 'three';

/** Fixed-length two-bone solve with an explicit elbow pole (no limb stretching). */
export function solveElbow(
  shoulder: Vector3,
  target: Vector3,
  pole: Vector3,
  upperLength: number,
  lowerLength: number,
  elbow: Vector3,
  wrist: Vector3,
  scratch = { direction: new Vector3(), bend: new Vector3() }
) {
  const direction = scratch.direction.copy(target).sub(shoulder);
  const requested = direction.length();
  if (requested < 1e-8) direction.set(0, -1, 0);
  else direction.normalize();
  const distance = Math.max(
    Math.abs(upperLength - lowerLength) + 1e-5,
    Math.min(upperLength + lowerLength - 1e-5, requested)
  );
  const along =
    (upperLength * upperLength -
      lowerLength * lowerLength +
      distance * distance) /
    (2 * distance);
  const bend = scratch.bend.copy(pole).sub(shoulder);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 1e-8) {
    bend.set(
      Math.abs(direction.z) > 0.9 ? 1 : 0,
      0,
      Math.abs(direction.z) > 0.9 ? 0 : 1
    );
    bend.addScaledVector(direction, -bend.dot(direction));
  }
  bend.normalize();
  elbow
    .copy(shoulder)
    .addScaledVector(direction, along)
    .addScaledVector(
      bend,
      Math.sqrt(Math.max(0, upperLength * upperLength - along * along))
    );
  wrist.copy(shoulder).addScaledVector(direction, distance);
  return Math.abs(requested - distance);
}

export function createArmIK(
  upper: Bone,
  lower: Bone,
  hand: Bone,
  side: number
) {
  const shoulder = new Vector3(),
    wrist = new Vector3(),
    elbow = new Vector3(),
    target = new Vector3();
  const direction = new Vector3(),
    currentAxis = new Vector3(),
    pole = new Vector3();
  const parent = new Quaternion(),
    world = new Quaternion(),
    swing = new Quaternion(),
    desired = new Quaternion();
  const axis = new Vector3(0, 1, 0),
    contactOffset = new Vector3(0, 0.05, 0);
  const scratch = { direction: new Vector3(), bend: new Vector3() };
  const upperLength = lower.position.length(),
    lowerLength = hand.position.length();
  const orient = (bone: Bone, end: Vector3, weight: number) => {
    bone.getWorldPosition(direction);
    direction.subVectors(end, direction).normalize();
    bone.getWorldQuaternion(world);
    currentAxis.copy(axis).applyQuaternion(world);
    swing.setFromUnitVectors(currentAxis, direction);
    desired.copy(world).premultiply(swing);
    bone.parent!.getWorldQuaternion(parent);
    desired.premultiply(parent.invert());
    bone.quaternion.slerp(desired, weight);
    bone.updateWorldMatrix(false, true);
  };
  return (contact: Vector3, handRotation: Quaternion, weight: number) => {
    upper.getWorldPosition(shoulder);
    target
      .copy(contact)
      .sub(direction.copy(contactOffset).applyQuaternion(handRotation));
    pole.set(side * 0.6, -0.18, 0.08).add(shoulder);
    const clamped = solveElbow(
      shoulder,
      target,
      pole,
      upperLength,
      lowerLength,
      elbow,
      wrist,
      scratch
    );
    orient(upper, elbow, weight);
    orient(lower, wrist, weight);
    hand.parent!.getWorldQuaternion(parent);
    desired.copy(parent).invert().multiply(handRotation);
    hand.quaternion.slerp(desired, weight);
    hand.updateWorldMatrix(false, true);
    return clamped;
  };
}
