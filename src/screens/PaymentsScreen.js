import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PageScaffold from '../components/PageScaffold';
import MobileCard from '../components/MobileCard';
import TabPills from '../components/TabPills';
import { PaymentsAPI } from '../api';
import { useAppNavigation } from '../context/NavigationContext';
import { useReservationFilter } from '../context/ReservationFilterContext';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { formatDateShort, formatDateTime, formatMoney, resolveReservationCurrency } from '../utils/format';

function statusColor(pay, tab) {
  if (pay.is_channel) return COLORS.primary;
  if (Number(pay.amount) < 0) return COLORS.danger;
  if (tab === 'pending' || pay.status === 'pending') return COLORS.warning;
  return COLORS.success;
}

export default function PaymentsScreen() {
  const { openPayment } = useAppNavigation();
  const { websiteOnly, ready: filterReady } = useReservationFilter();
  const [tab, setTab] = useState('collected');

  const tabs = useMemo(
    () => [
      { key: 'collected', label: 'Tahsil Edilen' },
      { key: 'pending', label: 'Ödeme Bekleyen' },
    ],
    []
  );

  const loader = useCallback(
    () => PaymentsAPI.list(100, tab, { websiteOnly }),
    [tab, websiteOnly]
  );
  const { data, loading, refreshing, error, refresh } = useFetch(loader);
  const payments = data?.data || data?.payments || [];
  const totals = data?.totals;
  const totalLines = totals?.by_currency?.length
    ? totals.by_currency
    : payments.length
      ? [{ amount_formatted: formatMoney(
          payments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0),
          payments[0]?.currency || resolveReservationCurrency(payments[0])
        ) }]
      : [];

  const tabsWithCounts = useMemo(
    () =>
      tabs.map((item) => ({
        ...item,
        count:
          item.key === 'collected'
            ? data?.counts?.collected ?? 0
            : data?.counts?.pending ?? 0,
      })),
    [tabs, data?.counts]
  );

  if (!filterReady) {
    return (
      <PageScaffold title="💳 Ödeme Listesi" loading />
    );
  }

  return (
    <PageScaffold
      title="💳 Ödeme Listesi"
      subtitle={
        tab === 'collected'
          ? 'Web tahsilatları · kanal girişi bugün ve öncesi'
          : 'Web bekleyen · kanal yarın ve sonrası girişler'
      }
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
      headerExtra={<TabPills tabs={tabsWithCounts} activeKey={tab} onChange={setTab} />}
    >
      {payments.length > 0 ? (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>
            Toplam Tutar ({totals?.count ?? payments.length} kayıt)
          </Text>
          {totalLines.map((line) => (
            <Text key={line.currency || line.amount_formatted} style={styles.totalValue}>
              {line.amount_formatted}
            </Text>
          ))}
        </View>
      ) : null}
      {payments.length === 0 ? (
        <Text style={styles.empty}>
          {websiteOnly
            ? 'Web sitesi ödemesi bulunamadı. Kanalları görmek için üstteki anahtarı açın.'
            : 'Bu sekmede kayıt bulunamadı.'}
        </Text>
      ) : (
        payments.map((pay) => {
          const key = pay.payment_id
            ? String(pay.payment_id)
            : pay.synthetic_id || `pay-${pay.reservation_id}-${pay.payment_kind}`;
          const amountLabel =
            pay.amount_formatted
            || formatMoney(pay.amount, pay.currency || resolveReservationCurrency(pay));
          const source =
            pay.source_label
            || pay.payment_method
            || (pay.is_channel ? 'Kanal' : 'Web');
          const stay = [
            pay.check_in_formatted || formatDateShort(pay.check_in),
            pay.check_out_formatted || formatDateShort(pay.check_out),
          ]
            .filter(Boolean)
            .join(' – ');

          const openPay = () => {
            if (!pay.reservation_id) return;
            openPayment(pay.reservation_id, pay);
          };

          return (
            <MobileCard
              key={key}
              borderColor={statusColor(pay, tab)}
              style={styles.compactCard}
            >
              <View style={styles.topRow}>
                <Pressable style={styles.topMain} onPress={openPay}>
                  <View style={styles.nameRow}>
                    <Text style={styles.customer} numberOfLines={1}>
                      {pay.user_name || 'Misafir'}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: statusColor(pay, tab) }]}>
                      <Text style={styles.badgeText} numberOfLines={1}>
                        {pay.payment_kind_label || (tab === 'pending' ? 'Bekliyor' : 'Tahsil')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    #{pay.reservation_id} · {source}
                    {stay ? ` · ${stay}` : ''}
                  </Text>
                  <Text style={styles.date} numberOfLines={1}>
                    {pay.created_at_formatted || pay.display_date || formatDateTime(pay.created_at) || '—'}
                  </Text>
                </Pressable>
                <View style={styles.topActions}>
                  <Text style={[styles.amount, Number(pay.amount) < 0 && styles.amountNegative]}>
                    {amountLabel}
                  </Text>
                  {pay.reservation_id ? (
                    <Pressable
                      style={styles.detailBtn}
                      onPress={openPay}
                      accessibilityRole="button"
                      accessibilityLabel="Ödeme Detayı"
                    >
                      <Text style={styles.detailBtnText}>Ödeme Detayı</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </MobileCard>
          );
        })
      )}
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.success,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 12,
  },
  totalLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.success },
  empty: { color: COLORS.textMuted, textAlign: 'center', padding: 24, lineHeight: 22 },
  compactCard: { paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  topMain: { flex: 1, minWidth: 0 },
  topActions: { alignItems: 'flex-end', gap: 6, paddingTop: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  customer: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flexShrink: 1,
    maxWidth: '68%',
  },
  amount: { fontSize: 13, fontWeight: '700', color: COLORS.success },
  amountNegative: { color: COLORS.danger },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  badge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 120,
    flexShrink: 0,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  date: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  detailBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: 'center',
  },
  detailBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
