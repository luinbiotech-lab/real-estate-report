// Regression for the 2026-10-20 browser QA finding (Issue #12): production `properties.payload` rows that are not
// Property objects (QA rows without id/updatedAt) crashed list sorting, and the home page silently showed no properties.
import { readFileSync } from 'node:fs';
import { importTs } from './lib/ts-module-loader.mjs';

const guard = await importTs('src/domain/propertyRecordGuard.ts');

// Shapes observed in Production (keys only; values here are synthetic).
const valid = { id: 'sample-bangbae-815-11', propertyNumber: 'SAMPLE-BB-815-11', name: '방배동', updatedAt: '2026-10-01T00:00:00.000Z' };
const validNoUpdatedAt = { id: 'p-legacy', propertyNumber: 'P-1', name: '기존 레코드' };
const qaRemote = { name: 'QA Remote E2E', source: 'qa' };
const qaMigration = { name: 'QA Controlled Migration', source: 'qa', editorWrite: true, verificationStatus: 'pending' };
const blankId = { id: '  ', name: 'blank' };
const { items, rejected } = guard.partitionPropertyRecords([valid, qaRemote, validNoUpdatedAt, qaMigration, null, 'x', [], blankId]);

if (items.length !== 2 || items[0] !== valid || items[1] !== validNoUpdatedAt) throw new Error(`유효 레코드 보존 실패: ${JSON.stringify(items.map((item) => item.id))}`);
if (rejected.length !== 6) throw new Error(`제외 레코드 수 불일치: ${rejected.length}`);
const labels = rejected.map((record) => record.label);
for (const expected of ['QA Remote E2E', 'QA Controlled Migration', 'blank']) if (!labels.includes(expected)) throw new Error(`제외 사유 표시에 이름이 없습니다: ${expected}`);
if (rejected.find((record) => record.label === 'QA Remote E2E').reason !== 'missing-id') throw new Error('id 없는 객체는 missing-id 여야 합니다.');
if (rejected.filter((record) => record.reason === 'not-an-object').length !== 3) throw new Error('null/문자열/배열은 not-an-object 여야 합니다.');
if (JSON.stringify(rejected).includes('editorWrite') || JSON.stringify(rejected).includes('verificationStatus')) throw new Error('제외 보고에 원본 payload가 노출되면 안 됩니다.');

// Sorting must not throw on missing updatedAt and must keep newest first.
const sorted = [validNoUpdatedAt, valid, { id: 'newer', updatedAt: '2026-10-19T00:00:00.000Z' }].sort(guard.compareByUpdatedAtDesc).map((item) => item.id);
if (sorted.join(',') !== 'newer,sample-bangbae-815-11,p-legacy') throw new Error(`정렬 오류: ${sorted}`);

// Wiring: every property list read goes through the guard; the home page reports exclusions instead of hiding them.
const repo = readFileSync('src/repositories/propertyRepository.ts', 'utf8');
if (!repo.includes('return (await this.getAllWithDiagnostics()).items;') || !repo.includes('partitionPropertyRecords(raw)')) throw new Error('propertyRepository.getAll은 guard를 거쳐야 합니다.');
if (/getAll\(\) \{\s*if \(REMOTE_OPERATIONAL_MODE\) return remoteDataGateway\.listProperties\(\)/.test(repo)) throw new Error('원격 목록을 guard 없이 반환하면 안 됩니다.');
const list = readFileSync('src/pages/PropertyList.tsx', 'utf8');
if (list.includes('b.updatedAt.localeCompare(a.updatedAt)')) throw new Error('목록 정렬이 updatedAt 누락에 취약합니다.');
if (!list.includes('getAllWithDiagnostics()') || !list.includes('rejected={rejected}')) throw new Error('홈은 제외된 레코드 수를 받아 표시해야 합니다.');
const hub = readFileSync('src/components/PortfolioOperationsHub.tsx', 'utf8');
if (!hub.includes('rejected.length > 0') || !hub.includes('저장된 원본은 변경하지 않았습니다')) throw new Error('홈은 제외 사실과 비파괴 처리를 표시해야 합니다.');

console.log('Property record guard validation passed (2 Production QA payload shapes excluded and reported, sort tolerant).');
