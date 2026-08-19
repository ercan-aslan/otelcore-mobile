import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_KEYS = new Set([
  '@otelcore_admin_token',
  '@mystoneinn_admin_token',
]);

function canUseSecureStore() {
  return Platform.OS !== 'web' && typeof SecureStore.getItemAsync === 'function';
}

function shouldUseSecureStore(key) {
  return SECURE_KEYS.has(key) && canUseSecureStore();
}

export async function storageGetItem(key) {
  if (shouldUseSecureStore(key)) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null && value !== undefined) {
        return value;
      }
    } catch {
      // SecureStore başarısız olursa AsyncStorage'a düş
    }
  }

  return AsyncStorage.getItem(key);
}

export async function storageSetItem(key, value) {
  if (shouldUseSecureStore(key)) {
    try {
      await SecureStore.setItemAsync(key, String(value));
      await AsyncStorage.removeItem(key);
      return;
    } catch {
      // SecureStore başarısız olursa AsyncStorage'a düş
    }
  }

  await AsyncStorage.setItem(key, String(value));
}

export async function storageRemoveItem(key) {
  if (shouldUseSecureStore(key)) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  }

  await AsyncStorage.removeItem(key);
}

export async function migrateTokenToSecureStore(tokenKey) {
  if (!canUseSecureStore()) {
    return;
  }

  try {
    const legacy = await AsyncStorage.getItem(tokenKey);
    if (legacy) {
      await SecureStore.setItemAsync(tokenKey, legacy);
      await AsyncStorage.removeItem(tokenKey);
    }
  } catch {
    // ignore migration errors
  }
}
