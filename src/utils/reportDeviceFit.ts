/** Pure helpers for useReportDeviceFit (no React import, unit-tested in validate-report-display-rules). */
export function isIosLike(nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> = navigator) {
  return /iP(hone|ad|od)/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

export const A4_PX = 794;

export function screenFit(viewportWidth: number, gutter = 16) {
  return Math.min(1, Math.max(0.3, (viewportWidth - gutter) / A4_PX));
}

