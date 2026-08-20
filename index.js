import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

// StyleSheet.create fontSize +1 — App ve ekran stillerinden önce yüklenmeli.
import './src/utils/bumpFontSizes';

import App from './App';
import { applyWebAppFix } from './src/utils/applyWebAppFix';

applyWebAppFix();

if (!__DEV__) {
  LogBox.ignoreAllLogs(true);
}

const defaultHandler = global.ErrorUtils?.getGlobalHandler?.();
global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
  console.error('[OtelCore fatal]', isFatal, error);
  defaultHandler?.(error, isFatal);
});

registerRootComponent(App);
