/** Ön Büro — alt menü soldan sağa: Takvim, Rezerv., Ödeme, Stok, İşler, Kuponlar, Piyasa */
export const MOBILE_FRONT_DESK_PERMS = [
  'manage_calendar',
  'manage_reservations',
  'manage_payments',
  'manage_inventory',
  'manage_cases',
  'manage_coupons',
  'manage_pricing',
];

export const MOBILE_MENU_ITEMS = [
  { perm: 'manage_calendar', screen: 'calendar', icon: 'calendar', title: 'Takvim', danger: false },
  { perm: 'manage_reservations', screen: 'reservations', icon: 'journal', title: 'Rezerv.', danger: false },
  { perm: 'manage_payments', screen: 'payments', icon: 'wallet', title: 'Ödeme', danger: false },
  { perm: 'manage_rooms', screen: 'rooms', icon: 'bed', title: 'Odalar', danger: false },
  { perm: 'manage_features', screen: 'features', icon: 'star', title: 'Özellik', danger: false },
  { perm: 'manage_room_types', screen: 'roomTypes', icon: 'pricetag', title: 'Tipler', danger: false },
  { perm: 'manage_users', screen: 'guests', icon: 'people', title: 'Misafir', danger: false },
  { perm: 'manage_inventory', screen: 'inventory', icon: 'cube', title: 'Stok', danger: false, altPerm: 'manage_calendar' },
  { perm: 'manage_coupons', screen: 'coupons', icon: 'ticket', title: 'Kuponlar', danger: false },
  { perm: 'manage_pricing', screen: 'pricing', icon: 'trending-up', title: 'Piyasa', danger: false },
  { perm: 'manage_extra_products', screen: 'extras', icon: 'cart', title: 'Ekstra', danger: false },
  { perm: 'manage_admins', screen: 'staff', icon: 'id-card', title: 'Personel', danger: false },
  { perm: 'view_reports', screen: 'reports', icon: 'bar-chart', title: 'Rapor', danger: false },
  { perm: 'manage_gallery', screen: 'gallery', icon: 'images', title: 'Galeri', danger: false },
  { perm: 'manage_cases', screen: 'cases', icon: 'clipboard', title: 'İşler', danger: false },
  { perm: 'manage_explore', screen: 'explore', icon: 'compass', title: 'Rehber', danger: false },
  { perm: 'manage_channels', screen: 'channels', icon: 'git-network', title: 'Kanal', danger: false },
  { perm: 'manage_settings', screen: 'settings', icon: 'settings', title: 'Ayarlar', danger: false },
  { perm: 'manage_policies', screen: 'policies', icon: 'shield-checkmark', title: 'Politika', danger: false },
  { perm: 'view_analytics', screen: 'analytics', icon: 'pie-chart', title: 'Analiz', danger: false },
  { perm: 'manage_qr', screen: 'qrcodes', icon: 'qr-code', title: 'QR Kod', danger: false },
];

export function canAccess(admin, perm) {
  if (!admin) return false;
  // Mobilde admin/süper fark etmez: sadece Ön Büro seti
  return MOBILE_FRONT_DESK_PERMS.includes(perm);
}

export function canAccessMenuItem(admin, item) {
  if (canAccess(admin, item.perm)) return true;
  if (item.altPerm && canAccess(admin, item.altPerm)) return true;
  return false;
}

export function getAllowedMenuItems(admin) {
  if (!admin) return [];
  const byPerm = new Map(MOBILE_MENU_ITEMS.map((item) => [item.perm, item]));
  return MOBILE_FRONT_DESK_PERMS.map((perm) => byPerm.get(perm)).filter(Boolean);
}

export function getDefaultScreen(admin) {
  if (canAccess(admin, 'manage_calendar')) {
    return 'calendar';
  }
  const items = getAllowedMenuItems(admin);
  return items.length > 0 ? items[0].screen : 'calendar';
}
