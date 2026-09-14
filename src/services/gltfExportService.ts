import type { BuildingReleaseSnapshot } from './buildingReleaseSnapshotService';
import type { GeometryMutationResult, MutatedWallSolid, WallPartition } from './geometryMutationEngineService';

export const GLTF_EXPORT_ADAPTER_VERSION = 'daon-gltf-export-v1';

type P3 = { x: number; y: number; z: number };

function bytesToBase64(bytes: Uint8Array) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function align4(value: number) { return (value + 3) & ~3; }

function addBox(vertices: number[], indices: number[], center: P3, ux: P3, uy: P3, halfLength: number, halfWidth: number, z0: number, z1: number) {
  const base = vertices.length / 3;
  const corners = [[-1,-1,z0],[1,-1,z0],[1,1,z0],[-1,1,z0],[-1,-1,z1],[1,-1,z1],[1,1,z1],[-1,1,z1]] as const;
  for (const [lx, ly, z] of corners) vertices.push(center.x + ux.x * halfLength * lx + uy.x * halfWidth * ly, center.y + ux.y * halfLength * lx + uy.y * halfWidth * ly, z);
  const faces = [[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]];
  for (const face of faces) indices.push(...face.map((i) => base + i));
}

function addWallPartition(vertices: number[], indices: number[], wall: MutatedWallSolid, partition: WallPartition, elevationM: number) {
  const dx = wall.end.x - wall.start.x; const dy = wall.end.y - wall.start.y; const length = Math.hypot(dx, dy);
  if (!length) return;
  const ux = { x: dx / length, y: dy / length, z: 0 }; const uy = { x: -ux.y, y: ux.x, z: 0 };
  const uMid = (partition.u0 + partition.u1) / 2;
  const center = { x: wall.start.x + ux.x * uMid, y: wall.start.y + ux.y * uMid, z: 0 };
  addBox(vertices, indices, center, ux, uy, (partition.u1 - partition.u0) / 2, wall.thicknessM / 2, elevationM + partition.z0, elevationM + partition.z1);
}

export function buildReleaseMesh(snapshot: BuildingReleaseSnapshot) {
  const vertices: number[] = []; const indices: number[] = []; let omittedSlabsWithHoles = 0; let slabMetadataCount = 0;
  for (const floor of snapshot.package.floors) {
    const result = floor.geometry as GeometryMutationResult;
    for (const wall of result.walls ?? []) for (const partition of wall.partitions ?? []) addWallPartition(vertices, indices, wall, partition, floor.elevationM);
    for (const fill of result.junctionFills ?? []) addBox(vertices, indices, { x: fill.center.x, y: fill.center.y, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, fill.sizeM / 2, fill.sizeM / 2, floor.elevationM, floor.elevationM + fill.heightM);
    for (const slab of result.slabs ?? []) { slabMetadataCount += 1; if (slab.holes?.length) omittedSlabsWithHoles += 1; }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), omittedSlabsWithHoles, slabMetadataCount };
}

export function exportReleaseGltf(snapshot: BuildingReleaseSnapshot) {
  const mesh = buildReleaseMesh(snapshot);
  const posBytes = new Uint8Array(mesh.vertices.buffer); const indexOffset = align4(posBytes.byteLength); const total = indexOffset + mesh.indices.byteLength;
  const bin = new Uint8Array(total); bin.set(posBytes); bin.set(new Uint8Array(mesh.indices.buffer), indexOffset);
  const gltf = {
    asset: { version: '2.0', generator: GLTF_EXPORT_ADAPTER_VERSION },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: `DAON_${snapshot.id}` }],
    meshes: [{ name: 'DAON reviewed production candidate', primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    buffers: [{ byteLength: bin.byteLength, uri: `data:application/octet-stream;base64,${bytesToBase64(bin)}` }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: posBytes.byteLength, target: 34962 }, { buffer: 0, byteOffset: indexOffset, byteLength: mesh.indices.byteLength, target: 34963 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: mesh.vertices.length / 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5125, count: mesh.indices.length, type: 'SCALAR' },
    ],
    extras: {
      releaseSnapshotId: snapshot.id, checksum: snapshot.checksumHex, signatureAlgorithm: snapshot.signatureAlgorithm,
      constructionReady: false, legalBimReady: false, slabMetadataCount: mesh.slabMetadataCount, omittedSlabsWithHoles: mesh.omittedSlabsWithHoles,
      note: 'Wall partitions and junction fills are exported as review mesh. Slabs with core holes remain authoritative in release JSON/BIM handoff metadata and are not triangulated by this browser adapter.',
    },
  };
  return { gltf, mesh };
}

export function exportReleaseGlb(snapshot: BuildingReleaseSnapshot) {
  const mesh = buildReleaseMesh(snapshot);
  const posBytes = new Uint8Array(mesh.vertices.buffer); const indexOffset = align4(posBytes.byteLength); const binLength = align4(indexOffset + mesh.indices.byteLength);
  const bin = new Uint8Array(binLength); bin.set(posBytes); bin.set(new Uint8Array(mesh.indices.buffer), indexOffset);
  const gltf = {
    asset: { version: '2.0', generator: GLTF_EXPORT_ADAPTER_VERSION }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: `DAON_${snapshot.id}` }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }], buffers: [{ byteLength: binLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: posBytes.byteLength, target: 34962 }, { buffer: 0, byteOffset: indexOffset, byteLength: mesh.indices.byteLength, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: mesh.vertices.length / 3, type: 'VEC3' }, { bufferView: 1, componentType: 5125, count: mesh.indices.length, type: 'SCALAR' }],
    extras: { releaseSnapshotId: snapshot.id, checksum: snapshot.checksumHex, constructionReady: false, legalBimReady: false, omittedSlabsWithHoles: mesh.omittedSlabsWithHoles },
  };
  const jsonRaw = new TextEncoder().encode(JSON.stringify(gltf)); const jsonLength = align4(jsonRaw.byteLength); const total = 12 + 8 + jsonLength + 8 + binLength;
  const out = new ArrayBuffer(total); const view = new DataView(out); const bytes = new Uint8Array(out); view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true); bytes.fill(0x20, 20, 20 + jsonLength); bytes.set(jsonRaw, 20);
  const binHeader = 20 + jsonLength; view.setUint32(binHeader, binLength, true); view.setUint32(binHeader + 4, 0x004e4942, true); bytes.set(bin, binHeader + 8);
  return out;
}

export const gltfExportService = { buildMesh: buildReleaseMesh, toGltf: exportReleaseGltf, toGlb: exportReleaseGlb };