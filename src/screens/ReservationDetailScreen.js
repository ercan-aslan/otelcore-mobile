import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FormCard, { FormInput, FormLabel } from '../components/FormCard';
import StayingGuestsCard from '../components/StayingGuestsCard';
import SelectField, { SubmitButton } from '../components/SelectField';
import DateInput from '../components/DateInput';
import AppPressable, { ConfirmButton } from '../components/AppPressable';
import TabPills from '../components/TabPills';
import { ReservationAPI, snapshotToReservation, isReservationPreviewMode, fetchMobileApiBuild, EXPECTED_API_BUILD } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import {
  formatDate,
  formatMoney,
  getChannelStyle,
  nightsBetweenIso,
  resolveReservationCurrency,
} from '../utils/format';
import { showMessage, showPrompt, showConfirm } from '../utils/alert';

function money(res, amount) {
  return formatMoney(amount, resolveReservationCurrency(res));
}

const STATUS_LABELS = {
  confirmed: 'Onaylandı',
  checked_in: 'Giriş Yapıldı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  pending: 'Beklemede',
};

const STATUS_COLORS = {
  confirmed: COLORS.primary,
  checked_in: COLORS.success,
  completed: '#495057',
  cancelled: COLORS.danger,
  pending: COLORS.warning,
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Nakit' },
  { value: 'card', label: 'Kredi Kartı' },
  { value: 'transfer', label: 'Havale / EFT' },
];

function SectionTitle({ icon, title }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );
}

function StatTile({ label, value, color, icon }) {
  return (
    <View style={[styles.statTile, { borderColor: `${color}33` }]}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={[styles.statTileValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StatusPill({ status }) {
  const color = STATUS_COLORS[status] || COLORS.textSecondary;
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}22`, borderColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusPillText, { color }]}>
        {STATUS_LABELS[status] || status || '—'}
      </Text>
    </View>
  );
}

function HeroCard({ res, channel, nights }) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <Text style={styles.heroId} numberOfLines={1}>
          #{res.reservation_id}
        </Text>
        <StatusPill status={res.status} />
      </View>

      <Text style={styles.heroGuest} numberOfLines={1}>
        {res.guest_name || 'Misafir'}
      </Text>

      <View style={styles.heroChannelRow}>
        <View style={[styles.channelPill, { backgroundColor: channel.color }]}>
          <Text style={styles.channelPillText}>{channel.label}</Text>
        </View>
        {res.room_name || res.unit_code ? (
          <View style={styles.roomPill}>
            <Ionicons name="bed-outline" size={12} color="#fff" />
            <Text style={styles.roomPillText} numberOfLines={1}>
              {[res.room_name, res.unit_code].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.dateTimeline}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateBlockLabel}>Giriş</Text>
          <Text style={styles.dateBlockValue}>{formatDate(res.check_in) || '—'}</Text>
        </View>
        <View style={styles.dateArrow}>
          <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.nightsText}>
            {nights > 0 ? `${nights} gece` : '—'}
          </Text>
        </View>
        <View style={styles.dateBlock}>
          <Text style={styles.dateBlockLabel}>Çıkış</Text>
          <Text style={styles.dateBlockValue}>{formatDate(res.check_out) || '—'}</Text>
        </View>
      </View>
    </View>
  );
}

function PriceSummaryRow({ res }) {
  const discountAmount = resolveCouponDiscount(res);
  const hasCoupon = hasCouponInfo(res);
  const netTotal = Number(res.total_price || 0);
  const grossTotal = hasCoupon && discountAmount > 0 ? netTotal + discountAmount : netTotal;

  return (
    <>
      <View style={styles.statsRow}>
        <StatTile
          label="Toplam"
          value={money(res, netTotal)}
          color={COLORS.primary}
          icon="receipt-outline"
        />
        <StatTile
          label="Tahsil"
          value={money(res, res.paid_total)}
          color={COLORS.success}
          icon="checkmark-circle-outline"
        />
        <StatTile
          label="Kalan"
          value={money(res, res.balance)}
          color={res.balance > 0 ? COLORS.warning : COLORS.success}
          icon="time-outline"
        />
      </View>

      {hasCoupon && discountAmount > 0 ? (
        <View style={styles.priceBreakdown}>
          <View style={styles.priceBreakdownRow}>
            <Text style={styles.priceBreakdownLabel}>Liste fiyatı</Text>
            <Text style={styles.priceBreakdownValue}>{money(res, grossTotal)}</Text>
          </View>
          <View style={styles.priceBreakdownRow}>
            <Text style={styles.priceBreakdownLabel}>
              Kupon indirimi{res.coupon_code ? ` (${res.coupon_code})` : ''}
            </Text>
            <Text style={[styles.priceBreakdownValue, styles.priceBreakdownDiscount]}>
              -{money(res, discountAmount)}
            </Text>
          </View>
          <View style={[styles.priceBreakdownRow, styles.priceBreakdownRowLast]}>
            <Text style={styles.priceBreakdownLabelStrong}>Net toplam</Text>
            <Text style={styles.priceBreakdownValueStrong}>{money(res, netTotal)}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

function resolveCouponDiscount(res) {
  const stored = Number(res.discount_amount || 0);
  if (stored > 0) {
    return stored;
  }

  const type = res.discount_type;
  const value = Number(res.discount_value || 0);
  const total = Number(res.total_price || 0);

  if (type === 'percent' && value > 0 && value < 100 && total > 0) {
    const base = total / (1 - value / 100);
    return Math.round((base - total) * 100) / 100;
  }

  if (type === 'fixed' && value > 0) {
    return value;
  }

  return 0;
}

function hasCouponInfo(res) {
  return Boolean(
    res?.has_coupon ||
      String(res?.coupon_code || '').trim() ||
      Number(res?.discount_amount || 0) > 0
  );
}

function GuestSummaryCard({ res }) {
  const hasContact =
    res.user_phone || res.user_email || res.user_tc || res.user_passport || res.user_nationality;

  return (
    <View style={styles.surfaceCard}>
      <SectionTitle icon="person-circle-outline" title="Misafir Bilgileri" />
      <InfoRow label="Ad Soyad" value={res.guest_name} />
      {res.user_phone ? <InfoRow label="Telefon" value={res.user_phone} /> : null}
      {res.user_email ? <InfoRow label="E-posta" value={res.user_email} /> : null}
      {res.user_tc ? <InfoRow label="TC Kimlik" value={res.user_tc} /> : null}
      {res.user_passport ? <InfoRow label="Pasaport" value={res.user_passport} /> : null}
      {res.user_nationality ? (
        <InfoRow label="Uyruk" value={res.user_nationality} last />
      ) : (
        <InfoRow label="Uyruk" value={null} last={!hasContact} />
      )}
      {!hasContact && !res.user_nationality ? (
        <Text style={styles.mutedHint}>
          İletişim bilgileri sunucu güncellemesinden sonra görünecek.
        </Text>
      ) : null}
    </View>
  );
}

export default function ReservationDetailScreen({ reservationId, initialSnapshot, onClose }) {
  const [busy, setBusy] = useState('');
  const [detailTab, setDetailTab] = useState('ozet');
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash' });
  const [newRoomId, setNewRoomId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [dateForm, setDateForm] = useState({ check_in: '', check_out: '' });
  const [serverBuild, setServerBuild] = useState('');

  const DETAIL_TABS = [
    { key: 'ozet', label: 'Özet', shortLabel: 'Özet' },
    { key: 'konaklama', label: 'Konaklama', shortLabel: 'Oda' },
    { key: 'misafir', label: 'Misafir', shortLabel: 'Misafir' },
    { key: 'odeme', label: 'Ödeme', shortLabel: 'Ödeme' },
  ];

  const loader = useCallback(
    () => ReservationAPI.get(reservationId, initialSnapshot),
    [reservationId, initialSnapshot]
  );
  const { data, loading, error, refresh } = useFetch(loader);
  const preview = useMemo(
    () => snapshotToReservation(initialSnapshot, reservationId),
    [initialSnapshot, reservationId]
  );
  const res = data?.data || data || preview || {};
  const channel = getChannelStyle(res.channel, res);
  const nights = nightsBetweenIso(res.check_in, res.check_out);
  const isPartial = isReservationPreviewMode(res);
  const isUpgrading = loading && res.reservation_id && isPartial;

  useEffect(() => {
    if (!isPartial || loading) {
      return undefined;
    }
    let cancelled = false;
    fetchMobileApiBuild().then((build) => {
      if (!cancelled) {
        setServerBuild(build);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isPartial, loading, reservationId]);

  useEffect(() => {
    if (!res.reservation_id) return;
    setNewRoomId(String(res.room_id || ''));
    setUnitId(String(res.assigned_unit_id || ''));
    setDateForm({
      check_in: res.check_in || '',
      check_out: res.check_out || '',
    });
  }, [
    res.reservation_id,
    res.room_id,
    res.assigned_unit_id,
    res.check_in,
    res.check_out,
  ]);

  const runAction = async (action, extra = {}, successMsg = 'İşlem kaydedildi.') => {
    setBusy(action);
    try {
      await ReservationAPI.action({ action, reservation_id: reservationId, ...extra });
      showMessage('Başarılı', successMsg);
      refresh();
      return true;
    } catch (err) {
      if (
        action === 'check_in' &&
        !extra.confirm_dirty_checkin &&
        (err.code === 'dirty_room' || err.needs_confirm)
      ) {
        setBusy('');
        showConfirm(
          'Kirli oda',
          'Oda kirli görünüyor. Temiz olarak işaretleyip check-in yapılsın mı?',
          () => {
            runAction(
              'check_in',
              { ...extra, confirm_dirty_checkin: 1 },
              'Check-in yapıldı (oda temiz işaretlendi).'
            );
          },
          { confirmText: 'Temizle ve check-in', cancelText: 'Vazgeç' }
        );
        return false;
      }
      showMessage('Hata', err.message || 'İşlem başarısız.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const onCancel = () => {
    showPrompt(
      'Rezervasyonu iptal et',
      'İptal nedenini yazın. Bu alan zorunludur (en az 5 karakter).',
      (reason) => {
        runAction('cancel', { cancel_reason: reason }, 'Rezervasyon iptal edildi.');
      },
      {
        placeholder: 'Örn: Misafir iptal etti, tarih değişikliği…',
        confirmText: 'İptal et',
        cancelText: 'Vazgeç',
        destructive: true,
        minLength: 5,
      }
    );
  };

  const onRestore = () =>
    runAction('restore', {}, 'Rezervasyon geri alındı.');

  const isCancelled = useMemo(() => {
    const status = String(res.status || '').toLowerCase();
    return ['cancelled', 'canceled', 'iptal', 'iptal edildi'].includes(status) || Boolean(res.is_deleted);
  }, [res.status, res.is_deleted]);

  const roomOptions = (res.all_rooms || []).map((r) => ({
    value: r.room_id,
    label: r.room_name,
  }));
  const unitOptions = (res.units || []).map((u) => ({
    value: String(u.unit_id),
    label: u.busy ? `${u.unit_code} (dolu)` : u.unit_code,
  }));
  const unitCount = (res.units || []).length;
  const hasUnits = unitCount > 0;
  const needsUnitPicker = unitCount > 1;
  const canEditStay = !isPartial && !isCancelled && res.status !== 'completed';
  const showUnitPicker = needsUnitPicker && canEditStay;
  const soleUnitCode =
    unitCount === 1
      ? String((res.units[0] && res.units[0].unit_code) || res.unit_code || '').trim()
      : String(res.unit_code || '').trim();

  const onChangeRoom = async () => {
    if (!newRoomId) {
      showMessage('Eksik alan', 'Oda seçin.');
      return;
    }
    await runAction('change_room', { room_id: Number(newRoomId) }, 'Oda güncellendi.');
  };

  const onChangeDates = async () => {
    const checkIn = String(dateForm.check_in || '').trim();
    const checkOut = String(dateForm.check_out || '').trim();

    if (!checkIn || !checkOut) {
      showMessage('Eksik alan', 'Giriş ve çıkış tarihlerini girin.');
      return;
    }

    if (checkOut <= checkIn) {
      showMessage('Geçersiz tarih', 'Çıkış tarihi giriş tarihinden sonra olmalıdır.');
      return;
    }

    if (checkIn === res.check_in && checkOut === res.check_out) {
      showMessage('Bilgi', 'Tarihlerde değişiklik yok.');
      return;
    }

    await runAction(
      'change_dates',
      { check_in: checkIn, check_out: checkOut },
      'Tarihler güncellendi.'
    );
  };

  const onAddPayment = async () => {
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      showMessage('Eksik alan', 'Geçerli bir tutar girin.');
      return;
    }
    const ok = await runAction(
      'add_payment',
      { amount, payment_method: paymentForm.payment_method },
      'Ödeme kaydedildi.'
    );
    if (ok) {
      setPaymentForm({ amount: '', payment_method: 'cash' });
    }
  };

  const errorMessage =
    typeof error === 'string' ? error : error?.message || 'Rezervasyon detayı yüklenemedi.';

  if (loading && !res.reservation_id) {
    return (
      <View style={styles.container}>
        <Header onClose={onClose} title="Detay" loading />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Rezervasyon yükleniyor…</Text>
        </View>
      </View>
    );
  }

  if ((error || !res.reservation_id) && !loading) {
    return (
      <View style={styles.container}>
        <Header onClose={onClose} title="Detay" />
        <View style={styles.centerContent}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={36} color={COLORS.danger} />
          </View>
          <Text style={styles.errorTitle}>Yüklenemedi</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <SubmitButton title="Tekrar Dene" onPress={refresh} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onClose={onClose} title={`#${res.reservation_id}`} loading={isUpgrading} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {isPartial ? (
            <View style={styles.previewBanner}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
              <View style={styles.previewBannerTextWrap}>
                <Text style={styles.previewBannerTitle}>Önizleme modu</Text>
                <Text style={styles.previewBannerText}>
                  Canlı sunucuda yeni API dosyaları yok (deploy yanlış yere gidiyor). Giriş
                  sonrası sunucu sürümü: {serverBuild || 'eski'} · beklenen: {EXPECTED_API_BUILD}.
                  CyberPanel / FTP ile public_html/api/mobile/ klasörüne yükleyin.
                </Text>
              </View>
            </View>
          ) : null}

          <TabPills tabs={DETAIL_TABS} activeKey={detailTab} onChange={setDetailTab} />

          {detailTab === 'ozet' ? (
            <>
              <HeroCard res={res} channel={channel} nights={nights} />

              {!isPartial && isCancelled ? (
                <View style={styles.actionsCard}>
                  <SectionTitle icon="arrow-undo-outline" title="İptal Geri Alma" />
                  {res.cancel_reason ? (
                    <Text style={styles.cancelReason} numberOfLines={4}>
                      İptal nedeni: {res.cancel_reason}
                    </Text>
                  ) : null}
                  {res.cancelled_at_formatted ? (
                    <Text style={styles.dateHint}>İptal: {res.cancelled_at_formatted}</Text>
                  ) : null}
                  <ConfirmButton
                    label="İptali Geri Al"
                    confirmLabel="Evet, geri al"
                    cancelLabel="Vazgeç"
                    color={COLORS.success}
                    busy={busy === 'restore'}
                    onConfirm={onRestore}
                  />
                </View>
              ) : null}

              {!isPartial && canEditStay ? (
                <View style={styles.actionsCard}>
                  <SectionTitle icon="flash-outline" title="Hızlı İşlemler" />
                  {needsUnitPicker && !unitId ? (
                    <Text style={styles.mutedHint}>
                      Check-in öncesi Oda sekmesinden oda numarası seçebilirsiniz.
                    </Text>
                  ) : null}
                  <SubmitButton
                    title="Check-in Yap"
                    color={COLORS.success}
                    loading={busy === 'check_in'}
                    onPress={() => runAction('check_in', { assigned_unit_id: Number(unitId || 0) })}
                  />
                  <SubmitButton
                    title="Check-out Yap"
                    color={COLORS.info}
                    loading={busy === 'check_out'}
                    onPress={() => runAction('check_out')}
                  />
                  <SubmitButton
                    title="Rezervasyonu İptal Et"
                    color={COLORS.danger}
                    loading={busy === 'cancel'}
                    onPress={onCancel}
                  />
                </View>
              ) : null}

              {res.note ? (
                <View style={styles.surfaceCard}>
                  <SectionTitle icon="document-text-outline" title="Not" />
                  <Text style={styles.noteBody}>{res.note}</Text>
                </View>
              ) : null}
            </>
          ) : null}

          {detailTab === 'konaklama' ? (
            <>
              {canEditStay && roomOptions.length > 0 ? (
                <FormCard title="Oda Tipi" icon="🚪" borderColor={COLORS.info}>
                  <SelectField
                    label="Oda tipi"
                    value={newRoomId}
                    options={roomOptions}
                    onChange={setNewRoomId}
                  />
                  {!needsUnitPicker && soleUnitCode ? (
                    <InfoRow label="Oda no" value={soleUnitCode} last />
                  ) : null}
                  {!needsUnitPicker && hasUnits && !soleUnitCode ? (
                    <Text style={styles.mutedHint}>
                      Bu tipte tek oda var; kaydedince numara otomatik atanır.
                    </Text>
                  ) : null}
                  <SubmitButton
                    title="Oda Tipini Kaydet"
                    color={COLORS.info}
                    loading={busy === 'change_room'}
                    onPress={onChangeRoom}
                  />
                </FormCard>
              ) : (
                <View style={styles.surfaceCard}>
                  <SectionTitle icon="bed-outline" title="Oda" />
                  <InfoRow label="Oda tipi" value={res.room_name} />
                  <InfoRow
                    label="Oda no"
                    value={soleUnitCode || (hasUnits ? 'Atanmadı' : '—')}
                    last
                  />
                </View>
              )}

              {showUnitPicker ? (
                <View style={styles.surfaceCard}>
                  <SectionTitle icon="keypad-outline" title="Oda numarası" />
                  <SelectField
                    placeholder="Oda numarası seçin"
                    value={unitId}
                    options={unitOptions}
                    onChange={setUnitId}
                  />
                  <SubmitButton
                    title="Oda no kaydet"
                    loading={busy === 'assign_unit'}
                    onPress={() =>
                      runAction(
                        'assign_unit',
                        { assigned_unit_id: Number(unitId || 0) },
                        'Oda numarası kaydedildi.'
                      )
                    }
                  />
                </View>
              ) : null}

              {canEditStay ? (
                <FormCard title="Tarih Değiştir" icon="📅" borderColor={COLORS.warning}>
                  <View style={styles.row2}>
                    <View style={styles.half}>
                      <FormLabel>Giriş</FormLabel>
                      <DateInput
                        value={dateForm.check_in}
                        onChangeValue={(v) => setDateForm((p) => ({ ...p, check_in: v }))}
                      />
                    </View>
                    <View style={styles.half}>
                      <FormLabel>Çıkış</FormLabel>
                      <DateInput
                        value={dateForm.check_out}
                        onChangeValue={(v) => setDateForm((p) => ({ ...p, check_out: v }))}
                      />
                    </View>
                  </View>
                  {dateForm.check_in && dateForm.check_out ? (
                    <Text style={styles.dateHint}>
                      {nightsBetweenIso(dateForm.check_in, dateForm.check_out)} gece
                      {dateForm.check_out <= dateForm.check_in ? ' · çıkış girişten sonra olmalı' : ''}
                    </Text>
                  ) : null}
                  <SubmitButton
                    title="Tarihleri Kaydet"
                    color={COLORS.warning}
                    loading={busy === 'change_dates'}
                    onPress={onChangeDates}
                  />
                </FormCard>
              ) : null}
            </>
          ) : null}

          {detailTab === 'misafir' ? (
            isPartial ? (
              <GuestSummaryCard res={res} />
            ) : (
              <StayingGuestsCard
                reservationId={reservationId}
                initialGuests={res.staying_guests || []}
                adults={res.adults || 1}
                onSaved={refresh}
              />
            )
          ) : null}

          {detailTab === 'odeme' ? (
            <>
              {!isPartial && canEditStay ? (
                <FormCard title="Ödeme Ekle" icon="💳" borderColor={COLORS.success}>
                  <FormLabel>Tutar ({resolveReservationCurrency(res) === 'TRY' ? '₺' : '€'})</FormLabel>
                  <FormInput
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChangeText={(v) => setPaymentForm((p) => ({ ...p, amount: v }))}
                  />
                  <FormLabel>Ödeme Yöntemi</FormLabel>
                  <SelectField
                    value={paymentForm.payment_method}
                    options={PAYMENT_METHODS}
                    onChange={(v) => setPaymentForm((p) => ({ ...p, payment_method: v }))}
                  />
                  <SubmitButton
                    title="Ödemeyi Kaydet"
                    color={COLORS.success}
                    loading={busy === 'add_payment'}
                    onPress={onAddPayment}
                  />
                </FormCard>
              ) : null}

              <PriceSummaryRow res={res} />

              {(res.payments || []).length > 0 ? (
                <View style={styles.surfaceCard}>
                  <SectionTitle icon="list-outline" title="Ödeme Geçmişi" />
                  {res.payments.map((p, index) => (
                    <View
                      key={String(p.payment_id)}
                      style={[
                        styles.listRow,
                        index === res.payments.length - 1 && styles.listRowLast,
                      ]}
                    >
                      <View style={styles.listRowLeft}>
                        <Ionicons name="card-outline" size={16} color={COLORS.textSecondary} />
                        <Text style={styles.listRowTitle}>{p.payment_method}</Text>
                      </View>
                      <Text style={styles.listRowAmount}>
                        {formatMoney(p.amount, p.currency || resolveReservationCurrency(res))}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.mutedHint}>Henüz ödeme kaydı yok.</Text>
              )}

              {(res.extras || []).length > 0 ? (
                <View style={styles.surfaceCard}>
                  <SectionTitle icon="add-circle-outline" title="Ekstralar" />
                  {res.extras.map((ex, index) => (
                    <View
                      key={String(ex.id)}
                      style={[
                        styles.listRow,
                        index === res.extras.length - 1 && styles.listRowLast,
                      ]}
                    >
                      <Text style={styles.listRowTitle}>{ex.description}</Text>
                      <Text style={styles.listRowAmount}>{money(res, ex.amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
        <Text style={styles.headerTitle}>Rezervasyon Detayı</Text>
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
  content: { padding: 16, paddingBottom: 40 },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 12,
  },
  loadingText: { color: COLORS.textMuted, fontSize: 14 },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fdecea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  errorText: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eef4ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#cfe2ff',
  },
  previewBannerTextWrap: { flex: 1 },
  previewBannerTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primaryDark },
  previewBannerText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  previewBannerEmphasis: { fontWeight: '800', color: COLORS.textPrimary },
  heroCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroId: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
  heroGuest: { fontSize: 18, fontWeight: '800', color: '#fff', lineHeight: 22 },
  heroChannelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  channelPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  channelPillText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '70%',
  },
  roomPillText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  dateTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dateBlock: { flex: 1 },
  dateBlockLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.6,
  },
  dateBlockValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  dateArrow: { alignItems: 'center', paddingHorizontal: 6 },
  nightsText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  priceBreakdown: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priceBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  priceBreakdownRowLast: { borderBottomWidth: 0, paddingTop: 8 },
  priceBreakdownLabel: { fontSize: 13, color: COLORS.textSecondary },
  priceBreakdownLabelStrong: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  priceBreakdownValue: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  priceBreakdownValueStrong: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  priceBreakdownDiscount: { color: COLORS.success },
  statTile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statTileLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  statTileValue: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  surfaceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
    gap: 12,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1.2,
    textAlign: 'right',
  },
  mutedHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },
  row2: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  dateHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
    marginTop: -2,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  listRowLast: { borderBottomWidth: 0 },
  listRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  listRowTitle: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  listRowAmount: { fontSize: 14, fontWeight: '800', color: COLORS.success },
  noteBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  cancelReason: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  actionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
