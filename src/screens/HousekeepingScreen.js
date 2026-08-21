import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import PageScaffold from '../components/PageScaffold';
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
        <View style={styles.list}>
          {flatUnits.map((unit) => {
            const st = unit.display_status || unit.housekeeping_status || 'clean';
            const meta = HK_META[st] || HK_META.clean;
            const summary = st === 'oos' ? reasonSummary(unit.oos_reason) : '';
            return (
              <Pressable
                key={String(unit.unit_id)}
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
          })}
        </View>
      )}

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
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  empty: { color: COLORS.textMuted, textAlign: 'center', padding: 24 },
  list: { gap: 8 },
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
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  modalMeta: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 },
  modalGuest: { fontSize: 13, color: COLORS.textPrimary, marginBottom: 8, fontWeight: '600' },
  modalReasonFull: {
    fontSize: 13,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.navySoft,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  optRow: { gap: 8, marginBottom: 12 },
  opt: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
  },
  optText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  reasonInput: {
    ...INPUT_BASE,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.inputBg,
    textAlignVertical: 'top',
    minHeight: 72,
  },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalBtn: { flex: 1, minHeight: 44 },
});
