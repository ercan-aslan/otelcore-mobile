import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';
import { COLORS, INPUT_BASE, INPUT_FONT_SIZE } from '../theme';
import {
  displayToIso,
  formatDateInputTyping,
  isoToDisplay,
} from '../utils/format';

/**
 * value/onChangeValue ISO formatında (YYYY-MM-DD) çalışır.
 * Ekranda gün/ay/yıl (GG/AA/YYYY) gösterilir; yazarken / otomatik eklenir.
 */
export default function DateInput({
  value = '',
  onChangeValue,
  placeholder = 'GG/AA/YYYY',
  style,
  ...rest
}) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const handleChange = (text) => {
    const formatted = formatDateInputTyping(text);
    setDisplay(formatted);
    onChangeValue?.(displayToIso(formatted));
  };

  return (
    <TextInput
      {...rest}
      style={[styles.input, style]}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      value={display}
      onChangeText={handleChange}
      keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
      inputMode="numeric"
      maxLength={10}
      autoComplete="off"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...INPUT_BASE,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    marginBottom: 4,
    fontSize: INPUT_FONT_SIZE,
  },
});
