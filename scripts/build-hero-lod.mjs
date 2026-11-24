/** Regenerate with: node scripts/build-hero-lod.mjs
 * (after every rebuild of public/models/jongwoo/jongwoo-v2.glb).
 *
 * His body is 482 k triangles (the source mesh, skinned whole so his face
 * keeps its detail: art/characters/jongwoo-v2/build_web_glb.py), and on
 * /portfolio it was the costliest thing in every frame: skinned in the
 * frame itself and in each shadow pass (three of the lamp's cube faces in
 * his room). This writes simplified index buffers over the same vertices
 * (index-only, like scripts/trees/build-broadleaf-lod.mjs, so skin weights,
 * UVs and normals stay exactly as built), two per part:
 *   - drawn: 30 % of the triangles. In close-ups his face, hands and hoodie
 *     look the same as at full resolution (compared side by side,
 *     2026-11-20); at 10 % the hoodie's texture smeared on a sleeve.
 *   - shadow: 10 %, for the shadow passes only.
 * RoomScene (heroLod.ts) checks each part's vertex count, triangle count and
 * index hash against the GLB it loaded and keeps the full mesh on a
 * mismatch, so a stale file is never applied to a rebuilt model.
 *
 * Output: public/models/jongwoo/jongwoo-v2-lod.bin, little-endian uint32s:
 *   'HLOD', version 1, part count; per part: name length (bytes), the name
 *   (UTF-8, padded to 4), vertex count, triangle count, the full index
 *   buffer's hash (heroLod.ts: hashIndex), level count; per level: index
 *   count, encoded length (bytes), then the meshopt-encoded index buffer
 *   (padded to 4).
 */
import fs from 'node:fs';
import draco3d from 'draco3d'; // with drei (three-stdlib), as its Node build
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const SOURCE = 'public/models/jongwoo/jongwoo-v2.glb';
const OUT = 'public/models/jongwoo/jongwoo-v2-lod.bin';
// Parts (glTF node names, as three names their meshes) and each level's share
// of the triangles. The rest (slippers, the worn bag, the blinking lids) are
// 15-35 k each and stay as built.
const PARTS = { Jongwoo: [0.3, 0.1], Sneakers: [0.3, 0.1], Socks: [0.3, 0.1] };
// How much a vertex's normal and UV weigh against its place when collapsing
// (meshopt: attribute differences are compared with position error).
const WEIGHTS = [0.5, 0.5, 0.5, 4, 4];

/** FNV-1a over an index buffer's values: must match heroLod.ts. */
function hashIndex(index) {
  let h = 0x811c9dc5;
  for (let i = 0; i < index.length; i++) {
    h ^= index[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready]);
const draco = await draco3d.createDecoderModule({});
const source = fs.readFileSync(SOURCE);
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength));
const bin = source.subarray(28 + jsonLength);

/** A Draco primitive's attribute (by its glTF name) as floats. */
function floats(decoder, mesh, ext, name) {
  const attribute = decoder.GetAttributeByUniqueId(mesh, ext.attributes[name]);
  const size = attribute.num_components(),
    count = mesh.num_points() * size,
    bytes = count * 4,
    ptr = draco._malloc(bytes);
  decoder.GetAttributeDataArrayForAllPoints(
    mesh,
    attribute,
    draco.DT_FLOAT32,
    bytes,
    ptr
  );
  const out = new Float32Array(draco.HEAPF32.buffer, ptr, count).slice();
  draco._free(ptr);
  return { array: out, size };
}

function triangles(decoder, mesh) {
  const count = mesh.num_faces() * 3,
    bytes = count * 4,
    ptr = draco._malloc(bytes);
  decoder.GetTrianglesUInt32Array(mesh, bytes, ptr);
  const out = new Uint32Array(draco.HEAPU32.buffer, ptr, count).slice();
  draco._free(ptr);
  return out;
}

const chunks = [];
const u32 = (...values) =>
  chunks.push(Buffer.from(new Uint32Array(values).buffer));
const padded = (bytes) => {
  chunks.push(Buffer.from(bytes));
  const pad = (4 - (bytes.length % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad));
};
u32(0x444f4c48, 1, Object.keys(PARTS).length);

for (const [name, ratios] of Object.entries(PARTS)) {
  const node = gltf.nodes.find((n) => n.name === name && n.mesh !== undefined);
  if (!node) throw Error(`No node ${name} in ${SOURCE}`);
  const primitives = gltf.meshes[node.mesh].primitives;
  if (primitives.length !== 1) throw Error(`${name}: one primitive expected`);
  const ext = primitives[0].extensions?.KHR_draco_mesh_compression;
  if (!ext) throw Error(`${name}: Draco compression expected`);
  const view = gltf.bufferViews[ext.bufferView];
  const data = new Int8Array(
    bin.buffer,
    bin.byteOffset + (view.byteOffset || 0),
    view.byteLength
  );
  const decoder = new draco.Decoder(),
    mesh = new draco.Mesh();
  const status = decoder.DecodeArrayToMesh(data, data.length, mesh);
  if (!status.ok()) throw Error(`${name}: ${status.error_msg()}`);
  const index = triangles(decoder, mesh),
    position = floats(decoder, mesh, ext, 'POSITION'),
    normal = floats(decoder, mesh, ext, 'NORMAL'),
    uv = floats(decoder, mesh, ext, 'TEXCOORD_0');
  const vertices = mesh.num_points();
  draco.destroy(mesh);
  draco.destroy(decoder);
  const attributes = new Float32Array(vertices * 5);
  for (let i = 0; i < vertices; i++) {
    attributes.set(normal.array.subarray(i * 3, i * 3 + 3), i * 5);
    attributes.set(uv.array.subarray(i * 2, i * 2 + 2), i * 5 + 3);
  }
  const nameBytes = Buffer.from(name, 'utf8');
  u32(nameBytes.length);
  padded(nameBytes);
  u32(vertices, index.length / 3, hashIndex(index), ratios.length);
  const report = [];
  for (const ratio of ratios) {
    const [level, error] = MeshoptSimplifier.simplifyWithAttributes(
      index,
      position.array,
      3,
      attributes,
      5,
      WEIGHTS,
      null,
      Math.floor((index.length * ratio) / 3) * 3,
      0.02
    );
    // Triangles in vertex-cache order (meshopt's reorder, its vertex
    // renumbering undone: the vertices stay where the GLB has them), which
    // the GPU and the index codec both like.
    const before = level.slice().sort();
    const [remap] = MeshoptEncoder.reorderMesh(level, true, false);
    const back = new Uint32Array(remap.length);
    for (let v = 0; v < remap.length; v++)
      if (remap[v] !== 0xffffffff) back[remap[v]] = v;
    for (let i = 0; i < level.length; i++) level[i] = back[level[i]];
    if (
      level
        .slice()
        .sort()
        .some((v, i) => v !== before[i])
    )
      throw Error(`${name}: reordering changed the triangles' vertices`);
    const encoded = MeshoptEncoder.encodeIndexBuffer(
      new Uint8Array(level.buffer, level.byteOffset, level.byteLength),
      level.length,
      4
    );
    u32(level.length, encoded.length);
    padded(encoded);
    report.push(
      `${level.length / 3} (error ${error.toExponential(1)}, ${Math.round(encoded.length / 1024)} KB)`
    );
  }
  console.log(name, 'triangles:', index.length / 3, '→', report.join(' → '));
}
const out = Buffer.concat(chunks);
fs.writeFileSync(OUT, out);
console.log(OUT, Math.round(out.length / 1024), 'KB');
