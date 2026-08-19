import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppPressable from '../components/AppPressable';
import { COLORS, INPUT_FONT_SIZE } from '../theme';

const ConfirmContext = createContext(null);

const DIM = 'rgba(0,0,0,0.58)';

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptError, setPromptError] = useState('');

  const close = useCallback(() => {
    setDialog(null);
    setPromptValue('');
    setPromptError('');
  }, []);

  const confirm = useCallback(
    ({ title, message, confirmText = 'Tamam', cancelText = 'İptal', destructive = false, onConfirm }) => {
      setDialog({
        type: 'confirm',
        title,
        message,
        confirmText,
        cancelText,
        destructive,
        onConfirm,
      });
    },
    []
  );

  const alert = useCallback(({ title, message, confirmText = 'Tamam' }) => {
    setDialog({
      type: 'alert',
      title,
      message,
      confirmText,
    });
  }, []);

  const prompt = useCallback(
    ({
      title,
      message,
      placeholder = '',
      confirmText = 'Tamam',
      cancelText = 'Vazgeç',
      destructive = false,
      minLength = 5,
      onConfirm,
    }) => {
      setPromptValue('');
      setPromptError('');
      setDialog({
        type: 'prompt',
        title,
        message,
        placeholder,
        confirmText,
        cancelText,
        destructive,
        minLength,
        onConfirm,
      });
    },
    []
  );

  const handleConfirm = () => {
    if (dialog?.type === 'prompt') {
      const text = String(promptValue || '').trim();
      if (text.length < (dialog.minLength || 5)) {
        setPromptError(`En az ${dialog.minLength || 5} karakter yazın.`);
        return;
      }
      const callback = dialog.onConfirm;
      close();
      callback?.(text);
      return;
    }
    const callback = dialog?.onConfirm;
    close();
    callback?.();
  };

  const value = useMemo(() => ({ confirm, alert, prompt }), [confirm, alert, prompt]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={close} />
          <View style={styles.card}>
            <Text style={styles.title}>{dialog?.title}</Text>
            {dialog?.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
            {dialog?.type === 'prompt' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={dialog.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  value={promptValue}
                  onChangeText={(v) => {
                    setPromptValue(v);
                    if (promptError) setPromptError('');
                  }}
                  multiline
                  autoFocus
                />
                {promptError ? <Text style={styles.error}>{promptError}</Text> : null}
              </>
            ) : null}
            <View style={styles.actions}>
              {dialog?.type !== 'alert' ? (
                <AppPressable
                  title={dialog?.cancelText || 'Vazgeç'}
                  color={COLORS.textPrimary}
                  variant="outline"
                  onPress={close}
                  style={[styles.btn, styles.cancelBtn]}
                  textStyle={styles.cancelText}
                />
              ) : null}
              <AppPressable
                title={dialog?.confirmText || 'Tamam'}
                color={dialog?.destructive ? COLORS.danger : COLORS.primary}
                onPress={handleConfirm}
                style={[styles.btn, dialog?.type === 'alert' && styles.fullBtn]}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

const webOverlay =
  Platform.OS === 'web'
    ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200000 }
    : null;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: DIM,
    ...webOverlay,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    padding: 20,
    zIndex: 1,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    padding: 10,
    fontSize: INPUT_FONT_SIZE || 15,
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  error: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  btn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  fullBtn: { flex: 1 },
  cancelBtn: {
    backgroundColor: '#e9ecef',
    flex: 1,
  },
  cancelText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 14 },
});
