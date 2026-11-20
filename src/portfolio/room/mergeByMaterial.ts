import { Matrix4, Mesh } from 'three';
import type { InstancedMesh, Material, Object3D, SkinnedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Draws a static part of a model with one call per material: root's mesh
 * children sharing a material (and shadow flags and vertex layout) become
 * one mesh, in root's space. Each draw call costs the CPU about the same
 * whatever its size, and every shadow pass draws them again: his bookcase
 * (210 small meshes, 75 materials) took a third of his room's CPU time to
 * draw (2026-11-20, 1.0-1.3 ms of 3.2-3.7). Left as they are: what keep()
 * names (looked up elsewhere), a mesh with children, transparent ones (they
 * are sorted one by one), mirrored ones, and a material only one uses. Once
 * per root (a cached model's scene is reused on a remount); before its first
 * frame, so the meshes it replaces are never uploaded.
 */
export function mergeByMaterial(
  root: Object3D,
  keep: (o: Object3D) => boolean = () => false
) {
  if (root.userData.mergedByMaterial) return;
  root.userData.mergedByMaterial = true;
  root.updateWorldMatrix(true, true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<string, Mesh[]>();
  for (const o of root.children) {
    const m = o as Mesh,
      mat = m.material as Material | Material[];
    if (
      !m.isMesh ||
      (m as SkinnedMesh).isSkinnedMesh ||
      (m as InstancedMesh).isInstancedMesh ||
      o.children.length ||
      keep(o) ||
      Array.isArray(mat) ||
      mat.transparent ||
      m.matrixWorld.determinant() <= 0
    )
      continue;
    const g = m.geometry,
      key = [
        mat.uuid,
        m.castShadow,
        m.receiveShadow,
        m.renderOrder,
        !!g.index,
        Object.keys(g.attributes)
          .sort()
          .map((k) => k + g.attributes[k].itemSize)
          .join(),
        Object.keys(g.morphAttributes).length,
      ].join('|');
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const parts = meshes.map((m) =>
      m.geometry
        .clone()
        .applyMatrix4(new Matrix4().multiplyMatrices(toRoot, m.matrixWorld))
    );
    const geometry = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    if (!geometry) continue;
    const [first] = meshes,
      merged = new Mesh(geometry, first.material);
    merged.name = `${(first.material as Material).name} (merged)`;
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.renderOrder = first.renderOrder;
    root.add(merged);
    for (const m of meshes) m.removeFromParent();
  }
}
