import { useEffect } from 'react';
import { isIosLike, screenFit } from '../utils/reportDeviceFit';

export { isIosLike, screenFit } from '../utils/reportDeviceFit';

/*
 * Report pages are fixed A4 (210mm ≈ 794px). Owner test 2026-11-07 on an iPhone showed two problems:
 *  1. On screen the A4 page overflowed the phone width (only part of the cover visible).
 *  2. iOS print / "PDF 저장" ignores `@page { margin: 0 }` and keeps its own page margins (about 6mm sides, 14mm
 *     top/bottom), so every A4 report page spilled onto two sheets and the edges were cut (15 sheets for 7 pages).
 * This hook sets `--report-screen-fit` (screen scale for narrow viewports) and the `ios-print-fit` class (print zoom so a
 * page fits inside the iOS printable area). CSS lives in src/report-device-fit.css. Report MASTER layout is unchanged.
 */
export function useReportDeviceFit() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('ios-print-fit', isIosLike());
    const update = () => root.style.setProperty('--report-screen-fit', String(screenFit(window.innerWidth)));
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      root.classList.remove('ios-print-fit');
      root.style.removeProperty('--report-screen-fit');
    };
  }, []);
}
