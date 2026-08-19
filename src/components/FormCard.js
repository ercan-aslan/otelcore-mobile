import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, INPUT_BASE } from '../theme';

export function FormLabel({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function FormInput(props) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.style]}
      placeholderTextColor={COLORS.textMuted}
    />
  );
}

export default function FormCard({ title, icon, borderColor, children }) {
  return (
    <View style={[styles.card, { borderLeftColor: borderColor || COLORS.primary }]}>
      <Text style={[styles.title, { color: borderColor || COLORS.primary }]}>
        {icon ? `${icon} ` : ''}
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    elevation: 1,
  },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  label: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4, marginTop: 6 },
  input: {
    ...INPUT_BASE,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    marginBottom: 4,
  },
});
