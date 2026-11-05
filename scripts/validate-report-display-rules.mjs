// Unit tests for the DA:ON 1P/7P display rules (루인 request on PR #46, 2026-11-05):
//  - short display labels win, otherwise the stored first line is printed verbatim (no rewriting/truncation);
//  - register coverage 0 is "unrecorded"; a calculated coverage is shown only with both areas and is always labelled.
import { readFileSync } from 'node:fs';

import { importTs } from './lib/ts-module-loader.mjs';

const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, message) => { if (actual !== expected) fail(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };
const rules = await importTs('src/domain/professionalReport/reportDisplayRules.ts');
const { shortOrFirstLine, coverageDisplay } = rules;

// 1. shortOrFirstLine
eq(shortOrFirstLine('국회 앞 업무용 빌딩', '첫 줄\n둘째 줄'), '국회 앞 업무용 빌딩', 'short label wins');
eq(shortOrFirstLine('  짧은 문구  ', '원문'), '짧은 문구', 'short label is trimmed');
eq(shortOrFirstLine('', '현재 소유자 직접 사용 중이며 잔금일 기준 전체 명도 협의가 가능합니다.\n둘째 줄'), '현재 소유자 직접 사용 중이며 잔금일 기준 전체 명도 협의가 가능합니다.', 'blank short label → original first line verbatim (no rewrite to 명도 가능)');
eq(shortOrFirstLine('   ', '82.5㎡ 코너 대지'), '82.5㎡ 코너 대지', 'whitespace short label → original; numbers not truncated');
eq(shortOrFirstLine(undefined, undefined, '기본 문구'), '기본 문구', 'both missing → fallback');
eq(shortOrFirstLine(null, '', ''), '', 'both empty → empty (row omitted by caller)');
eq(shortOrFirstLine(undefined, '\n\n둘째 줄만 있음'), '둘째 줄만 있음', 'leading blank lines skipped');

// 2. coverageDisplay
const reg = coverageDisplay(57.0, '57%', 61.8, 360);
eq(reg?.label, '건폐율', 'register value keeps register label'); eq(reg?.value, '57%', 'register display printed as given'); eq(reg?.calculated, false, 'register value is not calculated');
const calc = coverageDisplay(0, '0%', 24.8, 50.85);
eq(calc?.label, '단순 건폐율', 'register 0 + both areas → calculated label'); eq(calc?.value, '약 48.8%', 'calculated value = building ÷ land, 1 decimal, 약 prefix'); eq(calc?.calculated, true, 'flagged calculated');
eq(coverageDisplay(0, '0%', 0, 50.85), null, 'register 0 + no building area → omitted (never 0%)');
eq(coverageDisplay(0, '0%', 24.8, 0), null, 'register 0 + no land area → omitted');
eq(coverageDisplay(null, '', 24.8, undefined), null, 'missing values → omitted');
eq(coverageDisplay(Number.NaN, '', 24.8, 50.85)?.calculated, true, 'NaN register treated as unrecorded');
eq(coverageDisplay(-3, '-3%', 10, 20)?.value, '약 50%', 'negative register treated as unrecorded');

// 3. Masters use the shared rules (no inline re-implementation).
const one = readFileSync('src/components/professionalReport/DaonOnePageMaster.tsx', 'utf8');
const seven = readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8');
for (const key of ['shortHeadline', 'shortOccupancyLabel', 'shortRoadLabel', 'shortUseLabel', 'shortDevelopmentLabel']) {
  if (!new RegExp(`shortOrFirstLine\\(p\\.${key}\\b`).test(one)) fail(`1P must print ${key} through shortOrFirstLine`);
}
if (!/shortOrFirstLine\(model\.identity\.shortHeadline/.test(seven)) fail('7P hero statement must use shortOrFirstLine');
if (!/coverageDisplay\(model\.building\.buildingCoverageRate\.value/.test(seven)) fail('7P coverage must use coverageDisplay');
if (!seven.includes('공부상 수치가 아닙니다')) fail('7P calculated coverage note missing');

console.log('Report display rules (short labels, calculated coverage): PASS');
