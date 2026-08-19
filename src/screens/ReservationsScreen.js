import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PageScaffold from '../components/PageScaffold';
import MobileCard from '../components/MobileCard';
import TabPills from '../components/TabPills';
import SelectField, { SubmitButton } from '../components/SelectField';
import { ReservationsAPI, CancellationsAPI, ReservationAPI } from '../api';
import { useAppNavigation } from '../context/NavigationContext';
import { useReservationFilter } from '../context/ReservationFilterContext';
import { COLORS } from '../theme';
import {
  formatDateShort,
  formatDateTime,
  formatMoney,
  formatReservationMoney,
  getChannelStyle,
  isIcalListReservation,
  resolveReservationCurrency,
  RESERVATION_SORT_OPTIONS,
  sortReservationRows,
} from '../utils/format';
import { showMessage } from '../utils/alert';

const DEFAULT_SORT = {
  confirmed: 'created_at_desc',
  cancelled: 'created_at_desc',
  refunds: 'created_at_desc',
};

function filterVisibleRows(rows, showChannelReservations) {
  if (showChannelReservations) return rows;
  return rows.filter((item) => !isIcalListReservation(item));
}

function ReservationUnitAssign({ item, onAssigned }) {
  const [unitId, setUnitId] = useState('');
  const [saving, setSaving] = useState(false);
  const unitOptions = (item.units || [])
    .filter((u) => !u.busy)
    .map((u) => ({ value: u.unit_id, label: u.unit_code }));

  if (!item.needs_unit || unitOptions.length === 0) {
    return null;
  }

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
    <View style={styles.assignWrap}>
      <SelectField
        placeholder="Oda no seçin"
        value={unitId}
        options={unitOptions}
        onChange={setUnitId}
      />
      <SubmitButton title="Oda no kaydet" loading={saving} onPress={saveUnit} />
    </View>
  );
}

export default function ReservationsScreen({ initialTab = 'confirmed' }) {
  const { openReservation } = useAppNavigation();
  const { showChannelReservations, websiteOnly, ready: filterReady } = useReservationFilter();
  const [tab, setTab] = useState(initialTab);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ confirmed: 0, cancelled: 0, refunds: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState(null);
  const [sortKey, setSortKey] = useState(DEFAULT_SORT[initialTab] || 'created_at_desc');

  const tabs = useMemo(
    () => [
      { key: 'confirmed', label: 'Onaylananlar', shortLabel: 'Onaylı', count: counts.confirmed },
      { key: 'cancelled', label: 'İptal / Gün Düş.', shortLabel: 'İptal', count: counts.cancelled, danger: true },
      { key: 'refunds', label: 'İadeler', shortLabel: 'İade', count: counts.refunds },
    ],
    [counts]
  );

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((t) => t.key === tab)) {
      setTab(tabs[0].key);
    }
  }, [tabs, tab]);

  useEffect(() => {
    setSortKey(DEFAULT_SORT[tab] || 'created_at_desc');
  }, [tab]);

  const load = useCallback(
    async (activeTab, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        if (activeTab === 'confirmed') {
          const res = await ReservationsAPI.list('confirmed', 100, { websiteOnly });
          const rows = res.data || res.reservations || [];
          setItems(rows);
          if (res.counts) {
            setCounts((prev) => ({
              ...prev,
              confirmed: res.counts.confirmed ?? rows.length,
              cancelled: res.counts.cancelled ?? prev.cancelled,
            }));
          }
        } else {
          const res = await CancellationsAPI.list(activeTab, { websiteOnly });
          const rows = res.data || [];
          setItems(rows);
          setCounts((prev) => ({ ...prev, [activeTab]: rows.length }));
        }
      } catch (err) {
        setError(err.message || 'Kayıtlar yüklenemedi.');
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [websiteOnly]
  );

  useEffect(() => {
    if (!filterReady || !tabs.length) return;
    load(tab, false);
  }, [tab, load, filterReady, tabs.length]);

  const visibleItems = useMemo(
    () => sortReservationRows(filterVisibleRows(items, showChannelReservations), sortKey),
    [items, showChannelReservations, sortKey]
  );

  const onRestore = async (reservationId) => {
    setRestoringId(reservationId);
    try {
      await CancellationsAPI.restore(reservationId);
      showMessage('Başarılı', 'Rezervasyon geri alındı.');
      await load(tab, true);
    } catch (err) {
      showMessage('Hata', err.message || 'Geri alma başarısız.');
    } finally {
      setRestoringId(null);
    }
  };

  const renderConfirmedItem = (item) => {
    const guest =
      item.guest_name ||
      (item.channel_name !== 'Manuel Kayıt' ? item.channel_name : null) ||
      'Misafir';
    const channel = getChannelStyle(item.channel, item);
    const reservationId = item.reservation_id || item.id;
    const openDetail = () => openReservation(reservationId, item);
    const roomLine = item.unit_code
      ? `${item.room_name || 'Oda'} · ${item.unit_code}`
      : item.room_name || 'Oda';
    return (
      <MobileCard key={String(reservationId)} borderColor={COLORS.primary}>
        <Pressable onPress={openDetail}>
          <View style={styles.row}>
            <Text style={styles.guest} numberOfLines={1}>
              {guest}
            </Text>
            <Text style={styles.price}>{formatReservationMoney(item)}</Text>
          </View>
          <Text style={styles.meta}>
            🚪 {roomLine} | {formatDateShort(item.check_in)} -{' '}
            {formatDateShort(item.check_out)}
          </Text>
          {item.created_at_formatted || item.created_at ? (
            <Text style={styles.meta}>
              Kayıt: {item.created_at_formatted || formatDateTime(item.created_at)}
            </Text>
          ) : null}
          <View style={[styles.channelBadge, { backgroundColor: channel.color }]}>
            <Text style={styles.channelText}>{channel.label}</Text>
          </View>
          <Text style={styles.idText}>#{reservationId}</Text>
        </Pressable>
        <ReservationUnitAssign item={item} onAssigned={() => load(tab, true)} />
        <SubmitButton title="Detay Aç" onPress={openDetail} />
      </MobileCard>
    );
  };

  const renderCancellationItem = (item) => {
    const borderColor = tab === 'refunds' ? COLORS.success : COLORS.warning;
    return (
      <MobileCard key={String(item.reservation_id)} borderColor={borderColor}>
        <Pressable onPress={() => openReservation(item.reservation_id, item)}>
          <Text style={styles.guest}>{item.guest_name || 'Misafir'}</Text>
          <Text style={styles.meta}>
            #{item.reservation_id} · {item.room_name}
          </Text>
          <Text style={styles.meta}>
            {formatDateShort(item.check_in)} → {formatDateShort(item.check_out)}
          </Text>
          {item.created_at_formatted || item.created_at ? (
            <Text style={styles.meta}>
              Kayıt: {item.created_at_formatted || formatDateTime(item.created_at)}
            </Text>
          ) : null}
          {item.total_price_formatted ? (
            <Text style={styles.total}>{item.total_price_formatted}</Text>
          ) : null}
          {item.refund_amount > 0 ? (
            <Text style={styles.refund}>
              İade: {formatMoney(item.refund_amount, resolveReservationCurrency(item))}
            </Text>
          ) : null}
          {item.cancelled_at_formatted ? (
            <Text style={styles.meta}>İptal: {item.cancelled_at_formatted}</Text>
          ) : null}
          {item.cancel_reason ? (
            <Text style={styles.reason} numberOfLines={3}>
              {item.cancel_reason}
            </Text>
          ) : null}
          {item.sync_locked ? (
            <View style={styles.lockBadge}>
              <Text style={styles.lockText}>Senkron Kilitli</Text>
            </View>
          ) : null}
        </Pressable>
        <SubmitButton
          title="Detay Aç"
          onPress={() => openReservation(item.reservation_id, item)}
        />
        {String(item.status || '').toLowerCase() === 'cancelled' ? (
          <SubmitButton
            title="İptali Geri Al"
            color={COLORS.success}
            loading={restoringId === item.reservation_id}
            onPress={() => onRestore(item.reservation_id)}
          />
        ) : null}
      </MobileCard>
    );
  };

  if (!tabs.length) {
    return (
      <PageScaffold title="📋 Rezervasyonlar">
        <Text style={styles.empty}>Bu ekran için yetkiniz bulunmuyor.</Text>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="📋 Rezervasyonlar"
      subtitle="Onay, iptal ve iade kayıtları"
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => load(tab, true)}
      headerExtra={
        <>
          <TabPills tabs={tabs} activeKey={tab} onChange={setTab} />
          <Text style={styles.sortLabel}>Sırala</Text>
          <TabPills tabs={RESERVATION_SORT_OPTIONS} activeKey={sortKey} onChange={setSortKey} />
        </>
      }
    >
      {visibleItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {items.length > 0 && !showChannelReservations
              ? 'Web sitesi kaydı bulunamadı. Kanal kayıtları için üstteki anahtarı açın.'
              : 'Kayıt bulunamadı.'}
          </Text>
        </View>
      ) : tab === 'confirmed' ? (
        visibleItems.map(renderConfirmedItem)
      ) : (
        visibleItems.map(renderCancellationItem)
      )}
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  guest: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, flex: 1, paddingRight: 8 },
  price: { fontSize: 15, fontWeight: '700', color: COLORS.success },
  total: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 6 },
  refund: { fontSize: 14, fontWeight: '700', color: COLORS.success, marginTop: 6 },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  reason: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, fontStyle: 'italic' },
  channelBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  channelText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  idText: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  lockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  lockText: { fontSize: 11, fontWeight: '700', color: '#856404' },
  empty: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  sortLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  assignWrap: { marginTop: 10 },
});
