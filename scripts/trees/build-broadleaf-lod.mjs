/** Regenerate with: node scripts/trees/build-broadleaf-lod.mjs
 * Index-only LODs preserve the source vertex attributes and runtime styling.
 * Source attribution remains in public/models/trees/CREDITS.md.
 */
import fs from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';
await MeshoptSimplifier.ready;
const source = fs.readFileSync('public/models/trees/stylized-tree.glb');
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength));
const bin = source.subarray(28 + jsonLength);
function read(id) {
  const accessor = gltf.accessors[id],
    view = gltf.bufferViews[accessor.bufferView];
  const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[
    accessor.componentType
  ];
  const size = { VEC3: 3, SCALAR: 1 }[accessor.type];
  if (!Type || !size || accessor.sparse)
    throw Error('Unsupported source accessor');
  const result = new Type(accessor.count * size);
  const stride = view.byteStride || size * Type.BYTES_PER_ELEMENT;
  for (let i = 0; i < accessor.count; i++) {
    result.set(
      new Type(
        bin.buffer,
        bin.byteOffset +
          (view.byteOffset || 0) +
          (accessor.byteOffset || 0) +
          i * stride,
        size
      ),
      i * size
    );
  }
  return result;
}
const chunks = [];
for (const mesh of gltf.meshes)
  for (const primitive of mesh.primitives) {
    const position = read(primitive.attributes.POSITION);
    const index = new Uint32Array(read(primitive.indices));
    // Keep the crown silhouette dense; most savings come from tiny branches.
    const targets = mesh.name.includes('leafes')
      ? [
          [0.8, 0.01],
          [0.55, 0.012],
        ]
      : [
          [0.3, 0.015],
          [0.1, 0.04],
        ];
    const levels = targets.map(
      ([ratio, error]) =>
        MeshoptSimplifier.simplify(
          index,
          position,
          3,
          Math.floor((index.length * ratio) / 3) * 3,
          error,
          ['Prune']
        )[0]
    );
    chunks.push(
      new Uint32Array([
        position.length / 3,
        levels[0].length,
        levels[1].length,
      ]),
      ...levels
    );
    console.log(
      mesh.name,
      'triangles:',
      index.length / 3,
      '→',
      levels.map((level) => level.length / 3).join(' → ')
    );
  }
fs.writeFileSync(
  'public/models/trees/broadleaf-lod.bin',
  Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.buffer)))
);
