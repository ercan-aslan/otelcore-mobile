import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme';

const ICON_MAP = {
  calendar: 'calendar',
  journal: 'journal',
  'trending-up': 'trending-up',
  bed: 'bed-outline',
  star: 'star',
  pricetag: 'pricetag',
  people: 'people',
  cube: 'cube',
  wallet: 'wallet',
  cart: 'cart',
  'id-card': 'id-card',
  'bar-chart': 'bar-chart',
  images: 'images',
  ticket: 'ticket',
  clipboard: 'clipboard-outline',
  compass: 'compass',
  'git-network': 'git-network',
  settings: 'settings',
  trash: 'trash',
  'shield-checkmark': 'shield-checkmark',
  'pie-chart': 'pie-chart',
  'qr-code': 'qr-code',
};

export default function BottomNav({ items, activeScreen, onNavigate }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 8);
  const evenLayout = items.length > 0 && items.length <= 6;
  const sidePad = 12 + Math.max(insets.left, insets.right, 0);

  const renderItem = (item) => {
    const active = activeScreen === item.screen;
    const isDanger = item.danger;
    const color = active ? '#fff' : isDanger ? COLORS.danger : COLORS.navInactive;

    return (
      <TouchableOpacity
        key={item.screen}
        style={[
          styles.item,
          evenLayout && styles.itemEven,
          active && (isDanger ? styles.itemActiveDanger : styles.itemActive),
        ]}
        onPress={() => onNavigate(item.screen)}
        activeOpacity={0.7}
      >
        <View>
          <Ionicons name={ICON_MAP[item.icon] || 'ellipse'} size={active ? 18 : 17} color={color} />
          {item.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge > 99 ? '99+' : String(item.badge)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, { color }, active && styles.labelActive]} numberOfLines={1}>
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad, paddingHorizontal: sidePad }]}>
      {evenLayout ? (
        <View style={styles.evenRow}>{items.map(renderItem)}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
          {items.map(renderItem)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
  },
  evenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    gap: 3,
  },
  scrollRow: {
    paddingHorizontal: 8,
    paddingTop: 6,
    gap: 10,
    alignItems: 'center',
  },
  item: {
    minWidth: 44,
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: 8,
  },
  itemEven: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  itemActive: {
    backgroundColor: COLORS.primary,
  },
  itemActiveDanger: {
    backgroundColor: COLORS.danger,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
  labelActive: {
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
