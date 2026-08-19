import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'admin_show_channel_reservations_v2';

const ReservationFilterContext = createContext({
  showChannelReservations: true,
  setShowChannelReservations: () => {},
  websiteOnly: false,
  ready: false,
});

export function ReservationFilterProvider({ children }) {
  const [showChannelReservations, setShowChannelReservationsState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;
        if (value === '0') {
          setShowChannelReservationsState(false);
        } else {
          setShowChannelReservationsState(true);
        }
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setShowChannelReservations = useCallback(async (next) => {
    setShowChannelReservationsState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = useMemo(
    () => ({
      showChannelReservations,
      setShowChannelReservations,
      websiteOnly: !showChannelReservations,
      ready,
    }),
    [showChannelReservations, setShowChannelReservations, ready]
  );

  return (
    <ReservationFilterContext.Provider value={value}>
      {children}
    </ReservationFilterContext.Provider>
  );
}

export function useReservationFilter() {
  return useContext(ReservationFilterContext);
}
