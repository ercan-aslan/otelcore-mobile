import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PageScaffold from '../components/PageScaffold';
import MarketPeriodCard from '../components/MarketPeriodCard';
import AppPressable from '../components/AppPressable';
import { MarketAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { showMessage } from '../utils/alert';

export default function MarketScreen() {
  const loader = useCallback(() => MarketAPI.get(), []);
  const { data, loading, refreshing, error, refresh } = useFetch(loader);
  const payload = data?.data || {};
  const periods = payload.periods || [];
  const usesDemo = Boolean(payload.uses_demo_data);
  const showMarket = usesDemo || payload.has_api_key || periods.length > 0;
  const [scanning, setScanning] = useState(false);

  const onForceRefresh = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      await MarketAPI.refresh();
      refresh();
    } catch (err) {
      showMessage('Hata', err.message || 'Tarama başlatılamadı.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <PageScaffold loading={loading} refreshing={refreshing} error={error} onRefresh={refresh}>
      <Text style={styles.pageTitle}>📈 Piyasa Analizi</Text>

      {!showMarket ? (
        <View style={styles.noApiBox}>
          <Text style={styles.noApiIcon}>⚠️</Text>
          <Text style={styles.noApiText}>
            Sistemin piyasayı analiz edebilmesi için lütfen masaüstü görünümünden API anahtarınızı
            kaydedin.
          </Text>
        </View>
      ) : (
        <>
          {usesDemo ? (
            <View style={styles.demoBox}>
              <Text style={styles.demoText}>
                Demo rakip fiyat verisi gösteriliyor. Canlı tarama için SerpApi anahtarı gerekir.
              </Text>
            </View>
          ) : (
            <View style={styles.scanBar}>
              <Text style={styles.scanLabel}>
                Son Veri Tarama:{' '}
                <Text style={styles.scanValue}>{payload.last_scan || 'Henüz Veri Çekilmedi'}</Text>
              </Text>
              <AppPressable
                color={COLORS.danger}
                disabled={scanning}
                onPress={onForceRefresh}
                style={styles.scanBtn}
              >
                <View style={styles.scanBtnInner}>
                  {scanning ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="refresh" size={12} color="#fff" />
                  )}
                  <Text style={styles.scanBtnText}>
                    {scanning ? ' Taranıyor...' : ' Piyasayı Tarat (4 Kredi)'}
                  </Text>
                </View>
              </AppPressable>
            </View>
          )}

          <View style={styles.regionBar}>
            <Text style={styles.regionText}>
              📍 İzlenen Rekabet Bölgesi:{' '}
              <Text style={styles.regionHighlight}>{payload.search_query || 'Kaş Antalya'}</Text>
            </Text>
          </View>

          {periods.map((period) => (
            <MarketPeriodCard key={period.key} period={period} />
          ))}
        </>
      )}
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  noApiBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    elevation: 1,
  },
  noApiIcon: { fontSize: 40, marginBottom: 12 },
  noApiText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  demoBox: {
    backgroundColor: '#cff4fc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  demoText: {
    color: '#055160',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  scanBar: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
  },
  scanLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  scanValue: { color: COLORS.textPrimary, fontWeight: '700' },
  scanBtn: {
    alignSelf: 'center',
    minHeight: 28,
    minWidth: 0,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  scanBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  regionBar: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  regionText: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  regionHighlight: { color: COLORS.primary, fontWeight: '700' },
});
