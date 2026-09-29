import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { database } from '../repositories/database';
import { REMOTE_OPERATIONAL_MODE } from './operationalDataMode';
import { remoteDataGateway } from './remoteDataGateway';
import { buildingProductionGateService, type BuildingProductionCandidate } from './buildingProductionGateService';

export const BUILDING_RELEASE_SNAPSHOT_VERSION = 'daon-building-release-snapshot-v1';
const SIGNING_KEY_STORAGE_KEY = 'building-release-signing-identity-v1';

export interface BuildingReleaseSnapshot {
  id: string;
  propertyId: string;
  createdAt: string;
  schemaVersion: typeof BUILDING_RELEASE_SNAPSHOT_VERSION;
  package: BuildingProductionCandidate;
  canonicalPackage: string;
  checksumAlgorithm: 'SHA-256';
  checksumHex: string;
  signatureAlgorithm: 'ECDSA_P256_SHA256';
  signatureBase64: string;
  publicKeyJwk: JsonWebKey;
  immutable: true;
  constructionReady: false;
  legalBimReady: false;
}

type SigningIdentity = { publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey };

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${canonicalize(val)}`).join(',')}}`;
}

function bytesToHex(bytes: Uint8Array) { return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function bytesToBase64(bytes: Uint8Array) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function base64ToBytes(value: string) { const binary = atob(value); return Uint8Array.from(binary, (char) => char.charCodeAt(0)); }

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

async function getSigningIdentity(): Promise<SigningIdentity> {
  const db = await database;
  const saved = await db.get('settings', SIGNING_KEY_STORAGE_KEY) as SigningIdentity | undefined;
  if (saved?.privateKeyJwk && saved.publicKeyJwk) return saved;
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const identity = {
    publicKeyJwk: await crypto.subtle.exportKey('jwk', keyPair.publicKey),
    privateKeyJwk: await crypto.subtle.exportKey('jwk', keyPair.privateKey),
  };
  await db.put('settings', identity, SIGNING_KEY_STORAGE_KEY);
  return identity;
}

async function signCanonical(canonical: string, identity: SigningIdentity) {
  const privateKey = await crypto.subtle.importKey('jwk', identity.privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(canonical));
  return bytesToBase64(new Uint8Array(signature));
}

export async function createBuildingReleaseSnapshot(assets: DigitalTwinAsset[]): Promise<BuildingReleaseSnapshot> {
  const candidate = buildingProductionGateService.build(assets);
  if (!candidate.productionCandidateReady || candidate.status !== 'ready' || !candidate.propertyId) {
    throw new Error(`Building Release Snapshot 생성 불가: ${candidate.blockers.join(' / ') || 'release gate blocked'}`);
  }
  const canonicalPackage = canonicalize(candidate);
  const identity = await getSigningIdentity();
  const now = new Date().toISOString();
  const snapshot: BuildingReleaseSnapshot = {
    id: `building-release-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    propertyId: candidate.propertyId,
    createdAt: now,
    schemaVersion: BUILDING_RELEASE_SNAPSHOT_VERSION,
    package: candidate,
    canonicalPackage,
    checksumAlgorithm: 'SHA-256',
    checksumHex: await sha256Hex(canonicalPackage),
    signatureAlgorithm: 'ECDSA_P256_SHA256',
    signatureBase64: await signCanonical(canonicalPackage, identity),
    publicKeyJwk: identity.publicKeyJwk,
    immutable: true,
    constructionReady: false,
    legalBimReady: false,
  };
  if (REMOTE_OPERATIONAL_MODE) {
    await remoteDataGateway.upsertObject({
      objectType: 'buildingReleaseSnapshots',
      id: snapshot.id,
      propertyId: snapshot.propertyId,
      payload: snapshot as unknown as Record<string, unknown>,
    });
  } else {
    await (await database).add('buildingReleaseSnapshots', snapshot);
  }
  return snapshot;
}

export async function listBuildingReleaseSnapshots(propertyId: string): Promise<BuildingReleaseSnapshot[]> {
  const rows = REMOTE_OPERATIONAL_MODE
    ? (await remoteDataGateway.listObjects(propertyId, 'buildingReleaseSnapshots')).map((item) => item.payload as unknown as BuildingReleaseSnapshot)
    : await (await database).getAllFromIndex('buildingReleaseSnapshots', 'propertyId', propertyId) as BuildingReleaseSnapshot[];
  return rows.filter((row) => !(row as BuildingReleaseSnapshot & { deletedAt?: string }).deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function verifyBuildingReleaseSnapshot(snapshot: BuildingReleaseSnapshot) {
  const canonical = canonicalize(snapshot.package);
  const checksumHex = await sha256Hex(canonical);
  const publicKey = await crypto.subtle.importKey('jwk', snapshot.publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const signatureValid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, base64ToBytes(snapshot.signatureBase64), new TextEncoder().encode(canonical));
  return { canonicalMatches: canonical === snapshot.canonicalPackage, checksumValid: checksumHex === snapshot.checksumHex, signatureValid, valid: canonical === snapshot.canonicalPackage && checksumHex === snapshot.checksumHex && signatureValid };
}

export const buildingReleaseSnapshotService = {
  canonicalize,
  create: createBuildingReleaseSnapshot,
  list: listBuildingReleaseSnapshots,
  verify: verifyBuildingReleaseSnapshot,
};