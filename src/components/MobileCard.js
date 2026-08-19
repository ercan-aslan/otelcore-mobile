import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../theme';

export default function MobileCard({ children, borderColor = COLORS.primary, style }) {
  return (
    <View style={[styles.card, { borderLeftColor: borderColor }, style]}>
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
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
});
