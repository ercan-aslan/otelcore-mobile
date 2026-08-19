import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthAPI, STORAGE_ADMIN_KEY, STORAGE_API_BUILD_KEY, STORAGE_TOKEN_KEY, bootstrapSecureAuthStorage, checkMobileApiConnection, saveSiteBranding } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageSetItem } from '../utils/secureStorage';
import { startAppleLogin, startGoogleLogin } from '../socialAuth';
import AppPressable from '../components/AppPressable';
import {
  getBiometricLabel,
  isBiometricSupported,
  setBiometricEnabled,
} from '../services/biometricAuth';
import Constants from 'expo-constants';
import { COLORS, BRAND_NAME } from '../theme';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState(null);
  const [branding, setBranding] = useState(null);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biyometrik');
  const [enableBio, setEnableBio] = useState(true);
  const [hotelChoices, setHotelChoices] = useState(null);
  const [socialTicket, setSocialTicket] = useState('');

  useEffect(() => {
    (async () => {
      await bootstrapSecureAuthStorage();
      const supported = await isBiometricSupported();
      setBioSupported(supported);
      if (supported) {
        setBioLabel(await getBiometricLabel());
      }

      const status = await checkMobileApiConnection();
      setApiStatus(status);
      if (status.branding) {
        setBranding(status.branding);
        await saveSiteBranding(status.branding);
      }
    })();
  }, []);

  const finishLogin = async (result) => {
    await storageSetItem(STORAGE_TOKEN_KEY, result.token);
    await AsyncStorage.setItem(STORAGE_ADMIN_KEY, JSON.stringify(result.admin || {}));
    await AsyncStorage.setItem(STORAGE_API_BUILD_KEY, String(result.api_build || 'eski'));
    if (bioSupported && enableBio) {
      await setBiometricEnabled(true);
    }
    if (result.branding) {
      setBranding(result.branding);
      await saveSiteBranding(result.branding);
    }
    setHotelChoices(null);
    setSocialTicket('');
    onLoginSuccess(result);
  };

  const applyAuthResult = async (result) => {
    if (result?.needs_hotel_selection && Array.isArray(result.hotels)) {
      setHotelChoices(result.hotels);
      setSocialTicket(String(result.social_ticket || ''));
      setError('');
      return;
    }
    await finishLogin(result);
  };

  const handleLogin = async (selectedHotel = null) => {
    if (socialTicket && selectedHotel) {
      setLoading(true);
      setError('');
      try {
        const result = await AuthAPI.social({ socialTicket, hotel: selectedHotel });
        await applyAuthResult(result);
      } catch (err) {
        setError(err.message || 'Giriş başarısız.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const u = email.trim().toLowerCase();
    const p = password.trim();
    if (!u || !p) {
      setError('Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    if (!u.includes('@')) {
      setError('Giriş e-posta ile yapılır.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const status = apiStatus?.ok ? apiStatus : await checkMobileApiConnection();
      setApiStatus(status);
      if (!status.ok) {
        setError(status.message || 'Sunucuya bağlanılamadı.');
        return;
      }

      const result = await AuthAPI.login(u, p, selectedHotel);
      await applyAuthResult(result);
    } catch (err) {
      if (err.status === 401) {
        setError('E-posta veya şifre hatalı. Web paneldeki e-posta ile girin.');
      } else if (err.status === 429) {
        setError('Çok fazla deneme. 15 dakika sonra tekrar deneyin.');
      } else if (err.status === 503) {
        setError('Mobil API yapılandırması eksik. Sunucuda api/mobile/secret.php oluşturun.');
      } else {
        setError(err.message || 'Giriş başarısız.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const ticket = await startGoogleLogin();
      if (!ticket) {
        return;
      }
      const result = await AuthAPI.social({ ticket });
      await applyAuthResult(result);
    } catch (err) {
      setError(err.message || 'Google ile giriş başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setLoading(true);
    setError('');
    try {
      const cred = await startAppleLogin();
      if (!cred) {
        return;
      }
      if (cred.error) {
        setError(cred.error);
        return;
      }
      const result = await AuthAPI.social({
        identityToken: cred.identityToken,
        email: cred.email,
        fullName: cred.fullName,
      });
      await applyAuthResult(result);
    } catch (err) {
      setError(err.message || 'Apple ile giriş başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.loginCard}>
            <View style={styles.cardTopBorder} />
            <Image
              source={require('../../assets/icon.png')}
              style={styles.loginLogo}
              resizeMode="contain"
              accessibilityLabel="OtelCore"
            />
            <Text style={styles.title}>Otel girişi</Text>
            <Text style={styles.subtitle}>OtelCore yönetim uygulaması</Text>

            {apiStatus && !apiStatus.ok ? (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>⚠️ {apiStatus.message}</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}

            {hotelChoices?.length ? (
              <View style={styles.hotelBox}>
                <Text style={styles.label}>Otel seçin</Text>
                {hotelChoices.map((h) => (
                  <AppPressable
                    key={String(h.hotel_id)}
                    title={h.name || h.slug}
                    color={COLORS.primary}
                    disabled={loading}
                    onPress={() => handleLogin(h)}
                    style={styles.hotelBtn}
                  />
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>E-posta</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="ornek@otel.com"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setHotelChoices(null);
                  setSocialTicket('');
                }}
                editable={!loading}
              />
            </View>

            <Text style={styles.label}>Şifre</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputIcon}>🔑</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                onSubmitEditing={() => handleLogin()}
              />
            </View>

            {bioSupported ? (
              <Pressable
                style={styles.bioRow}
                onPress={() => setEnableBio((v) => !v)}
                disabled={loading}
              >
                <View style={[styles.bioCheck, enableBio && styles.bioCheckOn]}>
                  {enableBio ? <Text style={styles.bioCheckMark}>✓</Text> : null}
                </View>
                <Text style={styles.bioText}>
                  Sonraki açılışlarda {bioLabel.toLowerCase()} ile aç
                </Text>
              </Pressable>
            ) : null}

            {!hotelChoices?.length ? (
              <>
                <AppPressable
                  title={loading ? '' : 'Giriş Yap →'}
                  color={COLORS.primary}
                  loading={loading}
                  disabled={loading}
                  onPress={() => handleLogin()}
                  style={styles.button}
                />
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>veya</Text>
                  <View style={styles.orLine} />
                </View>
                {Platform.OS === 'ios' ? (
                  <Pressable style={styles.appleBtn} onPress={handleApple} disabled={loading}>
                    <Text style={styles.appleBtnText}>Apple ile giriş</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
                  <Text style={styles.googleBtnText}>Google ile giriş</Text>
                </Pressable>
              </>
            ) : null}
          </View>
          <Text style={styles.footer}>© {BRAND_NAME} · APK v{Constants.expoConfig?.version || '1.0.14'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loginCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  cardTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: COLORS.accent,
  },
  icon: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  loginLogo: {
    width: '100%',
    height: 56,
    marginBottom: 12,
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputIcon: { paddingLeft: 12, fontSize: 16 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 48,
    color: COLORS.textPrimary,
  },
  button: {
    marginTop: 8,
    minHeight: 48,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  hotelBox: {
    marginBottom: 12,
    gap: 8,
  },
  hotelBtn: {
    marginTop: 6,
    minHeight: 44,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 12 },
  appleBtn: {
    backgroundColor: '#000',
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  appleBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  googleBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  googleBtnText: { color: '#1f1f1f', fontWeight: '700', fontSize: 16 },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 6,
  },
  bioCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioCheckOn: {
    backgroundColor: COLORS.primary,
  },
  bioCheckMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  bioText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  errorBox: {
    backgroundColor: '#f8d7da',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  warnBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  warnText: { color: '#856404', fontWeight: '700', fontSize: 13 },
  errorText: { color: COLORS.danger, fontWeight: '700', fontSize: 14 },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 24,
    fontSize: 12,
  },
});
