import React, { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PageScaffold from '../components/PageScaffold';
import MobileCard from '../components/MobileCard';
import AppPressable from '../components/AppPressable';
import { CalendarAPI, ChannelsAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { showMessage } from '../utils/alert';

export default function ChannelsScreen() {
  const [syncing, setSyncing] = useState(false);
  const loader = useCallback(() => ChannelsAPI.list(), []);
  const { data, loading, refreshing, error, refresh } = useFetch(loader);
  const platforms = data?.data || [];

  const onSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await CalendarAPI.action({ action: 'sync' });
      refresh();
    } catch (err) {
      showMessage('Hata', err.message || 'Senkronizasyon başarısız.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <PageScaffold
      title="🔗 Kanal Yönetimi"
      subtitle="iCal senkronizasyon kanalları"
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
    >
      <View style={styles.syncRow}>
        <AppPressable
          color={COLORS.success}
          disabled={syncing}
          onPress={onSync}
          style={styles.syncBtn}
        >
          <View style={styles.syncBtnInner}>
            <Ionicons name="refresh" size={12} color="#fff" />
            <Text style={styles.syncBtnText}>
              {syncing ? ' Senkronize...' : ' Senkronize Et'}
            </Text>
          </View>
        </AppPressable>
      </View>

      {platforms.map((platform) => (
        <MobileCard key={platform.name} borderColor={platform.color || COLORS.primary}>
          <Text style={[styles.name, { color: platform.color || COLORS.primary }]}>
            {platform.name}
          </Text>
          <Text style={styles.meta}>iCal bağlantısı: {platform.ical_count || 0} oda</Text>
          <AppPressable
            title="Partner paneline git →"
            color={COLORS.primary}
            variant="outline"
            onPress={() => Linking.openURL(platform.partner_url)}
            style={styles.linkBtn}
          />
        </MobileCard>
      ))}
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  syncRow: { alignItems: 'center', marginBottom: 12 },
  syncBtn: {
    alignSelf: 'center',
    minHeight: 28,
    minWidth: 0,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  syncBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  name: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  linkBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
});
