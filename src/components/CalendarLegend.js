import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CALENDAR_LEGEND } from '../utils/format';
import { COLORS } from '../theme';

export default function CalendarLegend() {
  return (
    <View style={styles.wrap}>
      {CALENDAR_LEGEND.map((item) => (
          <View key={item.label} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
