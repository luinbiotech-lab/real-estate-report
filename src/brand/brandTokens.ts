/*
 * App brand tokens (owner decision 2026-10-30: design the app as DA:ON now; monetise later under LUIN).
 * Every app screen reads colours/radii/type from these tokens through CSS custom properties (--brand-*) and the MUI theme,
 * so switching brand is a configuration change (VITE_APP_BRAND=luin), not a redesign.
 * Scope: the app shell and work screens only. The approved DAON_1P_MASTER / DAON_DETAIL_7P_MASTER keep their own locked
 * styles and are NOT driven by these tokens.
 */

export type BrandId = 'daon' | 'luin';

export interface BrandTokens {
  id: BrandId;
  /** Short mark shown in the square logo. */
  mark: string;
  name: string;
  tagline: string;
  operationsLabel: string;
  colors: {
    primary: string;        // main navy / brand colour
    primaryDeep: string;    // sidebar / hero background
    primarySoft: string;    // tinted surface
    accent: string;         // gold highlight
    accentSoft: string;
    ink: string;            // body text
    muted: string;          // secondary text
    line: string;           // borders
    surface: string;        // cards
    canvas: string;         // page background
    danger: string;
    success: string;
    warning: string;
    onPrimary: string;
    sidebarText: string;
    sidebarActive: string;
  };
  radius: { card: number; control: number; pill: number };
  fontFamily: string;
}

const FONT = 'Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif';

export const BRANDS: Record<BrandId, BrandTokens> = {
  // Matches the approved DA:ON report masters (navy #073a69 / deep #032f56 / gold #b47a25) so app and reports read as one brand.
  daon: {
    id: 'daon',
    mark: 'D',
    name: 'DA:ON ASSET',
    tagline: 'PROPERTY DATA & AGENT PLATFORM',
    operationsLabel: 'DA:ON OPERATIONS',
    colors: {
      primary: '#073a69', primaryDeep: '#032f56', primarySoft: '#eef4fa',
      accent: '#b47a25', accentSoft: '#fbf3e4',
      ink: '#14243a', muted: '#5f6d7e', line: '#dce3ea', surface: '#ffffff', canvas: '#f4f6f9',
      danger: '#c2373d', success: '#1f7a4d', warning: '#a86512',
      onPrimary: '#ffffff', sidebarText: '#c4cfdc', sidebarActive: '#0d4a80',
    },
    radius: { card: 14, control: 10, pill: 999 },
    fontFamily: FONT,
  },
  // Future monetised platform brand. Same structure; values are a placeholder palette until the LUIN identity is fixed.
  luin: {
    id: 'luin',
    mark: 'L',
    name: 'LUIN',
    tagline: 'REAL ESTATE INTELLIGENCE',
    operationsLabel: 'LUIN OPERATIONS',
    colors: {
      primary: '#1b3a5c', primaryDeep: '#0f2236', primarySoft: '#edf3f8',
      accent: '#2f8f83', accentSoft: '#e6f4f2',
      ink: '#14212f', muted: '#5d6b7a', line: '#dbe2e9', surface: '#ffffff', canvas: '#f3f6f8',
      danger: '#c2373d', success: '#1f7a4d', warning: '#a86512',
      onPrimary: '#ffffff', sidebarText: '#c3cdd8', sidebarActive: '#25507c',
    },
    radius: { card: 14, control: 10, pill: 999 },
    fontFamily: FONT,
  },
};

export function resolveBrandId(raw: string | undefined | null): BrandId {
  const value = String(raw ?? '').trim().toLowerCase();
  return value === 'luin' ? 'luin' : 'daon';
}

/** CSS custom properties for the app shell; applied to :root at startup. */
export function brandCssVariables(brand: BrandTokens): Record<string, string> {
  const c = brand.colors;
  return {
    '--brand-primary': c.primary,
    '--brand-primary-deep': c.primaryDeep,
    '--brand-primary-soft': c.primarySoft,
    '--brand-accent': c.accent,
    '--brand-accent-soft': c.accentSoft,
    '--brand-ink': c.ink,
    '--brand-muted': c.muted,
    '--brand-line': c.line,
    '--brand-surface': c.surface,
    '--brand-canvas': c.canvas,
    '--brand-danger': c.danger,
    '--brand-success': c.success,
    '--brand-warning': c.warning,
    '--brand-on-primary': c.onPrimary,
    '--brand-sidebar-text': c.sidebarText,
    '--brand-sidebar-active': c.sidebarActive,
    '--brand-radius-card': `${brand.radius.card}px`,
    '--brand-radius-control': `${brand.radius.control}px`,
    '--brand-font': brand.fontFamily,
  };
}
