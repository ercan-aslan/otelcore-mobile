import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
  sparkles: 'sparkles-outline',
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
  const { width } = useWindowDimensions();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 8);
  const sidePad = 12 + Math.max(insets.left, insets.right, 0);

  return (
    <View style={[styles.wrapper, { width, paddingBottom: bottomPad, paddingHorizontal: sidePad }]}>
      <View style={styles.row}>
        {items.map((item) => {
          const active = activeScreen === item.screen;
          const isDanger = item.danger;
          const color = active ? '#fff' : isDanger ? COLORS.danger : COLORS.navInactive;

          return (
            <TouchableOpacity
              key={item.screen}
              style={[
                styles.item,
                active && (isDanger ? styles.itemActiveDanger : styles.itemActive),
              ]}
              onPress={() => onNavigate(item.screen)}
              activeOpacity={0.7}
            >
              <View>
                <Ionicons name={ICON_MAP[item.icon] || 'ellipse'} size={active ? 21 : 20} color={color} />
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
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingTop: 8,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: COLORS.primary,
  },
  itemActiveDanger: {
    backgroundColor: COLORS.danger,
  },
  label: {
    fontSize: 10,
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
