import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../theme';

export default function TabPills({ tabs, activeKey, onChange }) {
  return (
    <View style={styles.wrap}>
      {tabs.map((tab) => {
        const active = activeKey === tab.key;
        const label = tab.shortLabel || tab.label;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              active && styles.tabActive,
              tab.danger && !active && styles.tabDanger,
            ]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.tabLabel, active && styles.tabLabelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {label}
            </Text>
            {tab.count !== undefined ? (
              <Text style={[styles.tabCount, active && styles.tabCountActive]}>{tab.count}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabDanger: {
    backgroundColor: 'rgba(220, 53, 69, 0.08)',
  },
  tabLabel: {
    fontWeight: '700',
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabCount: {
    marginTop: 2,
    fontWeight: '800',
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  tabCountActive: {
    color: '#fff',
  },
});
