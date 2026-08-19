const listeners = new Set();
let activeReload = null;

export function registerCalendarReload(reloadFn) {
  activeReload = reloadFn;
  return () => {
    if (activeReload === reloadFn) {
      activeReload = null;
    }
  };
}

export function subscribeCalendarRefresh(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function notifyCalendarRefresh(reason = 'reservation') {
  if (activeReload) {
    try {
      activeReload(reason);
    } catch {
      // Sessiz geç
    }
  }
  listeners.forEach((callback) => {
    try {
      callback(reason);
    } catch {
      // Dinleyici hatası diğerlerini etkilemesin.
    }
  });
}
