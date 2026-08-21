import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import { PushAPI } from '../api';
import { notifyCalendarRefresh } from '../utils/calendarRefresh';
import { formatDate, getChannelStyle } from '../utils/format';
import {
  initializeReservationTracking,
  startReservationWatcher,
} from './reservationWatcher';

export { STORAGE_LAST_RESERVATION_ID_KEY } from './reservationWatcher';
export { initializeReservationTracking } from './reservationWatcher';

export const STORAGE_PUSH_TOKEN_KEY = '@mystoneinn_push_token';
export const STORAGE_PUSH_LAST_ERROR_KEY = '@mystoneinn_push_last_error';
const STORAGE_HANDLED_RESPONSE_KEY = '@mystoneinn_handled_notif_response';
const STORAGE_LOCAL_NOTIFIED_KEY = '@mystoneinn_local_notified_ids';
const RESERVATION_CATEGORY_ID = 'reservation';

function isDismissNotificationResponse(response) {
  const id = String(response?.actionIdentifier || '');
  if (!id) return false;
  const lower = id.toLowerCase();
  return (
    id === 'com.apple.UNNotificationDismissActionIdentifier' ||
    lower.includes('dismiss')
  );
}

/** Expo Go (SDK 53+) uzaktan push desteklemez — development build gerekir. */
export function isExpoGoClient() {
  return (
    isRunningInExpoGo()
    || Constants.appOwnership === 'expo'
    || Constants.executionEnvironment === 'storeClient'
  );
}

function getNotificationsModule() {
  if (Platform.OS === 'web' || isExpoGoClient()) {
    return null;
  }
  try {
    // eslint-disable-next-line global-require
    return require('expo-notifications');
  } catch {
    return null;
  }
}

let notificationHandlerConfigured = false;

function ensureNotificationHandler() {
  if (notificationHandlerConfigured) {
    return;
  }
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return;
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      // Badge'i biz yönetiyoruz; otomatik artırma birikime yol açıyor.
      shouldSetBadge: false,
    }),
  });
  notificationHandlerConfigured = true;
}

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
    ?? Constants.expoConfig?.extra?.projectId
    ?? undefined
  );
}

async function savePushError(message) {
  try {
    await AsyncStorage.setItem(
      STORAGE_PUSH_LAST_ERROR_KEY,
      JSON.stringify({ at: new Date().toISOString(), message: String(message || '') })
    );
  } catch {
    // ignore
  }
}

async function clearPushError() {
  try {
    await AsyncStorage.removeItem(STORAGE_PUSH_LAST_ERROR_KEY);
  } catch {
    // ignore
  }
}

export async function getLastPushError() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PUSH_LAST_ERROR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function ensureAndroidChannel() {
  const Notifications = getNotificationsModule();
  if (!Notifications || Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('reservations', {
    name: 'Rezervasyonlar',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0d6efd',
    sound: 'default',
  });
}

async function ensureReservationCategory() {
  const Notifications = getNotificationsModule();
  if (!Notifications?.setNotificationCategoryAsync) {
    return;
  }
  try {
    await Notifications.setNotificationCategoryAsync(RESERVATION_CATEGORY_ID, [], {
      customDismissAction: true,
    });
  } catch {
    // Kategori yoksa silme bildirimi gelmez; AppState senkronu yedek.
  }
}

/**
 * Expo token alır ve sunucuya kaydeder.
 * @returns {{ token: string|null, error: string|null }}
 */
export async function registerForPushNotifications() {
  if (Platform.OS === 'web') {
    return { token: null, error: 'web_unsupported' };
  }
  if (isExpoGoClient()) {
    return { token: null, error: 'expo_go' };
  }
  if (!Device.isDevice) {
    return { token: null, error: 'not_a_device' };
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) {
    await savePushError('expo-notifications yüklenemedi');
    return { token: null, error: 'module_missing' };
  }

  try {
    ensureNotificationHandler();
    await ensureAndroidChannel();
    await ensureReservationCategory();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      await savePushError('Bildirim izni verilmedi');
      return { token: null, error: 'permission_denied' };
    }

    const projectId = getProjectId();
    if (!projectId) {
      await savePushError('EAS projectId eksik — yeni APK gerekir');
      return { token: null, error: 'missing_project_id' };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse?.data;
    if (!token) {
      await savePushError('Expo push token alınamadı');
      return { token: null, error: 'token_empty' };
    }

    await AsyncStorage.setItem(STORAGE_PUSH_TOKEN_KEY, token);

    try {
      await PushAPI.register(token, Platform.OS);
      await clearPushError();
      return { token, error: null };
    } catch (err) {
      const msg = err?.message || 'push_register sunucu hatası';
      await savePushError(msg);
      // Token cihazda var; sunucu kaydı başarısız — tekrar denenebilir
      return { token, error: `server_register: ${msg}` };
    }
  } catch (err) {
    const msg = err?.message || String(err);
    await savePushError(msg);
    return { token: null, error: msg };
  }
}

export async function unregisterPushNotifications() {
  if (Platform.OS === 'web' || isExpoGoClient()) {
    return;
  }

  const token = await AsyncStorage.getItem(STORAGE_PUSH_TOKEN_KEY);
  if (token) {
    try {
      await PushAPI.unregister(token);
    } catch {
      // Oturum kapanırken sessizce geç.
    }
  }

  await AsyncStorage.removeItem(STORAGE_PUSH_TOKEN_KEY);
}

function extractNotificationPayload(data) {
  if (!data || typeof data !== 'object') return null;
  const type = String(data.type || '');
  const caseId = Number(data.case_id || 0);
  if ((type === 'case_assigned' || type === 'case') && caseId > 0) {
    return { type: 'case_assigned', case_id: caseId };
  }
  const reservationId = Number(data.reservation_id || data.id || 0);
  if (type === 'new_reservation' && reservationId > 0) {
    return { type, reservation_id: reservationId };
  }
  return null;
}

/** @deprecated use extractNotificationPayload */
function extractReservationPayload(data) {
  const payload = extractNotificationPayload(data);
  if (payload?.type === 'new_reservation') return payload;
  return null;
}

async function setBadgeCountSafe(count) {
  const Notifications = getNotificationsModule();
  if (!Notifications?.setBadgeCountAsync) return;
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, Number(count) || 0));
  } catch {
    // ignore
  }
}

/** Tepsideki bildirim sayısına göre ikon balonunu senkronla. */
export async function syncBadgeFromPresentedNotifications() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return 0;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const count = Array.isArray(presented) ? presented.length : 0;
    await setBadgeCountSafe(count);
    return count;
  } catch {
    return 0;
  }
}

/** Görüntülenen / işlenen bildirimleri temizle ve balonu sıfırla. */
export async function clearPresentedNotificationsAndBadge() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // ignore
  }
  await setBadgeCountSafe(0);
  try {
    if (typeof Notifications.clearLastNotificationResponseAsync === 'function') {
      await Notifications.clearLastNotificationResponseAsync();
    }
  } catch {
    // ignore
  }
}

/**
 * Push tıklanınca / cold-start:
 * - 1 rezervasyon bildirimi → detay
 * - 1'den fazla → rezervasyonlar listesi
 * Ardından bildirimleri ve badge'i temizler.
 */
export async function resolveNotificationOpenAction(preferredReservationId = null) {
  const Notifications = getNotificationsModule();
  const preferred = Number(preferredReservationId) || 0;

  const ids = new Set();
  if (preferred > 0) {
    ids.add(preferred);
  }

  if (Notifications) {
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      for (const item of presented || []) {
        const payload = extractReservationPayload(item?.request?.content?.data);
        if (payload) {
          ids.add(payload.reservation_id);
        }
      }
    } catch {
      // ignore
    }
  }

  const uniqueIds = [...ids];
  let action = { type: 'none' };
  if (uniqueIds.length > 1) {
    action = { type: 'open_reservations' };
  } else if (uniqueIds.length === 1) {
    action = { type: 'open_reservation', reservationId: uniqueIds[0] };
  }

  await clearPresentedNotificationsAndBadge();
  return action;
}

function responseFingerprint(response) {
  const id = response?.notification?.request?.identifier || '';
  const actionId = response?.actionIdentifier || '';
  const data = response?.notification?.request?.content?.data || {};
  const rid = data.reservation_id || data.id || '';
  const date = response?.notification?.date || '';
  return `${id}:${actionId}:${rid}:${date}`;
}

/**
 * Uygulama kapalıyken tıklanan bildirimi bir kez tüket.
 * Aynı last-response her açılışta tekrarlanmasın.
 */
export async function consumeInitialNotificationAction() {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return { type: 'none' };
  }

  ensureNotificationHandler();
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) {
    return { type: 'none' };
  }

  if (isDismissNotificationResponse(response)) {
    await syncBadgeFromPresentedNotifications();
    return { type: 'none' };
  }

  const payload = extractNotificationPayload(response?.notification?.request?.content?.data);
  if (!payload) {
    return { type: 'none' };
  }

  const fp = responseFingerprint(response);
  try {
    const handled = await AsyncStorage.getItem(STORAGE_HANDLED_RESPONSE_KEY);
    if (handled === fp) {
      return { type: 'none' };
    }
    await AsyncStorage.setItem(STORAGE_HANDLED_RESPONSE_KEY, fp);
  } catch {
    // ignore storage errors; yine de devam et
  }

  if (payload.type === 'case_assigned') {
    await clearPresentedNotificationsAndBadge();
    return { type: 'open_case', caseId: payload.case_id };
  }

  return resolveNotificationOpenAction(payload.reservation_id);
}

/** @deprecated use consumeInitialNotificationAction */
export async function getInitialNotificationReservationId() {
  const action = await consumeInitialNotificationAction();
  return action.type === 'open_reservation' ? action.reservationId : null;
}

function formatReservationBody(item) {
  const guest = item.guest_name || 'Misafir';
  const room = item.room_name || 'Oda';
  const checkIn = formatDate(item.check_in);
  const checkOut = formatDate(item.check_out);
  const source = getChannelStyle(item.channel, item).label;
  return `${guest} · ${room}\n${checkIn} → ${checkOut}\n${source}`;
}

async function getLocallyNotifiedIds() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LOCAL_NOTIFIED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set((Array.isArray(parsed) ? parsed : []).map((id) => Number(id)).filter((id) => id > 0));
  } catch {
    return new Set();
  }
}

async function markLocallyNotified(ids) {
  if (!ids?.length) return;
  const current = await getLocallyNotifiedIds();
  ids.forEach((id) => current.add(Number(id)));
  // Son 200 id tut
  const trimmed = [...current].slice(-200);
  try {
    await AsyncStorage.setItem(STORAGE_LOCAL_NOTIFIED_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

async function showLocalReservationAlert(item) {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return;
  }

  ensureNotificationHandler();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Yeni Rezervasyon',
      body: formatReservationBody(item),
      data: {
        type: 'new_reservation',
        reservation_id: item.reservation_id || item.id,
      },
      sound: 'default',
      categoryIdentifier: RESERVATION_CATEGORY_ID,
    },
    trigger: null,
  });
  await syncBadgeFromPresentedNotifications();
}

/**
 * Polling yalnızca takvimi yeniler.
 * Uzak push yoksa (token alınamadıysa) yerel bildirim fallback'i çalışır; tekrarlamaz.
 * UI otomatik açılmaz.
 */
export function startReservationPolling({ enableLocalAlerts = false } = {}) {
  return startReservationWatcher({
    onCalendarRefresh: () => {
      notifyCalendarRefresh('poll');
    },
    onNewItems: async (items) => {
      notifyCalendarRefresh('poll');
      if (!enableLocalAlerts || !items?.length) {
        return;
      }
      if (Platform.OS === 'web' || isExpoGoClient()) {
        return;
      }

      const notified = await getLocallyNotifiedIds();
      const fresh = [];
      for (const item of items) {
        const status = String(item?.status || '').toLowerCase().trim();
        if (['cancelled', 'canceled', 'blocked', 'iptal', 'iptal edildi'].includes(status)) {
          continue;
        }
        const id = Number(item.reservation_id || item.id || 0);
        if (!id || notified.has(id)) {
          continue;
        }
        fresh.push(item);
      }

      // Gece iCal / baseline sıfırlanması gibi toplu sel: bildirim yağdırma, sadece işaretle
      if (fresh.length > 5) {
        await markLocallyNotified(fresh.map((item) => Number(item.reservation_id || item.id)));
        return;
      }

      for (const item of fresh) {
        await showLocalReservationAlert(item);
      }
      await markLocallyNotified(fresh.map((item) => Number(item.reservation_id || item.id)));
    },
  });
}

export function listenForForegroundNotifications(onNewReservation) {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return () => {};
  }

  ensureNotificationHandler();
  const subscription = Notifications.addNotificationReceivedListener(async (notification) => {
    const data = extractReservationPayload(notification.request.content.data || {});
    if (!data) return;
    notifyCalendarRefresh('push');
    await syncBadgeFromPresentedNotifications();
    // Ön planda otomatik detay açma — alt menüyü kaçırıyor ve tıklamayı bozuyor.
    onNewReservation?.(data);
  });

  return () => subscription.remove();
}

export function listenForNotificationResponses(onAction) {
  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return () => {};
  }

  ensureNotificationHandler();
  const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
    if (isDismissNotificationResponse(response)) {
      await syncBadgeFromPresentedNotifications();
      return;
    }

    const payload = extractNotificationPayload(response.notification.request.content.data || {});
    if (!payload) return;

    try {
      const fp = responseFingerprint(response);
      await AsyncStorage.setItem(STORAGE_HANDLED_RESPONSE_KEY, fp);
    } catch {
      // ignore
    }

    if (payload.type === 'case_assigned') {
      await clearPresentedNotificationsAndBadge();
      onAction?.({ type: 'open_case', caseId: payload.case_id });
      return;
    }

    notifyCalendarRefresh('push-tap');
    const action = await resolveNotificationOpenAction(payload.reservation_id);
    onAction?.(action);
  });

  return () => subscription.remove();
}

/** Uygulama öne gelince tepsi/badge senkronu (tekrar açılış yok). */
export function listenForAppStateBadgeSync() {
  const onChange = (state) => {
    if (state === 'active') {
      // Ön plandayken kalan tepsi bildirimlerini de temizle — balon takılı kalmasın.
      clearPresentedNotificationsAndBadge().catch(() => {});
    }
  };
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
