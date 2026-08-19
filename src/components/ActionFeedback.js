import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

export default function ActionFeedback({ message, type = 'info', onClear }) {
  useEffect(() => {
    if (!message || !onClear) return undefined;
    const timer = setTimeout(onClear, 5000);
    return () => clearTimeout(timer);
  }, [message, onClear]);

  if (!message) return null;

  const bg =
    type === 'error' ? '#f8d7da' : type === 'success' ? '#d1e7dd' : '#cff4fc';
  const color =
    type === 'error' ? COLORS.danger : type === 'success' ? COLORS.success : COLORS.primary;

  return (
    <View style={[styles.box, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  text: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
