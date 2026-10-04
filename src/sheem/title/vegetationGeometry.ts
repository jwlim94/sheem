import * as THREE from 'three';
export function createGrassBlade(capacity: number) {
  const g = new THREE.BufferGeometry();
  const positions: number[] = [],
    indices: number[] = [];
  for (let row = 0; row < 4; row++) {
    const t = row / 4;
    const width = 0.055 * (1 - t * 0.85);
    positions.push(-width, t, 0, width, t, 0);
    if (row < 3) {
      const k = row * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  positions.push(0, 1, 0);
  indices.push(6, 7, 8);
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.setAttribute(
    'groundNormal',
    new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
  );
  g.setAttribute(
    'groundColor',
    new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
  );
  return g;
}
