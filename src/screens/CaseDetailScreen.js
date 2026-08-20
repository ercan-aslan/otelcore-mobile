import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
import { formatDate, formatDateTime } from '../utils/format';
import { showMessage } from '../utils/alert';
import { CASE_CATS, CASE_PRI, CASE_STATUS, priColor } from './CasesScreen';

const DIM = 'rgba(0,0,0,0.58)';

let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

let FileSystem = null;
try {
  FileSystem = require('expo-file-system');
} catch {
  FileSystem = null;
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
  status: 'Durum değişti',
  assign: 'Atandı',
  close: 'Kapatıldı',
  reopen: 'Yeniden açıldı',
};

const EVENT_ICON = {
  created: 'add-circle-outline',
  comment: 'chatbubble-outline',
  photo: 'image-outline',
  status: 'swap-horizontal-outline',
  assign: 'person-outline',
  close: 'checkmark-circle-outline',
  reopen: 'refresh-outline',
};

async function shareOrDownloadPhoto(url) {
  const src = String(url || '').trim();
  if (!src) return;
  try {
    if (FileSystem?.cacheDirectory && FileSystem?.downloadAsync) {
      const ext = src.includes('.png') ? 'png' : 'jpg';
      const dest = `${FileSystem.cacheDirectory}case-photo-${Date.now()}.${ext}`;
      const downloaded = await FileSystem.downloadAsync(src, dest);
      await Share.share(
        Platform.OS === 'ios'
          ? { url: downloaded.uri }
          : { message: downloaded.uri, url: downloaded.uri, title: 'İş fotoğrafı' }
      );
      return;
    }
  } catch {
    // fallback below
  }
  const opened = await Linking.canOpenURL(src);
  if (opened) {
    await Linking.openURL(src);
  } else {
    throw new Error('Fotoğraf açılamadı.');
  }
}

export default function CaseDetailScreen({ caseId, onClose }) {
  const { openReservation } = useAppNavigation();
  const [busy, setBusy] = useState('');
  const [comment, setComment] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [modal, setModal] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [viewer, setViewer] = useState(null);

  const loader = useCallback(() => CasesAPI.detail(caseId), [caseId]);
  const { data, loading, error, reload } = useFetch(loader);
  const item = data?.data;
  const lookups = data?.lookups || {};

  const staffOpts = useMemo(
    () => [{ value: 0, label: 'Atanmamış' }, ...(lookups.staff || []).map((s) => ({ value: s.admin_id, label: s.label }))],
    [lookups.staff]
  );

  const photos = useMemo(
    () => (item?.events || []).filter((ev) => ev.photo_url),
    [item?.events]
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
      quality: 0.75,
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    // Modal açık kalsın — kullanıcı altına not yazabilsin
    setBusy('photo');
    try {
      const asset = result.assets[0];
      await CasesAPI.photo(caseId, asset.base64, extensionFromAsset(asset));
      await reload();
    } catch (err) {
      showMessage('Hata', err.message || 'Fotoğraf yüklenemedi.');
    } finally {
      setBusy('');
    }
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
  const catLabel = CASE_CATS.find((c) => c.value === item.category)?.label || item.category;
  const priLabel = CASE_PRI.find((p) => p.value === item.priority)?.label || item.priority;
  const assigneeLabel = item.assignee_label || 'Atanmamış';
  const dueLabel = item.due_date ? formatDate(item.due_date) : null;
  const events = item.events || [];
  const uploading = busy === 'photo';

  return (
    <View style={styles.container}>
      <Header onClose={onClose} title={`#${item.case_id}`} loading={Boolean(busy) && !uploading} />
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
              title="Güncelleme"
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
          {CASE_STATUS[item.status]} · {priLabel}
          {item.overdue ? ' · Gecikmiş' : ''}
        </Text>
        <Text style={styles.title}>{item.title}</Text>
        {item.body ? <Text style={styles.body}>{item.body}</Text> : null}

        {photos.length > 0 ? (
          <View style={styles.galleryBlock}>
            <Text style={styles.galleryLabel}>Fotoğraflar ({photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
              {photos.map((ev) => (
                <Pressable key={ev.event_id} onPress={() => setViewer(ev)} style={styles.galleryThumbWrap}>
                  <Image source={{ uri: ev.photo_url }} style={styles.galleryThumb} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.chipRow}>
          <MetaChip icon="pricetag-outline" text={catLabel} />
          <MetaChip icon="person-outline" text={assigneeLabel} />
          {dueLabel ? <MetaChip icon="calendar-outline" text={dueLabel} danger={item.overdue} /> : null}
          {item.room_name || item.unit_code ? (
            <MetaChip
              icon="bed-outline"
              text={`${item.room_name || ''}${item.unit_code ? ` · ${item.unit_code}` : ''}`.trim()}
            />
          ) : null}
        </View>

        {item.reservation_id ? (
          <AppPressable
            title={item.reservation_label || `Rezervasyon #${item.reservation_id}`}
            color={COLORS.primary}
            variant="outline"
            onPress={() => openReservation(item.reservation_id)}
            style={styles.resBtn}
          />
        ) : null}

        <Pressable
          style={styles.editToggle}
          onPress={() => setEditOpen((v) => !v)}
          accessibilityRole="button"
        >
          <Text style={styles.editToggleText}>{editOpen ? 'Alanları gizle' : 'Durum / atama düzenle'}</Text>
          <Ionicons name={editOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
        </Pressable>

        {editOpen ? (
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
          </View>
        ) : null}

        <Text style={styles.section}>
          Ne yapıldı <Text style={styles.sectionCount}>({events.length})</Text>
        </Text>
        {events.length === 0 ? (
          <Text style={styles.emptyTimeline}>Henüz adım yok.</Text>
        ) : (
          events.map((ev, idx) => (
            <View key={ev.event_id} style={styles.event}>
              <View style={styles.eventRail}>
                <View style={[styles.eventDot, idx === events.length - 1 && styles.eventDotLatest]} />
                {idx < events.length - 1 ? <View style={styles.eventLine} /> : null}
              </View>
              <View style={styles.eventContent}>
                <View style={styles.eventHead}>
                  <Ionicons
                    name={EVENT_ICON[ev.type] || 'ellipse-outline'}
                    size={14}
                    color={COLORS.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.eventType}>{EVENT_LABEL[ev.type] || ev.type}</Text>
                  <Text style={styles.eventMeta}>
                    {' · '}
                    {ev.admin_label || '—'}
                    {' · '}
                    {formatDateTime(ev.created_at)}
                  </Text>
                </View>
                {ev.body ? <Text style={styles.eventBody}>{ev.body}</Text> : null}
                {ev.photo_url ? (
                  <Pressable onPress={() => setViewer(ev)} style={styles.photoWrap}>
                    <Image source={{ uri: ev.photo_url }} style={styles.photo} />
                    <Text style={styles.photoTapHint}>Büyüt / indir</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}

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
        onRequestClose={() => !uploading && setModal(null)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => !uploading && setModal(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Güncelleme ekle</Text>
            <FormInput
              placeholder="Ne oldu, ne kaldı?"
              value={comment}
              onChangeText={setComment}
              multiline
              style={styles.modalInput}
            />

            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalGallery}>
                {photos.map((ev) => (
                  <Pressable key={ev.event_id} onPress={() => setViewer(ev)}>
                    <Image source={{ uri: ev.photo_url }} style={styles.modalThumb} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {uploading ? (
              <View style={styles.modalUploadRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.modalUploadText}>Fotoğraf yükleniyor… Not yazmaya devam edebilirsiniz.</Text>
              </View>
            ) : null}

            <AppPressable
              title={uploading ? 'Yükleniyor…' : 'Fotoğraf ekle'}
              color={COLORS.textSecondary}
              variant="outline"
              disabled={uploading || busy === 'comment'}
              onPress={pickPhoto}
              style={{ marginBottom: 8 }}
            />
            <SubmitButton
              title={busy === 'comment' ? 'Kaydediliyor…' : 'Notu kaydet'}
              disabled={busy === 'comment' || uploading || !comment.trim()}
              onPress={() =>
                run('comment', async () => {
                  await CasesAPI.comment(caseId, comment);
                  setComment('');
                  setModal(null);
                })
              }
            />
            <AppPressable
              title="Kapat"
              color={COLORS.textPrimary}
              variant="outline"
              disabled={uploading}
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

      <Modal
        visible={Boolean(viewer)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
        statusBarTranslucent
      >
        <View style={styles.viewerOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setViewer(null)} />
          <View style={styles.viewerCard}>
            {viewer?.photo_url ? (
              <Image source={{ uri: viewer.photo_url }} style={styles.viewerImage} resizeMode="contain" />
            ) : null}
            <Text style={styles.viewerMeta}>
              {viewer?.admin_label || '—'} · {formatDateTime(viewer?.created_at)}
            </Text>
            <View style={styles.viewerActions}>
              <AppPressable
                title="İndir / Paylaş"
                color={COLORS.primary}
                onPress={async () => {
                  try {
                    await shareOrDownloadPhoto(viewer?.photo_url);
                  } catch (err) {
                    showMessage('Hata', err.message || 'Paylaşılamadı.');
                  }
                }}
                style={styles.viewerBtn}
              />
              <AppPressable
                title="Tarayıcıda aç"
                color={COLORS.textSecondary}
                variant="outline"
                onPress={() => viewer?.photo_url && Linking.openURL(viewer.photo_url)}
                style={styles.viewerBtn}
              />
            </View>
            <ConfirmButton
              label={busy === `del-${viewer?.event_id}` ? 'Siliniyor…' : 'Fotoğrafı sil'}
              confirmLabel="Sil"
              color={COLORS.danger}
              disabled={Boolean(busy) || !viewer?.event_id}
              onConfirm={() =>
                run(`del-${viewer.event_id}`, async () => {
                  await CasesAPI.deletePhoto(caseId, viewer.event_id);
                  setViewer(null);
                }, 'Fotoğraf silindi.')
              }
              style={{ marginTop: 8 }}
            />
            <AppPressable
              title="Kapat"
              color={COLORS.textPrimary}
              variant="outline"
              onPress={() => setViewer(null)}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetaChip({ icon, text, danger }) {
  return (
    <View style={[styles.chip, danger && styles.chipDanger]}>
      <Ionicons name={icon} size={12} color={danger ? COLORS.danger : COLORS.textSecondary} />
      <Text style={[styles.chipText, danger && styles.chipTextDanger]} numberOfLines={1}>
        {text}
      </Text>
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
  content: { padding: 16, paddingBottom: 32 },
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
  modalGallery: { marginBottom: 10, maxHeight: 72 },
  modalThumb: { width: 64, height: 64, borderRadius: 8, marginRight: 8, backgroundColor: COLORS.inputBg },
  modalUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    padding: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },
  modalUploadText: { flex: 1, fontSize: 12, color: COLORS.textPrimary, fontWeight: '600' },
  kicker: { fontWeight: '700', fontSize: 12, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  body: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 22, marginBottom: 10 },
  galleryBlock: { marginBottom: 12 },
  galleryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  galleryRow: { gap: 8, paddingRight: 8 },
  galleryThumbWrap: { marginRight: 8 },
  galleryThumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: COLORS.inputBg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  chipDanger: { borderColor: COLORS.dangerSoft, backgroundColor: COLORS.dangerSoft },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', maxWidth: 180 },
  chipTextDanger: { color: COLORS.danger },
  resBtn: { alignSelf: 'flex-start', marginBottom: 8, minHeight: 36 },
  editToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 4,
  },
  editToggleText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  props: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  section: { fontWeight: '800', marginTop: 8, marginBottom: 10, color: COLORS.textPrimary, fontSize: 15 },
  sectionCount: { fontWeight: '600', color: COLORS.textMuted },
  emptyTimeline: { color: COLORS.textMuted, marginBottom: 12 },
  event: { flexDirection: 'row', marginBottom: 4 },
  eventRail: { width: 18, alignItems: 'center' },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderStrong,
    marginTop: 5,
  },
  eventDotLatest: { backgroundColor: COLORS.primary },
  eventLine: { flex: 1, width: 2, backgroundColor: COLORS.border, marginTop: 2, marginBottom: 2 },
  eventContent: { flex: 1, paddingBottom: 14, paddingLeft: 4 },
  eventHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 },
  eventType: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  eventMeta: { fontSize: 11, color: COLORS.textMuted },
  eventBody: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  photo: { width: '100%', height: 160, borderRadius: 8, backgroundColor: COLORS.inputBg },
  photoWrap: { marginTop: 8 },
  photoTapHint: { marginTop: 4, fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  viewerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: DIM,
  },
  viewerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    zIndex: 1,
  },
  viewerImage: { width: '100%', height: 320, backgroundColor: '#111', borderRadius: 8 },
  viewerMeta: { marginTop: 8, marginBottom: 10, fontSize: 12, color: COLORS.textMuted },
  viewerActions: { flexDirection: 'row', gap: 8 },
  viewerBtn: { flex: 1, minHeight: 42 },
  error: { padding: 16, color: COLORS.danger },
});
