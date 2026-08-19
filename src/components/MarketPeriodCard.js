import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { formatMarketDateRange, formatMoneyTRYInt } from '../utils/format';

const PERIOD_COLORS = {
  secondary: '#6c757d',
  info: '#0dcaf0',
  primary: '#0d6efd',
  success: '#198754',
};

const PERIOD_ICONS = {
  lightning: 'flash',
  weekend: 'wine',
  'calendar-week': 'calendar',
  'calendar-month': 'calendar-outline',
};

function RoomPriceGrid({ prices = [] }) {
  return (
    <View style={styles.roomGrid}>
      {prices.map((room) => (
        <View key={String(room.room_id)} style={styles.roomCard}>
          <Text style={styles.roomName} numberOfLines={1}>
            {room.room_name}
          </Text>
          <Text style={styles.roomPrice}>{formatMoneyTRYInt(room.daily_try)}</Text>
        </View>
      ))}
    </View>
  );
}

function CompetitorRow({ item }) {
  return (
    <View style={styles.competitorRow}>
      <View style={[styles.rankCircle, item.top3 && styles.rankTop3]}>
        <Text style={[styles.rankText, item.top3 && styles.rankTextTop3]}>{item.rank}</Text>
      </View>
      <Text style={styles.competitorName} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={styles.ratingBadge}>
        <Text style={styles.ratingText}>★ {item.rating ?? '-'}</Text>
      </View>
      <Text style={styles.competitorPrice}>{formatMoneyTRYInt(item.price_try)}</Text>
    </View>
  );
}

export default function MarketPeriodCard({ period }) {
  const headerColor = PERIOD_COLORS[period.color] || COLORS.primary;
  const iconName = PERIOD_ICONS[period.icon] || 'stats-chart';
  const competitorCount = period.competitor_count ?? (period.competitors || []).length;

  return (
    <View style={styles.card}>
      <View style={[styles.cardHeader, { backgroundColor: headerColor }]}>
        <View style={styles.headerLeft}>
          <Ionicons name={iconName} size={18} color="#fff" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>{period.title}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerDatesLabel}>Giriş - Çıkış ({period.nights} Gece)</Text>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>
              {formatMarketDateRange(period.check_in, period.check_out)}
            </Text>
          </View>
        </View>
      </View>

      {period.alert ? (
        <View
          style={[
            styles.alertBar,
            period.alert.type === 'up'
              ? styles.alertUp
              : period.alert.type === 'down'
                ? styles.alertDown
                : styles.alertStable,
          ]}
        >
          <Text style={styles.alertText}>{period.alert.text}</Text>
        </View>
      ) : null}

      <View style={styles.ourPricesSection}>
        <Text style={styles.ourPricesTitle}>🏠 Bizim Ortalama Gecelik Fiyatlarımız</Text>
        <RoomPriceGrid prices={period.our_prices} />
      </View>

      <View style={styles.competitorHeader}>
        <Text style={styles.competitorTitle}>
          En Ucuz {competitorCount} Rakip (Gecelik)
        </Text>
        {period.market_average_try > 0 ? (
          <View style={styles.marketBadge}>
            <Text style={styles.marketBadgeText}>
              Piyasa: {formatMoneyTRYInt(period.market_average_try)}
            </Text>
          </View>
        ) : null}
      </View>

      {period.api_error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorTitle}>SerpApi Bağlantı Hatası:</Text>
          <Text style={styles.errorText}>{period.api_error}</Text>
        </View>
      ) : (period.competitors || []).length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>Uygun otel bulunamadı.</Text>
        </View>
      ) : (
        <View style={styles.competitorList}>
          {period.competitors.map((item) => (
            <CompetitorRow key={`${period.key}-${item.rank}-${item.name}`} item={item} />
          ))}
        </View>
      )}

      <View style={styles.cardFooter}>
        {period.cache_status === 'cached' && period.footer_time ? (
          <Text style={styles.footerText}>
            🕐 Güncelleme: <Text style={styles.footerBold}>{period.footer_time}</Text>
            <Text style={styles.footerSuccess}> ({period.footer_label || 'Kayıtlı Veri'})</Text>
          </Text>
        ) : period.cache_status === 'fresh' ? (
          <Text style={styles.footerText}>
            ☁️ <Text style={styles.footerSuccess}>{period.footer_label || 'Piyasadan Şimdi Çekildi'}</Text>
          </Text>
        ) : period.last_scan ? (
          <Text style={styles.footerText}>Son tarama: {period.last_scan}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerIcon: { marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  headerRight: { alignItems: 'flex-end' },
  headerDatesLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  dateBadge: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 3,
    elevation: 1,
  },
  dateBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  alertBar: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  alertUp: { backgroundColor: '#d1e7dd' },
  alertDown: { backgroundColor: '#f8d7da' },
  alertStable: { backgroundColor: '#fff3cd' },
  alertText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
  ourPricesSection: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ourPricesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roomCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  roomName: { fontSize: 12, color: COLORS.textSecondary, width: '100%', textAlign: 'center' },
  roomPrice: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginTop: 3 },
  competitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  competitorTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, flex: 1 },
  marketBadge: {
    backgroundColor: COLORS.textSecondary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  marketBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  competitorList: { backgroundColor: COLORS.surface },
  competitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankTop3: { backgroundColor: COLORS.warning, borderColor: COLORS.warning },
  rankText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  rankTextTop3: { color: '#fff' },
  competitorName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 6,
  },
  ratingBadge: {
    backgroundColor: COLORS.warning,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 8,
  },
  ratingText: { fontSize: 10, fontWeight: '700', color: COLORS.textPrimary },
  competitorPrice: { fontSize: 15, fontWeight: '800', color: COLORS.danger, minWidth: 72, textAlign: 'right' },
  errorBox: {
    margin: 12,
    padding: 16,
    backgroundColor: '#f8d7da',
    borderRadius: 8,
    alignItems: 'center',
  },
  errorIcon: { fontSize: 28, marginBottom: 6 },
  errorTitle: { fontWeight: '700', color: COLORS.danger, marginBottom: 4 },
  errorText: { color: COLORS.textPrimary, textAlign: 'center', fontSize: 13 },
  emptyBox: { padding: 32, alignItems: 'center' },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
  cardFooter: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  footerText: { fontSize: 12, color: COLORS.textMuted },
  footerBold: { fontWeight: '700', color: COLORS.textPrimary },
  footerSuccess: { fontWeight: '700', color: COLORS.success },
});
