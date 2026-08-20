import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppPressable from '../components/AppPressable';
import { PaymentsAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { formatDateShort, formatMoney, resolveReservationCurrency } from '../utils/format';

export default function PaymentDetailScreen({ reservationId, initialSnapshot = null, onClose }) {
  const loader = useCallback(
    () => PaymentsAPI.detail(reservationId),
    [reservationId]
  );
  const { data, loading, error, refresh, refreshing } = useFetch(loader);
  const detail = data?.data || null;
  const snap = initialSnapshot || {};

  const guest =
    detail?.guest_name || snap.user_name || snap.guest_name || 'Misafir';
  const currency =
    detail?.currency || snap.currency || resolveReservationCurrency(snap);
  const channel = detail?.channel_label || detail?.channel || snap.source_label || '—';
  const checkIn =
    detail?.check_in_formatted ||
    formatDateShort(detail?.check_in || snap.check_in) ||
    '—';
  const checkOut =
    detail?.check_out_formatted ||
    formatDateShort(detail?.check_out || snap.check_out) ||
    '—';
  const commission = detail?.commission || {};
  const lineItems = detail?.line_items || [];
  const payments = detail?.payments || [];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppPressable onPress={onClose} style={styles.backBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </AppPressable>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Ödeme Detayı</Text>
      </View>

      {loading && !detail ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : error && !detail ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>Yenile</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={!!refreshing} onRefresh={refresh} tintColor={COLORS.primary} />
          }
        >
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.guest}>{guest}</Text>
              <View style={styles.channelPill}>
                <Text style={styles.channelPillText} numberOfLines={1}>
                  {channel}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {detail?.room_name || 'Oda'} · {checkIn} – {checkOut}
            </Text>
            <Text style={styles.metaMuted}>Rezervasyon #{reservationId}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Kalemler</Text>
              {Number(commission.rate_percent) > 0 ? (
                <Text style={styles.commissionHint}>
                  Komisyon %{Number(commission.rate_percent).toFixed(1)}
                </Text>
              ) : null}
            </View>
            {lineItems.length === 0 ? (
              <Text style={styles.emptyLine}>Kalem yok</Text>
            ) : (
              lineItems.map((item) => (
                <View key={item.key || item.label} style={styles.lineRow}>
                  <Text style={styles.lineLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                  <Text style={styles.lineAmount}>{item.amount_formatted}</Text>
                </View>
              ))
            )}
            <View style={styles.divider} />
            <View style={styles.lineRow}>
              <Text style={styles.totalLabel}>Toplam</Text>
              <Text style={styles.totalAmount}>
                {detail?.total_price_formatted ||
                  formatMoney(detail?.total_price || snap.amount || 0, currency)}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ödemeler</Text>
            {payments.length === 0 ? (
              <Text style={styles.emptyLine}>Ödeme kaydı yok</Text>
            ) : (
              payments.map((pay, idx) => (
                <View
                  key={String(pay.payment_id || idx)}
                  style={[styles.payRow, idx === payments.length - 1 && styles.payRowLast]}
                >
                  <View style={styles.payMain}>
                    <Text style={styles.payStatus}>{pay.status_label || pay.status}</Text>
                    <Text style={styles.payMeta} numberOfLines={1}>
                      {pay.payment_method_label || pay.payment_method || '—'}
                      {pay.created_at_formatted ? ` · ${pay.created_at_formatted}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.payAmount,
                      Number(pay.amount) < 0 && styles.amountNegative,
                    ]}
                  >
                    {pay.amount_formatted || formatMoney(pay.amount, currency)}
                  </Text>
                </View>
              ))
            )}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Alınan</Text>
              <Text style={styles.summaryOk}>{detail?.paid_total_formatted || '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bekleyen</Text>
              <Text style={styles.summaryWarn}>{detail?.pending_total_formatted || '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Kalan</Text>
              <Text style={styles.summaryBal}>{detail?.balance_formatted || '—'}</Text>
            </View>
          </View>

          {Number(commission.rate_percent) > 0 || Number(commission.amount) > 0 ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Platform bilgisi</Text>
              <Text style={styles.infoLine}>Kanal: {commission.platform || channel}</Text>
              <Text style={styles.infoLine}>
                Komisyon: %{Number(commission.rate_percent || 0).toFixed(1)}
                {commission.amount_formatted ? ` · ${commission.amount_formatted}` : ''}
              </Text>
              {commission.net_formatted ? (
                <Text style={styles.infoLine}>Net: {commission.net_formatted}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Platform bilgisi</Text>
              <Text style={styles.infoLine}>Kanal: {channel}</Text>
              <Text style={styles.infoLine}>Komisyon tanımlı değil (veya %0)</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.background || '#f4f6f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { flex: 1 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    paddingRight: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: COLORS.danger, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  content: { padding: 12, paddingBottom: 28 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  guest: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  channelPill: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 140,
  },
  channelPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  metaMuted: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  commissionHint: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5,
  },
  lineLabel: { flex: 1, fontSize: 13, color: COLORS.textPrimary },
  lineAmount: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  emptyLine: { fontSize: 13, color: COLORS.textMuted, paddingVertical: 4 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalLabel: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  totalAmount: { fontSize: 15, fontWeight: '800', color: COLORS.success },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  payRowLast: { borderBottomWidth: 0 },
  payMain: { flex: 1, minWidth: 0 },
  payStatus: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  payMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  payAmount: { fontSize: 13, fontWeight: '800', color: COLORS.success },
  amountNegative: { color: COLORS.danger },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: { fontSize: 13, color: COLORS.textSecondary },
  summaryOk: { fontSize: 13, fontWeight: '700', color: COLORS.success },
  summaryWarn: { fontSize: 13, fontWeight: '700', color: COLORS.warning },
  summaryBal: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  infoCard: {
    backgroundColor: '#eef4ff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d6e4ff',
  },
  infoTitle: { fontSize: 13, fontWeight: '800', color: COLORS.primary, marginBottom: 6 },
  infoLine: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
