import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useReservationFilter } from '../context/ReservationFilterContext';
import { COLORS } from '../theme';

export default function ChannelFilterBar({ hiddenCount = 0 }) {
  const { showChannelReservations, setShowChannelReservations, ready } = useReservationFilter();

  if (!ready) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Kanal Rezervasyonları</Text>
        {!showChannelReservations && hiddenCount > 0 ? (
          <Text style={styles.hint}>{hiddenCount} kayıt gizli — web sitesi görünümü</Text>
        ) : !showChannelReservations ? (
          <Text style={styles.hint}>Kapalıyken yalnızca web sitesi (+ manuel) kayıtları</Text>
        ) : null}
      </View>
      <Switch
        value={showChannelReservations}
        onValueChange={setShowChannelReservations}
        trackColor={{ false: COLORS.border, true: `${COLORS.primary}88` }}
        thumbColor={showChannelReservations ? COLORS.primary : '#f4f3f4'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textWrap: { flex: 1, paddingRight: 12 },
  title: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  hint: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
