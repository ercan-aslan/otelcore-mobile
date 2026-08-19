import { Alert, Platform } from 'react-native';

let dialogApi = null;

export function bindDialogApi(api) {
  dialogApi = api;
}

export function showMessage(title, message) {
  if (dialogApi) {
    dialogApi.alert({ title, message: message || '' });
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;
  if (Platform.OS === 'web') {
    globalThis.alert?.(text);
    return;
  }
  Alert.alert(title, message || '');
}

export function showPrompt(title, message, onConfirm, options = {}) {
  const {
    placeholder = '',
    cancelText = 'Vazgeç',
    confirmText = 'Tamam',
    destructive = false,
    minLength = 5,
  } = options;

  if (dialogApi?.prompt) {
    dialogApi.prompt({
      title,
      message,
      placeholder,
      confirmText,
      cancelText,
      destructive,
      minLength,
      onConfirm,
    });
    return;
  }

  showConfirm(title, message, () => onConfirm?.(''), { cancelText, confirmText, destructive });
}

export function showConfirm(title, message, onConfirm, options = {}) {
  const {
    cancelText = 'İptal',
    confirmText = 'Tamam',
    destructive = false,
  } = options;

  if (dialogApi) {
    dialogApi.confirm({
      title,
      message,
      confirmText,
      cancelText,
      destructive,
      onConfirm,
    });
    return;
  }

  if (Platform.OS === 'web') {
    const ok = globalThis.confirm?.(`${title}\n\n${message}`);
    if (ok) {
      onConfirm?.();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: () => onConfirm?.(),
    },
  ]);
}
