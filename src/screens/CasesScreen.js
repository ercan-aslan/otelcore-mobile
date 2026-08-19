import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PageScaffold from '../components/PageScaffold';
import { FormInput } from '../components/FormCard';
import DateInput from '../components/DateInput';
import SelectField, { SubmitButton } from '../components/SelectField';
import TabPills from '../components/TabPills';
import { CasesAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { useAppNavigation } from '../context/NavigationContext';
import { COLORS } from '../theme';
import { formatDate } from '../utils/format';
import { showMessage } from '../utils/alert';

export const CASE_CATS = [
  { value: 'maintenance', label: 'Bakım' },
  { value: 'complaint', label: 'Şikayet' },
  { value: 'lost_found', label: 'Kayıp eşya' },
  { value: 'room', label: 'Oda' },
  { value: 'payment', label: 'Ödeme takibi' },
  { value: 'other', label: 'Diğer' },
];

export const CASE_PRI = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'urgent', label: 'Acil' },
];

export const CASE_STATUS = {
  open: 'Açık',
  followup: 'Takipte',
  closed: 'Kapandı',
};

const EMPTY_FORM = {
  title: '',
  body: '',
  category: 'other',
  priority: 'normal',
  due_date: '',
  assignee_admin_id: 0,
  reservation_id: 0,
  room_id: 0,
};

export function catLabel(key) {
  return CASE_CATS.find((c) => c.value === key)?.label || 'Diğer';
}

export function priColor(priority) {
  if (priority === 'urgent') return COLORS.danger;
  if (priority === 'high') return '#fd7e14';
  if (priority === 'low') return COLORS.textMuted;
  return COLORS.primary;
}

export default function CasesScreen() {
  const { openCase } = useAppNavigation();
  const [filter, setFilter] = useState('open');
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loader = useCallback(() => CasesAPI.list(filter, true), [filter]);
  const { data, loading, refreshing, error, refresh } = useFetch(loader);
  const items = data?.data || [];
  const counts = data?.counts || {};
  const lookups = data?.lookups || {};

  const tabs = useMemo(
    () => [
      { key: 'open', label: 'Aktif / devam', shortLabel: 'Aktif', count: counts.open ?? 0 },
      { key: 'closed', label: 'Sonuçlanan', shortLabel: 'Sonuçlanan', count: counts.closed ?? 0 },
    ],
    [counts]
  );

  const staffOpts = useMemo(
    () => [{ value: 0, label: 'Atanmamış' }, ...(lookups.staff || []).map((s) => ({ value: s.admin_id, label: s.label }))],
    [lookups.staff]
  );
  const roomOpts = useMemo(
    () => [{ value: 0, label: 'Oda yok' }, ...(lookups.rooms || []).map((r) => ({ value: r.room_id, label: r.room_name }))],
    [lookups.rooms]
  );
  const resOpts = useMemo(
    () => [{ value: 0, label: 'Rezervasyon yok' }, ...(lookups.reservations || []).map((r) => ({ value: r.reservation_id, label: r.label }))],
    [lookups.reservations]
  );

  const create = async () => {
    if (!form.title.trim()) {
      showMessage('Eksik', 'Başlık zorunludur.');
      return;
    }
    setBusy(true);
    try {
      await CasesAPI.create(form);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      if (filter !== 'open') setFilter('open');
      else await refresh();
      showMessage('Tamam', 'İş açıldı.');
    } catch (err) {
      showMessage('Hata', err.message || 'İş açılamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageScaffold
      title="İş takibi"
      subtitle="Unutulmaması gereken işler. Kapanmadan listeden düşmez."
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
      headerExtra={<TabPills tabs={tabs} activeKey={filter} onChange={setFilter} />}
    >
      <View style={styles.drawer}>
        <Pressable
          onPress={() => setFormOpen((open) => !open)}
          style={styles.drawerHead}
          accessibilityRole="button"
          accessibilityState={{ expanded: formOpen }}
        >
          <Text style={styles.drawerTitle}>Yeni iş</Text>
          <Ionicons name={formOpen ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.accent} />
        </Pressable>
        {formOpen ? (
          <View style={styles.drawerBody}>
            <FormInput
              placeholder="Başlık"
              value={form.title}
              onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
            />
            <FormInput
              placeholder="Açıklama"
              value={form.body}
              onChangeText={(body) => setForm((prev) => ({ ...prev, body }))}
              multiline
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
            <SelectField
              label="Kategori"
              value={form.category}
              options={CASE_CATS}
              onChange={(category) => setForm((prev) => ({ ...prev, category }))}
            />
            <SelectField
              label="Öncelik"
              value={form.priority}
              options={CASE_PRI}
              onChange={(priority) => setForm((prev) => ({ ...prev, priority }))}
            />
            <DateInput value={form.due_date} onChangeValue={(due_date) => setForm((prev) => ({ ...prev, due_date }))} />
            <SelectField
              label="Atanan"
              value={form.assignee_admin_id}
              options={staffOpts}
              onChange={(assignee_admin_id) => setForm((prev) => ({ ...prev, assignee_admin_id }))}
            />
            <SelectField
              label="Rezervasyon"
              value={form.reservation_id}
              options={resOpts}
              onChange={(reservation_id) => setForm((prev) => ({ ...prev, reservation_id }))}
            />
            <SelectField
              label="Oda"
              value={form.room_id}
              options={roomOpts}
              onChange={(room_id) => setForm((prev) => ({ ...prev, room_id }))}
            />
            <SubmitButton title={busy ? 'Kaydediliyor…' : 'İş aç'} onPress={create} disabled={busy} />
          </View>
        ) : null}
      </View>

      {items.length === 0 && !loading ? (
        <Text style={styles.empty}>{filter === 'closed' ? 'Sonuçlanan iş yok.' : 'Devam eden iş yok.'}</Text>
      ) : null}

      {items.map((item) => {
        const color = item.overdue ? COLORS.danger : priColor(item.priority);
        return (
          <View key={item.case_id} style={[styles.row, { borderLeftColor: color }]}>
            <Pressable onPress={() => openCase(item.case_id)}>
              <View style={styles.rowTop}>
                <Text style={styles.id}>#{item.case_id}</Text>
                <Text style={styles.status}>{CASE_STATUS[item.status] || item.status}</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {catLabel(item.category)}
                {' · '}
                {CASE_PRI.find((p) => p.value === item.priority)?.label || item.priority}
                {item.due_date ? ` · ${formatDate(item.due_date)}` : ''}
                {item.overdue ? ' · Gecikmiş' : ''}
                {item.assignee_label ? ` · ${item.assignee_label}` : ' · Atanmamış'}
                {item.room_name ? ` · ${item.room_name}` : ''}
                {item.unit_code ? ` ${item.unit_code}` : ''}
              </Text>
            </Pressable>
            <SubmitButton title="Detay Aç" onPress={() => openCase(item.case_id)} />
          </View>
        );
      })}
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    overflow: 'hidden',
  },
  drawerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  drawerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.accent },
  drawerBody: { paddingHorizontal: 14, paddingBottom: 14 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 16 },
  row: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  id: { fontWeight: '800', color: COLORS.textSecondary, fontSize: 12 },
  status: { fontWeight: '700', fontSize: 12, color: COLORS.primary },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  meta: { marginTop: 4, fontSize: 12, color: COLORS.textSecondary },
});
