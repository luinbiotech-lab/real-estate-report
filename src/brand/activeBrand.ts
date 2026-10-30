import { createTheme } from '@mui/material';
import { BRANDS, brandCssVariables, resolveBrandId, type BrandTokens } from './brandTokens';

export const activeBrand: BrandTokens = BRANDS[resolveBrandId(import.meta.env.VITE_APP_BRAND)];

export function applyBrandToDocument(brand: BrandTokens = activeBrand, root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(brandCssVariables(brand))) root.style.setProperty(name, value);
  root.dataset.brand = brand.id;
}

export function createBrandTheme(brand: BrandTokens = activeBrand) {
  const c = brand.colors;
  return createTheme({
    palette: {
      primary: { main: c.primary, dark: c.primaryDeep, contrastText: c.onPrimary },
      secondary: { main: c.accent, contrastText: '#ffffff' },
      error: { main: c.danger },
      success: { main: c.success },
      warning: { main: c.warning },
      background: { default: c.canvas, paper: c.surface },
      text: { primary: c.ink, secondary: c.muted },
      divider: c.line,
    },
    typography: {
      fontFamily: brand.fontFamily,
      h1: { fontWeight: 800, letterSpacing: '-0.02em' },
      h2: { fontWeight: 800, letterSpacing: '-0.02em' },
      button: { fontWeight: 700, textTransform: 'none' },
    },
    shape: { borderRadius: brand.radius.control },
    components: {
      MuiButton: { styleOverrides: { root: { borderRadius: brand.radius.control, minHeight: 40 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: brand.radius.control, alignItems: 'flex-start' } } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 700 } } },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: brand.radius.card } } },
    },
  });
}
