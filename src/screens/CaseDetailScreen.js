import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FormCard, { FormInput, FormLabel } from '../components/FormCard';
import SelectField, { SubmitButton } from '../components/SelectField';
import DateInput from '../components/DateInput';
import AppPressable, { ConfirmButton } from '../components/AppPressable';
import { CasesAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { useAppNavigation } from '../context/NavigationContext';
import { COLORS } from '../theme';
import { formatDateTime } from '../utils/format';
import { showMessage } from '../utils/alert';
import { CASE_CATS, CASE_PRI, CASE_STATUS, priColor } from './CasesScreen';

const DIM = 'rgba(0,0,0,0.58)';

let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

function extensionFromAsset(asset) {
  const mime = String(asset?.mimeType || '').toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

const EVENT_LABEL = {
  created: 'Açıldı',
  comment: 'Güncelleme',
  photo: 'Fotoğraf',
  status: 'Durum',
  assign: 'Atama',
  close: 'Kapatıldı',
  reopen: 'Yeniden açıldı',
};

export default function CaseDetailScreen({ caseId, onClose }) {
  const { openReservation } = useAppNavigation();
  const [busy, setBusy] = useState('');
  const [comment, setComment] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [modal, setModal] = useState(null);

  const loader = useCallback(() => CasesAPI.detail(caseId), [caseId]);
  const { data, loading, error, reload } = useFetch(loader);
  const item = data?.data;
  const lookups = data?.lookups || {};

  const staffOpts = useMemo(
    () => [{ value: 0, label: 'Atanmamış' }, ...(lookups.staff || []).map((s) => ({ value: s.admin_id, label: s.label }))],
    [lookups.staff]
  );

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      await fn();
      if (okMsg) showMessage('Tamam', okMsg);
      await reload();
    } catch (err) {
      showMessage('Hata', err.message || 'İşlem başarısız.');
    } finally {
      setBusy('');
    }
  };

  const pickPhoto = async () => {
    if (!ImagePicker) {
      showMessage('Kurulum', 'Fotoğraf seçici yok.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showMessage('İzin gerekli', 'Galeri izni verilmedi.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    await run('photo', () => CasesAPI.photo(caseId, asset.base64, extensionFromAsset(asset)), 'Fotoğraf eklendi.');
  };

  if (loading && !item) {
    return (
      <View style={styles.container}>
        <Header onClose={onClose} title={`#${caseId}`} />
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.container}>
        <Header onClose={onClose} title={`#${caseId}`} />
        <Text style={styles.error}>{error || 'İş bulunamadı.'}</Text>
      </View>
    );
  }

  const closed = item.status === 'closed';
  const color = item.overdue ? COLORS.danger : priColor(item.priority);

  return (
    <View style={styles.container}>
      <Header onClose={onClose} title={`#${item.case_id}`} loading={Boolean(busy)} />
      <View style={styles.actionBar}>
        {closed ? (
          <AppPressable
            title="Yeniden aç"
            color={COLORS.primary}
            disabled={busy === 'reopen'}
            onPress={() => run('reopen', () => CasesAPI.reopen(caseId), 'İş yeniden açıldı.')}
            style={styles.actionBtn}
          />
        ) : (
          <>
            <AppPressable
              title="Güncelleme ekle"
              color={COLORS.primary}
              onPress={() => setModal('update')}
              style={styles.actionBtn}
            />
            <AppPressable
              title="Sonuçlandır"
              color={COLORS.success}
              onPress={() => setModal('close')}
              style={styles.actionBtn}
            />
          </>
        )}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.kicker, { color }]}>
          {CASE_STATUS[item.status]} · {CASE_PRI.find((p) => p.value === item.priority)?.label}
          {item.overdue ? ' · Gecikmiş' : ''}
        </Text>
        <Text style={styles.title}>{item.title}</Text>
        {item.body ? <Text style={styles.body}>{item.body}</Text> : null}

        <View style={styles.props}>
          {!closed ? (
            <SelectField
              label="Durum"
              value={item.status}
              options={[
                { value: 'open', label: 'Açık' },
                { value: 'followup', label: 'Takipte' },
              ]}
              onChange={(status) => run('status', () => CasesAPI.status(caseId, status))}
            />
          ) : null}
          <SelectField
            label="Kategori"
            value={item.category}
            options={CASE_CATS}
            onChange={(category) => run('upd', () => CasesAPI.update(caseId, { category }))}
          />
          <SelectField
            label="Öncelik"
            value={item.priority}
            options={CASE_PRI}
            onChange={(priority) => run('upd', () => CasesAPI.update(caseId, { priority }))}
          />
          <FormLabel>Son tarih</FormLabel>
          <DateInput
            value={item.due_date || ''}
            onChangeValue={(due_date) => {
              if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) return;
              if (due_date === (item.due_date || '')) return;
              run('upd', () => CasesAPI.update(caseId, { due_date }));
            }}
          />
          <SelectField
            label="Atanan"
            value={item.assignee_admin_id || 0}
            options={staffOpts}
            onChange={(assignee_admin_id) => run('assign', () => CasesAPI.assign(caseId, assignee_admin_id))}
          />
          {item.reservation_id ? (
            <AppPressable
              title={item.reservation_label || `Rezervasyon #${item.reservation_id}`}
              color={COLORS.primary}
              variant="outline"
              onPress={() => openReservation(item.reservation_id)}
            />
          ) : null}
          {item.room_name || item.unit_code ? (
            <Text style={styles.meta}>
              {item.room_name}
              {item.unit_code ? ` · ${item.unit_code}` : ''}
            </Text>
          ) : null}
        </View>

        <Text style={styles.section}>Zaman çizelgesi</Text>
        {(item.events || []).map((ev) => (
          <View key={ev.event_id} style={styles.event}>
            <Text style={styles.eventMeta}>
              {EVENT_LABEL[ev.type] || ev.type} · {ev.admin_label || '—'} · {formatDateTime(ev.created_at)}
            </Text>
            {ev.body ? <Text style={styles.eventBody}>{ev.body}</Text> : null}
            {ev.photo_url ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: ev.photo_url }} style={styles.photo} />
                <ConfirmButton
                  label={busy === `del-${ev.event_id}` ? 'Siliniyor…' : 'Fotoğrafı sil'}
                  confirmLabel="Sil"
                  color={COLORS.danger}
                  disabled={Boolean(busy)}
                  onConfirm={() =>
                    run(`del-${ev.event_id}`, () => CasesAPI.deletePhoto(caseId, ev.event_id), 'Fotoğraf silindi.')
                  }
                  style={styles.photoDelete}
                />
              </View>
            ) : null}
          </View>
        ))}

        {closed && item.close_note ? (
          <FormCard title="Kapanış notu" borderColor={COLORS.textMuted}>
            <Text style={styles.body}>{item.close_note}</Text>
          </FormCard>
        ) : null}
      </ScrollView>

      <Modal
        visible={modal === 'update'}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setModal(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Güncelleme ekle</Text>
            <FormInput
              placeholder="Ne oldu, ne kaldı?"
              value={comment}
              onChangeText={setComment}
              multiline
              style={styles.modalInput}
            />
            <SubmitButton
              title={busy === 'comment' ? '…' : 'Kaydet'}
              disabled={busy === 'comment'}
              onPress={() =>
                run('comment', async () => {
                  await CasesAPI.comment(caseId, comment);
                  setComment('');
                  setModal(null);
                })
              }
            />
            <AppPressable
              title={busy === 'photo' ? 'Yükleniyor…' : 'Fotoğraf ekle'}
              color={COLORS.textSecondary}
              variant="outline"
              disabled={busy === 'photo'}
              onPress={pickPhoto}
              style={{ marginTop: 8 }}
            />
            <AppPressable
              title="Vazgeç"
              color={COLORS.textPrimary}
              variant="outline"
              onPress={() => setModal(null)}
              style={{ marginTop: 8 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={modal === 'close'}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setModal(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sonuçlandır</Text>
            <FormLabel>Kapanış notu (zorunlu)</FormLabel>
            <FormInput
              placeholder="Nasıl sonuçlandı?"
              value={closeNote}
              onChangeText={setCloseNote}
              multiline
              style={styles.modalInput}
            />
            <ConfirmButton
              label="İş sonuçlandı — kapat"
              confirmLabel="Evet, kapat"
              color={COLORS.success}
              disabled={!closeNote.trim() || busy === 'close'}
              onConfirm={() =>
                run('close', async () => {
                  await CasesAPI.close(caseId, closeNote);
                  setCloseNote('');
                  setModal(null);
                }, 'İş kapatıldı.')
              }
              style={{ marginTop: 4 }}
            />
            <AppPressable
              title="Vazgeç"
              color={COLORS.textPrimary}
              variant="outline"
              onPress={() => setModal(null)}
              style={{ marginTop: 10 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Header({ onClose, title, loading = false }) {
  return (
    <View style={styles.header}>
      <AppPressable onPress={onClose} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
      </AppPressable>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>İş takibi</Text>
        <Text style={styles.headerSubtitle}>{title}</Text>
      </View>
      <View style={styles.headerRight}>
        {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 8, width: 40 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  headerRight: { width: 40, alignItems: 'center', justifyContent: 'center' },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionBtn: { flex: 1, minHeight: 42 },
  content: { padding: 16, paddingBottom: 24 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: DIM,
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: {
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
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
  modalInput: { minHeight: 88, textAlignVertical: 'top', marginBottom: 10 },
  kicker: { fontWeight: '700', fontSize: 12, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  body: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 22, marginBottom: 12 },
  props: { marginBottom: 16 },
  meta: { marginTop: 8, color: COLORS.textSecondary },
  section: { fontWeight: '800', marginBottom: 8, color: COLORS.textPrimary },
  event: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
    paddingLeft: 10,
    marginBottom: 12,
  },
  eventMeta: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  eventBody: { fontSize: 14, color: COLORS.textPrimary },
  photo: { width: '100%', height: 180, borderRadius: 8, backgroundColor: COLORS.inputBg },
  photoWrap: { marginTop: 8 },
  photoDelete: { marginTop: 8, alignSelf: 'flex-start' },
  error: { padding: 16, color: COLORS.danger },
});
