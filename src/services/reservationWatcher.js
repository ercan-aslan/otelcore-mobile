import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CalendarAPI,
  PushAPI,
  ReservationsAPI,
} from '../api';

export const STORAGE_LAST_RESERVATION_ID_KEY = '@otelcore_last_reservation_id';
export const STORAGE_CALENDAR_FP_KEY = '@otelcore_calendar_fingerprint';
export const STORAGE_CALENDAR_START_KEY = '@otelcore_calendar_start_date';

const POLL_INTERVAL_MS = 8000;

function isActiveReservationItem(row) {
  const status = String(row?.status || '').toLowerCase().trim();
  return !['cancelled', 'canceled', 'blocked', 'iptal', 'iptal edildi'].includes(status);
}

function filterNotifyableItems(items) {
  return (items || []).filter(isActiveReservationItem);
}

export function buildCalendarRevision(cal) {
  if (cal?.calendar_revision) {
    return String(cal.calendar_revision);
  }

  const meta = cal?.reservation_meta || {};
  const metaParts = Object.values(meta)
    .map((row) => [
      row.reservation_id || row.id || 0,
      row.status || '',
      row.is_unpaid_hold ? 1 : 0,
      row.check_in || '',
      row.check_out || '',
      row.room_id || 0,
    ].join(':'))
    .sort();

  return metaParts.join('|');
}

export async function getBaselineReservationId() {
  const stored = await AsyncStorage.getItem(STORAGE_LAST_RESERVATION_ID_KEY);
  const parsed = stored ? parseInt(stored, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function saveLatestReservationId(id) {
  if (id > 0) {
    await AsyncStorage.setItem(STORAGE_LAST_RESERVATION_ID_KEY, String(id));
  }
}

async function syncCalendarBaseline(cal) {
  const revision = buildCalendarRevision(cal);
  await AsyncStorage.setItem(STORAGE_CALENDAR_FP_KEY, revision);
  const ids = Object.values(cal?.reservation_meta || {})
    .map((row) => Number(row.reservation_id || row.id || 0))
    .filter((id) => id > 0);
  if (ids.length) {
    const sinceId = await getBaselineReservationId();
    await saveLatestReservationId(Math.max(sinceId, ...ids));
  }
}

export async function syncCalendarBaselineFromResponse(cal) {
  await syncCalendarBaseline(cal || {});
}

/** @deprecated use syncCalendarBaselineFromResponse */
export async function syncCalendarBaselineFromGrid(grid) {
  await syncCalendarBaseline({ grid, reservation_meta: {} });
}

async function checkViaSinceApi(sinceId) {
  const result = await PushAPI.since(sinceId, 30);
  const payload = result?.data || {};
  const items = filterNotifyableItems(payload.items || []);
  const latestId = Number(payload.latest_id || sinceId);
  return {
    items,
    latestId,
  };
}

async function checkViaCalendarRevision(startDate) {
  const calRes = await CalendarAPI.get(startDate || undefined);
  const cal = calRes.data || calRes;
  const revision = buildCalendarRevision(cal);
  const stored = await AsyncStorage.getItem(STORAGE_CALENDAR_FP_KEY);
  const changed = stored !== null && stored !== revision;
  await AsyncStorage.setItem(STORAGE_CALENDAR_FP_KEY, revision);
  const ids = Object.values(cal?.reservation_meta || {})
    .map((row) => Number(row.reservation_id || row.id || 0))
    .filter((id) => id > 0);
  const maxId = ids.length ? Math.max(...ids) : 0;
  return { changed, maxId, items: [], cal };
}

async function checkViaReservationsList(sinceId) {
  const [confirmed, cancelled] = await Promise.all([
    ReservationsAPI.list('confirmed', 100),
    ReservationsAPI.list('cancelled', 100),
  ]);
  const all = [
    ...(confirmed?.data || confirmed?.reservations || []),
    ...(cancelled?.data || cancelled?.reservations || []),
  ];
  const newItems = filterNotifyableItems(
    all.filter((row) => Number(row.reservation_id || row.id) > sinceId)
  );
  const maxId = all.reduce(
    (max, row) => Math.max(max, Number(row.reservation_id || row.id) || 0),
    sinceId
  );
  return { items: newItems, latestId: maxId };
}

/** Takvimde yeni rezervasyon, iptal veya hold değişimi var mı kontrol et */
export async function watchForNewReservations() {
  const sinceId = await getBaselineReservationId();
  let calendarChanged = false;
  let startDate = '';
  try {
    startDate = (await AsyncStorage.getItem(STORAGE_CALENDAR_START_KEY)) || '';
  } catch {
    startDate = '';
  }

  try {
    const viaCalendar = await checkViaCalendarRevision(startDate || undefined);
    calendarChanged = viaCalendar.changed;
  } catch {
    // Takvim API hatası — diğer yöntemlere düş
  }

  try {
    const viaSince = await checkViaSinceApi(sinceId);
    if (viaSince.latestId > sinceId) {
      await saveLatestReservationId(viaSince.latestId);
    }
    if (viaSince.items.length > 0) {
      return { found: true, items: viaSince.items, source: 'since' };
    }
  } catch {
    // reservations_since.php deploy edilmemiş olabilir
  }

  try {
    const viaList = await checkViaReservationsList(sinceId);
    if (viaList.latestId > sinceId) {
      await saveLatestReservationId(viaList.latestId);
    }
    if (viaList.items.length > 0) {
      return { found: true, items: viaList.items, source: 'list' };
    }
  } catch {
    // Liste API hatası
  }

  if (calendarChanged) {
    return { found: true, items: [], source: 'calendar' };
  }

  return { found: false, items: [], source: 'none' };
}

export async function initializeReservationTracking() {
  try {
    const result = await PushAPI.since(0, 1);
    const latestId = Number(result?.data?.latest_id || 0);
    if (latestId > 0) {
      await saveLatestReservationId(latestId);
    }
  } catch {
    // since API yok — takvim taban çizgisine düş
  }

  try {
    const calRes = await CalendarAPI.get();
    const cal = calRes.data || calRes;
    await syncCalendarBaseline(cal);
  } catch {
    // Sessiz geç
  }
}

export function startReservationWatcher({ onNewItems, onCalendarRefresh, startDate } = {}) {
  let stopped = false;
  let ticking = false;

  const tick = async () => {
    if (stopped || ticking) return;

    ticking = true;
    try {
      const result = await watchForNewReservations(startDate);
      if (result.found) {
        onCalendarRefresh?.(result);
        onNewItems?.(result.items, result);
      }
    } catch {
      // Sonraki turda tekrar dene
    } finally {
      ticking = false;
    }
  };

  tick();
  const timer = setInterval(tick, POLL_INTERVAL_MS);

  let onVisibilityChange = null;
  if (typeof document !== 'undefined') {
    onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  return () => {
    stopped = true;
    clearInterval(timer);
    if (onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}
