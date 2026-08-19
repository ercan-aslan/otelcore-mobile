import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppPressable from '../components/AppPressable';
import { COLORS } from '../theme';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const close = useCallback(() => setDialog(null), []);

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

  const handleConfirm = () => {
    const callback = dialog?.onConfirm;
    close();
    callback?.();
  };

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

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
        <View style={styles.overlay}>
          <AppPressable onPress={close} style={styles.backdrop}>
            <View style={StyleSheet.absoluteFillObject} />
          </AppPressable>
          <View style={styles.card}>
            <Text style={styles.title}>{dialog?.title}</Text>
            {dialog?.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
            <View style={styles.actions}>
              {dialog?.type === 'confirm' ? (
                <AppPressable
                  title={dialog.cancelText}
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
                style={[
                  styles.btn,
                  dialog?.type === 'alert' && styles.fullBtn,
                ]}
              />
            </View>
          </View>
        </View>
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
    ...webOverlay,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 20,
    zIndex: 1,
    elevation: 8,
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
  okBtn: {
    backgroundColor: COLORS.primary,
    flex: 1,
  },
  dangerBtn: {
    backgroundColor: COLORS.danger,
    flex: 1,
  },
  cancelText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 14 },
  okText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
