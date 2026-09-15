import type { BuildingReleaseSnapshot } from './buildingReleaseSnapshotService';
import type { GeometryMutationResult, MutatedWallSolid, WallPartition } from './geometryMutationEngineService';

export const GLTF_EXPORT_ADAPTER_VERSION = 'daon-gltf-export-v2';

type P3 = { x: number; y: number; z: number };
export interface ReleaseMeshFloorGroup { floorLabel: string; assetId: string; indexStart: number; indexCount: number; vertexStart: number; vertexCount: number; promotionId?: string; sourceFingerprint: string; }

function bytesToBase64(bytes: Uint8Array) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function align4(value: number) { return (value + 3) & ~3; }
function minMax(vertices: Float32Array) {
  if (!vertices.length) return { min: [0,0,0], max: [0,0,0] };
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (let i=0;i<vertices.length;i+=3) for (let axis=0;axis<3;axis+=1) { min[axis]=Math.min(min[axis],vertices[i+axis]); max[axis]=Math.max(max[axis],vertices[i+axis]); }
  return { min, max };
}

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
  const vertices: number[] = []; const indices: number[] = []; const floorGroups: ReleaseMeshFloorGroup[] = []; let omittedSlabsWithHoles = 0; let slabMetadataCount = 0;
  for (const floor of snapshot.package.floors) {
    const vertexStart = vertices.length / 3; const indexStart = indices.length;
    const result = floor.geometry as GeometryMutationResult;
    for (const wall of result.walls ?? []) for (const partition of wall.partitions ?? []) addWallPartition(vertices, indices, wall, partition, floor.elevationM);
    for (const fill of result.junctionFills ?? []) addBox(vertices, indices, { x: fill.center.x, y: fill.center.y, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, fill.sizeM / 2, fill.sizeM / 2, floor.elevationM, floor.elevationM + fill.heightM);
    for (const slab of result.slabs ?? []) { slabMetadataCount += 1; if (slab.holes?.length) omittedSlabsWithHoles += 1; }
    floorGroups.push({ floorLabel: floor.floorLabel, assetId: floor.assetId, indexStart, indexCount: indices.length-indexStart, vertexStart, vertexCount: vertices.length/3-vertexStart, promotionId: floor.promotionId, sourceFingerprint: floor.sourceFingerprint });
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), floorGroups, omittedSlabsWithHoles, slabMetadataCount };
}

function gltfCore(snapshot: BuildingReleaseSnapshot, withUri: boolean) {
  const mesh = buildReleaseMesh(snapshot); const posBytes = new Uint8Array(mesh.vertices.buffer); const indexOffset = align4(posBytes.byteLength); const total = align4(indexOffset + mesh.indices.byteLength); const bin = new Uint8Array(total); bin.set(posBytes); bin.set(new Uint8Array(mesh.indices.buffer), indexOffset); const bounds = minMax(mesh.vertices);
  const gltf = {
    asset: { version: '2.0', generator: GLTF_EXPORT_ADAPTER_VERSION },
    scene: 0,
    scenes: [{ nodes: [0], name: 'DA:ON Building Release' }],
    nodes: [{ mesh: 0, name: `DAON_${snapshot.id}`, extras: { floorGroups: mesh.floorGroups.map((g) => ({ floorLabel: g.floorLabel, assetId: g.assetId, promotionId: g.promotionId, sourceFingerprint: g.sourceFingerprint })) } }],
    materials: [{ name: 'DAON_Reviewed_Wall', pbrMetallicRoughness: { baseColorFactor: [0.18,0.31,0.48,1], metallicFactor: 0, roughnessFactor: 0.85 } }],
    meshes: [{ name: 'DAON reviewed production candidate', primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0, mode: 4 }], extras: { floorGroups: mesh.floorGroups } }],
    buffers: [{ byteLength: bin.byteLength, ...(withUri ? { uri: `data:application/octet-stream;base64,${bytesToBase64(bin)}` } : {}) }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: posBytes.byteLength, target: 34962 }, { buffer: 0, byteOffset: indexOffset, byteLength: mesh.indices.byteLength, target: 34963 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: mesh.vertices.length / 3, type: 'VEC3', min: bounds.min, max: bounds.max },
      { bufferView: 1, componentType: 5125, count: mesh.indices.length, type: 'SCALAR' },
    ],
    extras: { releaseSnapshotId: snapshot.id, checksum: snapshot.checksumHex, signatureAlgorithm: snapshot.signatureAlgorithm, adapterVersion: GLTF_EXPORT_ADAPTER_VERSION, units: 'meter', upAxis: 'Z', constructionReady: false, legalBimReady: false, slabMetadataCount: mesh.slabMetadataCount, omittedSlabsWithHoles: mesh.omittedSlabsWithHoles, note: 'Floor groups, promotion provenance and material naming are preserved. Slabs with core holes remain authoritative in release/BIM metadata and are not guessed by browser triangulation.' },
  };
  return { gltf, mesh, bin };
}

export function exportReleaseGltf(snapshot: BuildingReleaseSnapshot) { const result = gltfCore(snapshot, true); return { gltf: result.gltf, mesh: result.mesh }; }
export function exportReleaseGlb(snapshot: BuildingReleaseSnapshot) {
  const result = gltfCore(snapshot, false); const jsonRaw = new TextEncoder().encode(JSON.stringify(result.gltf)); const jsonLength = align4(jsonRaw.byteLength); const binLength = result.bin.byteLength; const total = 12 + 8 + jsonLength + 8 + binLength;
  const out = new ArrayBuffer(total); const view = new DataView(out); const bytes = new Uint8Array(out); view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true); bytes.fill(0x20, 20, 20 + jsonLength); bytes.set(jsonRaw, 20); const binHeader = 20 + jsonLength; view.setUint32(binHeader, binLength, true); view.setUint32(binHeader + 4, 0x004e4942, true); bytes.set(result.bin, binHeader + 8); return out;
}

export const gltfExportService = { buildMesh: buildReleaseMesh, toGltf: exportReleaseGltf, toGlb: exportReleaseGlb };