import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import AppPressable from './AppPressable';
import { COLORS } from '../theme';
import { showConfirm } from '../utils/alert';

export default function AppHeader({ admin, onLogout, branding }) {
  const fullName = String(admin?.admin_adsoyad || '').trim();
  const firstName = fullName ? fullName.split(/\s+/)[0] : '';
  const displayName = firstName || String(admin?.admin_kadi || '').trim() || 'Admin';
  const logoUrl = String(branding?.logo_url || '').trim();

  const handleLogout = () => {
    showConfirm(
      'Çıkış Yap',
      'Oturumunuzu kapatmak istediğinize emin misiniz?',
      onLogout,
      { confirmText: 'Çıkış', destructive: true }
    );
  };

  return (
    <View style={styles.headerBar}>
      <View style={styles.logoWrap}>
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={branding?.site_name || 'Otel logosu'}
          />
        ) : (
          <View style={styles.logoPlaceholder} />
        )}
      </View>
      <View style={styles.userRow}>
        <Text style={styles.userName} numberOfLines={2}>
          👤 {displayName}
        </Text>
        <AppPressable
          title="Çıkış"
          color={COLORS.danger}
          onPress={handleLogout}
          style={styles.logoutBtn}
          textStyle={styles.logoutText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 10,
  },
  logoWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 36,
    maxWidth: '100%',
  },
  logoPlaceholder: {
    width: 1,
    height: 36,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 8,
    maxWidth: '52%',
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
  logoutBtn: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  logoutText: {
    fontSize: 12,
  },
});
