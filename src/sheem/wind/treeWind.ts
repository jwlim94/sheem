import {
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  MeshStandardMaterial,
  RGBADepthPacking,
  Vector3,
} from 'three';
import type { Object3D } from 'three';
import type { WindField, WindSample } from './windField';

/** GPU wind displacement is added after CPU contact, never replacing it. Sample
 * the ambient map field at trunk/crown heights; listener velocity is irrelevant. */
export function createTreeWind(
  root: Object3D,
  kind: 'pine' | 'broadleaf',
  x: number,
  y: number,
  z: number,
  height: number
) {
  const uniforms = {
    treeWindLow: { value: new Vector3() },
    treeWindHigh: { value: new Vector3() },
    treeWindTime: { value: 0 },
  };
  const low: WindSample = { velocity: { x: 0, y: 0, z: 0 }, speed: 0 };
  const high: WindSample = { velocity: { x: 0, y: 0, z: 0 }, speed: 0 };
  const point = new Vector3();
  const targetLow = new Vector3(),
    targetHigh = new Vector3();
  const records: {
    mesh: Mesh;
    inverse: Matrix4;
    low: Vector3;
    high: Vector3;
  }[] = [];
  const depths: MeshDepthMaterial[] = [];
  let initialized = false,
    timer = 1;
  const strength = kind === 'pine' ? 0.012 : 0.022;
  const declarations = `attribute vec2 treeWindShape;
    uniform vec3 treeWindLow; uniform vec3 treeWindHigh; uniform float treeWindTime;`;
  const deformation = `
    float h = treeWindShape.x;
    float phase = treeWindShape.y;
    vec3 breeze = mix(treeWindLow,treeWindHigh,h);
    float sway = .82 + .18*sin(treeWindTime*${kind === 'pine' ? '.85' : '1.15'} + phase*.12);
    transformed += breeze * h*h * sway;
    transformed += breeze * ${kind === 'pine' ? '.12' : '.24'} * h *
      sin(treeWindTime*${kind === 'pine' ? '1.7' : '2.3'} + phase) * TREE_WIND_LEAVES;
  `;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = (
      Array.isArray(object.material) ? object.material : [object.material]
    ) as MeshStandardMaterial[];
    const leaves = materials.some(
      (m) => m.name === 'Leavs' || m.name.startsWith('leafes')
    );
    const record = {
      mesh: object,
      inverse: new Matrix4(),
      low: new Vector3(),
      high: new Vector3(),
    };
    records.push(record);
    const patch = (material: MeshStandardMaterial | MeshDepthMaterial) => {
      const previous = material.onBeforeCompile.bind(material);
      const key = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        previous(shader, renderer);
        shader.uniforms.treeWindLow = { value: record.low };
        shader.uniforms.treeWindHigh = { value: record.high };
        shader.uniforms.treeWindTime = uniforms.treeWindTime;
        shader.vertexShader =
          declarations +
          '\n#define TREE_WIND_LEAVES ' +
          (leaves ? '1.0' : '0.0') +
          '\n' +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n' + deformation
        );
      };
      material.customProgramCacheKey = () =>
        key + '-tree-wind-' + kind + '-' + leaves;
      material.needsUpdate = true;
    };
    materials.forEach(patch);
    const source = materials[0];
    const depth = new MeshDepthMaterial({
      depthPacking: RGBADepthPacking,
      map: source.map,
      alphaMap: source.alphaMap,
      alphaTest: source.alphaTest,
      side: source.side,
    });
    patch(depth);
    object.customDepthMaterial = depth;
    depths.push(depth);
  });
  return {
    update(
      field: WindField,
      seconds: number,
      delta: number,
      reducedMotion = false
    ) {
      if (!initialized) {
        root.updateWorldMatrix(true, true);
        for (const record of records) {
          const { mesh } = record;
          record.inverse.copy(mesh.matrixWorld).invert();
          const positions = mesh.geometry.getAttribute('position');
          const shape = new Float32BufferAttribute(positions.count * 2, 2);
          for (let i = 0; i < positions.count; i++) {
            point
              .fromBufferAttribute(positions, i)
              .applyMatrix4(mesh.matrixWorld);
            const h = Math.max(0, Math.min(1, (point.y - y) / height));
            shape.setXY(i, h, point.x * 2.1 + point.z * 1.7 + point.y * 3.3);
          }
          mesh.geometry.setAttribute('treeWindShape', shape);
          mesh.geometry.computeBoundingSphere();
          const scale = new Vector3().setFromMatrixScale(mesh.matrixWorld);
          mesh.geometry.boundingSphere!.radius +=
            0.5 / Math.min(scale.x, scale.y, scale.z);
        }
        initialized = true;
      }
      const dt = Math.min(Math.max(delta, 0), 0.05);
      timer += dt;
      if (timer >= 0.1) {
        timer = 0;
        field.sample(point.set(x, y + height * 0.25, z), seconds, low);
        field.sample(point.set(x, y + height * 0.8, z), seconds, high);
        targetLow
          .set(low.velocity.x, 0, low.velocity.z)
          .clampLength(0, 12)
          .multiplyScalar(strength);
        targetHigh
          .set(high.velocity.x, 0, high.velocity.z)
          .clampLength(0, 12)
          .multiplyScalar(strength);
      }
      const blend = 1 - Math.exp(-dt / (kind === 'pine' ? 0.65 : 0.4));
      uniforms.treeWindLow.value.lerp(
        reducedMotion ? point.set(0, 0, 0) : targetLow,
        blend
      );
      uniforms.treeWindHigh.value.lerp(
        reducedMotion ? point.set(0, 0, 0) : targetHigh,
        blend
      );
      if (!reducedMotion) uniforms.treeWindTime.value = seconds;
      for (const record of records) {
        // Apply the inverse linear transform, preserving world-space metres.
        const e = record.inverse.elements;
        const lo = uniforms.treeWindLow.value,
          hi = uniforms.treeWindHigh.value;
        record.low.set(
          e[0] * lo.x + e[8] * lo.z,
          e[1] * lo.x + e[9] * lo.z,
          e[2] * lo.x + e[10] * lo.z
        );
        record.high.set(
          e[0] * hi.x + e[8] * hi.z,
          e[1] * hi.x + e[9] * hi.z,
          e[2] * hi.x + e[10] * hi.z
        );
      }
    },
    dispose() {
      depths.forEach((m) => m.dispose());
    },
  };
}
