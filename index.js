/**
 * @format
 */

import { AppRegistry, Alert } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Catch all unhandled errors/rejections so the app shows the error instead of crashing silently
const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  Alert.alert(
    isFatal ? '[FATAL]' : '[ERROR]',
    `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}\n\n${error?.stack?.slice(0, 300) ?? ''}`,
  );
  defaultHandler(error, isFatal);
});

AppRegistry.registerComponent(appName, () => App);
