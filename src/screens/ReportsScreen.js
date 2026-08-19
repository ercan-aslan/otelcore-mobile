import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PageScaffold from '../components/PageScaffold';
import MobileCard from '../components/MobileCard';
import { ReportsAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';

export default function ReportsScreen() {
  const loader = useCallback(() => ReportsAPI.get(), []);
  const { data, loading, refreshing, error, refresh } = useFetch(loader);
  const payload = data?.data || {};

  return (
    <PageScaffold
      title="📊 Raporlar"
      subtitle="Son 12 ay finansal performans"
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
    >
      <Text style={styles.section}>Aylık Gelir (EUR)</Text>
      {(payload.monthly_income || []).length === 0 ? (
        <Text style={styles.empty}>Gelir verisi yok.</Text>
      ) : (
        payload.monthly_income.map((row) => (
          <MobileCard key={row.month} borderColor={COLORS.primary}>
            <Text style={styles.month}>{row.month}</Text>
            <Text style={styles.meta}>Brüt: €{Number(row.total_gross || 0).toFixed(2)}</Text>
            <Text style={styles.net}>Net: €{Number(row.total_net || 0).toFixed(2)}</Text>
            <Text style={styles.meta}>
              Komisyon: €{Number(row.total_commission || 0).toFixed(2)}
            </Text>
          </MobileCard>
        ))
      )}

      <Text style={styles.section}>Oda Doluluk Sayıları</Text>
      {(payload.room_occupancy || []).map((row) => (
        <MobileCard key={row.room_name} borderColor={COLORS.info}>
          <View style={styles.row}>
            <Text style={styles.room}>{row.room_name}</Text>
            <Text style={styles.count}>{row.count} rez.</Text>
          </View>
        </MobileCard>
      ))}
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 8, color: COLORS.textPrimary },
  empty: { color: COLORS.textMuted, marginBottom: 12 },
  month: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  net: { fontSize: 16, fontWeight: '800', color: COLORS.success, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  room: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  count: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
});
