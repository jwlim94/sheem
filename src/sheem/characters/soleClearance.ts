import { Matrix4, Object3D, SkinnedMesh, Vector3 } from 'three';

/** Flat support-plane clearance for a blended pose, not individual terrain IK.
 * Explicit foot names allow the same helper to support a differently named rig.
 * Vertex indices are cached once; the render loop allocates no sample objects.
 */
export function createSoleClearance(
  root: Object3D,
  footNames: readonly string[]
) {
  const feet = new Set(footNames);
  const samples: { mesh: SkinnedMesh; indices: number[] }[] = [];
  root.traverse((object) => {
    if (!(object instanceof SkinnedMesh)) return;
    const skin = object.geometry.getAttribute('skinIndex');
    const weights = object.geometry.getAttribute('skinWeight');
    const indices: number[] = [];
    for (let i = 0; i < skin.count; i++) {
      if (
        weights.getX(i) > 0.99 &&
        feet.has(object.skeleton.bones[skin.getX(i)].name)
      )
        indices.push(i);
    }
    if (indices.length) samples.push({ mesh: object, indices });
  });
  const inverseRoot = new Matrix4();
  const point = new Vector3();
  return () => {
    root.updateWorldMatrix(true, true);
    inverseRoot.copy(root.matrixWorld).invert();
    let minimum = Infinity;
    for (const { mesh, indices } of samples) {
      // SkinnedMesh updates its attached bind inverse in this override, not in
      // Object3D.updateWorldMatrix. Keep it current before CPU skin sampling.
      mesh.updateMatrixWorld(true);
      mesh.skeleton.update();
      const positions = mesh.geometry.getAttribute('position');
      for (const index of indices) {
        point.fromBufferAttribute(positions, index);
        mesh.applyBoneTransform(index, point);
        point.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseRoot);
        minimum = Math.min(minimum, point.y);
      }
    }
    return Math.max(0, 0.0002 - minimum);
  };
}
