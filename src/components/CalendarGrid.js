import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { getCalendarReservationColor } from '../utils/format';

export const CELL_W = 52;
export const ROOM_W = 108;
export const ROW_H = 40;
export const DETAIL_ROW_H = 28;

export function calendarRowKey(room) {
  return String(room?.row_key || room?.room_id || '');
}

const DETAIL_ROWS = [
  { key: 'status', label: 'Durum' },
  { key: 'price', label: 'Fiyat (€)' },
  { key: 'avail', label: 'Müsaitlik' },
  { key: 'min', label: 'Min gece' },
  { key: 'max', label: 'Max gece' },
];

function getSelectionRole(rowKey, date, selection) {
  if (!selection?.checkIn || String(selection.rowKey || selection.roomId) !== String(rowKey)) {
    return null;
  }

  const { checkIn, checkOut } = selection;

  if (!checkOut) {
    return date === checkIn ? 'start' : null;
  }

  if (date === checkIn) return 'start';
  if (date === checkOut) return 'end';
  if (date > checkIn && date < checkOut) return 'middle';
  return null;
}

function DayHeader({ day }) {
  const bg = day.is_today ? '#fff3cd' : day.is_past ? '#f8f9fa' : COLORS.surface;
  return (
    <View style={[styles.dayHead, { backgroundColor: bg, width: CELL_W }]}>
      <Text style={styles.dayNum}>{day.day}</Text>
      <Text style={styles.dayMonth}>{day.month_short}</Text>
    </View>
  );
}

function DayCell({
  cell,
  day,
  width,
  onCellPress,
  onReservationPress,
  room,
  rowKey,
  selection,
  rowSelected,
}) {
  const role = getSelectionRole(rowKey, day.date, selection);
  const isOpen = cell?.type === 'open';
  const isPast = day.is_past;
  const resColor =
    cell?.type === 'reservation'
      ? cell.bar_color || getCalendarReservationColor(cell.channel, cell)
      : COLORS.primary;
  const resLabel = cell?.type === 'reservation' ? (cell.label || 'HotelRunner') : cell?.label;

  let bg = day.is_today ? '#fff3cd' : day.is_past ? '#f8f9fa' : COLORS.surface;
  if (role === 'start' || role === 'end') bg = 'rgba(13, 110, 253, 0.38)';
  else if (role === 'middle') bg = 'rgba(13, 110, 253, 0.16)';
  else if (rowSelected && isOpen && !isPast) bg = 'rgba(13, 110, 253, 0.06)';

  const content = (
    <View
      style={[
        styles.cell,
        { width, backgroundColor: bg },
        role && styles.cellSelected,
        role === 'start' && styles.cellStart,
        role === 'end' && styles.cellEnd,
      ]}
    >
      {cell?.type === 'reservation' ? (
        <View style={[styles.resBar, { backgroundColor: resColor }]}>
          <Text style={styles.resText} numberOfLines={1}>
            {resLabel}
          </Text>
        </View>
      ) : cell?.type === 'block' ? (
        <View style={styles.blockBar}>
          <Text style={styles.blockText} numberOfLines={1}>
            {cell.label || 'Kapalı'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={isOpen && !isPast ? styles.priceTextOpen : styles.closedText}>
            {cell?.label || 'Kapalı'}
          </Text>
          {role === 'start' ? <Text style={styles.marker}>Giriş</Text> : null}
          {role === 'end' ? <Text style={styles.marker}>Çıkış</Text> : null}
        </>
      )}
    </View>
  );

  if (cell?.type === 'reservation' && cell.reservation_id && onReservationPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onReservationPress(cell.reservation_id)}
        style={({ pressed }) => [styles.cellPress, { width }, pressed && styles.cellPressed]}
      >
        {content}
      </Pressable>
    );
  }

  const selectable = cell?.type === 'open' && !isPast;

  if (selectable && onCellPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onCellPress(room, day.date, cell)}
        style={({ pressed }) => [styles.cellPress, { width }, pressed && styles.cellPressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.cellDisabled, { width }]}>{content}</View>;
}

function buildRowCells(days, room, grid, onCellPress, onReservationPress, selection) {
  const rowKey = calendarRowKey(room);
  const rowSelected = selection?.rowKey
    ? String(selection.rowKey) === rowKey
    : selection?.roomId && String(selection.roomId) === String(room.room_id);
  const cells = [];
  let d = 0;

  while (d < days.length) {
    const day = days[d];
    const cell = grid[rowKey]?.[day.date] || grid[room.room_id]?.[day.date];
    const colspan = cell?.colspan || 1;
    const isSpan = cell?.type === 'reservation' || cell?.type === 'block';
    const width = isSpan ? CELL_W * colspan : CELL_W;

    cells.push(
      <DayCell
        key={`${rowKey}-${day.date}`}
        cell={cell}
        day={day}
        width={width}
        room={room}
        rowKey={rowKey}
        onCellPress={onCellPress}
        onReservationPress={onReservationPress}
        selection={selection}
        rowSelected={rowSelected}
      />
    );

    d += colspan;
  }

  return cells;
}

function resolveDayState(dayState, room, day, grid) {
  const roomId = room.room_id;
  const rowKey = calendarRowKey(room);
  const rid = String(roomId);
  const fromMap =
    dayState?.[rid]?.[day.date]
    || dayState?.[roomId]?.[day.date]
    || null;
  if (fromMap) {
    return fromMap;
  }

  const cell = grid?.[rowKey]?.[day.date] || grid?.[rid]?.[day.date] || grid?.[roomId]?.[day.date];
  if (!cell || cell.type === 'reservation' || cell.type === 'block') {
    return {
      is_open: false,
      is_stop_sell: true,
      price_eur: cell?.price_eur ?? null,
    };
  }
  const isOpen = cell.type === 'open';
  return {
    is_open: isOpen,
    is_stop_sell: !isOpen,
    price_eur: cell.price_eur ?? null,
  };
}

function DetailValue({ rowKey, room, state }) {
  const roomStock = Math.max(1, Number(room.room_stock) || 1);

  if (rowKey === 'status') {
    return (
      <View style={[styles.badge, state.is_open ? styles.badgeOpen : styles.badgeClosed]}>
        <Text style={styles.badgeText}>{state.is_open ? 'Açık' : 'Kapalı'}</Text>
      </View>
    );
  }
  if (rowKey === 'price') {
    const price = state.price_eur;
    if (price !== null && price !== undefined && price !== '') {
      return <Text style={styles.detailVal}>{`${price}€`}</Text>;
    }
    return <Text style={styles.detailMuted}>—</Text>;
  }
  if (rowKey === 'avail') {
    if (state.is_open) {
      return <Text style={styles.detailVal}>{`${roomStock} Oda`}</Text>;
    }
    return <Text style={styles.detailMuted}>0</Text>;
  }
  if (rowKey === 'min') {
    const v = state.min_nights ?? room.min_nights;
    return <Text style={styles.detailVal}>{v != null && v !== '' ? String(v) : '—'}</Text>;
  }
  if (rowKey === 'max') {
    const v = state.max_nights ?? room.max_nights;
    return <Text style={styles.detailVal}>{v != null && v !== '' ? String(v) : '—'}</Text>;
  }
  return <Text style={styles.detailMuted}>—</Text>;
}

function RoomLabel({ room, expanded, active, onToggle, showChevron }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={showChevron ? onToggle : undefined}
      disabled={!showChevron}
      style={({ pressed }) => [
        styles.roomCol,
        active && styles.roomColActive,
        expanded && styles.roomColExpanded,
        pressed && showChevron && styles.cellPressed,
      ]}
    >
      {showChevron ? (
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={14}
          color={COLORS.textSecondary}
          style={styles.chevron}
        />
      ) : (
        <View style={styles.chevronSpacer} />
      )}
      <Text style={[styles.roomName, active && styles.roomNameActive]} numberOfLines={2}>
        {room.room_name}
      </Text>
    </Pressable>
  );
}

export default function CalendarGrid({
  days = [],
  rooms = [],
  grid = {},
  dayState = {},
  onCellPress,
  onReservationPress,
  selection = null,
}) {
  const [expanded, setExpanded] = useState(() => new Set());
  const totalWidth = Math.max(days.length * CELL_W, CELL_W);

  const toggleRoomType = (room) => {
    const key = String(room.room_id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.hint}>
        Yalnızca müsait (açık) günlere basarak rezervasyon ekleyin. Oda adının yanındaki ok durum, fiyat ve min/max gösterir.
      </Text>
      <View style={styles.table}>
        <View style={styles.fixedCol}>
          <View style={[styles.roomCol, styles.roomColHead]}>
            <Text style={styles.roomHead}>Odalar</Text>
          </View>
          {rooms.map((room, index) => {
            const rid = calendarRowKey(room);
            const firstOfType = index === 0 || Number(rooms[index - 1].room_id) !== Number(room.room_id);
            const lastOfType = index === rooms.length - 1 || Number(rooms[index + 1].room_id) !== Number(room.room_id);
            const isExpanded = expanded.has(String(room.room_id));
            const active = selection?.rowKey
              ? String(selection.rowKey) === rid
              : selection?.roomId && String(selection.roomId) === String(room.room_id);
            return (
              <View key={`label-${rid}`}>
                <RoomLabel
                  room={room}
                  expanded={isExpanded}
                  active={active}
                  showChevron={firstOfType}
                  onToggle={() => toggleRoomType(room)}
                />
                {isExpanded && lastOfType
                  ? DETAIL_ROWS.map((row) => (
                      <View key={`${rid}-${row.key}`} style={styles.detailLabelCol}>
                        <Text style={styles.detailLabel} numberOfLines={1}>
                          {row.label}
                        </Text>
                      </View>
                    ))
                  : null}
              </View>
            );
          })}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          nestedScrollEnabled
          bounces={false}
          style={styles.scrollArea}
          contentContainerStyle={{ width: totalWidth }}
        >
          <View style={{ width: totalWidth }}>
            <View style={styles.dateHeadRow}>
              {days.map((day) => (
                <DayHeader key={day.date} day={day} />
              ))}
            </View>
            {rooms.map((room, index) => {
              const rid = calendarRowKey(room);
              const lastOfType = index === rooms.length - 1 || Number(rooms[index + 1].room_id) !== Number(room.room_id);
              const isExpanded = expanded.has(String(room.room_id));
              return (
                <View key={`row-${rid}`}>
                  <View style={styles.dateRow}>
                    {buildRowCells(days, room, grid, onCellPress, onReservationPress, selection)}
                  </View>
                  {isExpanded && lastOfType
                    ? DETAIL_ROWS.map((row) => (
                        <View key={`${rid}-d-${row.key}`} style={styles.detailDateRow}>
                          {days.map((day) => {
                            const state = resolveDayState(dayState, room, day, grid);
                            const bg = day.is_today
                              ? '#fff3cd'
                              : day.is_past
                                ? '#f8f9fa'
                                : '#fbfcfd';
                            return (
                              <View
                                key={`${rid}-${row.key}-${day.date}`}
                                style={[styles.detailCell, { backgroundColor: bg }]}
                              >
                                <DetailValue rowKey={row.key} room={room} state={state} />
                              </View>
                            );
                          })}
                        </View>
                      ))
                    : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b0bec5',
    marginBottom: 8,
    overflow: 'hidden',
    elevation: 2,
  },
  hint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    lineHeight: 15,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  table: { flexDirection: 'row' },
  fixedCol: {
    width: ROOM_W,
    borderRightWidth: 2,
    borderColor: '#b0bec5',
    backgroundColor: '#f8fafc',
    zIndex: 2,
  },
  scrollArea: { flex: 1 },
  roomCol: {
    height: ROW_H,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#b0bec5',
    backgroundColor: '#f8fafc',
  },
  roomColActive: {
    backgroundColor: 'rgba(13, 110, 253, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  roomColExpanded: {
    backgroundColor: '#eef2f6',
  },
  roomColHead: {
    height: 44,
    borderBottomWidth: 1,
    borderColor: '#b0bec5',
    paddingHorizontal: 8,
  },
  chevron: { marginRight: 2, width: 14 },
  chevronSpacer: { width: 16 },
  roomHead: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  roomName: { flex: 1, fontSize: 11, fontWeight: '700', color: COLORS.textPrimary },
  roomNameActive: { color: COLORS.primary },
  detailLabelCol: {
    height: DETAIL_ROW_H,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dateRow: { flexDirection: 'row', height: ROW_H },
  detailDateRow: { flexDirection: 'row', height: DETAIL_ROW_H },
  dateHeadRow: { flexDirection: 'row', height: 44 },
  dayHead: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#b0bec5',
  },
  dayNum: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 15 },
  dayMonth: { fontSize: 9, color: '#888', lineHeight: 11 },
  cell: {
    height: ROW_H,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#b0bec5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  detailCell: {
    width: CELL_W,
    height: DETAIL_ROW_H,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
  },
  detailVal: { fontSize: 9, fontWeight: '700', color: COLORS.textPrimary },
  detailMuted: { fontSize: 9, color: '#94a3b8' },
  badge: {
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minWidth: 28,
    alignItems: 'center',
  },
  badgeOpen: { backgroundColor: '#198754' },
  badgeClosed: { backgroundColor: '#6c757d' },
  badgeStop: { backgroundColor: '#dc3545' },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  cellSelected: {
    borderColor: COLORS.primary,
  },
  cellStart: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
  },
  cellEnd: {
    borderRightWidth: 2,
    borderRightColor: COLORS.primary,
  },
  marker: {
    fontSize: 7,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 1,
  },
  resBar: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 4,
    paddingHorizontal: 5,
    justifyContent: 'center',
    marginLeft: 2,
    marginRight: 2,
    minHeight: 30,
  },
  resText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  blockBar: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: '#e2e3e5',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#adb5bd',
    borderStyle: 'dashed',
    paddingHorizontal: 5,
    justifyContent: 'center',
    marginLeft: 2,
    marginRight: 2,
    minHeight: 30,
  },
  blockText: { color: '#6c757d', fontSize: 10, fontWeight: '600', fontStyle: 'italic' },
  priceTextOpen: { fontSize: 9, color: COLORS.textPrimary, textAlign: 'center', fontWeight: '600' },
  closedText: { fontSize: 9, color: '#ccc', fontStyle: 'italic', textAlign: 'center' },
  cellDisabled: { opacity: 0.72 },
  cellPress: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
    height: ROW_H,
  },
  cellPressed: {
    opacity: 0.85,
  },
});
