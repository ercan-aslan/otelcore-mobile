import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PageScaffold from '../components/PageScaffold';
import MobileCard from '../components/MobileCard';
import AppPressable from '../components/AppPressable';
import { SettingsAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import {
  STORAGE_PUSH_TOKEN_KEY,
  getLastPushError,
  registerForPushNotifications,
} from '../services/pushNotifications';
import { showMessage } from '../utils/alert';

export default function SettingsScreen() {
  const loader = useCallback(() => SettingsAPI.get(), []);
  const { data, loading, refreshing, error, refresh } = useFetch(loader);
  const s = data?.data || {};
  const [pushBusy, setPushBusy] = useState(false);
  const [pushInfo, setPushInfo] = useState({ token: '', err: null });

  const loadPushInfo = useCallback(async () => {
    const token = (await AsyncStorage.getItem(STORAGE_PUSH_TOKEN_KEY)) || '';
    const err = await getLastPushError();
    setPushInfo({ token, err });
  }, []);

  React.useEffect(() => {
    loadPushInfo();
  }, [loadPushInfo]);

  const onRetryPush = async () => {
    setPushBusy(true);
    try {
      const result = await registerForPushNotifications();
      await loadPushInfo();
      if (result?.token && !result?.error) {
        showMessage('Push', 'Token sunucuya kaydedildi.');
      } else {
        showMessage(
          'Push kaydı başarısız',
          result?.error || 'Bilinmeyen hata. Firebase/FCM kurulumu gerekir.'
        );
      }
    } finally {
      setPushBusy(false);
    }
  };

  const rows = [
    { label: 'Otel Adı', value: s.ayar_title },
    { label: 'Telefon', value: s.ayar_tel || s.ayar_gsm },
    { label: 'E-posta', value: s.ayar_mail },
    { label: 'Adres', value: s.ayar_adres },
    { label: 'Site', value: s.ayar_siteurl },
    { label: 'Instagram', value: s.ayar_instagram },
    { label: 'Kur Tipi', value: s.ayar_kur_tipi },
    { label: 'EUR Kuru', value: s.ayar_eur_kuru },
    { label: 'Son Senkron', value: s.ayar_last_sync },
  ];

  return (
    <PageScaffold
      title="⚙️ Ayarlar"
      subtitle="Genel tesis bilgileri (salt okunur)"
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={async () => {
        await refresh();
        await loadPushInfo();
      }}
    >
      <MobileCard borderColor={pushInfo.token ? COLORS.success : COLORS.warning}>
        <Text style={styles.label}>Push bildirimi</Text>
        <Text style={styles.value}>
          {pushInfo.token
            ? `Token var: ${pushInfo.token.slice(0, 28)}…`
            : 'Token yok — sunucuya kayıt yapılamadı'}
        </Text>
        {pushInfo.err?.message ? (
          <Text style={styles.pushError}>
            Son hata ({pushInfo.err.at || ''}): {pushInfo.err.message}
          </Text>
        ) : null}
        <View style={{ marginTop: 10 }}>
          <AppPressable color={COLORS.primary} loading={pushBusy} onPress={onRetryPush}>
            Push kaydını tekrar dene
          </AppPressable>
        </View>
      </MobileCard>

      {rows.map((row) => (
        <MobileCard key={row.label} borderColor={COLORS.border}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value || '—'}</Text>
        </MobileCard>
      ))}
      <Text style={styles.hint}>
        Ayar değişiklikleri web admin panelinden yapılır.
      </Text>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  value: { fontSize: 15, color: COLORS.textPrimary, marginTop: 4 },
  pushError: { fontSize: 12, color: COLORS.danger, marginTop: 8, fontWeight: '600' },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
});
