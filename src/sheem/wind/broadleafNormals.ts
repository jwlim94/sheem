import {
  Box3,
  BufferAttribute,
  Float32BufferAttribute,
  Matrix3,
  Mesh,
  Vector3,
} from 'three';

/** Fit a handful of crown lobes once, in the source scene's world space. This
 * shares lighting volumes across mesh splits without changing UVs or positions. */
export function fitCrownLobes(meshes: readonly Mesh[]) {
  const samples: Vector3[] = [];
  const bounds = new Box3();
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 32) {
      const p = new Vector3()
        .fromBufferAttribute(positions, i)
        .applyMatrix4(mesh.matrixWorld);
      samples.push(p);
      bounds.expandByPoint(p);
    }
  }
  if (!samples.length) return [];
  const centers = [bounds.getCenter(new Vector3())];
  for (let k = 1; k < 6; k++) {
    let farthest = samples[0],
      distance = -1;
    for (const p of samples) {
      const d = Math.min(...centers.map((c) => c.distanceToSquared(p)));
      if (d > distance) {
        distance = d;
        farthest = p;
      }
    }
    centers.push(farthest.clone());
  }
  for (let iteration = 0; iteration < 8; iteration++) {
    const sums = centers.map(() => new Vector3()),
      counts = centers.map(() => 0);
    for (const p of samples) {
      let nearest = 0,
        d = Infinity;
      for (let k = 0; k < centers.length; k++) {
        const value = p.distanceToSquared(centers[k]);
        if (value < d) {
          d = value;
          nearest = k;
        }
      }
      sums[nearest].add(p);
      counts[nearest]++;
    }
    for (let k = 0; k < centers.length; k++)
      if (counts[k]) centers[k].copy(sums[k]).divideScalar(counts[k]);
  }
  const radius = Math.max(bounds.getSize(new Vector3()).length() * 0.09, 0.001);
  return centers.map((center) => ({ center, radius }));
}

/** Additional normal attribute only: original normals and source geometry stay intact. */
export function crownNormalAttribute(
  mesh: Mesh,
  lobes: ReturnType<typeof fitCrownLobes>
) {
  const positions = mesh.geometry.getAttribute('position');
  const result = new Float32BufferAttribute(
    new Float32Array(positions.count * 3),
    3
  );
  const point = new Vector3(),
    direction = new Vector3(),
    normal = new Vector3();
  const toLocal = new Matrix3().getNormalMatrix(mesh.matrixWorld).invert();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    normal.set(0, 0, 0);
    for (const lobe of lobes) {
      direction.copy(point).sub(lobe.center);
      const d = direction.lengthSq(),
        weight = 1 / Math.pow(d + lobe.radius * lobe.radius, 2);
      normal.addScaledVector(direction.normalize(), weight);
    }
    if (normal.lengthSq() < 1e-10) normal.set(0, 1, 0);
    normal.normalize().applyMatrix3(toLocal).normalize();
    result.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return result as BufferAttribute;
}
