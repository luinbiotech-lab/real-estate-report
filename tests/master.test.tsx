import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyProperty } from '../src/types';
import type { Property } from '../src/types';
import type { DataRoomBundle, PropertyMedia } from '../src/domain/propertyDataRoom/types';
import { buildProfessionalReportViewModel, reportDataBuilder } from '../src/services/reportEngine/reportDataBuilder';
import { buildMasterPresentation } from '../src/services/reportEngine/masterPresentation';
import { DAON_SETTINGS } from '../src/domain/professionalReport/brandProfile';
import { internalPhotoAllowed, isBangbae81511 } from '../src/domain/professionalReport/reportAccessPolicy';
import { resolveProfessionalRenderer } from '../src/domain/professionalReport/templateIds';
import { snapshotMediaIssue } from '../src/domain/professionalReport/mediaPolicy';
import { DaonOnePageMaster } from '../src/components/professionalReport/DaonOnePageMaster';
import { DaonDetail7PageMaster } from '../src/components/professionalReport/DaonDetail7PageMaster';
import { LegacyDaonDetail7PageMasterV2 } from '../src/components/professionalReport/LegacyDaonDetail7PageMasterV2';
import { propertyRepository, settingsRepository } from '../src/repositories/propertyRepository';
import { propertyDataRoomRepository } from '../src/repositories/propertyDataRoomRepository';
import { reportSnapshotService } from '../src/services/reportEngine/reportSnapshotService';
import { importJobRepository } from '../src/repositories/importJobRepository';
import { runImportQueue } from '../src/services/importAutomation/importJobService';
import { database } from '../src/repositories/database';
import type { ImportJob } from '../src/services/importAutomation/types';
import { calculateUnitPrice, sqmToPyeong, pyeongToSqm } from '../src/domain/professionalReport/calculations';
import { createId } from '../src/utils/createId';

const now = '2026-09-09T00:00:00.000Z';
const bundle = (): DataRoomBundle => ({ documents: [], media: [], verifications: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] });
const property = (patch: Partial<Property> = {}): Property => ({ ...structuredClone(emptyProperty), id: 'qa-seongsu', name: '성수동 QA 샘플', address: '성수동2가 331-7', salePrice: 5300000000, landAreaPyeong: 36, landAreaSqm: 119.01, totalFloorAreaPyeong: 63.63, totalFloorAreaSqm: 210.35, basementFloors: 1, managerName: '이전 담당자', managerPhone: '000', isSample: true, createdAt: now, updatedAt: now, ...patch });
const media = (id: string, category: PropertyMedia['category'], url: string, propertyId = 'qa-bangbae'): PropertyMedia => ({ id, propertyId, mediaType: 'image', category, storagePath: id, url, fileName: id, caption: id, aiTags: [], verificationStatus: 'confirmed', sortOrder: 0, isPrimary: false, createdAt: now, updatedAt: now });

test('property content is isolated; header/facts never inherit basement or location claims', () => {
  const model = buildProfessionalReportViewModel(property(), bundle(), { generatedAt: now });
  const view = buildMasterPresentation(model);
  const html = renderToStaticMarkup(<DaonOnePageMaster view={view} />);
  assert.doesNotMatch(html, /방배동|BANGBAE|래미안|서래마을|방음시설|이전 담당자/);
  assert.match(html, /daonasset.korea@gmail.com/);
  assert.doesNotMatch(html, /김은미|신반포로|서초/);
  assert.match(html, /지하 특화/);
  assert.equal(view.facts.find(([label]) => label === '지하 특화')?.[1], '확인 필요');
  assert.equal(view.parking, '주차 확인 필요');
  assert.equal(model.pricing.salePrice.state, 'unverified');
});

test('explicit slots round-trip independently between two properties', () => {
  const a = property({ reportContent: { heroHeadline: 'A headline', locationHeadline: 'A location' } });
  const b = property({ id: 'qa-other', reportContent: { heroHeadline: 'B headline', locationHeadline: 'B location' } });
  assert.equal(buildMasterPresentation(buildProfessionalReportViewModel(a, bundle())).heroHeadline, 'A headline');
  assert.equal(buildMasterPresentation(buildProfessionalReportViewModel(b, bundle())).heroHeadline, 'B headline');
  assert.equal(a.reportContent?.heroHeadline, 'A headline');
});

test('template ID/version pairs fail closed and retain both historical renderers', () => {
  assert.equal(resolveProfessionalRenderer({ templateVersion: 'professional-v1' }), 'legacy-professional');
  assert.equal(resolveProfessionalRenderer({ templateId: 'DAON_DETAIL_7P_MASTER', templateVersion: 'daon-detail-7p-v1' }), 'legacy-daon-v1');
  assert.equal(resolveProfessionalRenderer({ templateVersion: 'DAON_DETAIL_7P_MASTER' }), 'legacy-daon-v1');
  assert.equal(resolveProfessionalRenderer({ templateId: 'DAON_DETAIL_7P_MASTER', templateVersion: 'daon-detail-7p-v2' }), 'daon-v2');
  assert.equal(resolveProfessionalRenderer({ templateId: 'DAON_DETAIL_7P_MASTER', templateVersion: 'daon-detail-7p-v3' }), 'daon-v3');
  assert.equal(resolveProfessionalRenderer({ templateId: 'unknown', templateVersion: 'professional-v1' }), null);
  assert.equal(resolveProfessionalRenderer({ templateId: 'DAON_DETAIL_7P_MASTER', templateVersion: 'future' }), null);
  assert.equal(resolveProfessionalRenderer({ templateId: 'professional-v1', templateVersion: 'daon-detail-7p-v2' }), null);
});

test('seller restriction is scoped; interior/unknown main cannot bypass it', () => {
  const p = property({ id: 'qa-bangbae', name: '방배동 815-11', address: '서울 서초구 동광로18길 7', internalPhotoAllowed: true, mainImage: 'internal', additionalImages: ['unknown'] });
  assert.equal(internalPhotoAllowed(p), false);
  assert.equal(internalPhotoAllowed(property()), true);
  assert.equal(isBangbae81511(property({ name: '', address: '방배동 815-110' })), false);
  assert.equal(isBangbae81511(property({ name: '', address: '동광로18길 70' })), false);
  const b = bundle(); b.media = [media('interior', 'interior', 'internal'), media('outside', 'exterior', 'external'), media('unknown', 'other', 'unknown'), media('other-property', 'exterior', 'foreign', 'another')];
  const model = buildProfessionalReportViewModel(p, b);
  assert.deepEqual(model.media.items.map((m) => m.url), ['external']);
  assert.equal(model.media.mainImage.value, 'external');
  assert.equal(snapshotMediaIssue(model, p), null);
  const unsafe = structuredClone(model); unsafe.media.mainImage.value = 'internal';
  assert.ok(snapshotMediaIssue(unsafe, p));
  const unrestricted = buildProfessionalReportViewModel(property({ mainImage: 'internal', mainImageCategory: 'interior' }), bundle());
  assert.equal(unrestricted.media.mainImage.value, 'internal');
});

test('parking separates legacy, official zero, field use and missing', () => {
  const p = property({ parkingSpaces: 99, parkingField: 2, parkingFieldNote: '현장 이용 기준' });
  let view = buildMasterPresentation(buildProfessionalReportViewModel(p, bundle()));
  assert.match(view.parking, /2대 가능/); assert.match(view.parkingNote, /현장 이용 기준/); assert.doesNotMatch(view.parking, /99/);
  assert.match(view.profileFacts.find(([label]) => label === '현장 주차')![1], /2대.*현장 이용 기준/);
  assert.equal(view.profileFacts.find(([label]) => label === '공부상 주차')![1], '확인 필요');
  const b = bundle(); b.verifications = [{ id: 'zero', propertyId: p.id, fieldKey: 'parkingOfficial', status: 'confirmed', note: 'test only', createdAt: now, updatedAt: now }];
  view = buildMasterPresentation(buildProfessionalReportViewModel({ ...p, parkingField: undefined, parkingOfficial: 0 }, b));
  assert.equal(view.parking, '공부상 주차 0대');
  view = buildMasterPresentation(buildProfessionalReportViewModel({ ...p, parkingField: 0 }, bundle()));
  assert.equal(view.parking, '주차 0대 가능*†');
  view = buildMasterPresentation(buildProfessionalReportViewModel({ ...p, parkingField: undefined, parkingOfficial: undefined }, bundle()));
  assert.equal(view.parking, '주차 확인 필요');
});

test('calculation boundaries reject non-finite/invalid values and preserve normal results', () => {
  assert.equal(calculateUnitPrice(4150000000, 50.85), 4150000000 / 50.85);
  for (const invalid of [0, -1, NaN, Infinity, -Infinity, undefined, null]) {
    assert.equal(calculateUnitPrice(4150000000, invalid), null);
    assert.equal(calculateUnitPrice(invalid, 50.85), null);
    assert.equal(sqmToPyeong(invalid), null);
    assert.equal(pyeongToSqm(invalid), null);
  }
  assert.equal(calculateUnitPrice(Number.MAX_VALUE, Number.MIN_VALUE), null);
});

test('structured tables preserve evidence, missing values and fixed capacities', () => {
  const p = property({ floorUsageRows: Array.from({ length: 6 }, (_, i) => ({ id: `floor-${i}`, floor: `${i + 1}F`, officialUse: 'QA 용도', areaSqm: 81.98, currentUse: 'QA 이용', sourceReference: 'QA fixture', verificationStatus: 'unverified' as const })),
    comparableTransactions: [{ id: 'sale', address: 'QA 비교', salePrice: 3000000000, landAreaPyeong: 30, sourceReference: 'QA source', checkedAt: now, verificationStatus: 'confirmed' }, { id: 'invalid', address: 'QA 미확인', landAreaPyeong: 0, salePrice: 1 }] });
  const model = buildProfessionalReportViewModel(p, bundle());
  const v = buildMasterPresentation(model);
  assert.equal(v.floorRows.length, 4); assert.equal(v.floorOverflow, 2);
  assert.equal(model.floorUsageRows?.length, 6);
  assert.equal(v.comparableRows.length, 6);
  assert.equal(v.comparableRows[0].unit, '10,000');
  assert.match(v.comparableRows[0].evidence, /QA source/);
  assert.equal(v.comparableRows[1].percent, 0);
  assert.equal(v.comparableRows[1].unit, '확인 필요');
  assert.ok(v.comparableRows.every((row) => Number.isFinite(row.percent) && row.percent >= 0 && row.percent <= 100));
  p.floorUsageRows![0].floor = 'changed';
  assert.equal(model.floorUsageRows![0].floor, '1F');
});

test('conflicting image classifications fail closed for a restricted property', () => {
  const p = property({ id: 'qa-bangbae', name: '방배동 815-11', mapImage: 'conflicting' });
  const b = bundle(); b.media = [media('private', 'interior', 'conflicting')];
  assert.equal(buildProfessionalReportViewModel(p, b).media.items.length, 0);
  const explicitInterior = { ...p, mapImage: '', mainImage: 'conflicting', mainImageCategory: 'interior' as const };
  b.media = [media('misclassified', 'exterior', 'conflicting')];
  assert.equal(buildProfessionalReportViewModel(explicitInterior, b).media.items.length, 0);
});

test('UUID fallback preserves version and variant without insecure randomness', () => {
  const original = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const ids = Array.from({ length: 100 }, () => createId());
    assert.equal(new Set(ids).size, 100);
    ids.forEach((id) => assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  } finally { if (original) Object.defineProperty(crypto, 'randomUUID', original); else delete (crypto as Partial<Crypto>).randomUUID; }
});

test('1P and 7P roots/count are fixed; supporting images never duplicate mislabeled hero', () => {
  const model = buildProfessionalReportViewModel(property({ mainImage: 'data:image/png;base64,AA==' }), bundle(), { generatedAt: now });
  const view = buildMasterPresentation(model);
  assert.ok(view.photos.every((p) => p.src === null));
  const snap = { id: 'qa', propertyId: 'qa', reportType: 'professional_report' as const, reportVersion: 1, templateVersion: 'daon-detail-7p-v3', snapshotData: {}, generatedAt: now, status: 'draft' as const, createdAt: now };
  const one = renderToStaticMarkup(<DaonOnePageMaster view={view} />);
  const seven = renderToStaticMarkup(<DaonDetail7PageMaster snapshot={snap} view={view} />);
  assert.equal((one.match(/class="d1-sheet"/g) || []).length, 1);
  assert.equal((seven.match(/class="daon-detail-page daon-detail-page-\d"/g) || []).length, 7);
  assert.doesNotMatch(seven, /BANGBAE|방배동|방음시설|최진/);
});

test('v3 contacts are M/E only; v2 retains captured historical contact output', () => {
  const model = buildProfessionalReportViewModel(property(), bundle(), { generatedAt: now });
  const view = buildMasterPresentation(model);
  const snap = { id: 'contact-qa', propertyId: 'qa', reportType: 'professional_report' as const, reportVersion: 1, templateVersion: 'daon-detail-7p-v3', snapshotData: model, generatedAt: now, status: 'draft' as const, createdAt: now };
  const before = JSON.stringify(snap);
  const one = renderToStaticMarkup(<DaonOnePageMaster view={view} />);
  const seven = renderToStaticMarkup(<DaonDetail7PageMaster snapshot={snap} view={view} />);
  for (const html of [one, seven]) {
    assert.equal((html.match(/M 010 9953 1270/g) || []).length, 1);
    assert.equal((html.match(/E daonasset.korea@gmail.com/g) || []).length, 1);
    assert.doesNotMatch(html, /신반포로|02 543|02 517|김은미/);
    assert.match(html, /DA:ON/);
  }
  const old = renderToStaticMarkup(<LegacyDaonDetail7PageMasterV2 snapshot={{ ...snap, templateVersion: 'daon-detail-7p-v2' }} view={view} />);
  assert.match(old, /신반포로/);
  assert.match(old, /김은미/);
  assert.match(old, /data-template-version="daon-detail-7p-v2"/);
  assert.equal(JSON.stringify(snap), before);
});

test('repositories preserve stores, versions, captured brand/data and ImportJob pause/resume', async () => {
  const p = property();
  const db = await database;
  assert.deepEqual([...db.objectStoreNames].sort(), ['properties','settings','importJobs','propertyDocuments','propertyMedia','propertyVerifications','propertyDataSources','reportSnapshots','digitalTwinAssets'].sort());
  await propertyRepository.create(p); await settingsRepository.save(DAON_SETTINGS);
  const before = JSON.stringify(await propertyRepository.getById(p.id));
  const [a, b] = await Promise.all([reportSnapshotService.createDraft(p.id), reportSnapshotService.createDraft(p.id)]);
  assert.deepEqual([a.reportVersion, b.reportVersion].sort(), [1, 2]);
  assert.equal(JSON.stringify(await propertyRepository.getById(p.id)), before);
  const captured = JSON.stringify(a.snapshotData);
  await propertyRepository.update({ ...p, salePrice: 1, reportContent: { heroHeadline: 'changed' } });
  await settingsRepository.save({ ...DAON_SETTINGS, defaultManager: 'Changed manager' });
  await reportSnapshotService.markReady(a.id);
  const saved = await propertyDataRoomRepository.getReportSnapshot(a.id);
  assert.equal(JSON.stringify(saved!.snapshotData), captured);
  assert.equal(saved!.generatedAt, a.generatedAt);
  await assert.rejects(() => propertyDataRoomRepository.saveReportSnapshot(a));
  const job: ImportJob = { id: 'qa-job', fileName: 'QA only', createdAt: now, updatedAt: now, totalRows: 1, processedRows: 0, running: false, paused: false, concurrency: 1, poiRadiusMeters: 500, rows: [{ rowId: 'qa-row', excelRowNumber: 2, raw: {}, normalizedProperty: { name: 'QA only' }, status: 'ready', issues: [], retryCount: 0, selected: true, saveMode: 'new', selectedAddressCandidateIndex: 0, addressCandidates: [{ roadAddress: 'QA only', latitude: 37, longitude: 127, provider: 'naver' }], generatedMapImage: 'TEST MAP', poiCandidates: [] }], logs: [] };
  await runImportQueue(job, importJobRepository.save, () => true);
  assert.equal((await importJobRepository.get(job.id))!.paused, true);
  await runImportQueue(job, importJobRepository.save, () => false);
  assert.equal((await importJobRepository.get(job.id))!.rows[0].status, 'completed');
  const count = (await propertyRepository.getAll()).length;
  await runImportQueue(job, importJobRepository.save, () => false);
  assert.equal((await propertyRepository.getAll()).length, count);
  // Failed image URL never remains as a broken but "connected" report image.
  await propertyRepository.update({ ...p, mainImage: 'https://invalid.test/image.png', mainImageCategory: 'exterior' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('not an image', { status: 404 });
  try { const m = await reportDataBuilder.build(p.id); assert.equal(m.media.mainImage.state, 'disconnected'); assert.equal(m.media.mainImage.value, null); assert.ok(m.dataQuality.disconnectedFields.includes('media.mainImage')); }
  finally { globalThis.fetch = originalFetch; }
  db.close();
});
