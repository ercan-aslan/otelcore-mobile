import { StyleSheet } from 'react-native';

/** Uygulama genelinde StyleSheet fontSize değerlerine +1 (layout bozulmadan). */
const FONT_DELTA = 1;

if (!StyleSheet.__msiFontBumpApplied) {
  const originalCreate = StyleSheet.create.bind(StyleSheet);
  StyleSheet.create = (styles) => {
    const next = {};
    for (const key of Object.keys(styles || {})) {
      const value = styles[key];
      if (
        value
        && typeof value === 'object'
        && !Array.isArray(value)
        && typeof value.fontSize === 'number'
      ) {
        next[key] = { ...value, fontSize: value.fontSize + FONT_DELTA };
      } else {
        next[key] = value;
      }
    }
    return originalCreate(next);
  };
  StyleSheet.__msiFontBumpApplied = true;
}

export const FONT_DELTA_APPLIED = FONT_DELTA;
