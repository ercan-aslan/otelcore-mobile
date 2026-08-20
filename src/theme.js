export const COLORS = {
  background: '#f4f6f9',
  surface: '#ffffff',
  border: '#dee2e6',
  borderStrong: '#b0bec5',
  textPrimary: '#212529',
  textSecondary: '#6c757d',
  textMuted: '#adb5bd',
  primary: '#0d6efd',
  primaryDark: '#0a58ca',
  primaryLight: '#cfe2ff',
  accent: '#6B7B4C',
  accentLight: '#eef2e8',
  navy: '#212529',
  navySoft: '#f8f9fa',
  info: '#0dcaf0',
  infoSoft: '#e7f8fc',
  success: '#198754',
  successSoft: '#d1e7dd',
  danger: '#dc3545',
  dangerSoft: '#f8d7da',
  warning: '#ffc107',
  warningSoft: '#fff3cd',
  sidebar: '#343a40',
  inputBg: '#f8f9fa',
  navInactive: '#adb5bd',
  navActive: '#0d6efd',
  cardShadow: 'rgba(0, 0, 0, 0.06)',
};

export const BRAND_NAME = 'OtelCore';
export { API_BASE_URL } from './config';

/** iOS Safari input odaklanınca sayfayı zoomlamaması için minimum 16px (StyleSheet bump +1 uygular) */
export const INPUT_FONT_SIZE = 16;
export const INPUT_MIN_HEIGHT = 48;

export const INPUT_BASE = {
  fontSize: INPUT_FONT_SIZE,
  minHeight: INPUT_MIN_HEIGHT,
  color: COLORS.textPrimary,
};
