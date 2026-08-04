export const colors = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceElevated: '#252525',
  accent: '#F5A623',
  accentLight: '#FFD080',
  text: '#FFFFFF',
  textSecondary: '#9E9E9E',
  success: '#4CAF50',
  border: '#333333',
  black: '#000000',
} as const;

export const theme = {
  colors,
} as const;

export type Theme = typeof theme;
