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
    /** brand red for fills (buttons, active chips, indicators) */
    accent: string;
    /** red for small text/icons on bg — guaranteed WCAG AA (≥4.5:1) */
    accentText: string;
    /** text/icons placed on an accent fill */
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

/* Contrast (WCAG 2.1):
 *  light: text #0A0A0A on #FFFFFF = 19.8:1 · muted #5A5A5A = 6.9:1 · faint #737373 = 4.7:1 · red #D7141A = 5.2:1
 *  dark:  text #FFFFFF on #0A0A0A = 19.8:1 · muted #A3A3A3 = 7.9:1 · red text #FF4D52 = 6.1:1
 *  on red: white = 5.2:1 (black on red is only 3.8:1, so never used)
 */
export const lightTheme: Theme = {
  name: 'light',
  dark: false,
  colors: {
    bg: palette.white,
    bgElevated: palette.white,
    surface: palette.white,
    surfaceAlt: palette.snow,
    border: 'rgba(10,10,10,0.10)',
    text: palette.ink,
    textMuted: '#5A5A5A',
    textFaint: '#737373',
    accent: palette.red,
    accentText: palette.red,
    onAccent: palette.white,
    breaking: palette.red,
    breakingText: palette.redDeep,
    success: palette.green,
    glass: 'rgba(255,255,255,0.78)',
    glassBorder: 'rgba(10,10,10,0.08)',
    overlayTop: 'rgba(0,0,0,0)',
    overlayBottom: 'rgba(0,0,0,0.85)',
    skeleton: '#EDEDED',
    skeletonHi: '#F8F8F8',
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  dark: true,
  colors: {
    bg: palette.ink,
    bgElevated: palette.ink2,
    surface: palette.ink2,
    surfaceAlt: palette.ink3,
    border: 'rgba(255,255,255,0.10)',
    text: palette.white,
    textMuted: '#A3A3A3',
    textFaint: '#8A8A8A',
    accent: palette.red,
    accentText: palette.redBright,
    onAccent: palette.white,
    breaking: palette.red,
    breakingText: palette.redBright,
    success: '#3CC584',
    glass: 'rgba(21,21,21,0.72)',
    glassBorder: 'rgba(255,255,255,0.10)',
    overlayTop: 'rgba(0,0,0,0)',
    overlayBottom: 'rgba(0,0,0,0.9)',
    skeleton: '#1A1A1A',
    skeletonHi: '#262626',
  },
};

export const amoledTheme: Theme = {
  ...darkTheme,
  name: 'amoled',
  colors: {
    ...darkTheme.colors,
    bg: palette.black,
    bgElevated: '#0A0A0A',
    surface: '#0B0B0B',
    surfaceAlt: '#161616',
    glass: 'rgba(0,0,0,0.78)',
    overlayBottom: 'rgba(0,0,0,0.94)',
    skeleton: '#121212',
    skeletonHi: '#1C1C1C',
  },
};
