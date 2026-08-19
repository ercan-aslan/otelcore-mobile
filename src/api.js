import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import { storageGetItem, storageSetItem, storageRemoveItem, migrateTokenToSecureStore } from './utils/secureStorage';
import {
  isWebSiteChannel,
  noteIndicatesWebsite,
  resolveWebsiteGuestName,
  isChannelSyncedReservation,
} from './utils/format';

export const STORAGE_TOKEN_KEY = '@otelcore_admin_token';
export const STORAGE_ADMIN_KEY = '@otelcore_admin_profile';
export const STORAGE_API_BUILD_KEY = '@otelcore_api_build';
export const STORAGE_BRANDING_KEY = '@otelcore_site_branding';
export const STORAGE_HOTEL_KEY = '@otelcore_hotel';

const API_TIMEOUT_MS = 30000;

export async function clearAuthStorage() {
  await storageRemoveItem(STORAGE_TOKEN_KEY);
  await AsyncStorage.removeItem(STORAGE_ADMIN_KEY);
  await AsyncStorage.removeItem(STORAGE_API_BUILD_KEY);
  await AsyncStorage.removeItem(STORAGE_HOTEL_KEY);
}

export async function saveSiteBranding(branding) {
  if (!branding || typeof branding !== 'object') return;
  await AsyncStorage.setItem(STORAGE_BRANDING_KEY, JSON.stringify(branding));
}

export async function loadSiteBranding() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_BRANDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function bootstrapSecureAuthStorage() {
  await migrateTokenToSecureStore(STORAGE_TOKEN_KEY);
}

function apiPath(path) {
  if (!path || path.endsWith('.php')) {
    return path;
  }
  const qIndex = path.indexOf('?');
  if (qIndex === -1) {
    return `${path}.php`;
  }
  return `${path.slice(0, qIndex)}.php${path.slice(qIndex)}`;
}

async function apiRequest(path, options = {}) {
  const token = await storageGetItem(STORAGE_TOKEN_KEY);
  let hotelHeaders = {};
  try {
    const rawHotel = await AsyncStorage.getItem(STORAGE_HOTEL_KEY);
    if (rawHotel) {
      const hotel = JSON.parse(rawHotel);
      if (hotel?.hotel_id) hotelHeaders['X-Hotel-Id'] = String(hotel.hotel_id);
      if (hotel?.slug) hotelHeaders['X-Hotel-Slug'] = String(hotel.slug);
    }
  } catch {
    // ignore
  }
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...hotelHeaders,
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${apiPath(path)}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const error = new Error('Sunucu yanıt vermedi (zaman aşımı).');
      error.status = 408;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { message: text };
  }

  if (!contentType.includes('application/json')) {
    const error = new Error(
      response.status === 404
        ? 'Sunucuda bu özellik bulunamadı. reservations.php dosyasını deploy edin.'
        : 'Sunucu JSON yerine HTML döndürdü. api/mobile dosyalarını deploy edin.'
    );
    error.status = response.status === 200 ? 404 : response.status;
    throw error;
  }

  if (!response.ok) {
    let message = data?.message;
    const isLoginRequest = String(path || '').includes('/auth/login');
    if (!contentType.includes('application/json')) {
      if (response.status === 404) {
        message = 'Sunucuda bu özellik bulunamadı. api/mobile dosyalarını kontrol edin.';
      } else if (response.status === 401 && !isLoginRequest) {
        message = 'Oturum süresi doldu. Tekrar giriş yapın.';
      } else if (response.status === 503) {
        message = 'Mobil API yapılandırması eksik (secret.php).';
      } else {
        message = `Sunucu hatası (HTTP ${response.status}).`;
      }
    }
    const error = new Error(
      message
        || (response.status === 401 && isLoginRequest
          ? 'E-posta veya şifre hatalı.'
          : response.status === 401
            ? 'Oturum süresi doldu. Tekrar giriş yapın.'
            : `HTTP ${response.status}`)
    );
    error.status = response.status;
    if (data?.needs_confirm) error.needs_confirm = data.needs_confirm;
    if (data?.current_code) error.current_code = data.current_code;
    throw error;
  }

  if (data?.status === 'error') {
    const error = new Error(data?.message || 'İstek başarısız.');
    error.status = response.status;
    if (data?.needs_confirm) error.needs_confirm = data.needs_confirm;
    if (data?.current_code) error.current_code = data.current_code;
    throw error;
  }

  return data;
}

export function normalizeFetchError(err, fallback = 'Veri yüklenemedi.') {
  const msg = err?.message || fallback;
  if (/failed to fetch|load failed|network request failed|networkerror/i.test(msg)) {
    return 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.';
  }
  if (msg.length > 240) {
    return fallback;
  }
  return msg;
}

export const EXPECTED_API_BUILD = '20260819-cases-v4';

function isFullReservationRow(row) {
  if (!row || Array.isArray(row)) {
    return false;
  }
  const reservationId = Number(row.reservation_id || row.id || 0);
  if (!reservationId) {
    return false;
  }
  if (row.detail === true || row.partial === false) {
    return true;
  }
  if (Array.isArray(row.all_rooms) && row.all_rooms.length > 0) {
    return true;
  }
  return 'user_email' in row || 'sync_locked' in row;
}

export function isReservationPreviewMode(row) {
  if (!row?.reservation_id) {
    return true;
  }
  if (isFullReservationRow(row)) {
    return false;
  }
  if (row.enriched === true) {
    return false;
  }
  return !(row.check_in && row.check_out);
}

async function lookupReservationInCalendarGrid(id) {
  try {
    const calRes = await CalendarAPI.get();
    const cal = calRes?.data || calRes;
    const metaMap = cal?.reservation_meta || {};
    const meta = metaMap[id] || metaMap[String(id)];
    if (meta?.check_in && meta?.check_out) {
      return meta;
    }

    const grid = cal?.grid || {};
    for (const row of Object.values(grid)) {
      for (const cell of Object.values(row || {})) {
        if (cell?.type === 'reservation' && Number(cell.reservation_id) === id) {
          return {
            check_in: cell.check_in || '',
            check_out: cell.check_out || '',
            status: cell.status || 'confirmed',
            total_price: Number(cell.total_price || 0),
            guest_name: cell.guest_name || cell.label || '',
            channel: cell.channel || '',
            note: cell.note || '',
            room_id: Number(cell.room_id || 0),
          };
        }
      }
    }
  } catch {
    // Sessiz geç
  }
  return null;
}

async function lookupReservationListRow(id) {
  for (const tab of ['confirmed', 'cancelled']) {
    const list = await apiRequest(`/reservations?tab=${tab}&limit=200`);
    const items = list.data || list.reservations || [];
    const found = items.find((row) => Number(row.reservation_id || row.id) === id);
    if (found) {
      return found;
    }
  }
  return null;
}

async function buildReservationDetailFallback(id, initialSnapshot = null) {
  const reservationId = Number(id);
  if (!reservationId) {
    return null;
  }

  const snapshot = snapshotToReservation(initialSnapshot, reservationId) || {};
  const listRow = await lookupReservationListRow(reservationId);
  const merged = {
    ...snapshot,
    ...(listRow || {}),
    reservation_id: reservationId,
    guest_name:
      listRow?.guest_name ||
      snapshot.guest_name ||
      initialSnapshot?.guest_name ||
      initialSnapshot?.label ||
      'Misafir',
    channel: listRow?.channel || snapshot.channel || initialSnapshot?.channel || '',
    room_id: Number(listRow?.room_id || snapshot.room_id || initialSnapshot?.room_id || 0),
    room_name: listRow?.room_name || snapshot.room_name || initialSnapshot?.room_name || '',
    check_in: listRow?.check_in || snapshot.check_in || initialSnapshot?.check_in || '',
    check_out: listRow?.check_out || snapshot.check_out || initialSnapshot?.check_out || '',
    status: listRow?.status || snapshot.status || initialSnapshot?.status || 'confirmed',
    total_price: Number(
      listRow?.total_price ?? snapshot.total_price ?? initialSnapshot?.total_price ?? 0
    ),
    note: listRow?.note || snapshot.note || initialSnapshot?.note || '',
    coupon_code: listRow?.coupon_code || snapshot.coupon_code || '',
    has_coupon: Boolean(
      listRow?.has_coupon ||
        snapshot.has_coupon ||
        listRow?.coupon_code ||
        snapshot.coupon_code
    ),
    discount_type: listRow?.discount_type || snapshot.discount_type || '',
    discount_value: Number(listRow?.discount_value ?? snapshot.discount_value ?? 0),
    discount_amount: Number(listRow?.discount_amount ?? snapshot.discount_amount ?? 0),
  };

  if (!merged.check_in || !merged.check_out) {
    const fromCalendar = await lookupReservationInCalendarGrid(reservationId);
    if (fromCalendar) {
      merged.check_in = fromCalendar.check_in || merged.check_in;
      merged.check_out = fromCalendar.check_out || merged.check_out;
      merged.status = fromCalendar.status || merged.status;
      merged.total_price = Number(fromCalendar.total_price ?? merged.total_price ?? 0);
      merged.guest_name = merged.guest_name || fromCalendar.guest_name || '';
      merged.channel = merged.channel || fromCalendar.channel || '';
      merged.note = merged.note || fromCalendar.note || '';
      merged.room_id = merged.room_id || Number(fromCalendar.room_id || 0);
    }
  }

  if (!merged.check_in || !merged.check_out) {
    return null;
  }

  let all_rooms = [];
  try {
    const roomsRes = await apiRequest('/rooms');
    all_rooms = roomsRes?.data || roomsRes?.rooms || [];
  } catch {
    all_rooms = [];
  }

  let payments = [];
  let paid_total = 0;
  try {
    const payRes = await apiRequest('/payments?limit=200');
    const all = payRes?.data || payRes?.payments || [];
    payments = all.filter((p) => Number(p.reservation_id) === reservationId);
    paid_total = payments
      .filter((p) => (p.status || '') === 'success')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  } catch {
    payments = [];
  }

  return {
    data: {
      ...merged,
      user_name: merged.user_name || '',
      user_surname: merged.user_surname || '',
      user_email: merged.user_email || '',
      user_phone: merged.user_phone || '',
      user_tc: merged.user_tc || '',
      user_passport: merged.user_passport || '',
      user_nationality: merged.user_nationality || '',
      sync_locked: Number(merged.sync_locked || 0),
      all_rooms: Array.isArray(all_rooms) ? all_rooms : [],
      payments,
      extras: [],
      paid_total,
      balance: merged.total_price - paid_total,
      detail: true,
      partial: false,
      enriched: true,
    },
  };
}

function extractReservationDetail(payload) {
  const row = payload?.data;
  if (!isFullReservationRow(row)) {
    return null;
  }
  const reservationId = Number(row.reservation_id || row.id);
  return {
    ...payload,
    data: {
      ...row,
      reservation_id: reservationId,
      detail: true,
      partial: false,
    },
  };
}

export async function fetchMobileApiBuild() {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_API_BUILD_KEY);
    if (cached) {
      return cached;
    }
  } catch {
    // ignore
  }
  try {
    const res = await apiRequest('/version');
    return String(res?.api_build || '');
  } catch {
    try {
      const res = await apiRequest('/reservations?tab=confirmed&limit=1');
      return String(res?.api_build || '');
    } catch {
      return '';
    }
  }
}

export function snapshotToReservation(snapshot, id) {
  if (!snapshot) return null;
  const reservationId = Number(snapshot.reservation_id || snapshot.id || id || 0);
  if (!reservationId) return null;
  return {
    reservation_id: reservationId,
    guest_name: snapshot.guest_name || snapshot.label || 'Misafir',
    channel: snapshot.channel || '',
    room_name: snapshot.room_name || '',
    room_id: Number(snapshot.room_id || 0),
    check_in: snapshot.check_in || '',
    check_out: snapshot.check_out || '',
    total_price: Number(snapshot.total_price || 0),
    status: snapshot.status || 'confirmed',
    partial: true,
    coupon_code: snapshot.coupon_code || '',
    discount_type: snapshot.discount_type || '',
    discount_value: Number(snapshot.discount_value || 0),
    discount_amount: Number(snapshot.discount_amount || 0),
    has_coupon: Boolean(snapshot.has_coupon || snapshot.coupon_code),
    paid_total: 0,
    balance: Number(snapshot.total_price || 0),
    payments: [],
    extras: [],
    all_rooms: [],
  };
}

export const AuthAPI = {
  login: async (email, password, hotel = null) => {
    const body = { email, password };
    if (hotel?.hotel_id) body.hotel_id = hotel.hotel_id;
    if (hotel?.slug) body.hotel_slug = hotel.slug;
    const payload = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (payload?.needs_hotel_selection) {
      return payload;
    }
    if (!payload?.token) {
      throw new Error('Sunucu giriş yanıtı geçersiz (token yok).');
    }
    if (payload.hotel) {
      await AsyncStorage.setItem(STORAGE_HOTEL_KEY, JSON.stringify(payload.hotel));
    }
    return payload;
  },
  social: async ({ ticket, socialTicket, identityToken, email, fullName, hotel } = {}) => {
    const body = {};
    if (ticket) body.ticket = ticket;
    if (socialTicket) body.social_ticket = socialTicket;
    if (identityToken) body.identity_token = identityToken;
    if (email) body.email = email;
    if (fullName) body.full_name = fullName;
    if (hotel?.hotel_id) body.hotel_id = hotel.hotel_id;
    if (hotel?.slug) body.hotel_slug = hotel.slug;
    const payload = await apiRequest('/auth/social', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (payload?.needs_hotel_selection) {
      return payload;
    }
    if (!payload?.token) {
      throw new Error('Sunucu giriş yanıtı geçersiz (token yok).');
    }
    if (payload.hotel) {
      await AsyncStorage.setItem(STORAGE_HOTEL_KEY, JSON.stringify(payload.hotel));
    }
    return payload;
  },
  me: () => apiRequest('/auth/me'),
};

export async function checkMobileApiConnection() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${API_BASE_URL}/version.php`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      return {
        ok: false,
        message: `API yanıt vermedi (HTTP ${response.status}).`,
      };
    }
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        message: 'API JSON yerine HTML döndürdü. Dosya yolu veya .htaccess kontrol edin.',
      };
    }
    const data = await response.json();
    if (data?.status !== 'success') {
      return {
        ok: false,
        message: data?.message || 'API durumu okunamadı.',
      };
    }
    return {
      ok: true,
      apiBuild: String(data.api_build || ''),
      baseUrl: API_BASE_URL,
      branding: data.branding || null,
    };
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { ok: false, message: 'Sunucuya bağlanılamadı (zaman aşımı).' };
    }
    return {
      ok: false,
      message: 'Sunucuya bağlanılamadı. İnternet veya API adresini kontrol edin.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const DashboardAPI = {
  getStats: () => apiRequest('/dashboard'),
};

export const CalendarAPI = {
  get: (startDate) =>
    apiRequest(`/calendar${startDate ? `?start_date=${startDate}` : ''}`),
  action: (payload) =>
    apiRequest('/calendar_actions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const CalendarSummaryAPI = {
  get: (tab = 'giris') => apiRequest(`/calendar_summary?tab=${encodeURIComponent(tab)}`),
};

export const ReservationsAPI = {
  list: (tab = 'confirmed', limit = 50, { websiteOnly = true, q = '' } = {}) => {
    const websiteQuery = websiteOnly ? '&website_only=1' : '';
    const qQuery = q ? `&q=${encodeURIComponent(q)}` : '';
    return apiRequest(`/reservations?tab=${tab}&limit=${limit}${websiteQuery}${qQuery}`);
  },
  metaByIds: (ids = []) => {
    const clean = [...new Set(ids.map((id) => Number(id)).filter(Boolean))];
    if (!clean.length) return Promise.resolve({ data: [] });
    return apiRequest(`/reservations?ids=${clean.join(',')}`);
  },
};

export function reservationMetaToMap(items = []) {
  const map = {};
  items.forEach((item) => {
    const id = Number(item.reservation_id || item.id);
    if (!id) return;
    const isWebsite =
      item.is_website === true ||
      noteIndicatesWebsite(item.note) ||
      isWebSiteChannel(item.channel);
    map[id] = {
      ...item,
      guest_name: String(item.guest_name || item.guestName || '').trim(),
      user_name: String(item.user_name || '').trim(),
      channel_name: String(item.channel_name || '').trim(),
      user_surname: String(item.user_surname || '').trim(),
      note: String(item.note || ''),
      channel: String(item.channel || ''),
      is_website: isWebsite,
      is_ical: item.is_ical === true,
      display_name: isWebsite
        ? resolveWebsiteGuestName(item)
        : String(item.guest_name || item.user_name || '').trim(),
    };
  });
  return map;
}

function mergeReservationMetaMaps(...maps) {
  const merged = {};
  maps.forEach((source) => {
    Object.entries(source || {}).forEach(([id, item]) => {
      const numId = Number(id);
      if (!numId) return;
      merged[numId] = { ...(merged[numId] || {}), ...item };
    });
  });
  return merged;
}

function metaEntryHasGuestName(entry) {
  if (!entry) return false;
  if (entry.is_ical || isChannelSyncedReservation({ note: entry.note, channel: entry.channel, is_ical: entry.is_ical, user_name: entry.user_name, guest_name: entry.guest_name })) {
    return true;
  }
  if (entry.is_website || noteIndicatesWebsite(entry.note) || isWebSiteChannel(entry.channel)) {
    return Boolean(resolveWebsiteGuestName(entry));
  }
  const name = String(entry.display_name || entry.guest_name || entry.user_name || '').trim();
  if (!name || /^misafir$/i.test(name)) return false;
  return !/^(hotelrunner(\s+misafiri)?|nobeds(\s+misafiri)?)$/i.test(name);
}

async function fetchReservationDetailsMeta(ids = []) {
  const map = {};
  const chunkSize = 8;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map((id) => apiRequest(`/reservations?id=${id}`).catch(() => null))
    );
    results.forEach((res) => {
      const row = res?.data;
      if (!row?.reservation_id) return;
      map[Number(row.reservation_id)] = row;
    });
  }

  return reservationMetaToMap(Object.values(map));
}

export function collectReservationIdsFromGrid(grid = {}) {
  const ids = new Set();
  Object.values(grid).forEach((row) => {
    Object.values(row || {}).forEach((cell) => {
      if (cell?.type === 'reservation' && cell.reservation_id) {
        ids.add(Number(cell.reservation_id));
      }
    });
  });
  return [...ids];
}

export async function fetchReservationMetaForGrid(grid = {}, calendarMeta = null) {
  const ids = collectReservationIdsFromGrid(grid);
  let map = {};

  if (calendarMeta && typeof calendarMeta === 'object') {
    map = reservationMetaToMap(
      Array.isArray(calendarMeta) ? calendarMeta : Object.values(calendarMeta)
    );
  }

  if (ids.length) {
    try {
      const res = await ReservationsAPI.metaByIds(ids);
      map = mergeReservationMetaMaps(map, reservationMetaToMap(res.data || []));
    } catch {
      // Eski sunucu: ids parametresi yoksa listeye düş
    }
  }

  const needsGuestNames = ids.filter((id) => !metaEntryHasGuestName(map[id]));

  if (needsGuestNames.length) {
    try {
      const [confirmed, cancelled] = await Promise.all([
        ReservationsAPI.list('confirmed', 100),
        ReservationsAPI.list('cancelled', 100),
      ]);
      map = mergeReservationMetaMaps(map, reservationMetaToMap([
        ...(confirmed?.data || confirmed?.reservations || []),
        ...(cancelled?.data || cancelled?.reservations || []),
      ]));
    } catch {
      // Sessiz geç
    }
  }

  const stillMissing = ids.filter((id) => !metaEntryHasGuestName(map[id]));

  if (stillMissing.length) {
    map = mergeReservationMetaMaps(map, await fetchReservationDetailsMeta(stillMissing));
  }

  return map;
}

export const ReservationAPI = {
  get: async (id, initialSnapshot = null) => {
    const reservationId = Number(id);
    if (!reservationId) {
      throw new Error('Geçersiz rezervasyon numarası.');
    }

    const endpoints = [
      `/reservation_detail?id=${reservationId}`,
      `/reservations?id=${reservationId}`,
      `/reservation?id=${reservationId}`,
    ];
    let lastError = null;

    for (const path of endpoints) {
      try {
        const res = await apiRequest(path);
        const detail = extractReservationDetail(res);
        if (detail) {
          return detail;
        }
      } catch (err) {
        lastError = err;
        if (err.status && err.status !== 404) {
          throw new Error(normalizeFetchError(err, 'Rezervasyon detayı yüklenemedi.'));
        }
      }
    }

    try {
      const enriched = await buildReservationDetailFallback(reservationId, initialSnapshot);
      if (enriched) {
        return enriched;
      }
    } catch (err) {
      lastError = err;
    }

    const fromSnapshot = snapshotToReservation(initialSnapshot, reservationId);
    if (fromSnapshot) {
      return { data: fromSnapshot };
    }

    throw new Error(
      normalizeFetchError(
        lastError,
        'Rezervasyon detayı sunucuda bulunamadı. bootstrap.php ve reservations.php dosyalarını deploy edin.'
      )
    );
  },
  action: (payload) =>
    apiRequest('/reservation_actions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  fetchGuest: (payload) =>
    apiRequest('/reservation_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'fetch_guest', ...payload }),
    }),
  updateGuests: (reservationId, guests) =>
    apiRequest('/reservation_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_guests', reservation_id: reservationId, guests }),
    }),
  uploadGuestId: (reservationId, payload) =>
    apiRequest('/reservation_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'upload_guest_id', reservation_id: reservationId, ...payload }),
    }),
};

export const InventoryAPI = {
  create: (itemName, quantity = 0, status = 'needed') =>
    apiRequest('/inventory_actions', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        item_name: itemName,
        quantity,
        status,
      }),
    }),
  placeOrder: (inventoryId, payload) =>
    apiRequest('/inventory_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'place_order', inventory_id: inventoryId, ...payload }),
    }),
  receiveOrder: (inventoryId, payload) =>
    apiRequest('/inventory_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'receive_order', inventory_id: inventoryId, ...payload }),
    }),
  addStock: (inventoryId, payload) =>
    apiRequest('/inventory_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'add_stock', inventory_id: inventoryId, ...payload }),
    }),
  remove: (inventoryId) =>
    apiRequest('/inventory_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', inventory_id: inventoryId }),
    }),
};

export const CancellationsAPI = {
  list: (tab = 'cancelled', { websiteOnly = true, q = '' } = {}) =>
    ReservationsAPI.list(tab, q ? 400 : 100, { websiteOnly, q }),
  restore: (reservationId) =>
    apiRequest('/reservation_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'restore', reservation_id: reservationId }),
    }),
};

export const RoomsAPI = {
  list: () => apiRequest('/rooms'),
  updateHousekeeping: (roomId, status) =>
    apiRequest('/rooms_actions', {
      method: 'POST',
      body: JSON.stringify({
        action: 'update_housekeeping',
        room_id: roomId,
        housekeeping_status: status,
      }),
    }),
};

export const PaymentsAPI = {
  list: (limit = 100, tab = 'collected', { websiteOnly = true } = {}) => {
    const websiteQuery = websiteOnly ? '&website_only=1' : '';
    return apiRequest(`/payments?limit=${limit}&tab=${encodeURIComponent(tab)}${websiteQuery}`);
  },
};

export const ReportsAPI = {
  get: () => apiRequest('/reports'),
};

export const SettingsAPI = {
  get: () => apiRequest('/settings'),
};

export const ChannelsAPI = {
  list: () => apiRequest('/channels'),
};

export const MarketAPI = {
  get: () => apiRequest('/market'),
  refresh: () =>
    apiRequest('/market', {
      method: 'POST',
      body: JSON.stringify({ action: 'force_refresh' }),
    }),
};

export const CouponsAPI = {
  list: () => apiRequest('/coupons'),
  create: (payload) =>
    apiRequest('/coupons', { method: 'POST', body: JSON.stringify({ action: 'create', ...payload }) }),
  setWebsite: (couponId, showOnWebsite, confirmReplace = false) =>
    apiRequest('/coupons', {
      method: 'POST',
      body: JSON.stringify({
        action: 'set_website',
        coupon_id: couponId,
        show_on_website: showOnWebsite ? 1 : 0,
        confirm_replace_website: confirmReplace ? 1 : 0,
      }),
    }),
  toggle: (couponId) =>
    apiRequest('/coupons', {
      method: 'POST',
      body: JSON.stringify({ action: 'toggle', coupon_id: couponId }),
    }),
  remove: (couponId) =>
    apiRequest('/coupons', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', coupon_id: couponId }),
    }),
};

export const CasesAPI = {
  list: (filter = 'open', lookups = true) =>
    apiRequest(`/cases?filter=${encodeURIComponent(filter)}&lookups=${lookups ? '1' : '0'}`),
  detail: (id) => apiRequest(`/case_detail?id=${encodeURIComponent(id)}`),
  create: (payload) =>
    apiRequest('/cases_actions', { method: 'POST', body: JSON.stringify({ action: 'create', ...payload }) }),
  comment: (caseId, body) =>
    apiRequest('/cases_actions', { method: 'POST', body: JSON.stringify({ action: 'comment', case_id: caseId, body }) }),
  photo: (caseId, imageBase64, extension = 'jpg') =>
    apiRequest('/cases_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'photo', case_id: caseId, image_base64: imageBase64, extension }),
    }),
  deletePhoto: (caseId, eventId) =>
    apiRequest('/cases_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_photo', case_id: caseId, event_id: eventId }),
    }),
  status: (caseId, status) =>
    apiRequest('/cases_actions', { method: 'POST', body: JSON.stringify({ action: 'status', case_id: caseId, status }) }),
  assign: (caseId, assigneeAdminId) =>
    apiRequest('/cases_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'assign', case_id: caseId, assignee_admin_id: assigneeAdminId }),
    }),
  update: (caseId, payload) =>
    apiRequest('/cases_actions', { method: 'POST', body: JSON.stringify({ action: 'update', case_id: caseId, ...payload }) }),
  close: (caseId, closeNote) =>
    apiRequest('/cases_actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'close', case_id: caseId, close_note: closeNote }),
    }),
  reopen: (caseId) =>
    apiRequest('/cases_actions', { method: 'POST', body: JSON.stringify({ action: 'reopen', case_id: caseId }) }),
};

export const ResourceAPI = {
  get: (resource) => apiRequest(`/resource?resource=${resource}`),
  action: (resource, payload) =>
    apiRequest('/resource_actions', {
      method: 'POST',
      body: JSON.stringify({ resource, ...payload }),
    }),
};

export const PushAPI = {
  register: (pushToken, platform = 'android') =>
    apiRequest('/push_register', {
      method: 'POST',
      body: JSON.stringify({ action: 'register', push_token: pushToken, platform }),
    }),
  unregister: (pushToken) =>
    apiRequest('/push_register', {
      method: 'POST',
      body: JSON.stringify({ action: 'unregister', push_token: pushToken }),
    }),
  since: (sinceId = 0, limit = 20) =>
    apiRequest(`/reservations_since?since_id=${sinceId}&limit=${limit}`),
};
