import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PageScaffold from '../components/PageScaffold';
import TabPills from '../components/TabPills';
import AppPressable from '../components/AppPressable';
import SelectField, { SubmitButton } from '../components/SelectField';
import { CalendarSummaryAPI, ReservationAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { formatDate } from '../utils/format';
import { showMessage } from '../utils/alert';

const TAB_META = {
  giris: { label: 'Girişler', shortLabel: 'Giriş', color: COLORS.success },
  cikis: { label: 'Çıkışlar', shortLabel: 'Çıkış', color: COLORS.info },
  yeni: { label: 'Bugün Gelen', shortLabel: 'Yeni', color: '#ffc107' },
  coklu: { label: 'Çoklu Rez.', shortLabel: 'Çoklu', color: COLORS.danger, danger: true },
  atanmamis: { label: 'Oda eklenmemiş', shortLabel: 'Oda yok', color: '#fd7e14' },
};

function SummaryRow({ item, onPress, showCreatedAt = false, onAssigned }) {
  const [unitId, setUnitId] = useState('');
  const [saving, setSaving] = useState(false);
  const unitOptions = (item.units || []).map((u) => ({ value: u.unit_id, label: u.unit_code }));

  const saveUnit = async () => {
    if (!unitId) {
      showMessage('Eksik alan', 'Oda numarası seçin.');
      return;
    }
    setSaving(true);
    try {
      await ReservationAPI.action({
        action: 'assign_unit',
        reservation_id: item.reservation_id,
        assigned_unit_id: Number(unitId),
      });
      showMessage('Başarılı', 'Oda numarası kaydedildi.');
      onAssigned?.();
    } catch (err) {
      showMessage('Hata', err.message || 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Pressable style={styles.row} onPress={() => onPress?.(item)}>
      <View style={styles.rowTop}>
        <Text style={styles.rowId}>#{item.reservation_id}</Text>
        <Text style={styles.rowRoom}>{item.room_name || 'Oda'}</Text>
      </View>
      <Text style={styles.rowDates}>
        {formatDate(item.check_in)} → {formatDate(item.check_out)}
      </Text>
      {showCreatedAt && item.created_at ? (
        <Text style={styles.rowMeta}>Kayıt: {item.created_at.slice(0, 16).replace('T', ' ')}</Text>
      ) : null}
      <Text style={styles.rowGuest}>{item.guest_name || 'Misafir'}</Text>
      <Text style={styles.rowChannel}>{item.channel_label || item.channel || '—'}</Text>
      {item.needs_unit && unitOptions.length > 0 ? (
        <View style={styles.assignRow}>
          <View style={styles.assignSelect}>
            <SelectField
              placeholder="Oda no"
              value={unitId}
              options={unitOptions}
              onChange={setUnitId}
            />
          </View>
          <SubmitButton title="Kaydet" loading={saving} onPress={saveUnit} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function CalendarSummaryScreen({ initialTab = 'giris', onClose, onOpenReservation }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const loader = useCallback(async () => {
    const res = await CalendarSummaryAPI.get(activeTab);
    return res.data || res;
  }, [activeTab]);

  const { data, loading, refreshing, error, refresh } = useFetch(loader);
  const counts = data?.counts || {};

  const tabs = useMemo(
    () =>
      Object.entries(TAB_META).map(([key, meta]) => ({
        key,
        label: meta.label,
        shortLabel: meta.shortLabel,
        danger: meta.danger,
        count: counts[key] ?? 0,
      })),
    [counts]
  );

  const emptyMessages = {
    giris: 'Bugün giriş yapacak misafir yok.',
    cikis: 'Bugün çıkış yapacak misafir yok.',
    yeni: 'Bugün oluşturulan yeni rezervasyon yok.',
    coklu: 'Aktif kayıtlarda çoklu rezervasyon yok.',
    atanmamis: 'Oda eklenmemiş rezervasyon yok.',
  };

  const handleOpenReservation = (item) => {
    const id = Number(item?.reservation_id);
    if (!id) return;
    onOpenReservation?.(id, item);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <AppPressable color={COLORS.textSecondary} onPress={onClose} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </AppPressable>
        <Text style={styles.headerTitle}>Takvim Özeti</Text>
        <View style={styles.backBtn} />
      </View>

      <PageScaffold
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={refresh}
      >
        <TabPills tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

        {activeTab === 'coklu' ? (
          (data?.groups || []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🛡</Text>
              <Text style={styles.emptyText}>{emptyMessages.coklu}</Text>
            </View>
          ) : (
            (data?.groups || []).map((group) => (
              <View key={`group-${group.group_index}`} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>
                    {group.group_index}. Çakışma · {group.room_name}
                  </Text>
                  {group.overlap_label ? (
                    <Text style={styles.groupOverlap}>Kesişen: {group.overlap_label}</Text>
                  ) : null}
                </View>
                {(group.items || []).map((item) => (
                  <SummaryRow key={String(item.reservation_id)} item={item} onPress={handleOpenReservation} />
                ))}
              </View>
            ))
          )
        ) : (data?.items || []).length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>{emptyMessages[activeTab] || 'Kayıt yok.'}</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {(data?.items || []).map((item) => (
              <SummaryRow
                key={String(item.reservation_id)}
                item={item}
                onPress={handleOpenReservation}
                onAssigned={refresh}
                showCreatedAt={activeTab === 'yeni'}
              />
            ))}
          </View>
        )}
      </PageScaffold>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  backBtn: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 12,
    paddingBottom: 24,
  },
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  assignRow: {
    marginTop: 8,
  },
  assignSelect: {
    marginBottom: 6,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowId: {
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  rowRoom: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  rowDates: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  rowGuest: {
    marginTop: 6,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rowChannel: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.danger,
    marginBottom: 12,
    overflow: 'hidden',
  },
  groupHeader: {
    backgroundColor: 'rgba(220, 53, 69, 0.08)',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupTitle: {
    fontWeight: '800',
    color: COLORS.danger,
  },
  groupOverlap: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
