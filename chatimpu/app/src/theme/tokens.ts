/**
 * Chatimpu design tokens — bold editorial red / white / black.
 * Brand palette is fixed; semantic colours are derived per theme in themes.ts.
 */
export const palette = {
  // Chatimpu brand: red · white · black
  red: '#D7141A',        // brand red — buttons, active states, breaking (white text on it = 5.2:1)
  redDeep: '#B00E13',    // pressed / small red text on white (7.2:1)
  redBright: '#FF4D52',  // red text & icons on black (6.1:1)
  redSoft: '#FF9A9D',    // secondary accent text on black / dark imagery (9.8:1)
  redTint: '#FDECEC',    // red-tinted surfaces on white
  ink: '#0A0A0A',        // near-black: text on white, dark backgrounds
  ink2: '#151515',
  ink3: '#222222',
  white: '#FFFFFF',
  paper: '#FFFFFF',
  snow: '#F4F4F5',       // alternate light surface
  black: '#000000',
  slate: '#5A5A5A',
  slateLight: '#A3A3A3',
  green: '#1F8A55',
  blue: '#2563EB',
  amber: '#D98A1A',
} as const;

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const shadow = {
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  lift: {
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
} as const;

export const motion = {
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
  springSnappy: { damping: 22, stiffness: 320, mass: 0.7 },
  flip: { damping: 20, stiffness: 140, mass: 1 },
  fast: 160,
  base: 260,
  slow: 420,
} as const;

/** Category accent colours used for chips, pins and the alert list. */
export const categoryColors: Record<string, string> = {
  politics: '#7C5CDB',
  cinema: '#D9487A',
  sports: '#2F9E6B',
  business: '#3D7BD9',
  tech: '#1BA3B8',
  jobs: '#E39A2D',
  education: '#5A7FD6',
  devotional: '#C98A1A',
  agriculture: '#5E9E3A',
  health: '#E06A5A',
  crime: '#B23A48',
  weather: '#4A90C2',
};
