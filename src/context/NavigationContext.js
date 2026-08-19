import React, { createContext, useContext } from 'react';

export const NavigationContext = createContext({
  openReservation: () => {},
  openCase: () => {},
  navigateTo: () => {},
});

export function useAppNavigation() {
  return useContext(NavigationContext);
}
