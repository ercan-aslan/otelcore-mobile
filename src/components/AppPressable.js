import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

function WebClickable({ disabled, onPress, style, children }) {
  const handlePress = (event) => {
    if (disabled || !onPress) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onPress(event);
  };

  if (Platform.OS === 'web') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.webBtn,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
          style,
        ]}
        // RN Web: explicit click handler improves reliability inside ScrollView
        onClick={handlePress}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.nativeBtn,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export default function AppPressable({
  title,
  children,
  color = COLORS.primary,
  textColor = '#fff',
  loading,
  disabled,
  onPress,
  style,
  textStyle,
  variant = 'solid',
}) {
  const isDisabled = disabled || loading;

  return (
    <WebClickable
      disabled={isDisabled || !onPress}
      onPress={onPress}
      style={[
        variant === 'outline' && {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: color,
        },
        variant === 'solid' && { backgroundColor: color },
        style,
      ]}
    >
      {loading ? (
        <Text style={[styles.text, { color: variant === 'outline' ? color : textColor }, textStyle]}>
          ...
        </Text>
      ) : children ? (
        <View pointerEvents="none">{children}</View>
      ) : (
        <Text
          pointerEvents="none"
          style={[
            styles.text,
            { color: variant === 'outline' ? color : textColor },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </WebClickable>
  );
}

/** Silme: 1. tık → Evet/Vazgeç satırı (modal yok, web'de garanti çalışır) */
export function ConfirmButton({
  label,
  confirmLabel = 'Evet',
  cancelLabel = 'Vazgeç',
  onConfirm,
  color = COLORS.primary,
  variant = 'outline',
  disabled,
  busy,
  style,
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <View style={[styles.confirmRow, style]}>
        <AppPressable
          title={confirmLabel}
          color={color}
          disabled={disabled || busy}
          onPress={() => {
            setOpen(false);
            onConfirm?.();
          }}
          style={styles.confirmYes}
        />
        <AppPressable
          title={cancelLabel}
          color={COLORS.textSecondary}
          variant="outline"
          onPress={() => setOpen(false)}
          style={styles.confirmNo}
        />
      </View>
    );
  }

  return (
    <AppPressable
      title={label}
      color={color}
      variant={variant}
      disabled={disabled || busy}
      onPress={() => setOpen(true)}
      style={style}
    />
  );
}

export function DeleteButton({ label = 'Sil', onConfirm, disabled, busy, style }) {
  return (
    <ConfirmButton
      label={label}
      confirmLabel="Evet, sil"
      cancelLabel="Vazgeç"
      onConfirm={onConfirm}
      color={COLORS.danger}
      disabled={disabled}
      busy={busy}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  webBtn: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  nativeBtn: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flex: 1,
  },
  confirmYes: { minHeight: 38, paddingHorizontal: 10 },
  confirmNo: { minHeight: 38, paddingHorizontal: 10 },
});
