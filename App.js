import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppHeader from './src/components/AppHeader';
import SafeScreen from './src/components/SafeScreen';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import BottomNav from './src/components/BottomNav';
import { NavigationContext } from './src/context/NavigationContext';
import { ConfirmProvider, useConfirm } from './src/context/ConfirmContext';
import { ReservationFilterProvider } from './src/context/ReservationFilterContext';
import ChannelFilterBar from './src/components/ChannelFilterBar';
import { bindDialogApi } from './src/utils/alert';
import {
  AuthAPI,
  CasesAPI,
  STORAGE_ADMIN_KEY,
  STORAGE_API_BUILD_KEY,
  STORAGE_TOKEN_KEY,
  bootstrapSecureAuthStorage,
  clearAuthStorage,
  loadSiteBranding,
  saveSiteBranding,
} from './src/api';
import { storageGetItem } from './src/utils/secureStorage';
import { getAllowedMenuItems, getDefaultScreen, canAccess, canAccessMenuItem, MOBILE_MENU_ITEMS } from './src/menuConfig';
import { applyWebAppFix } from './src/utils/applyWebAppFix';
import { showMessage } from './src/utils/alert';
import { COLORS } from './src/theme';
import LoginScreen from './src/screens/LoginScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import ReservationsScreen from './src/screens/ReservationsScreen';
import ReservationDetailScreen from './src/screens/ReservationDetailScreen';
import RoomsScreen from './src/screens/RoomsScreen';
import PaymentsScreen from './src/screens/PaymentsScreen';
import MarketScreen from './src/screens/MarketScreen';
import CouponsScreen from './src/screens/CouponsScreen';
import CasesScreen from './src/screens/CasesScreen';
import CaseDetailScreen from './src/screens/CaseDetailScreen';
import CancellationsScreen from './src/screens/CancellationsScreen';
import ChannelsScreen from './src/screens/ChannelsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import {
  InventoryScreen,
  GuestsScreen,
  ExtraProductsScreen,
  RoomFeaturesScreen,
  RoomTypesScreen,
  ExploreScreen,
  QRCodesScreen,
  PoliciesScreen,
  GalleryScreen,
  StaffScreen,
} from './src/screens/ResourceScreens';
import {
  getInitialNotificationReservationId,
  initializeReservationTracking,
  listenForForegroundNotifications,
  listenForNotificationResponses,
  registerForPushNotifications,
  startReservationPolling,
  unregisterPushNotifications,
} from './src/services/pushNotifications';
import {
  authenticateWithBiometric,
  isBiometricEnabled,
  setBiometricEnabled,
} from './src/services/biometricAuth';

const SCREEN_MAP = {
  calendar: CalendarScreen,
  reservations: ReservationsScreen,
  pricing: MarketScreen,
  rooms: RoomsScreen,
  features: RoomFeaturesScreen,
  roomTypes: RoomTypesScreen,
  guests: GuestsScreen,
  inventory: InventoryScreen,
  payments: PaymentsScreen,
  extras: ExtraProductsScreen,
  staff: StaffScreen,
  reports: ReportsScreen,
  gallery: GalleryScreen,
  coupons: CouponsScreen,
  cases: CasesScreen,
  explore: ExploreScreen,
  channels: ChannelsScreen,
  settings: SettingsScreen,
  cancellations: CancellationsScreen,
  policies: PoliciesScreen,
  analytics: AnalyticsScreen,
  qrcodes: QRCodesScreen,
};

function DialogBinder() {
  const dialog = useConfirm();

  useEffect(() => {
    bindDialogApi(dialog);
    return () => bindDialogApi(null);
  }, [dialog]);

  return null;
}

function PushManager({ onOpenReservation }) {
  const onOpenRef = useRef(onOpenReservation);

  useEffect(() => {
    onOpenRef.current = onOpenReservation;
  }, [onOpenReservation]);

  useEffect(() => {
    let stopPolling = () => {};

    const setup = async () => {
      try {
        await registerForPushNotifications();
        await initializeReservationTracking();

        const pendingId = await getInitialNotificationReservationId();
        if (pendingId) {
          onOpenRef.current?.(pendingId);
        }

        stopPolling = startReservationPolling({ enableLocalAlerts: true });
      } catch (error) {
        console.warn('PushManager setup failed', error);
      }
    };

    setup();

    const removeForeground = listenForForegroundNotifications((data) => {
      if (data.reservation_id) {
        onOpenRef.current?.(Number(data.reservation_id));
      }
    });

    const removeListener = listenForNotificationResponses((reservationId) => {
      onOpenRef.current?.(reservationId);
    });

    return () => {
      stopPolling();
      removeForeground();
      removeListener();
    };
  }, []);

  return null;
}

function canNavigateToScreen(admin, screen) {
  const item = MOBILE_MENU_ITEMS.find((entry) => entry.screen === screen);
  if (!item) return false;
  return canAccessMenuItem(admin, item);
}

function MainShell({ admin, onLogout, branding }) {
  const menuItems = useMemo(() => getAllowedMenuItems(admin), [admin]);
  const [activeScreen, setActiveScreen] = useState(() => getDefaultScreen(admin));
  const [reservationDetail, setReservationDetail] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseBadge, setCaseBadge] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const navigation = useMemo(
    () => ({
      openReservation: (id, snapshot = null) => {
        const numId = Number(id);
        if (!numId) return;
        setReservationDetail({ id: numId, snapshot });
      },
      openCase: (id) => {
        const numId = Number(id);
        if (!numId) return;
        setReservationDetail(null);
        setCaseDetail({ id: numId });
      },
      navigateTo: (screen) => {
        if (!canNavigateToScreen(admin, screen)) {
          showMessage('Yetki yok', 'Bu sayfaya erişim yetkiniz bulunmuyor.');
          return;
        }
        setReservationDetail(null);
        setCaseDetail(null);
        setActiveScreen(screen);
      },
    }),
    [admin]
  );

  useEffect(() => {
    if (!canNavigateToScreen(admin, activeScreen)) {
      setActiveScreen(getDefaultScreen(admin));
    }
  }, [menuItems, admin, activeScreen]);

  useEffect(() => {
    let cancelled = false;
    CasesAPI.list('open', false)
      .then((res) => {
        if (cancelled) return;
        const overdue = Number(res?.overdue_count || 0);
        const open = Number(res?.open_count || 0);
        setCaseBadge(overdue > 0 ? overdue : open);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [admin, caseDetail, activeScreen]);

  const navItems = useMemo(
    () =>
      menuItems.map((item) =>
        item.screen === 'cases' && caseBadge > 0 ? { ...item, badge: caseBadge } : item
      ),
    [menuItems, caseBadge]
  );

  const ScreenComponent = SCREEN_MAP[activeScreen] || CalendarScreen;
  const isCalendar = activeScreen === 'calendar';
  const overlayOpen = Boolean(reservationDetail || caseDetail);
  const showReservationFilter =
    !overlayOpen &&
    (activeScreen === 'reservations' || activeScreen === 'cancellations' || activeScreen === 'payments');
  const OtherScreen = !isCalendar && !overlayOpen ? ScreenComponent : null;

  if (menuItems.length === 0) {
    return (
      <NavigationContext.Provider value={navigation}>
        <SafeScreen style={styles.safe}>
          <PushManager onOpenReservation={navigation.openReservation} />
          <AppHeader admin={admin} onLogout={onLogout} branding={branding} />
          <CalendarScreen />
        </SafeScreen>
      </NavigationContext.Provider>
    );
  }

  return (
    <NavigationContext.Provider value={navigation}>
      <SafeScreen style={styles.safe}>
        <PushManager onOpenReservation={navigation.openReservation} />
        <AppHeader admin={admin} onLogout={onLogout} branding={branding} />
        {showReservationFilter ? <ChannelFilterBar /> : null}
        <View style={styles.body}>
          <View
            style={isCalendar && !overlayOpen ? styles.flex1 : styles.calendarKeeper}
            pointerEvents={isCalendar && !overlayOpen ? 'auto' : 'none'}
          >
            <CalendarScreen isFocused={isCalendar && !overlayOpen} />
          </View>
          {reservationDetail ? (
            <View style={styles.flex1}>
              <ReservationDetailScreen
                reservationId={reservationDetail.id}
                initialSnapshot={reservationDetail.snapshot}
                onClose={() => setReservationDetail(null)}
              />
            </View>
          ) : caseDetail ? (
            <View style={styles.flex1}>
              <CaseDetailScreen caseId={caseDetail.id} onClose={() => setCaseDetail(null)} />
            </View>
          ) : OtherScreen ? (
            <View style={styles.flex1}>
              <OtherScreen />
            </View>
          ) : null}
        </View>
        {keyboardOpen ? null : (
        <BottomNav
          items={navItems}
          activeScreen={activeScreen}
          onNavigate={(screen) => {
            setReservationDetail(null);
            setCaseDetail(null);
            setActiveScreen(screen);
          }}
        />
        )}
      </SafeScreen>
    </NavigationContext.Provider>
  );
}

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    applyWebAppFix();
  }, []);

  useEffect(() => {
    const restore = async () => {
      try {
        await bootstrapSecureAuthStorage();
        const cachedBranding = await loadSiteBranding();
        if (cachedBranding) {
          setBranding(cachedBranding);
        }
        const token = await storageGetItem(STORAGE_TOKEN_KEY);
        const cached = await AsyncStorage.getItem(STORAGE_ADMIN_KEY);
        if (token && cached) {
          try {
            const me = await AuthAPI.me();
            if (!me?.admin) {
              throw new Error('invalid session');
            }
            if (await isBiometricEnabled()) {
              try {
                const ok = await authenticateWithBiometric('Oturumu açmak için doğrulayın');
                if (!ok) {
                  await clearAuthStorage();
                  setAdmin(null);
                  setBranding(null);
                  return;
                }
              } catch {
                await clearAuthStorage();
                setAdmin(null);
                setBranding(null);
                return;
              }
            }
            setAdmin(me.admin);
            await AsyncStorage.setItem(STORAGE_ADMIN_KEY, JSON.stringify(me.admin));
            if (me.branding) {
              setBranding(me.branding);
              await saveSiteBranding(me.branding);
            }
          } catch {
            await clearAuthStorage();
            setAdmin(null);
            setBranding(null);
          }
        }
      } catch {
        setAdmin(null);
        setBranding(null);
      } finally {
        setBootstrapping(false);
      }
    };
    restore();
  }, []);

  const handleLoginSuccess = useCallback(async (payload) => {
    const nextAdmin = payload?.admin || payload;
    setAdmin(nextAdmin);
    if (payload?.branding) {
      setBranding(payload.branding);
      await saveSiteBranding(payload.branding);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await unregisterPushNotifications();
    await setBiometricEnabled(false);
    await clearAuthStorage();
    setAdmin(null);
    setBranding(null);
  }, []);

  if (bootstrapping) {
    return (
      <SafeAreaProvider>
        <ConfirmProvider>
          <DialogBinder />
          <View style={styles.bootstrap}>
            <ExpoStatusBar style="dark" />
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </ConfirmProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppErrorBoundary onReset={handleLogout}>
        <ConfirmProvider>
          <DialogBinder />
          <ReservationFilterProvider>
            <View style={styles.root}>
              <ExpoStatusBar style="dark" />
              <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
              {admin ? (
                <MainShell admin={admin} onLogout={handleLogout} branding={branding} />
              ) : (
                <LoginScreen onLoginSuccess={handleLoginSuccess} />
              )}
            </View>
          </ReservationFilterProvider>
        </ConfirmProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  safe: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, overflow: 'hidden' },
  flex1: { flex: 1 },
  calendarKeeper: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  bootstrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
