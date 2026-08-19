import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

import App from './App';
import { applyWebAppFix } from './src/utils/applyWebAppFix';

applyWebAppFix();

if (!__DEV__) {
  LogBox.ignoreAllLogs(true);
}

const defaultHandler = global.ErrorUtils?.getGlobalHandler?.();
global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
  console.error('[MyStoneINN fatal]', isFatal, error);
  defaultHandler?.(error, isFatal);
});

registerRootComponent(App);
