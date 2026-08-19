import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, INPUT_FONT_SIZE, INPUT_MIN_HEIGHT } from '../theme';
import AppPressable from './AppPressable';

export default function SelectField({ label, value, options = [], onChange, placeholder = 'Seçin...' }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <View style={[styles.wrap, open && styles.wrapOpen]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={styles.field}
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.inlineList}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={styles.optionsList}
          >
            {options.length === 0 ? (
              <Text style={styles.emptyOption}>Seçenek yok</Text>
            ) : (
              options.map((opt) => (
                <Pressable
                  key={String(opt.value)}
                  style={[styles.option, String(opt.value) === String(value) && styles.optionActive]}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      String(opt.value) === String(value) && styles.optionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export function SubmitButton({ title, color, loading, disabled, onPress, style }) {
  return (
    <AppPressable
      title={title}
      color={color || COLORS.primary}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      style={[styles.submitBtnWrap, style]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  wrapOpen: { zIndex: 4, elevation: 3 },
  label: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, marginTop: 6 },
  field: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: INPUT_MIN_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  placeholder: { fontSize: INPUT_FONT_SIZE, color: COLORS.textMuted },
  value: { fontSize: INPUT_FONT_SIZE, color: COLORS.textPrimary, fontWeight: '600', flex: 1, paddingRight: 8 },
  chevron: { color: COLORS.textMuted, fontSize: 12 },
  inlineList: {
    marginTop: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  optionsList: { maxHeight: 220 },
  option: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionActive: { backgroundColor: '#e7f1ff' },
  optionText: { fontSize: 15, color: COLORS.textPrimary },
  optionTextActive: { color: COLORS.primary, fontWeight: '700' },
  emptyOption: { padding: 16, color: COLORS.textMuted, textAlign: 'center' },
  submitBtnWrap: { marginTop: 10, width: '100%' },
});
