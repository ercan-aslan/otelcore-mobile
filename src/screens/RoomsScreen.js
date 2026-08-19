import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PageScaffold from '../components/PageScaffold';
import MobileCard from '../components/MobileCard';
import AppPressable from '../components/AppPressable';
import { RoomsAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { STATUS_LABELS } from '../utils/format';
import { showMessage } from '../utils/alert';

const HK_COLORS = {
  clean: COLORS.success,
  dirty: COLORS.warning,
  inspected: COLORS.info,
  oos: COLORS.danger,
};

const HK_OPTIONS = [
  { key: 'clean', label: 'Temiz' },
  { key: 'dirty', label: 'Kirli' },
  { key: 'inspected', label: 'Kontrol' },
  { key: 'oos', label: 'Servis Dışı' },
];

export default function RoomsScreen() {
  const [tick, setTick] = useState(0);
  const [busyId, setBusyId] = useState(null);

  const loader = useCallback(async () => {
    const res = await RoomsAPI.list();
    return res.data || res.rooms || [];
  }, [tick]);

  const { data: rooms, loading, refreshing, error, refresh } = useFetch(loader);

  const setHk = async (room, status) => {
    setBusyId(room.room_id);
    try {
      await RoomsAPI.updateHousekeeping(room.room_id, status);
      setTick((t) => t + 1);
    } catch (err) {
      showMessage('Hata', err.message || 'Güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageScaffold
      title="🛏️ Odalar"
      subtitle={`${(rooms || []).length} oda`}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
    >
      {(rooms || []).length === 0 ? (
        <Text style={styles.empty}>Oda bulunamadı.</Text>
      ) : (
        rooms.map((room) => {
          const hk = room.housekeeping_status || 'clean';
          return (
            <MobileCard key={String(room.room_id)} borderColor={HK_COLORS[hk] || COLORS.primary}>
              <View style={styles.top}>
                <Text style={styles.name}>{room.room_name}</Text>
                <View style={[styles.badge, { backgroundColor: HK_COLORS[hk] || COLORS.textSecondary }]}>
                  <Text style={styles.badgeText}>{STATUS_LABELS[hk] || hk}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {room.room_type || 'Tip yok'} · {room.room_capacity} kişilik · Stok: {room.room_stock}
              </Text>
              <Text style={styles.price}>Taban fiyat: €{Number(room.room_price || 0).toFixed(2)}</Text>
              <View style={styles.hkRow}>
                {HK_OPTIONS.map((opt) => (
                  <AppPressable
                    key={opt.key}
                    title={opt.label}
                    color={HK_COLORS[opt.key]}
                    variant={hk === opt.key ? 'solid' : 'outline'}
                    disabled={busyId === room.room_id}
                    onPress={() => setHk(room, opt.key)}
                    style={styles.hkBtn}
                  />
                ))}
              </View>
            </MobileCard>
          );
        })
      )}
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  empty: { color: COLORS.textMuted, textAlign: 'center', padding: 24 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, flex: 1, paddingRight: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, color: COLORS.textSecondary },
  price: { fontSize: 14, fontWeight: '700', color: COLORS.success, marginTop: 6 },
  hkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  hkBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  hkBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary },
});
