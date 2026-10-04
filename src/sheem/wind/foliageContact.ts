import {
  BufferAttribute,
  Matrix4,
  Mesh,
  Vector3,
  DynamicDrawUsage,
  MathUtils,
} from 'three';
import { stepGrassContact } from './grassContact.ts';
import type { GrassContactBody } from './grassContact.ts';

/** Each leaf point uses the grass contact response locally. No shared branch
 * displacement: a touch cannot move distant parts of the same connected frond. */
export function createFoliageContact(
  mesh: Mesh,
  trunkX: number,
  trunkZ: number,
  isolate = false,
  smallLeaves = false
) {
  const position = mesh.geometry.getAttribute('position') as BufferAttribute;
  position.setUsage(DynamicDrawUsage);
  const rest = Float32Array.from(position.array);
  const parent = Array.from({ length: position.count }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const join = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  const seams = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const key = `${rest[i * 3].toFixed(5)},${rest[i * 3 + 1].toFixed(5)},${rest[i * 3 + 2].toFixed(5)}`;
    const other = seams.get(key);
    if (other !== undefined) join(i, other);
    else seams.set(key, i);
  }
  const index = mesh.geometry.index;
  const indices = Array.from(
    { length: index?.count ?? position.count },
    (_, i) => (index ? index.getX(i) : i)
  );
  for (let i = 0; i + 2 < indices.length; i += 3) {
    join(indices[i], indices[i + 1]);
    join(indices[i], indices[i + 2]);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < position.count; i++) {
    const id = find(i);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(i);
  }
  const worldRest = new Float32Array(rest.length),
    weights = new Float32Array(position.count);
  const inverse = new Matrix4(),
    point = new Vector3(),
    root = new Vector3(),
    tip = new Vector3();
  const center = new Vector3();
  const responses = Array.from({ length: position.count }, () => ({
    x: 0,
    z: 0,
    intensity: 0,
  }));
  const buckets = new Map<string, number[]>();
  const active = new Set<number>();
  const cellSize = 0.75;
  const triangles: number[] = [];
  let selected: number[] = [],
    initialized = false;
  return {
    probe: tip,
    anchor: root,
    update(bodies: readonly GrassContactBody[], delta: number) {
      if (!initialized) {
        mesh.updateWorldMatrix(true, false);
        inverse.copy(mesh.matrixWorld).invert();
        for (let i = 0; i < position.count; i++)
          point
            .fromArray(rest, i * 3)
            .applyMatrix4(mesh.matrixWorld)
            .toArray(worldRest, i * 3);
        let best = Infinity,
          selectedId = -1;
        // Locate the branch used by the isolated comparison.
        for (const [id, vertices] of groups) {
          center.set(0, 0, 0);
          for (const i of vertices)
            center.add(point.fromArray(worldRest, i * 3));
          center.divideScalar(vertices.length);
          const score =
            (center.x - trunkX - 1) ** 2 +
            (center.z - trunkZ - 0.5) ** 2 +
            4 * (center.y - 0.95) ** 2;
          if (score < best) {
            best = score;
            selected = vertices;
            selectedId = id;
          }
        }
        for (let i = 0; i + 2 < indices.length; i += 3)
          if (find(indices[i]) === selectedId)
            triangles.push(indices[i], indices[i + 1], indices[i + 2]);
        if (isolate) mesh.geometry.setIndex(triangles);
        const branchVertices = isolate ? [selected] : [...groups.values()];
        const pickedTip = new Vector3(),
          pickedRoot = new Vector3();
        for (const vertices of branchVertices) {
          let inner = Infinity;
          for (const i of vertices) {
            point.fromArray(worldRest, i * 3);
            const r = Math.hypot(point.x - trunkX, point.z - trunkZ);
            if (r < inner) {
              inner = r;
              root.copy(point);
            }
          }
          let far = 0;
          for (const i of vertices) {
            point.fromArray(worldRest, i * 3);
            const d = point.distanceToSquared(root);
            if (d > far) {
              far = d;
              tip.copy(point);
            }
          }
          for (const i of vertices) {
            point.fromArray(worldRest, i * 3).sub(root);
            // Anchor only the actual attachment. Squaring progress along the
            // whole frond suppressed most mid-branch touches almost to zero.
            weights[i] = smallLeaves
              ? MathUtils.smoothstep(
                  point.length(),
                  Math.sqrt(far) * 0.08,
                  Math.max(0.001, Math.sqrt(far) * 0.75)
                )
              : MathUtils.smoothstep(point.length(), 0.18, 0.65);
          }
          if (vertices === selected) {
            pickedTip.copy(tip);
            pickedRoot.copy(root);
          }
        }
        tip.copy(pickedTip);
        root.copy(pickedRoot);
        if (!isolate) selected = branchVertices.flat();
        for (const i of selected) {
          const key = `${Math.floor(worldRest[i * 3] / cellSize)},${Math.floor(worldRest[i * 3 + 2] / cellSize)}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(i);
        }
        mesh.geometry.computeBoundingSphere();
        const scale = new Vector3().setFromMatrixScale(mesh.matrixWorld);
        mesh.geometry.boundingSphere!.radius +=
          0.3 / Math.min(scale.x, scale.y, scale.z);
        initialized = true;
      }
      // Visit only touched cells plus vertices still recovering, even for dense assets.
      for (const body of bodies) {
        if (!body.active) continue;
        const r = body.radius + 0.12;
        for (
          let x = Math.floor((body.position.x - r) / cellSize);
          x <= Math.floor((body.position.x + r) / cellSize);
          x++
        )
          for (
            let z = Math.floor((body.position.z - r) / cellSize);
            z <= Math.floor((body.position.z + r) / cellSize);
            z++
          )
            for (const i of buckets.get(`${x},${z}`) ?? [])
              if (
                worldRest[i * 3 + 1] <= body.position.y + body.height &&
                worldRest[i * 3 + 1] + 0.3 >= body.position.y
              )
                active.add(i);
      }
      const changed = active.size > 0;
      for (const i of active) {
        point.fromArray(worldRest, i * 3);
        const response = responses[i];
        // Identical local range, depth, direction and recovery model as grass.
        // 30 cm effective leaf length: visible local brushing, capped at 25.5 cm.
        stepGrassContact(point, 0.3, bodies, delta, response);
        if (
          response.intensity === 0 &&
          Math.hypot(response.x, response.z) < 0.0001
        ) {
          response.x = 0;
          response.z = 0;
          active.delete(i);
        }
        point.x += response.x * weights[i];
        point.z += response.z * weights[i];
        point.y -= Math.hypot(response.x, response.z) * weights[i] * 0.12;
        point.applyMatrix4(inverse);
        position.setXYZ(i, point.x, point.y, point.z);
      }
      if (changed) position.needsUpdate = true;
    },
  };
}
