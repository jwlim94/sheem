import {
  Bone,
  Matrix4,
  Object3D,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from 'three';

// Shared by foot placement and the gait clock: shortening only one causes sliding.
const strideScale = (crossSlope: number, runWeight: number) =>
  (0.85 - 0.05 * runWeight) * (1 - 0.22 * crossSlope);

/** Post-animation two-bone leg IK. Keep the authored swing/flight height, but
 * support each sole on the actual terrain instead of tilting the whole animal. */
export function createRabbitGrounding(model: Object3D) {
  model.updateWorldMatrix(true, true);
  const root = model.getObjectByName('Root') as Bone;
  const legs = ['L', 'R'].map((side) => {
    const upper = model.getObjectByName(`Leg${side}`) as Bone;
    const lower = model.getObjectByName(`Shin${side}`) as Bone;
    const foot = model.getObjectByName(`Foot${side}`) as Bone;
    const vertices: Vector3[] = [];
    const inverse = new Matrix4().copy(foot.matrixWorld).invert();
    model.traverse((object) => {
      if (!(object instanceof SkinnedMesh)) return;
      object.updateMatrixWorld(true);
      object.skeleton.update();
      const skin = object.geometry.getAttribute('skinIndex');
      const weights = object.geometry.getAttribute('skinWeight');
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < skin.count; i++) {
        if (
          weights.getX(i) < 0.99 ||
          object.skeleton.bones[skin.getX(i)] !== foot
        )
          continue;
        const point = new Vector3().fromBufferAttribute(positions, i);
        object.applyBoneTransform(i, point);
        vertices.push(
          point.applyMatrix4(object.matrixWorld).applyMatrix4(inverse)
        );
      }
    });
    return {
      upper,
      lower,
      foot,
      vertices,
      hip: new Vector3(),
      knee: new Vector3(),
      ankle: new Vector3(),
      target: new Vector3(),
      rotation: new Quaternion(),
      upperLength: 0,
      lowerLength: 0,
      terrainTilt: new Quaternion(),
      lift: 0,
    };
  });
  const poses = [
    root,
    ...legs.flatMap((leg) => [leg.upper, leg.lower, leg.foot]),
  ].map((bone) => ({
    bone,
    position: bone.position.clone(),
    rotation: bone.quaternion.clone(),
  }));
  let flatHeight = 0;
  const flatGround = () => flatHeight;
  let applied = false;
  let initialized = false;
  let pelvisHeight = 0;
  const weightShift = new Vector3(),
    desiredShift = new Vector3();
  const forward = new Vector3(),
    leftGround = new Vector3(),
    rightGround = new Vector3();
  const point = new Vector3(),
    origin = new Vector3(),
    normal = new Vector3();
  const up = new Vector3(0, 1, 0),
    direction = new Vector3(),
    pole = new Vector3();
  const kneeTarget = new Vector3(),
    from = new Vector3(),
    to = new Vector3();
  const tilt = new Quaternion(),
    rotation = new Quaternion(),
    parentRotation = new Quaternion();
  function orient(bone: Bone, start: Vector3, end: Vector3, target: Vector3) {
    from.copy(end).sub(start).normalize();
    to.copy(target).sub(start).normalize();
    rotation.setFromUnitVectors(from, to);
    bone.getWorldQuaternion(parentRotation);
    rotation.multiply(parentRotation);
    bone.parent!.getWorldQuaternion(parentRotation).invert();
    bone.quaternion.copy(parentRotation.multiply(rotation));
    bone.updateWorldMatrix(false, true);
  }
  return {
    restore() {
      if (!applied) return;
      for (const pose of poses) {
        pose.bone.position.copy(pose.position);
        pose.bone.quaternion.copy(pose.rotation);
      }
      applied = false;
    },
    strideScale(
      height: ((x: number, z: number) => number) | undefined,
      runWeight: number
    ) {
      if (!height) return strideScale(0, runWeight);
      model.updateWorldMatrix(true, true);
      legs[0].upper.getWorldPosition(leftGround);
      legs[1].upper.getWorldPosition(rightGround);
      return strideScale(
        Math.min(
          1,
          Math.abs(
            height(leftGround.x, leftGround.z) -
              height(rightGround.x, rightGround.z)
          ) / 0.1
        ),
        runWeight
      );
    },
    reset() {
      initialized = false;
      weightShift.set(0, 0, 0);
    },
    update(
      groundHeight: ((x: number, z: number) => number) | undefined,
      dt: number,
      runWeight: number
    ) {
      for (const pose of poses) {
        pose.position.copy(pose.bone.position);
        pose.rotation.copy(pose.bone.quaternion);
      }
      applied = true;
      model.updateWorldMatrix(true, true);
      model.getWorldPosition(origin);
      flatHeight = origin.y - 0.008;
      const height = groundHeight ?? flatGround;
      forward.set(0, 0, 1).transformDirection(model.matrixWorld);
      legs[0].upper.getWorldPosition(leftGround);
      legs[1].upper.getWorldPosition(rightGround);
      const leftHeight = height(leftGround.x, leftGround.z);
      const rightHeight = height(rightGround.x, rightGround.z);
      const crossSlope = Math.min(1, Math.abs(leftHeight - rightHeight) / 0.1);
      let pelvis = 0;
      let totalWeight = 0;
      desiredShift.set(0, 0, 0);
      for (const leg of legs) {
        const { hip, knee, ankle, foot, target } = leg;
        leg.upper.getWorldPosition(hip);
        leg.lower.getWorldPosition(knee);
        foot.getWorldPosition(ankle);
        leg.upperLength = hip.distanceTo(knee);
        leg.lowerLength = knee.distanceTo(ankle);
        target.copy(ankle);
        // Shorter steps across a slope leave room for the downhill leg to reach,
        // and stop the uphill knee bunching into the belly during its swing.
        const stride = point.copy(ankle).sub(hip).dot(forward);
        target.addScaledVector(
          forward,
          stride * (strideScale(crossSlope, runWeight) - 1)
        );
        const e = 0.06;
        normal
          .set(
            height(target.x - e, target.z) - height(target.x + e, target.z),
            2 * e,
            height(target.x, target.z - e) - height(target.x, target.z + e)
          )
          .normalize();
        tilt.setFromUnitVectors(up, normal);
        if (!initialized) leg.terrainTilt.copy(tilt);
        else leg.terrainTilt.slerp(tilt, 1 - Math.exp(-18 * dt));
        foot.getWorldQuaternion(leg.rotation);
        leg.rotation.premultiply(leg.terrainTilt);
        let animatedBottom = Infinity,
          support = -Infinity;
        for (const vertex of leg.vertices) {
          point.copy(vertex).applyMatrix4(foot.matrixWorld);
          animatedBottom = Math.min(animatedBottom, point.y - origin.y);
          point.sub(ankle).applyQuaternion(leg.terrainTilt);
          support = Math.max(
            support,
            height(target.x + point.x, target.z + point.z) - point.y
          );
        }
        const uphill =
          height(ankle.x, ankle.z) > (leftHeight + rightHeight) / 2;
        leg.lift =
          Math.max(0, animatedBottom) *
          (1 - crossSlope * (uphill ? 0.25 : 0.1));
        target.y = support + leg.lift + 0.008;
        const offset = target.y - ankle.y;
        pelvis += offset / legs.length;
        const weight = Math.exp(-leg.lift / 0.018);
        desiredShift.addScaledVector(target, weight);
        totalWeight += weight;
      }
      desiredShift.divideScalar(totalWeight).sub(origin);
      desiredShift.y = 0;
      // Only a small lateral weight transfer; the clip already supplies body sway.
      desiredShift.addScaledVector(forward, -desiredShift.dot(forward));
      desiredShift.multiplyScalar(0.12 * crossSlope).clampLength(0, 0.015);
      weightShift.lerp(desiredShift, initialized ? 1 - Math.exp(-10 * dt) : 1);
      // Reserve reach before the downhill leg straightens. Smoothing the mean
      // alone still makes the reach clamp snap once every step.
      pelvis -= (0.008 + 0.025 * runWeight) * crossSlope;
      pelvisHeight = initialized
        ? pelvisHeight + (pelvis - pelvisHeight) * (1 - Math.exp(-10 * dt))
        : pelvis;
      let reachLimit = Infinity;
      // Enforce contact even at sharp edges where smoothing cannot be retained.
      for (const leg of legs) {
        const reach = (leg.upperLength + leg.lowerLength) * 0.995;
        const horizontal =
          (leg.hip.x + weightShift.x - leg.target.x) ** 2 +
          (leg.hip.z + weightShift.z - leg.target.z) ** 2;
        reachLimit = Math.min(
          reachLimit,
          leg.target.y +
            Math.sqrt(Math.max(0, reach * reach - horizontal)) -
            leg.hip.y
        );
      }
      root.getWorldPosition(point);
      pelvisHeight = Math.min(pelvisHeight, reachLimit);
      point.add(weightShift);
      point.y += pelvisHeight;
      initialized = true;
      root.position.copy(root.parent!.worldToLocal(point));
      model.updateWorldMatrix(true, true);
      for (const leg of legs) {
        const {
          upper,
          lower,
          foot,
          hip,
          knee,
          ankle,
          target,
          upperLength: a,
          lowerLength: b,
        } = leg;
        upper.getWorldPosition(hip);
        lower.getWorldPosition(knee);
        foot.getWorldPosition(ankle);
        direction.copy(target).sub(hip);
        const distance = Math.max(0.00001, direction.length());
        direction.divideScalar(distance);
        pole.copy(knee).sub(hip);
        pole.addScaledVector(direction, -pole.dot(direction));
        if (pole.lengthSq() < 1e-10)
          pole.set(0, 0, 1).addScaledVector(direction, -direction.z);
        pole.normalize();
        const along = (a * a - b * b + distance * distance) / (2 * distance);
        kneeTarget
          .copy(hip)
          .addScaledVector(direction, along)
          .addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
        orient(upper, hip, knee, kneeTarget);
        lower.getWorldPosition(knee);
        foot.getWorldPosition(ankle);
        orient(lower, knee, ankle, target);
        foot.parent!.getWorldQuaternion(parentRotation).invert();
        foot.quaternion.copy(parentRotation.multiply(leg.rotation));
        foot.updateWorldMatrix(false, true);
      }
    },
  };
}
