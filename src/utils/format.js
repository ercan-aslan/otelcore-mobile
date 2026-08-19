export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

/** Tarih + saat (rezervasyon kaydı, iptal vb.) */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/** ISO tarihe gün ekler */
export function addDaysIso(iso, days) {
  if (!iso) return '';
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Otel geceleri: check_in dahil, check_out hariç */
export function nightsBetweenIso(checkIn, checkOut) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return 0;
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  return Math.round((end - start) / 86400000);
}

/** ISO (YYYY-MM-DD) → GG/AA/YYYY */
export function isoToDisplay(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Klavye girişini GG/AA/YYYY formatına çevirir */
export function formatDateInputTyping(text) {
  const digits = String(text).replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** GG/AA/YYYY veya GG-AA-YYYY → ISO; geçersizse '' */
export function displayToIso(display) {
  const digits = String(display).replace(/\D/g, '');
  if (digits.length !== 8) return '';
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return '';
  }
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const check = new Date(iso);
  if (Number.isNaN(check.getTime())) return '';
  return iso;
}

/** Form doğrulama için tam tarih mi? */
export function isCompleteDisplayDate(display) {
  return displayToIso(display) !== '';
}

export function formatMoneyEUR(amount) {
  const num = Number(amount);
  if (Number.isNaN(num)) return '—';
  return `€${num.toFixed(2)}`;
}

export function formatMoneyTRY(amount) {
  const num = Number(amount);
  if (Number.isNaN(num)) return '—';
  return `₺${num.toFixed(2)}`;
}

/** Web / Tosla / Iyzico ödemeleri TRY; kanal rezervasyonları genelde EUR. */
export function resolveReservationCurrency(item) {
  if (!item || typeof item !== 'object') {
    return 'EUR';
  }

  const isWebsite =
    item.is_website === true
    || item.is_website === 1
    || String(item.is_website) === '1';

  const channel = String(item.channel || '').toLowerCase().trim();
  const note = String(item.note || '');

  if (
    isWebsite
    || String(item.payment_kind || '').startsWith('website_')
    || channel === 'web sitesi'
    || channel === 'web'
    || channel === 'website'
    || /^web\s*sitesi(\s|:|\[|$)/iu.test(note.trim())
    || /tosla|iyzico|ödeme onaylandı|odeme onaylandi/i.test(note)
  ) {
    return 'TRY';
  }

  const stored = String(item.currency || '').toUpperCase().trim();
  if (stored === 'TRY' || stored === 'TL') return 'TRY';
  if (stored === 'USD') return 'USD';
  if (stored === 'EUR') return 'EUR';

  return 'EUR';
}

/** Rezervasyon para birimine göre tutar (TRY web, EUR kanal/manuel). */
export function formatMoney(amount, currency = 'EUR') {
  const code = String(currency || 'EUR').toUpperCase().trim();
  if (code === 'TRY' || code === 'TL') {
    return formatMoneyTRY(amount);
  }
  if (code === 'USD') {
    const num = Number(amount);
    if (Number.isNaN(num)) return '—';
    return `$${num.toFixed(2)}`;
  }
  return formatMoneyEUR(amount);
}

/** Liste/detay satırı: API formatı varsa onu kullan, yoksa currency / is_website. */
export function formatReservationMoney(item, amount = null) {
  const value = amount != null ? amount : item?.total_price;
  if (
    amount == null
    && item?.total_price_formatted
    && String(item.total_price_formatted).trim() !== ''
  ) {
    return String(item.total_price_formatted);
  }
  const currency = resolveReservationCurrency(item);
  return formatMoney(value, currency);
}

export function formatMoneyTRYInt(amount) {
  const num = Number(amount);
  if (Number.isNaN(num) || num <= 0) return '—';
  return `${num.toLocaleString('tr-TR')} ₺`;
}

export const RESERVATION_SORT_OPTIONS = [
  { key: 'check_in_asc', label: 'Konaklama (yakın)', shortLabel: 'Giriş ↑' },
  { key: 'check_in_desc', label: 'Konaklama (uzak)', shortLabel: 'Giriş ↓' },
  { key: 'created_at_desc', label: 'Rezervasyon (yeni)', shortLabel: 'Kayıt ↓' },
  { key: 'created_at_asc', label: 'Rezervasyon (eski)', shortLabel: 'Kayıt ↑' },
];

function reservationSortValue(item, sortKey) {
  if (sortKey.startsWith('check_in')) {
    return String(item?.check_in || '');
  }
  return String(item?.created_at || item?.cancelled_at || '');
}

/** Rezervasyon listesi sıralama (konaklama veya kayıt tarihi). */
export function sortReservationRows(rows, sortKey = 'created_at_desc') {
  const list = Array.isArray(rows) ? [...rows] : [];
  const key = String(sortKey || 'created_at_desc');

  if (key === 'check_in_asc') {
    const today = new Date().toISOString().slice(0, 10);
    list.sort((a, b) => {
      const aCheckIn = String(a?.check_in || '');
      const bCheckIn = String(b?.check_in || '');
      const aPast = aCheckIn !== '' && aCheckIn < today ? 1 : 0;
      const bPast = bCheckIn !== '' && bCheckIn < today ? 1 : 0;
      if (aPast !== bPast) return aPast - bPast;

      let cmp = aCheckIn.localeCompare(bCheckIn);
      if (cmp === 0) {
        cmp = Number(b?.reservation_id || b?.id || 0) - Number(a?.reservation_id || a?.id || 0);
      }
      return cmp;
    });
    return list;
  }

  const desc = key.endsWith('_desc');
  list.sort((a, b) => {
    const av = reservationSortValue(a, key);
    const bv = reservationSortValue(b, key);
    let cmp = av.localeCompare(bv);
    if (cmp === 0) {
      cmp = Number(b?.reservation_id || b?.id || 0) - Number(a?.reservation_id || a?.id || 0);
    }
    return desc ? -cmp : cmp;
  });
  return list;
}

export function formatMarketDateRange(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '—';
  try {
    const opts = { day: '2-digit', month: 'short' };
    const inStr = new Date(checkIn).toLocaleDateString('tr-TR', opts);
    const outStr = new Date(checkOut).toLocaleDateString('tr-TR', opts);
    return `${inStr} - ${outStr}`;
  } catch {
    return `${checkIn} - ${checkOut}`;
  }
}

export const CHANNEL_USER_NAMES = new Set([
  'airbnb',
  'booking',
  'booking.com',
  'agoda',
  'expedia',
  'etstur',
  'ets tur',
  'nobeds',
  'sistem',
  'web sitesi',
  'web',
  'hotelrunner',
  'manuel kayıt',
  'blokaj',
]);

export function isChannelUserName(name) {
  const key = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!key) return false;
  if (CHANNEL_USER_NAMES.has(key)) return true;
  if (key.includes('hotelrunner') || key.includes('booking') || key.includes('airbnb')) return true;
  return false;
}

export function isUsableGuestName(name) {
  const label = String(name || '').trim();
  if (!label) return false;
  if (/^(misafir|bilinmeyen misafir)$/i.test(label)) return false;
  if (isOtaPlaceholderName(label)) return false;
  if (isChannelUserName(label.replace(/\s+Misafiri$/i, ''))) return false;
  return true;
}

/** iCal/OTA placeholder — boş string placeholder sayılmaz */
export function isOtaPlaceholderName(name) {
  const raw = String(name || '').trim();
  if (!raw) return false;
  if (/^hotelrunner(\s+misafiri)?$/i.test(raw)) return true;
  if (/^nobeds(\s+misafiri)?$/i.test(raw)) return true;
  if (/^misafir$/i.test(raw)) return true;
  if (/not available/i.test(raw)) return true;
  if (/misafiri$/i.test(raw) && isChannelUserName(raw.replace(/\s+misafiri$/i, ''))) return true;
  return false;
}

export function buildReservationRecord(cell, meta = null) {
  return {
    guest_name: String(cell?.guest_name ?? meta?.guest_name ?? '').trim(),
    user_name: String(cell?.user_name ?? meta?.user_name ?? '').trim(),
    user_surname: String(cell?.user_surname ?? meta?.user_surname ?? '').trim(),
    channel_name: String(cell?.channel_name ?? meta?.channel_name ?? '').trim(),
    note: String(cell?.note ?? meta?.note ?? '').trim(),
    channel: String(cell?.channel ?? meta?.channel ?? '').trim(),
  };
}

function normalizePersonName(raw) {
  const name = String(raw || '').trim();
  if (!name || /^misafir$/i.test(name) || name === 'Bilinmeyen Misafir') return '';
  if (isOtaPlaceholderName(name)) return '';
  return name.replace(/\s+Misafiri$/i, '');
}

/** Web sitesi rezervasyonları — admin reservations.php ile aynı */
export function resolveWebsiteGuestName(record = {}) {
  const guestCol = normalizePersonName(record.guest_name);
  if (guestCol && !isChannelUserName(guestCol)) return guestCol;

  const userFull = normalizePersonName(`${record.user_name || ''} ${record.user_surname || ''}`.trim());
  if (userFull && record.user_name && !isChannelUserName(record.user_name)) return userFull;

  const accountName = String(record.channel_name || record.user_name || '').trim();
  if (accountName && accountName !== 'Manuel Kayıt' && !isChannelUserName(accountName)) {
    const normalized = normalizePersonName(accountName);
    if (normalized) return normalized;
  }

  const note = String(record.note || '');
  const webMatch = note.match(/^web\s*sitesi:\s*(.+?)(?:\s*\[|$)/i);
  if (webMatch?.[1]) {
    const fromNote = normalizePersonName(webMatch[1]);
    if (fromNote && !isChannelUserName(fromNote)) return fromNote;
  }

  return '';
}

/** Admin reservation_detail.php ile aynı misafir adı çözümleme */
export function resolveGuestNameFromRecord(record = {}) {
  if (noteIndicatesWebsite(record.note) || isWebSiteChannel(record.channel)) {
    return resolveWebsiteGuestName(record);
  }

  const guestDirect = normalizePersonName(record.guest_name);
  if (guestDirect && !isChannelUserName(guestDirect)) return guestDirect;

  const userFull = normalizePersonName(`${record.user_name || ''} ${record.user_surname || ''}`.trim());
  if (userFull && record.user_name && !isChannelUserName(record.user_name)) return userFull;

  const note = String(record.note || '').trim();
  if (note.includes(':')) {
    const parts = note.split(':');
    const fromNote = normalizePersonName(parts[parts.length - 1].replace(/\s*\[.*$/, ''));
    if (fromNote && !isChannelUserName(fromNote) && !isOtaPlaceholderName(fromNote)) return fromNote;
  }

  return '';
}

export function isWebSiteChannel(channel) {
  const name = String(channel || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  return name === 'web sitesi' || name === 'web';
}

/** Web Sitesi notu mu? (Web Sitesi, Web Sitesi: ..., Web Sitesi [Ödeme...]) */
export function noteIndicatesWebsite(note) {
  const text = String(note || '').trim();
  if (!text) return false;
  if (/^(nobeds|hotelrunner)/i.test(text)) return false;
  return /^web\s*sitesi(\s|:|\[|$)/i.test(text);
}

/** Web rezervasyonu: kanal, not veya etiketten tespit (sunucu gecikse bile) */
export function isWebSiteReservation(cell) {
  if (!cell) return false;
  if (cell.is_website === true) return true;

  if (noteIndicatesWebsite(cell.note)) return true;
  if (isWebSiteChannel(cell.channel)) return true;

  const label = String(cell.label || '').trim().replace(/\s+/g, ' ');
  if (/^web\s*sitesi$/i.test(label)) return true;
  return false;
}

/** Rezervasyon listesinde iCal / OTA / HotelRunner kaydı mı? (web ve manuel hariç) */
export function isIcalListReservation(item) {
  if (!item) return false;
  if (item.is_website === true) return false;
  if (isWebSiteChannel(item.channel) || noteIndicatesWebsite(item.note)) return false;

  const channel = String(item.channel || '').toLowerCase().trim();
  if (channel === 'manuel' || channel === 'manuel kayıt' || channel === 'manuel eklendi') {
    return false;
  }

  if (item.is_ical === true) return true;
  return isChannelSyncedReservation(item);
}

export function isUnpaidWebHold(cell) {
  if (!cell) return false;
  if (cell.is_unpaid_hold === true || cell.is_pending_web === true) return true;
  return false;
}

/** Takvim çubuk rengi: bekleyen web turuncu, onaylı web gri, diğer kanallar mavi */
export function getCalendarReservationColor(channel, cell) {
  const record = cell || { channel };
  const apiColor = String(record.bar_color || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(apiColor)) return apiColor;
  if (isUnpaidWebHold(record)) return '#fd7e14';
  return isWebSiteReservation(record) ? '#9ca3af' : '#0d6efd';
}

/** iCal / kanal senkronu (Airbnb, Booking, HotelRunner, Nobeds vb.) */
export function isChannelSyncedReservation(cell, meta = null) {
  if (isWebSiteReservation(cell)) return false;

  const record = buildReservationRecord(cell, meta);
  const note = record.note;

  if (meta?.is_ical === true || cell?.is_ical === true) return true;

  if (/^(hotelrunner|nobeds|airbnb|booking\.?com|agoda|expedia|etstur)\s*:/i.test(note)) {
    return true;
  }

  if (note.includes(':') && !noteIndicatesWebsite(note) && !/^blokaj/i.test(note) && !/^manuel/i.test(note)) {
    const prefix = note.split(':')[0].trim();
    if (prefix && !isWebSiteChannel(prefix)) return true;
  }

  const channelKey = record.channel.toLowerCase();
  if (channelKey && !isWebSiteChannel(channelKey) && channelKey !== 'manuel' && channelKey !== 'manuel kayıt') {
    if (/hotelrunner|nobeds|airbnb|booking|agoda|expedia|etstur/i.test(channelKey)) return true;
  }

  if (isChannelUserName(record.user_name)) return true;
  if (isOtaPlaceholderName(record.guest_name)) return true;

  return false;
}

export function resolveChannelSyncLabel(cell, meta = null) {
  const record = buildReservationRecord(cell, meta);
  const note = record.note;

  if (note.includes(':')) {
    const platform = note.split(':')[0].trim();
    const key = platform.toLowerCase();
    if (key.includes('hotelrunner') || key === 'nobeds') return 'HotelRunner';
    if (key === 'booking' || key === 'booking.com') return 'Booking.com';
    if (key === 'etstur') return 'ETSTUR';
    if (!isWebSiteChannel(platform) && key !== 'blokaj' && key !== 'manuel kayıt') {
      return platform;
    }
  }

  const channel = record.channel.trim();
  if (channel) {
    const key = channel.toLowerCase();
    if (key.includes('hotelrunner') || key === 'nobeds') return 'HotelRunner';
    return channel;
  }

  if (isChannelUserName(record.user_name)) {
    const u = record.user_name.toLowerCase();
    if (u.includes('hotelrunner') || u === 'nobeds') return 'HotelRunner';
    return record.user_name;
  }

  return 'HotelRunner';
}

/** Takvim çubuğu etiketi — web: isim, diğer her şey (iCal): kanal */
export function resolveCalendarDisplayLabel(cell, meta = null) {
  const record = buildReservationRecord(cell, meta);

  if (isWebSiteReservation(cell)) {
    return resolveWebsiteGuestName(record) || 'Misafir';
  }

  return resolveChannelSyncLabel(cell, meta);
}

/** Takvim grid — web gri + isim, iCal/kanal mavi + HotelRunner */
export function overlayPendingHoldsOnGrid(grid, reservationMeta = {}, days = []) {
  if (!grid || typeof grid !== 'object') return grid;

  const metaList = Array.isArray(reservationMeta)
    ? reservationMeta
    : Object.values(reservationMeta || {});

  if (!metaList.length) return grid;

  const next = {};
  for (const roomKey of Object.keys(grid)) {
    next[roomKey] = { ...(grid[roomKey] || {}) };
  }

  for (const meta of metaList) {
    if (!isUnpaidWebHold(meta)) continue;

    const roomId = String(meta.room_id || '');
    const checkIn = String(meta.check_in || '');
    const checkOut = String(meta.check_out || '');
    if (!roomId || !checkIn || !checkOut || checkOut <= checkIn) continue;

    const bucketKey =
      Object.keys(next).find((key) => key === roomId || key.startsWith(`${roomId}:`)) || roomId;
    if (!next[bucketKey]) next[bucketKey] = {};

    const visibleDays = days.length
      ? days.filter((day) => day.date >= checkIn && day.date < checkOut)
      : [{ date: checkIn }];

    if (!visibleDays.length) continue;

    const anchorDate = visibleDays[0].date;
    const existing = next[bucketKey][anchorDate];
    if (existing?.type === 'reservation') continue;

    const anchorIdx = days.length ? days.findIndex((day) => day.date === anchorDate) : 0;
    const colsLeft = days.length ? Math.max(1, days.length - anchorIdx) : nightsBetweenIso(anchorDate, checkOut);
    const spanNights = nightsBetweenIso(anchorDate, checkOut);
    const colspan = Math.max(1, Math.min(spanNights, colsLeft));
    const guestLabel = resolveWebsiteGuestName(meta) || meta.guest_name || 'Misafir';

    next[bucketKey][anchorDate] = {
      type: 'reservation',
      label: guestLabel,
      colspan,
      reservation_id: Number(meta.reservation_id || meta.id || 0),
      check_in: checkIn,
      check_out: checkOut,
      status: meta.status || 'pending',
      total_price: Number(meta.total_price || 0),
      channel: meta.channel || 'Web Sitesi',
      note: meta.note || '',
      guest_name: meta.guest_name || guestLabel,
      user_name: meta.user_name || '',
      user_surname: meta.user_surname || '',
      is_website: true,
      is_unpaid_hold: true,
      is_pending_web: true,
      bar_color: meta.bar_color || '#fd7e14',
    };
  }

  return next;
}

/** Takvim grid — web gri + isim, iCal/kanal mavi + HotelRunner */
export function enrichCalendarGrid(grid, reservationMeta = {}) {
  if (!grid || typeof grid !== 'object') return grid;

  const next = {};
  for (const roomKey of Object.keys(grid)) {
    next[roomKey] = {};
    const row = grid[roomKey] || {};
    for (const date of Object.keys(row)) {
      const cell = row[date];
      if (cell?.type !== 'reservation') {
        next[roomKey][date] = cell;
        continue;
      }

      const meta = reservationMeta[cell.reservation_id] || reservationMeta[cell.id] || null;
      const note = String(cell.note ?? meta?.note ?? '').trim();
      let channel = String(cell.channel || meta?.channel || '').trim();

      const merged = {
        ...cell,
        note,
        channel: noteIndicatesWebsite(note) ? 'Web Sitesi' : channel,
        guest_name: cell.guest_name || meta?.guest_name || '',
        user_name: cell.user_name || meta?.user_name || meta?.channel_name || '',
        user_surname: cell.user_surname || meta?.user_surname || '',
        channel_name: meta?.channel_name || cell?.channel_name || '',
        is_website:
          meta?.is_website === true ||
          cell.is_website === true ||
          noteIndicatesWebsite(note) ||
          isWebSiteChannel(channel),
        is_unpaid_hold: cell.is_unpaid_hold === true || meta?.is_unpaid_hold === true,
        is_pending_web: cell.is_pending_web === true || meta?.is_pending_web === true,
        bar_color: cell.bar_color || meta?.bar_color || '',
        is_ical: meta?.is_ical === true || cell?.is_ical === true,
      };

      const displayLabel = resolveCalendarDisplayLabel(merged, meta);
      const isWeb = isWebSiteReservation(merged);

      next[roomKey][date] = {
        ...merged,
        label: displayLabel,
        channel: isWeb ? 'Web Sitesi' : (channel || 'HotelRunner'),
        is_website: isWeb,
        is_unpaid_hold:
          merged.is_unpaid_hold === true ||
          meta?.is_unpaid_hold === true ||
          isUnpaidWebHold(merged),
        is_pending_web:
          merged.is_pending_web === true ||
          meta?.is_pending_web === true ||
          isUnpaidWebHold(merged),
        bar_color: getCalendarReservationColor(isWeb ? 'Web Sitesi' : channel, {
          ...merged,
          bar_color: merged.bar_color || meta?.bar_color || '',
        }),
      };
    }
  }
  return next;
}

export function getChannelStyle(channel, row = null) {
  const record = row && typeof row === 'object' ? row : { channel };
  const color = getCalendarReservationColor(channel, record);

    if (isUnpaidWebHold(record)) {
      return { label: 'Web Sitesi — ödeme bekliyor', color };
    }
    if (isWebSiteReservation(record)) {
      return { label: 'Web Sitesi', color };
    }

  const raw = String(channel || '').trim();
  const key = raw.toLowerCase();
  if (key.includes('mobil')) {
    return { label: 'Mobil Uygulama', color };
  }
  if (key.includes('panel') || key.includes('yönetim')) {
    return { label: 'Yönetim Paneli', color };
  }
  if (key === 'manuel' || key === 'manuel kayıt') {
    return { label: 'Manuel', color };
  }

  const label = raw || 'HotelRunner';
  return { label, color };
}

export const CALENDAR_LEGEND = [
  { color: '#fd7e14', label: 'Web Sitesi — ödeme bekliyor' },
  { color: '#9ca3af', label: 'Web Sitesi — onaylı' },
  { color: '#0d6efd', label: 'OTA / HotelRunner' },
];

export const STATUS_LABELS = {
  needed: 'İhtiyaç Var',
  ordered: 'Sipariş Verildi',
  in_stock: 'Stokta',
  active: 'Aktif',
  inactive: 'Pasif',
  passive: 'Pasif',
  clean: 'Temiz',
  dirty: 'Kirli',
  inspected: 'Kontrol Edildi',
  oos: 'Servis Dışı',
};

export const EXPLORE_TYPES = {
  beach: 'Plaj',
  place: 'Gezilecek Yer',
  activity: 'Aktivite',
};
