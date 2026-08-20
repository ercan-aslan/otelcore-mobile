import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PageScaffold from '../components/PageScaffold';
import CalendarGrid, { calendarRowKey } from '../components/CalendarGrid';
import { FormInput, FormLabel } from '../components/FormCard';
import DateInput from '../components/DateInput';
import SelectField, { SubmitButton } from '../components/SelectField';
import { CalendarAPI, fetchReservationMetaForGrid, RoomsAPI } from '../api';
import { useAppNavigation } from '../context/NavigationContext';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { showMessage } from '../utils/alert';
import ActionFeedback from '../components/ActionFeedback';
import { addDaysIso, enrichCalendarGrid, formatDate, nightsBetweenIso, overlayPendingHoldsOnGrid } from '../utils/format';
import { subscribeCalendarRefresh, registerCalendarReload } from '../utils/calendarRefresh';
import { syncCalendarBaselineFromResponse, STORAGE_CALENDAR_START_KEY } from '../services/reservationWatcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CalendarSummaryScreen from './CalendarSummaryScreen';
import BulkUpdateModal from '../components/BulkUpdateModal';

function StatBox({ label, value, bg, onPress, textDark = false }) {
  const content = (
    <>
      <Text style={[styles.statLabel, textDark && styles.statLabelDark]}>{label}</Text>
      <Text style={[styles.statValue, textDark && styles.statValueDark]}>{value}</Text>
    </>
  );

  if (!onPress) {
    return <View style={[styles.statBox, { backgroundColor: bg }]}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={[styles.statBox, { backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.85}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
    >
      {content}
    </TouchableOpacity>
  );
}

const emptyRes = { room_id: '', assigned_unit_id: '', row_key: '', check_in: '', check_out: '', guest_name: '', total_price: '' };

function findReservationSnapshot(grid, rooms, reservationId) {
  const targetId = Number(reservationId);
  if (!targetId) return null;

  for (const room of rooms || []) {
    const rowKey = room.row_key || room.room_id;
    const roomId = Number(room.room_id);
    const row = grid?.[rowKey] || grid?.[roomId] || {};
    for (const cell of Object.values(row)) {
      if (cell?.type === 'reservation' && Number(cell.reservation_id) === targetId) {
        return {
          reservation_id: targetId,
          guest_name: cell.guest_name || cell.label,
          channel: cell.channel,
          room_id: roomId,
          room_name: room.room_name,
          check_in: cell.check_in || '',
          check_out: cell.check_out || '',
          status: cell.status || 'confirmed',
          total_price: Number(cell.total_price || 0),
          note: cell.note || '',
        };
      }
    }
  }
  return null;
}

export default function CalendarScreen({ isFocused = true }) {
  const { openReservation, navigateTo } = useAppNavigation();
  const [startDate, setStartDate] = useState(null);
  const [resForm, setResForm] = useState(emptyRes);
  const [quickOpen, setQuickOpen] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState({ message: '', type: 'info' });
  const [fallbackRooms, setFallbackRooms] = useState([]);
  const [summaryTab, setSummaryTab] = useState(null);

  useEffect(() => {
    if (isFocused) return;
    setBulkModalVisible(false);
    setQuickOpen(false);
    setSummaryTab(null);
  }, [isFocused]);

  const loader = useCallback(async () => {
    const calRes = await CalendarAPI.get(startDate || undefined);
    const cal = calRes.data || calRes;
    const meta = await fetchReservationMetaForGrid(cal?.grid || {}, cal?.reservation_meta);
    const overlaid = overlayPendingHoldsOnGrid(cal?.grid || {}, cal?.reservation_meta || meta, cal?.days || []);
    const grid = enrichCalendarGrid(overlaid, meta);
    await syncCalendarBaselineFromResponse({
      ...cal,
      grid: cal?.grid || {},
      reservation_meta: cal?.reservation_meta || meta,
      calendar_revision: cal?.calendar_revision,
    });
    await AsyncStorage.setItem(STORAGE_CALENDAR_START_KEY, cal?.start_date || startDate || '');
    return {
      ...cal,
      grid,
    };
  }, [startDate]);

  const { data: cal, loading, refreshing, error, refresh, reloadQuiet } = useFetch(loader);
  const stats = cal?.stats || {};
  const cokluCount = stats.coklu_rezervasyon ?? stats.conflicts ?? 0;
  const todayNew = stats.today_new_reservations ?? 0;
  const rooms = cal?.rooms?.length ? cal.rooms : fallbackRooms;
  const displayGrid = cal?.grid || {};

  useEffect(() => {
    const unregister = registerCalendarReload(() => reloadQuiet());
    const unsubscribe = subscribeCalendarRefresh(() => reloadQuiet());
    return () => {
      unregister();
      unsubscribe();
    };
  }, [reloadQuiet]);

  useEffect(() => {
    if (cal?.rooms?.length || fallbackRooms.length) return;
    RoomsAPI.list()
      .then((res) => {
        const list = res?.data || res?.rooms || [];
        if (Array.isArray(list) && list.length) {
          setFallbackRooms(list);
        }
      })
      .catch(() => {});
  }, [cal?.rooms, fallbackRooms.length]);

  const bulkRooms = useMemo(() => {
    const seen = new Set();
    const out = [];
    rooms.forEach((r) => {
      const id = Number(r.room_id);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({ ...r, room_name: r.type_name || r.room_name });
    });
    return out;
  }, [rooms]);

  const roomOptions = useMemo(
    () => rooms.map((r) => ({ value: calendarRowKey(r), label: r.room_name, room: r })),
    [rooms]
  );

  const runAction = async (key, payload, onSuccess) => {
    setBusy(key);
    setFeedback({ message: '', type: 'info' });
    try {
      await CalendarAPI.action(payload);
      setFeedback({ message: 'İşlem kaydedildi.', type: 'success' });
      showMessage('Başarılı', 'İşlem kaydedildi.');
      onSuccess?.();
      refresh();
    } catch (err) {
      const msg = err.message || 'İşlem başarısız.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Hata', msg);
    } finally {
      setBusy('');
    }
  };

  const onSync = async () => {
    setBusy('sync');
    setFeedback({ message: '', type: 'info' });
    try {
      await CalendarAPI.action({ action: 'sync' });
      refresh();
    } catch (err) {
      const msg = err.message || 'Senkronizasyon başarısız.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Hata', msg);
    } finally {
      setBusy('');
    }
  };

  const isRangeAvailable = (rowKey, checkIn, checkOut) => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return true;
    const key = String(rowKey);
    const grid = displayGrid || {};
    let cursor = checkIn;
    while (cursor < checkOut) {
      const cell = grid[key]?.[cursor];
      if (!cell || cell.type !== 'open') return false;
      cursor = addDaysIso(cursor, 1);
    }
    return true;
  };

  const onSaveReservation = () => {
    if (!resForm.room_id || !resForm.check_in || !resForm.check_out || !resForm.guest_name) {
      const msg = 'Oda, tarihler (GG/AA/YYYY) ve misafir adı zorunludur.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Eksik alan', msg);
      return;
    }
    const rangeKey = resForm.row_key || resForm.room_id;
    if (!isRangeAvailable(rangeKey, resForm.check_in, resForm.check_out)) {
      const msg = 'Seçilen tarihler arasında dolu veya kapalı gün var.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Müsait değil', msg);
      return;
    }
    runAction(
      'res',
      {
        action: 'create_manual_reservation',
        room_id: Number(resForm.room_id),
        assigned_unit_id: Number(resForm.assigned_unit_id || 0),
        check_in: resForm.check_in,
        check_out: resForm.check_out,
        guest_name: resForm.guest_name,
        total_price: Number(resForm.total_price || 0),
      },
      () => {
        setResForm(emptyRes);
        setQuickOpen(false);
      }
    );
  };

  const onSaveBulk = (payload) => {
    runAction(
      'bulk',
      { action: 'bulk_update', ...payload },
      () => setBulkModalVisible(false)
    );
  };

  const onCellPress = (room, date, cell) => {
    if (cell?.type !== 'open') return;
    const roomId = room?.room_id ?? room;
    const rowKey = calendarRowKey(typeof room === 'object' ? room : { room_id: roomId });
    const unitId = Number(room?.unit_id || 0);
    const checkOut = addDaysIso(date, 1);
    const dayPrice = Number(cal?.day_state?.[roomId]?.[date]?.price_eur || 0);
    setResForm({
      ...emptyRes,
      room_id: roomId,
      row_key: rowKey,
      assigned_unit_id: unitId || '',
      check_in: date,
      check_out: checkOut,
      total_price: dayPrice > 0 ? String(dayPrice) : '',
    });
    setQuickOpen(true);
  };

  useEffect(() => {
    if (!quickOpen || !resForm.room_id || !resForm.check_in || !resForm.check_out) return;
    if (resForm.check_out <= resForm.check_in) return;
    let sum = 0;
    let cursor = resForm.check_in;
    while (cursor < resForm.check_out) {
      const price = Number(cal?.day_state?.[resForm.room_id]?.[cursor]?.price_eur || 0);
      if (price > 0) sum += price;
      cursor = addDaysIso(cursor, 1);
    }
    setResForm((prev) => {
      const next = sum > 0 ? String(sum) : prev.total_price;
      if (next === prev.total_price) return prev;
      return { ...prev, total_price: next };
    });
  }, [quickOpen, resForm.room_id, resForm.check_in, resForm.check_out, cal?.day_state]);

  const calendarSelection = {
    roomId: resForm.room_id,
    rowKey: resForm.row_key,
    checkIn: resForm.check_in,
    checkOut: resForm.check_out,
  };

  const goPrev = () => setStartDate(cal?.prev_date || null);
  const goNext = () => setStartDate(cal?.next_date || null);
  const goToday = () => setStartDate(null);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screenRoot}>
    <PageScaffold loading={loading} refreshing={refreshing} error={error} onRefresh={refresh}>
      <ActionFeedback
        message={feedback.message}
        type={feedback.type}
        onClear={() => setFeedback({ message: '', type: 'info' })}
      />
      <View style={styles.statsRow}>
        <StatBox
          label="GİRİŞ"
          value={String(stats.today_checkins ?? 0)}
          bg={COLORS.success}
          onPress={() => setSummaryTab('giris')}
        />
        <StatBox
          label="ÇIKIŞ"
          value={String(stats.today_checkouts ?? 0)}
          bg={COLORS.info}
          onPress={() => setSummaryTab('cikis')}
        />
        <StatBox
          label="BUGÜN GELEN"
          value={String(todayNew)}
          bg="#ffc107"
          textDark
          onPress={() => setSummaryTab('yeni')}
        />
        <StatBox
          label="ODA EKLENMEMİŞ"
          value={(stats.unassigned ?? 0) > 0 ? String(stats.unassigned) : 'Yok'}
          bg={(stats.unassigned ?? 0) > 0 ? '#fd7e14' : COLORS.textSecondary}
          onPress={() => setSummaryTab('atanmamis')}
        />
        <StatBox
          label="KRİTİK STOK"
          value={(stats.critical_stock ?? 0) > 0 ? String(stats.critical_stock) : 'Yok'}
          bg={(stats.critical_stock ?? 0) > 0 ? COLORS.danger : COLORS.textSecondary}
          onPress={() => navigateTo('inventory')}
        />
        <StatBox
          label="ÇOKLU REZ."
          value={cokluCount > 0 ? String(cokluCount) : 'Yok'}
          bg={cokluCount > 0 ? COLORS.danger : COLORS.success}
          onPress={() => setSummaryTab('coklu')}
        />
      </View>

      <View style={styles.syncBar}>
        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnFill]}
          onPress={goPrev}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.syncCenter}>
          {!cal?.is_today_view ? (
            <TouchableOpacity onPress={goToday} style={styles.todayBadge} activeOpacity={0.85}>
              <Text style={styles.todayBadgeText}>Bugüne Dön</Text>
            </TouchableOpacity>
          ) : null}
          {cal?.ical_configured ? (
            <Text style={styles.syncLabel}>
              Son Senkron: <Text style={styles.syncValue}>{cal?.last_sync || '—'}</Text>
            </Text>
          ) : null}
          <View style={styles.syncActions}>
            {cal?.ical_configured ? (
              <TouchableOpacity
                style={[styles.syncBtn, busy === 'sync' && styles.btnDisabled]}
                onPress={onSync}
                disabled={busy === 'sync'}
                activeOpacity={0.85}
              >
                <View style={styles.syncBtnInner}>
                  <Ionicons name="refresh" size={13} color="#fff" />
                  <Text style={styles.syncBtnText}>
                    {busy === 'sync' ? ' Senkronize...' : ' iCal senkronize et'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.bulkBtn}
              onPress={() => setBulkModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.bulkBtnText}>📦 Toplu Güncelle</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnFill]}
          onPress={goNext}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <CalendarGrid
        days={cal?.days || []}
        rooms={rooms}
        grid={displayGrid}
        dayState={cal?.day_state || {}}
        onCellPress={onCellPress}
        onReservationPress={(id) =>
          openReservation(id, findReservationSnapshot(displayGrid, rooms, id))
        }
        selection={calendarSelection}
      />

    </PageScaffold>

    {isFocused ? (
      <>
    <BulkUpdateModal
      visible={bulkModalVisible}
      onClose={() => setBulkModalVisible(false)}
      rooms={bulkRooms}
      startDateHint={cal?.start_date}
      loading={busy === 'bulk'}
      onSubmit={onSaveBulk}
    />

    <Modal
      visible={quickOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setQuickOpen(false)}
    >
      <KeyboardAvoidingView
        style={styles.quickWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.quickBackdrop} onPress={() => setQuickOpen(false)} />
        <View style={[styles.quickSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.quickHeader}>
            <Text style={styles.quickTitle}>Hızlı rezervasyon</Text>
            <Pressable onPress={() => setQuickOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <SelectField
              placeholder="Oda Seçin..."
              value={resForm.row_key || resForm.room_id}
              options={roomOptions}
              onChange={(v) => {
                const opt = roomOptions.find((r) => String(r.value) === String(v));
                const room = opt?.room;
                setResForm((p) => ({
                  ...p,
                  row_key: v,
                  room_id: room?.room_id ?? v,
                  assigned_unit_id: room?.unit_id || '',
                }));
              }}
            />
            <View style={styles.row2}>
              <View style={styles.half}>
                <FormLabel>Giriş</FormLabel>
                <DateInput
                  value={resForm.check_in}
                  onChangeValue={(v) => setResForm((p) => ({ ...p, check_in: v }))}
                />
              </View>
              <View style={styles.half}>
                <FormLabel>Çıkış</FormLabel>
                <DateInput
                  value={resForm.check_out}
                  onChangeValue={(v) => setResForm((p) => ({ ...p, check_out: v }))}
                />
              </View>
            </View>
            <FormInput
              placeholder="Misafir adı"
              value={resForm.guest_name}
              onChangeText={(v) => setResForm((p) => ({ ...p, guest_name: v }))}
            />
            <FormInput
              placeholder="Tutar"
              keyboardType="decimal-pad"
              value={resForm.total_price}
              onChangeText={(v) => setResForm((p) => ({ ...p, total_price: v }))}
            />
            {resForm.check_in && resForm.check_out ? (
              <Text style={styles.quickNights}>
                {formatDate(resForm.check_in)} → {formatDate(resForm.check_out)}
                {` · ${nightsBetweenIso(resForm.check_in, resForm.check_out)} gece`}
              </Text>
            ) : null}
            <SubmitButton
              title="Kaydet"
              color={COLORS.primary}
              loading={busy === 'res'}
              onPress={onSaveReservation}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal
      visible={!!summaryTab}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setSummaryTab(null)}
    >
      <View style={[styles.summaryModal, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {summaryTab ? (
          <CalendarSummaryScreen
            key={summaryTab}
            initialTab={summaryTab}
            onClose={() => setSummaryTab(null)}
            onOpenReservation={(id, snapshot) => {
              setSummaryTab(null);
              openReservation(id, snapshot);
            }}
          />
        ) : null}
      </View>
    </Modal>
      </>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  summaryModal: { flex: 1, backgroundColor: COLORS.background },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    width: '32%',
    minHeight: 62,
    marginBottom: 8,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  statLabel: { fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  statLabelDark: { color: 'rgba(0,0,0,0.65)' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 2, lineHeight: 20 },
  statValueDark: { color: '#212529' },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  navBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textSecondary,
  },
  navBtnFill: {
    backgroundColor: COLORS.textSecondary,
  },
  syncCenter: { flex: 1, alignItems: 'center' },
  todayBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  todayBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  syncLabel: { fontSize: 11, color: COLORS.textSecondary },
  syncValue: { color: COLORS.textPrimary, fontWeight: '700' },
  syncActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  syncBtn: {
    minHeight: 32,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
  },
  bulkBtn: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: COLORS.warning,
  },
  bulkBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  syncBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  quickWrap: { flex: 1, justifyContent: 'flex-end' },
  quickBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' },
  quickSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 0,
    maxHeight: '88%',
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginBottom: 12,
  },
  quickTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  quickNights: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10, fontWeight: '600' },
});
