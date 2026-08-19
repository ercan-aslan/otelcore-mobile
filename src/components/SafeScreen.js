import React from 'react';
import { Platform, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SafeScreen({ children, style, edges = ['top'] }) {
  const insets = useSafeAreaInsets();
  const statusBarFallback = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

  const padding = {
    paddingTop: edges.includes('top') ? Math.max(insets.top, statusBarFallback) : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View style={[{ flex: 1 }, padding, style]}>
      {children}
    </View>
  );
}
