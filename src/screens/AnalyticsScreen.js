import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PageScaffold from '../components/PageScaffold';
import MobileCard from '../components/MobileCard';
import { DashboardAPI, ReportsAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const dashLoader = useCallback(() => DashboardAPI.getStats(), []);
  const reportsLoader = useCallback(() => ReportsAPI.get(), []);
  const dash = useFetch(dashLoader);
  const reports = useFetch(reportsLoader);

  const stats = dash.data?.data || {};
  const monthly = reports.data?.data?.monthly_income || [];
  const latestMonth = monthly.length > 0 ? monthly[monthly.length - 1] : null;

  return (
    <PageScaffold
      title="📉 Özet Analiz"
      subtitle="Canlı operasyon ve gelir özeti"
      loading={dash.loading && reports.loading}
      refreshing={dash.refreshing || reports.refreshing}
      error={dash.error || reports.error}
      onRefresh={() => {
        dash.refresh();
        reports.refresh();
      }}
    >
      <View style={styles.statsRow}>
        <StatCard label="Bugün Giriş" value={String(stats.today_checkins ?? stats.bugun_giris ?? 0)} color={COLORS.success} />
        <StatCard label="Bugün Çıkış" value={String(stats.today_checkouts ?? stats.bugun_cikis ?? 0)} color={COLORS.info} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Bugün Gelen Rez." value={String(stats.today_new_reservations ?? stats.bugun_gelen ?? 0)} color="#ffc107" />
        <StatCard label="Çoklu Rez." value={String(stats.coklu_rezervasyon ?? stats.conflicts ?? 0)} color={COLORS.danger} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Bekleyen" value={String(stats.pending_reservations ?? 0)} color={COLORS.warning} />
      </View>

      {latestMonth ? (
        <MobileCard borderColor={COLORS.primary}>
          <Text style={styles.cardTitle}>Son Ay Geliri ({latestMonth.month})</Text>
          <Text style={styles.meta}>Brüt: €{Number(latestMonth.total_gross || 0).toFixed(2)}</Text>
          <Text style={styles.net}>Net: €{Number(latestMonth.total_net || 0).toFixed(2)}</Text>
        </MobileCard>
      ) : null}

      <MobileCard borderColor={COLORS.textSecondary}>
        <Text style={styles.cardTitle}>Google Analytics 4</Text>
        <Text style={styles.desc}>
          Detaylı ziyaretçi, cihaz ve sayfa raporları web admin panelindeki analytics.php
          sayfasında görüntülenir.
        </Text>
      </MobileCard>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  net: { fontSize: 18, fontWeight: '800', color: COLORS.success, marginTop: 4 },
  desc: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, lineHeight: 22 },
});
