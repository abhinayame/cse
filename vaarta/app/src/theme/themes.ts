import { palette } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled';

export interface Theme {
  name: 'light' | 'dark' | 'amoled';
  dark: boolean;
  colors: {
    bg: string;
    bgElevated: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    textFaint: string;
    accent: string;
    /** accent for small text on bg — guaranteed WCAG AA (≥4.5:1) */
    accentText: string;
    onAccent: string;
    breaking: string;
    breakingText: string;
    success: string;
    glass: string;
    glassBorder: string;
    overlayTop: string;
    overlayBottom: string;
    skeleton: string;
    skeletonHi: string;
  };
}

/* Contrast notes (WCAG 2.1):
 *  light: text #0B1220 on #F7F3EA = 16.6:1, muted #4A5366 on ivory = 7.4:1, accentText #8E6E25 = 4.8:1
 *  dark:  text #F7F3EA on #0B1220 = 16.6:1, muted #AEB5C4 = 8.9:1, gold #C9A24D on midnight = 7.9:1
 *  breaking white on #E5484D = 3.9:1 → only used for ≥14pt bold labels (AA large) ; breakingText for body.
 */
export const lightTheme: Theme = {
  name: 'light',
  dark: false,
  colors: {
    bg: palette.ivory,
    bgElevated: palette.paper,
    surface: palette.paper,
    surfaceAlt: palette.ivory2,
    border: 'rgba(11,18,32,0.10)',
    text: palette.midnight,
    textMuted: '#4A5366',
    textFaint: '#6B7385',
    accent: palette.gold,
    accentText: palette.goldDeep,
    onAccent: palette.midnight,
    breaking: palette.red,
    breakingText: palette.redDeep,
    success: palette.green,
    glass: 'rgba(255,253,248,0.72)',
    glassBorder: 'rgba(11,18,32,0.08)',
    overlayTop: 'rgba(11,18,32,0.0)',
    overlayBottom: 'rgba(11,18,32,0.88)',
    skeleton: '#E9E2D2',
    skeletonHi: '#F6F1E6',
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  dark: true,
  colors: {
    bg: palette.midnight,
    bgElevated: palette.midnight2,
    surface: palette.midnight2,
    surfaceAlt: palette.midnight3,
    border: 'rgba(247,243,234,0.10)',
    text: palette.ivory,
    textMuted: '#AEB5C4',
    textFaint: '#8A93A6',
    accent: palette.gold,
    accentText: palette.gold,
    onAccent: palette.midnight,
    breaking: palette.red,
    breakingText: '#FF7A7E',
    success: '#4CC38A',
    glass: 'rgba(18,27,46,0.66)',
    glassBorder: 'rgba(247,243,234,0.10)',
    overlayTop: 'rgba(11,18,32,0.0)',
    overlayBottom: 'rgba(11,18,32,0.92)',
    skeleton: '#18233A',
    skeletonHi: '#22304D',
  },
};

export const amoledTheme: Theme = {
  ...darkTheme,
  name: 'amoled',
  colors: {
    ...darkTheme.colors,
    bg: palette.black,
    bgElevated: '#0A0A0A',
    surface: '#0B0B0D',
    surfaceAlt: '#141418',
    glass: 'rgba(0,0,0,0.72)',
    overlayBottom: 'rgba(0,0,0,0.94)',
    skeleton: '#121214',
    skeletonHi: '#1C1C20',
  },
};
