import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import PageScaffold from '../components/PageScaffold';
import AppPressable from '../components/AppPressable';
import { HousekeepingAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { showMessage } from '../utils/alert';

const HK_META = {
  clean: { label: 'Temiz', bg: '#d8f3e4', fg: '#146c43' },
  dirty: { label: 'Kirli', bg: '#fff0c7', fg: '#997404' },
  oos: { label: 'Servis dışı', bg: '#f8d7da', fg: '#842029' },
};

const HK_OPTIONS = [
  { key: 'clean', label: 'Temiz' },
  { key: 'dirty', label: 'Kirli' },
  { key: 'oos', label: 'Servis dışı' },
];

export default function HousekeepingScreen() {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [draftStatus, setDraftStatus] = useState('clean');

  const loader = useCallback(async () => {
    const res = await HousekeepingAPI.list();
    return res.units || res.data || [];
  }, [tick]);

  const { data: units, loading, refreshing, error, refresh } = useFetch(loader);

  const groups = useMemo(() => {
    const map = new Map();
    (units || []).forEach((unit) => {
      const type = unit.room_type || 'Diğer';
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(unit);
    });
    return Array.from(map.entries());
  }, [units]);

  const openUnit = (unit) => {
    setSelected(unit);
    setDraftStatus(unit.housekeeping_status || 'clean');
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await HousekeepingAPI.updateUnit(selected.unit_id, draftStatus);
      setSelected(null);
      setTick((t) => t + 1);
      showMessage('Tamam', 'Durum güncellendi.');
    } catch (err) {
      showMessage('Hata', err.message || 'Güncellenemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageScaffold
      title="Oda Temizlik"
      subtitle={`${(units || []).length} birim`}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
    >
      {(units || []).length === 0 ? (
        <Text style={styles.empty}>Aktif oda birimi yok.</Text>
      ) : (
        groups.map(([type, list]) => (
          <View key={type} style={styles.group}>
            <Text style={styles.groupTitle}>{type}</Text>
            <View style={styles.grid}>
              {list.map((unit) => {
                const st = unit.housekeeping_status || 'clean';
                const meta = HK_META[st] || HK_META.clean;
                return (
                  <Pressable
                    key={String(unit.unit_id)}
                    onPress={() => openUnit(unit)}
                    style={[styles.card, { backgroundColor: meta.bg }]}
                  >
                    <Text style={[styles.code, { color: meta.fg }]}>{unit.unit_code}</Text>
                    <Text style={[styles.room, { color: meta.fg }]} numberOfLines={1}>
                      {unit.room_name}
                    </Text>
                    <Text style={[styles.status, { color: meta.fg }]}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.unit_code || ''}</Text>
            <Text style={styles.modalMeta}>{selected?.room_name || ''}</Text>
            <View style={styles.optRow}>
              {HK_OPTIONS.map((opt) => {
                const meta = HK_META[opt.key];
                const active = draftStatus === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setDraftStatus(opt.key)}
                    style={[
                      styles.opt,
                      { backgroundColor: meta.bg, borderColor: active ? meta.fg : 'transparent' },
                    ]}
                  >
                    <Text style={[styles.optText, { color: meta.fg }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <AppPressable
                title="Vazgeç"
                color={COLORS.textSecondary}
                variant="outline"
                onPress={() => setSelected(null)}
                style={styles.modalBtn}
              />
              <AppPressable
                title="Kaydet"
                color={COLORS.primary}
                disabled={busy}
                onPress={save}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  empty: { color: COLORS.textMuted, textAlign: 'center', padding: 24 },
  group: { marginBottom: 18 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  code: { fontSize: 20, fontWeight: '800' },
  room: { fontSize: 11, marginTop: 4, opacity: 0.9 },
  status: { fontSize: 11, fontWeight: '700', marginTop: 8, textTransform: 'uppercase' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  modalMeta: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 14 },
  optRow: { gap: 8, marginBottom: 16 },
  opt: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
  },
  optText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalBtn: { flex: 1, minHeight: 44 },
});
