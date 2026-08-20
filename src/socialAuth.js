import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export const SITE_URL = 'https://tr.otelcore.com';

export function appScheme() {
  return String(Constants.expoConfig?.scheme || 'otelcore');
}

export async function startGoogleLogin() {
  const redirect = `${appScheme()}://google-auth`;
  const url = `${SITE_URL}/google_oauth.php?intent=login&mobile=1&app_scheme=${encodeURIComponent(appScheme())}`;
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type !== 'success' || !result.url) {
    return null;
  }
  try {
    const parsed = new URL(result.url);
    const err = parsed.searchParams.get('error');
    if (err) {
      const error = new Error(err);
      error.code = 'GOOGLE_AUTH_ERROR';
      throw error;
    }
    return parsed.searchParams.get('ticket');
  } catch (e) {
    if (e?.code === 'GOOGLE_AUTH_ERROR') {
      throw e;
    }
    return null;
  }
}

export async function startAppleLogin() {
  if (Platform.OS !== 'ios') {
    return { error: 'Apple ile giriş iOS uygulamasında kullanılır.' };
  }
  let AppleAuthentication;
  try {
    AppleAuthentication = await import('expo-apple-authentication');
  } catch {
    return { error: 'Apple ile giriş bu sürümde kapalı. E-posta veya Google kullanın.' };
  }
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    return { error: 'Bu cihazda Apple ile giriş kullanılamıyor.' };
  }
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const identityToken = cred.identityToken;
    if (!identityToken) {
      return { error: 'Apple jetonu alınamadı.' };
    }
    const nameParts = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean);
    return {
      identityToken,
      email: cred.email || '',
      fullName: nameParts.join(' ').trim(),
    };
  } catch (e) {
    if (e?.code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    return { error: 'Apple ile giriş iptal edildi veya başarısız.' };
  }
}
