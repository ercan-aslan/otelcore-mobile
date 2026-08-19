import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export const BIOMETRIC_ENABLED_KEY = '@otelcore_biometric_enabled';

export async function isBiometricSupported() {
  if (Platform.OS === 'web') return false;
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch {
    return false;
  }
}

export async function getBiometricLabel() {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Yüz tanıma';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Parmak izi';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'İris';
    }
  } catch {
    // ignore
  }
  return 'Biyometrik';
}

export async function isBiometricEnabled() {
  if (Platform.OS === 'web') return false;
  return (await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)) === '1';
}

export async function setBiometricEnabled(enabled) {
  if (enabled) {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, '1');
  } else {
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  }
}

export async function authenticateWithBiometric(reason) {
  if (Platform.OS === 'web') return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason || 'MyStoneINN oturumunu açın',
      cancelLabel: 'İptal',
      fallbackLabel: 'Şifre kullan',
      disableDeviceFallback: false,
    });
    return result.success === true;
  } catch {
    return false;
  }
}
