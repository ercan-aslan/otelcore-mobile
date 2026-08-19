import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateInput from './DateInput';
import { FormInput, FormLabel } from './FormCard';
import { SubmitButton } from './SelectField';
import AppPressable from './AppPressable';
import { COLORS } from '../theme';
import { addDaysIso } from '../utils/format';
import { showMessage } from '../utils/alert';

const emptyToggles = {
  update_availability: false,
  update_stop_sell: false,
  update_open_sale: false,
  update_price: false,
  update_min_nights: false,
  update_max_nights: false,
};

function buildEmptyRoomRows(rooms) {
  const rows = {};
  for (const room of rooms || []) {
    const id = Number(room.room_id);
    if (!id) continue;
    rows[id] = {
      selected: false,
      avail_qty: '',
      status: '',
      price: '',
      min_nights: '',
      max_nights: '',
    };
  }
  return rows;
}

function StatusPicker({ value, disabled, onChange }) {
  const options = [
    { value: '', label: '—' },
    { value: 'open', label: 'Aç' },
    { value: 'closed', label: 'Kapat' },
  ];

  return (
    <View style={[styles.statusRow, disabled && styles.fieldDisabled]}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value || 'none'}
            disabled={disabled}
            style={[styles.statusChip, active && styles.statusChipActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function BulkUpdateModal({
  visible,
  onClose,
  rooms = [],
  startDateHint,
  loading,
  onSubmit,
}) {
  const insets = useSafeAreaInsets();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [toggles, setToggles] = useState(emptyToggles);
  const [roomRows, setRoomRows] = useState({});

  useEffect(() => {
    if (!visible) return;
    const start = startDateHint || new Date().toISOString().slice(0, 10);
    setStartDate(start);
    setEndDate(addDaysIso(start, 6));
    setToggles({ ...emptyToggles });
    setRoomRows(buildEmptyRoomRows(rooms));
  }, [visible, startDateHint, rooms]);

  const roomIds = useMemo(
    () => rooms.map((r) => Number(r.room_id)).filter(Boolean),
    [rooms]
  );

  const allSelected = roomIds.length > 0 && roomIds.every((id) => roomRows[id]?.selected);

  const setToggle = (key, value) => {
    setToggles((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'update_open_sale' && value) next.update_stop_sell = false;
      if (key === 'update_stop_sell' && value) next.update_open_sale = false;
      return next;
    });

    if ((key === 'update_stop_sell' || key === 'update_open_sale') && value) {
      const statusVal = key === 'update_stop_sell' ? 'closed' : 'open';
      setRoomRows((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          next[id] = { ...next[id], status: statusVal };
        }
        return next;
      });
    }
  };

  const toggleAllRooms = (checked) => {
    setRoomRows((prev) => {
      const next = { ...prev };
      for (const id of roomIds) {
        if (next[id]) next[id] = { ...next[id], selected: checked };
      }
      return next;
    });
  };

  const updateRoom = (roomId, patch) => {
    setRoomRows((prev) => ({
      ...prev,
      [roomId]: { ...prev[roomId], ...patch },
    }));
  };

  const availEnabled = toggles.update_availability;
  const statusEnabled = toggles.update_open_sale || toggles.update_stop_sell;
  const priceEnabled = toggles.update_price;
  const minEnabled = toggles.update_min_nights;
  const maxEnabled = toggles.update_max_nights;
  const hasUpdate = Object.values(toggles).some(Boolean);

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      showMessage('Eksik alan', 'Başlangıç ve bitiş tarihi zorunludur.');
      return;
    }
    if (startDate > endDate) {
      showMessage('Hatalı tarih', 'Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }

    const selectedIds = roomIds.filter((id) => roomRows[id]?.selected);
    if (!selectedIds.length) {
      showMessage('Eksik alan', 'En az bir oda seçin.');
      return;
    }
    if (!hasUpdate) {
      showMessage('Eksik alan', 'En az bir güncelleme seçeneği işaretleyin.');
      return;
    }

    const room_avail_qty = {};
    const room_status = {};
    const room_prices = {};
    const room_min_nights = {};
    const room_max_nights = {};

    for (const id of selectedIds) {
      const row = roomRows[id];
      if (availEnabled && row.avail_qty !== '') {
        room_avail_qty[id] = row.avail_qty;
      }
      if (statusEnabled && row.status) {
        room_status[id] = row.status;
      }
      if (priceEnabled && row.price !== '') {
        room_prices[id] = row.price;
      }
      if (minEnabled && row.min_nights !== '') {
        room_min_nights[id] = row.min_nights;
      }
      if (maxEnabled && row.max_nights !== '') {
        room_max_nights[id] = row.max_nights;
      }
    }

    onSubmit({
      start_date: startDate,
      end_date: endDate,
      room_ids: selectedIds,
      update_availability: availEnabled ? 1 : 0,
      update_open_sale: toggles.update_open_sale ? 1 : 0,
      update_stop_sell: toggles.update_stop_sell ? 1 : 0,
      update_price: priceEnabled ? 1 : 0,
      update_min_nights: minEnabled ? 1 : 0,
      update_max_nights: maxEnabled ? 1 : 0,
      room_avail_qty,
      room_status,
      room_prices,
      room_min_nights,
      room_max_nights,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerIcon}>📦</Text>
            <Text style={styles.headerTitle}>Toplu Güncelleme</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={COLORS.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Tarih aralığı</Text>
          <View style={styles.row2}>
            <View style={styles.half}>
              <FormLabel>Başlangıç</FormLabel>
              <DateInput value={startDate} onChangeValue={setStartDate} />
            </View>
            <View style={styles.half}>
              <FormLabel>Bitiş</FormLabel>
              <DateInput value={endDate} onChangeValue={setEndDate} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Güncellenecek alanlar</Text>
          <View style={styles.toggleCard}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Müsaitlik (stok)</Text>
              <Switch
                value={toggles.update_availability}
                onValueChange={(v) => setToggle('update_availability', v)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: COLORS.danger }]}>Satışa kapat</Text>
              <Switch
                value={toggles.update_stop_sell}
                onValueChange={(v) => setToggle('update_stop_sell', v)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: COLORS.success }]}>Satışa aç</Text>
              <Switch
                value={toggles.update_open_sale}
                onValueChange={(v) => setToggle('update_open_sale', v)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Fiyat (€)</Text>
              <Switch
                value={toggles.update_price}
                onValueChange={(v) => setToggle('update_price', v)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Min konaklama</Text>
              <Switch
                value={toggles.update_min_nights}
                onValueChange={(v) => setToggle('update_min_nights', v)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Max konaklama</Text>
              <Switch
                value={toggles.update_max_nights}
                onValueChange={(v) => setToggle('update_max_nights', v)}
              />
            </View>
          </View>

          <View style={styles.roomHeader}>
            <Text style={styles.sectionTitle}>Odalar ve değerler</Text>
            <Pressable onPress={() => toggleAllRooms(!allSelected)} style={styles.selectAllBtn}>
              <Text style={styles.selectAllText}>{allSelected ? '☑ Tümü' : '☐ Tümü'}</Text>
            </Pressable>
          </View>

          {rooms.map((room) => {
            const id = Number(room.room_id);
            const row = roomRows[id];
            if (!row) return null;

            return (
              <View
                key={`bulk-room-${id}`}
                style={[styles.roomCard, row.selected && styles.roomCardActive]}
              >
                <Pressable
                  style={styles.roomTitleRow}
                  onPress={() => updateRoom(id, { selected: !row.selected })}
                >
                  <Text style={styles.roomCheck}>{row.selected ? '☑' : '☐'}</Text>
                  <Text style={styles.roomName}>{room.room_name}</Text>
                </Pressable>

                {availEnabled ? (
                  <View style={styles.fieldBlock}>
                    <FormLabel>Stok</FormLabel>
                    <FormInput
                      placeholder="Örn: 3"
                      keyboardType="number-pad"
                      value={row.avail_qty}
                      onChangeText={(v) => updateRoom(id, { avail_qty: v })}
                    />
                  </View>
                ) : null}

                {statusEnabled ? (
                  <View style={styles.fieldBlock}>
                    <FormLabel>Satış durumu</FormLabel>
                    <StatusPicker
                      value={row.status}
                      disabled={!statusEnabled}
                      onChange={(v) => updateRoom(id, { status: v })}
                    />
                  </View>
                ) : null}

                {priceEnabled ? (
                  <View style={styles.fieldBlock}>
                    <FormLabel>Fiyat (€)</FormLabel>
                    <FormInput
                      placeholder="Fiyat"
                      keyboardType="decimal-pad"
                      value={row.price}
                      onChangeText={(v) => updateRoom(id, { price: v })}
                    />
                  </View>
                ) : null}

                {minEnabled || maxEnabled ? (
                  <View style={styles.row2}>
                    {minEnabled ? (
                      <View style={styles.half}>
                        <FormLabel>Min gece</FormLabel>
                        <FormInput
                          placeholder="Min"
                          keyboardType="number-pad"
                          value={row.min_nights}
                          onChangeText={(v) => updateRoom(id, { min_nights: v })}
                        />
                      </View>
                    ) : null}
                    {maxEnabled ? (
                      <View style={[styles.half, !minEnabled && { flex: 1 }]}>
                        <FormLabel>Max gece</FormLabel>
                        <FormInput
                          placeholder="Max"
                          keyboardType="number-pad"
                          value={row.max_nights}
                          onChangeText={(v) => updateRoom(id, { max_nights: v })}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <AppPressable color={COLORS.textSecondary} onPress={onClose} style={styles.footerBtn}>
            <Text style={styles.footerBtnText}>Vazgeç</Text>
          </AppPressable>
          <SubmitButton
            title="Güncelle"
            color={COLORS.primary}
            loading={loading}
            onPress={handleSubmit}
            style={styles.footerSubmit}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 18 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  closeBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  row2: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  toggleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  switchLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, flex: 1, paddingRight: 8 },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  selectAllText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  roomCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  roomCardActive: { borderColor: COLORS.warning, backgroundColor: '#fffdf5' },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  roomCheck: { fontSize: 16, marginRight: 8 },
  roomName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  fieldBlock: { marginBottom: 6 },
  fieldDisabled: { opacity: 0.45 },
  statusRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  statusChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
  },
  statusChipActive: { borderColor: COLORS.primary, backgroundColor: '#eef4ff' },
  statusChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  statusChipTextActive: { color: COLORS.primary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  footerBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  footerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footerSubmit: { flex: 1, marginTop: 0 },
});
