/*
 * Public listing publish / read / inquiry (phase 2, 2026-11-18; production tables applied 2026-11-17, migration
 * 20261117075320_daon_public_listings_phase2).
 * - Staff publish a frozen allowlist snapshot (buildPublicListingSnapshot). Only owner/admin may set 'published' or
 *   'withdrawn' (RLS: private.daon_can_verify_data); editors are refused by the database, not just by the button.
 * - Buyers read by a random public_id with the anon key only. The anon role can select public_id, status,
 *   address_level, snapshot, snapshot_version and published_at, nothing else (column grants), so the internal property
 *   id never reaches a buyer's browser.
 * - Inquiries: anon insert only, consent required, never readable back by anon.
 * Local mode keeps the same contract in this browser's localStorage, for QA and the demo. It is not a server.
 */
import type { AddressLevel } from '../domain/platform/publicListing';
import type { PublicListingSnapshot } from '../domain/platform/publicListingSnapshot';
import { inquiryProblems, type InquiryInput } from '../domain/platform/publicInquiry';
import { remoteAuthGateway } from './authProviderService';
import { REMOTE_OPERATIONAL_MODE } from './operationalDataMode';
import { DAON_SUPABASE_PROJECT_URL, DAON_SUPABASE_PUBLISHABLE_KEY } from './supabaseProductionConfig';

export type PublicListingStatus = 'draft' | 'published' | 'withdrawn';

export interface PublicListingRecord {
  publicId: string;
  status: PublicListingStatus;
  addressLevel: AddressLevel;
  snapshot: PublicListingSnapshot;
  snapshotVersion: number;
  publishedAt?: string;
}

export type { InquiryInput, InquiryKind } from '../domain/platform/publicInquiry';

export interface PublicListingStore {
  readonly mode: 'remote' | 'local';
  /** Staff: the listing row for one property, or null when it was never prepared. */
  getForProperty(propertyId: string): Promise<PublicListingRecord | null>;
  publish(propertyId: string, snapshot: PublicListingSnapshot, level: AddressLevel): Promise<PublicListingRecord>;
  withdraw(propertyId: string): Promise<void>;
  /** Buyer: a published listing by its public id, or null (unknown, withdrawn or not yet published). */
  getPublished(publicId: string): Promise<PublicListingRecord | null>;
  submitInquiry(publicId: string, input: InquiryInput): Promise<void>;
}

export { INQUIRY_LIMITS, inquiryProblems } from '../domain/platform/publicInquiry';

interface Row { [key: string]: unknown }

function mapRow(row: Row): PublicListingRecord {
  return {
    publicId: String(row.public_id ?? ''),
    status: (row.status as PublicListingStatus) ?? 'draft',
    addressLevel: (row.address_level as AddressLevel) ?? 'dong',
    snapshot: (row.snapshot ?? {}) as PublicListingSnapshot,
    snapshotVersion: typeof row.snapshot_version === 'number' ? row.snapshot_version : 0,
    publishedAt: typeof row.published_at === 'string' ? row.published_at : undefined,
  };
}

const BUYER_COLUMNS = 'public_id,status,address_level,snapshot,snapshot_version,published_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readError(response: Response) {
  const text = await response.text().catch(() => '');
  if (response.status === 401 || response.status === 403 || /row-level security|permission denied/i.test(text)) {
    return new Error('권한이 없습니다. 게시·철회는 대표(owner)·관리자(admin)만 할 수 있습니다.');
  }
  return new Error(`서버가 요청을 거절했습니다 (HTTP ${response.status}).`);
}

export function createRemotePublicListingStore(fetchImpl: typeof fetch = (...args) => fetch(...args)): PublicListingStore {
  const base = `${DAON_SUPABASE_PROJECT_URL.replace(/\/+$/, '')}/rest/v1`;
  const anonHeaders = { apikey: DAON_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  const staffHeaders = async () => {
    const token = (await remoteAuthGateway.getAccessToken())?.trim();
    if (!token) throw new Error('로그인이 필요합니다.');
    return { ...anonHeaders, Authorization: `Bearer ${token}` };
  };
  const actorId = async () => {
    const session = await remoteAuthGateway.getSession();
    if (!session?.userId) throw new Error('로그인이 필요합니다.');
    return session.userId;
  };
  const getForProperty = async (propertyId: string) => {
    const response = await fetchImpl(`${base}/public_listings?property_id=eq.${encodeURIComponent(propertyId)}&select=${BUYER_COLUMNS}`, { headers: await staffHeaders() });
    if (!response.ok) throw await readError(response);
    const rows = (await response.json()) as Row[];
    return rows[0] ? mapRow(rows[0]) : null;
  };
  return {
    mode: 'remote',
    getForProperty,
    async publish(propertyId, snapshot, level) {
      const headers = await staffHeaders();
      const userId = await actorId();
      const existing = await getForProperty(propertyId);
      if (!existing) {
        // RLS lets anyone who may edit insert a draft only; publishing is a separate update that needs owner/admin.
        const insert = await fetchImpl(`${base}/public_listings`, {
          method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ property_id: propertyId, status: 'draft', address_level: level, snapshot, created_by: userId, updated_by: userId }),
        });
        if (!insert.ok) throw await readError(insert);
      }
      const update = await fetchImpl(`${base}/public_listings?property_id=eq.${encodeURIComponent(propertyId)}&select=${BUYER_COLUMNS}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'published', address_level: level, snapshot, snapshot_version: (existing?.snapshotVersion ?? 0) + 1,
          published_at: new Date().toISOString(), published_by: userId, withdrawn_at: null, updated_by: userId,
        }),
      });
      if (!update.ok) throw await readError(update);
      const rows = (await update.json()) as Row[];
      if (!rows[0]) throw new Error('게시 권한이 없습니다. 대표(owner)·관리자(admin)만 게시할 수 있습니다.');
      return mapRow(rows[0]);
    },
    async withdraw(propertyId) {
      const headers = await staffHeaders();
      const userId = await actorId();
      const response = await fetchImpl(`${base}/public_listings?property_id=eq.${encodeURIComponent(propertyId)}&select=public_id`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'withdrawn', withdrawn_at: new Date().toISOString(), updated_by: userId }),
      });
      if (!response.ok) throw await readError(response);
      const rows = (await response.json()) as Row[];
      if (!rows[0]) throw new Error('게시 철회 권한이 없습니다. 대표(owner)·관리자(admin)만 철회할 수 있습니다.');
    },
    async getPublished(publicId) {
      if (!UUID.test(publicId)) return null;
      // Buyer read: anon key only, even when a staff member is signed in, so staff see exactly what buyers see.
      const response = await fetchImpl(`${base}/public_listings?public_id=eq.${publicId}&status=eq.published&select=${BUYER_COLUMNS}`, { headers: anonHeaders });
      if (!response.ok) throw await readError(response);
      const rows = (await response.json()) as Row[];
      return rows[0] ? mapRow(rows[0]) : null;
    },
    async submitInquiry(publicId, input) {
      const problems = inquiryProblems(input);
      if (problems.length) throw new Error(problems[0]);
      if (!UUID.test(publicId)) throw new Error('매물을 찾을 수 없습니다.');
      const response = await fetchImpl(`${base}/public_listing_inquiries`, {
        method: 'POST', headers: { ...anonHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({
          public_listing_id: publicId, kind: input.kind, name: input.name.trim(), contact: input.contact.trim(),
          message: input.message.trim(), consent_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error('문의를 보내지 못했습니다. 게시가 끝난 매물이거나 입력값이 올바르지 않습니다.');
    },
  };
}

const LOCAL_LISTINGS = 'daon-public-listings-v1';
const LOCAL_INQUIRIES = 'daon-public-inquiries-v1';

interface LocalListing extends PublicListingRecord { propertyId: string }

function readLocal<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeLocal(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}
function newPublicId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

export function createLocalPublicListingStore(): PublicListingStore {
  const all = () => readLocal<LocalListing[]>(LOCAL_LISTINGS, []);
  const strip = ({ propertyId: _omit, ...record }: LocalListing): PublicListingRecord => { void _omit; return record; };
  return {
    mode: 'local',
    async getForProperty(propertyId) {
      const row = all().find((item) => item.propertyId === propertyId);
      return row ? strip(row) : null;
    },
    async publish(propertyId, snapshot, level) {
      const rows = all();
      const existing = rows.find((item) => item.propertyId === propertyId);
      const next: LocalListing = {
        propertyId, publicId: existing?.publicId ?? newPublicId(), status: 'published', addressLevel: level,
        snapshot: JSON.parse(JSON.stringify(snapshot)) as PublicListingSnapshot, snapshotVersion: (existing?.snapshotVersion ?? 0) + 1,
        publishedAt: new Date().toISOString(),
      };
      writeLocal(LOCAL_LISTINGS, [...rows.filter((item) => item.propertyId !== propertyId), next]);
      return strip(next);
    },
    async withdraw(propertyId) {
      writeLocal(LOCAL_LISTINGS, all().map((item) => (item.propertyId === propertyId ? { ...item, status: 'withdrawn' as const } : item)));
    },
    async getPublished(publicId) {
      const row = all().find((item) => item.publicId === publicId && item.status === 'published');
      return row ? strip(row) : null;
    },
    async submitInquiry(publicId, input) {
      const problems = inquiryProblems(input);
      if (problems.length) throw new Error(problems[0]);
      if (!all().some((item) => item.publicId === publicId && item.status === 'published')) throw new Error('문의를 보내지 못했습니다. 게시가 끝난 매물입니다.');
      const rows = readLocal<unknown[]>(LOCAL_INQUIRIES, []);
      writeLocal(LOCAL_INQUIRIES, [...rows, { publicListingId: publicId, kind: input.kind, name: input.name.trim(), contact: input.contact.trim(), message: input.message.trim(), consentAt: new Date().toISOString(), status: 'new' }]);
    },
  };
}

export const publicListingStore: PublicListingStore = REMOTE_OPERATIONAL_MODE ? createRemotePublicListingStore() : createLocalPublicListingStore();
