import { Bone, Object3D, SkinnedMesh, Vector3 } from 'three';
import { BENCH_SEAT_TOP, ease } from './reading';

/** Keep the deformed pelvis supported as the torso leans; legs remain independent. */
export function createSeatContact(model: Object3D, body: Bone) {
  const samples: { mesh: SkinnedMesh; indices: number[] }[] = [];
  const point = new Vector3(),
    position = new Vector3();
  const actor = model.parent?.parent;
  model.updateWorldMatrix(true, true);
  model.traverse((o) => {
    if (!(o instanceof SkinnedMesh) || !actor) return;
    const joints = o.geometry.getAttribute('skinIndex'),
      weights = o.geometry.getAttribute('skinWeight');
    const bodyIndex = o.skeleton.bones.indexOf(body),
      indices: number[] = [];
    if (bodyIndex < 0 || !joints || !weights) return;
    for (let i = 0; i < joints.count; i++) {
      if (joints.getX(i) !== bodyIndex || weights.getX(i) < 0.99) continue;
      o.getVertexPosition(i, point);
      o.localToWorld(point);
      actor.worldToLocal(point);
      if (point.y < 0.38) indices.push(i);
    }
    if (indices.length) samples.push({ mesh: o, indices });
  });
  return (seat: number) => {
    if (seat < 0.9) return 0;
    let bottom = Infinity;
    for (const { mesh, indices } of samples)
      for (const i of indices) {
        mesh.getVertexPosition(i, point);
        mesh.localToWorld(point);
        if (
          point.x >= 3.75 &&
          point.x <= 5.85 &&
          point.z >= 3.05 &&
          point.z <= 3.75
        )
          bottom = Math.min(bottom, point.y);
      }
    if (!Number.isFinite(bottom)) return 0;
    const desired = BENCH_SEAT_TOP + 0.003;
    const correction =
      Math.max(-0.08, Math.min(0.08, desired - bottom)) *
      ease((seat - 0.9) / 0.1);
    body.getWorldPosition(position);
    position.y += correction;
    body.parent!.worldToLocal(position);
    body.position.copy(position);
    body.updateWorldMatrix(false, true);
    return bottom + correction - desired;
  };
}
