/**
 * Vaarta design tokens — "editorial luxury".
 * Brand palette is fixed; semantic colours are derived per theme in themes.ts.
 */
export const palette = {
  midnight: '#0B1220',
  midnight2: '#121B2E',
  midnight3: '#1B2740',
  ink: '#0E1626',
  ivory: '#F7F3EA',
  ivory2: '#EFE8D9',
  paper: '#FFFDF8',
  gold: '#C9A24D',
  goldDeep: '#8E6E25', // AA-safe gold for text on ivory (4.8:1)
  goldSoft: '#E6D3A3',
  red: '#E5484D',
  redDeep: '#C2353A', // AA-safe on ivory for small text
  black: '#000000',
  white: '#FFFFFF',
  slate: '#5B6476',
  slateLight: '#9AA3B5',
  green: '#2F9E6B',
  blue: '#3D7BD9',
  amber: '#E39A2D',
} as const;

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const shadow = {
  soft: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  lift: {
    shadowColor: '#0B1220',
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
  devotional: '#C9A24D',
  agriculture: '#5E9E3A',
  health: '#E06A5A',
  crime: '#B23A48',
  weather: '#4A90C2',
};
