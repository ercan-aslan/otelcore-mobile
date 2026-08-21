import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppPressable from '../components/AppPressable';
import { HousekeepingAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS, INPUT_BASE } from '../theme';
import { showMessage } from '../utils/alert';

const HK_META = {
  clean: { label: 'Temiz', bg: '#d8f3e4', fg: '#146c43' },
  dirty: { label: 'Kirli', bg: '#f8d7da', fg: '#842029' },
  occupied: { label: 'Dolu', bg: '#ffe0b8', fg: '#9a4d00' },
  oos: { label: 'Servis dışı', bg: '#e9ecef', fg: '#495057' },
};

const HK_OPTIONS = [
  { key: 'clean', label: 'Temiz' },
  { key: 'dirty', label: 'Kirli' },
  { key: 'oos', label: 'Servis dışı' },
];

function reasonSummary(text, max = 48) {
  const value = String(text || '').trim();
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export default function HousekeepingScreen() {
  const insets = useSafeAreaInsets();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [draftStatus, setDraftStatus] = useState('clean');
  const [draftReason, setDraftReason] = useState('');

  const loader = useCallback(async () => {
    const res = await HousekeepingAPI.list();
    return res.units || res.data || [];
  }, [tick]);

  const { data: units, loading, refreshing, error, refresh } = useFetch(loader);

  const flatUnits = useMemo(() => units || [], [units]);
  const bottomPad = 16 + Math.min(insets.bottom || 0, 12);

  const openUnit = (unit) => {
    setSelected(unit);
    setDraftStatus(unit.housekeeping_status || 'clean');
    setDraftReason(unit.oos_reason || '');
  };

  const save = async () => {
    if (!selected) return;
    if (draftStatus === 'oos' && !String(draftReason || '').trim()) {
      showMessage('Eksik', 'Servis dışı için sebep yazın.');
      return;
    }
    setBusy(true);
    try {
      await HousekeepingAPI.updateUnit(selected.unit_id, draftStatus, draftReason);
      setSelected(null);
      setTick((t) => t + 1);
      showMessage('Tamam', 'Durum güncellendi.');
    } catch (err) {
      showMessage('Hata', err.message || 'Güncellenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const renderItem = ({ item: unit }) => {
    const st = unit.display_status || unit.housekeeping_status || 'clean';
    const meta = HK_META[st] || HK_META.clean;
    const summary = st === 'oos' ? reasonSummary(unit.oos_reason) : '';
    return (
      <Pressable
        onPress={() => openUnit(unit)}
        style={[styles.row, { backgroundColor: meta.bg }]}
      >
        <View style={styles.rowMain}>
          <Text style={[styles.code, { color: meta.fg }]} numberOfLines={1}>
            {unit.unit_code}
          </Text>
          <Text style={[styles.room, { color: meta.fg }]} numberOfLines={1}>
            {unit.room_name}
          </Text>
          {st === 'occupied' ? (
            <>
              <Text style={[styles.guest, { color: meta.fg }]} numberOfLines={1}>
                {unit.guest_name || 'Misafir'}
              </Text>
              {unit.check_out_formatted ? (
                <Text style={[styles.metaLine, { color: meta.fg }]} numberOfLines={1}>
                  Çıkış: {unit.check_out_formatted}
                </Text>
              ) : null}
            </>
          ) : null}
          {summary ? (
            <Text style={[styles.metaLine, { color: meta.fg }]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.badge, { color: meta.fg }]}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.list}
        data={loading && !refreshing ? [] : flatUnits}
        keyExtractor={(item) => String(item.unit_id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Oda Temizlik</Text>
            <Text style={styles.subtitle}>{flatUnits.length} birim</Text>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {loading && !refreshing ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading && !refreshing ? null : (
            <Text style={styles.empty}>Aktif oda birimi yok.</Text>
          )
        }
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[COLORS.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        {...(Platform.OS === 'ios'
          ? { contentInsetAdjustmentBehavior: 'never' }
          : null)}
      />

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.unit_code || ''}</Text>
            <Text style={styles.modalMeta}>{selected?.room_name || ''}</Text>
            {selected?.guest_name ? (
              <Text style={styles.modalGuest}>
                {selected.guest_name}
                {selected.check_out_formatted ? ` · Çıkış: ${selected.check_out_formatted}` : ''}
              </Text>
            ) : null}
            {selected?.oos_reason ? (
              <Text style={styles.modalReasonFull}>{selected.oos_reason}</Text>
            ) : null}
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
            {draftStatus === 'oos' ? (
              <TextInput
                style={styles.reasonInput}
                value={draftReason}
                onChangeText={setDraftReason}
                placeholder="Servis dışı sebebi"
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={255}
              />
            ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  list: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexGrow: 0,
  },
  headerBlock: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  loader: { marginTop: 32 },
  errorBox: {
    backgroundColor: '#f8d7da',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: { color: COLORS.danger, fontWeight: '600' },
  empty: { color: COLORS.textMuted, textAlign: 'center', paddingVertical: 24 },
  sep: { height: 8 },
  row: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
  },
  rowMain: { flex: 1, paddingRight: 10 },
  code: { fontSize: 17, fontWeight: '800' },
  room: { fontSize: 12, marginTop: 2, opacity: 0.9 },
  guest: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  metaLine: { fontSize: 12, marginTop: 2, opacity: 0.95 },
  badge: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
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
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  modalMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  modalGuest: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginTop: 8 },
  modalReasonFull: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8, lineHeight: 18 },
  optRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  opt: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  optText: { fontSize: 12, fontWeight: '800' },
  reasonInput: {
    ...INPUT_BASE,
    marginTop: 12,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flex: 1 },
});
