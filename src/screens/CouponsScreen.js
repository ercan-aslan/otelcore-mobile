import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import PageScaffold from '../components/PageScaffold';
import FormCard, { FormInput, FormLabel } from '../components/FormCard';
import DateInput from '../components/DateInput';
import SelectField, { SubmitButton } from '../components/SelectField';
import ActionFeedback from '../components/ActionFeedback';
import AppPressable, { DeleteButton } from '../components/AppPressable';
import { CouponsAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { formatDate } from '../utils/format';
import { showConfirm, showMessage } from '../utils/alert';

const DISCOUNT_TYPES = [
  { value: 'fixed', label: 'Sabit Tutar (TL / €)' },
  { value: 'percent', label: 'Yüzde (%)' },
];

function CouponCard({ item, onToggle, onDelete, onWebsite, busyId }) {
  const active = item.status === 'active';
  const onSite = Number(item.show_on_website) === 1;
  const borderColor = onSite ? COLORS.primary : active ? COLORS.success : COLORS.textMuted;
  const discountLabel =
    item.discount_type === 'percent'
      ? `%${item.discount_value}`
      : `${Number(item.discount_value).toFixed(2)} ₺/€`;
  const isBusy = busyId === item.coupon_id;

  return (
    <View style={[styles.couponCard, { borderLeftColor: borderColor }]}>
      <View style={styles.couponTop}>
        <View style={styles.codeBadge}>
          <Text style={styles.codeText}>🎫 {item.code}</Text>
        </View>
        <AppPressable
          title={active ? 'Aktif' : 'Pasif'}
          color={active ? COLORS.success : COLORS.textMuted}
          disabled={isBusy}
          onPress={() => onToggle(item.coupon_id)}
          style={styles.statusBadge}
        />
      </View>

      {onSite ? (
        <View style={styles.siteBadge}>
          <Text style={styles.siteBadgeText}>🌐 Sitede yayında</Text>
        </View>
      ) : null}

      <View style={styles.couponMid}>
        <Text style={styles.discountValue}>{discountLabel}</Text>
        <Text style={styles.usageText}>
          Kullanım:{' '}
          <Text style={styles.usageBold}>
            {item.used_count} / {item.usage_limit == 0 ? 'Sınırsız' : item.usage_limit}
          </Text>
        </Text>
      </View>

      <View style={styles.couponBottom}>
        <Text style={styles.expiryText}>
          📅 Son Tarih: <Text style={styles.expiryBold}>{formatDate(item.expiry_date)}</Text>
        </Text>
        <View style={styles.bottomActions}>
          <AppPressable
            title={onSite ? 'Siteden Kaldır' : 'Sitede Yayınla'}
            color={onSite ? COLORS.textSecondary : COLORS.primary}
            disabled={isBusy}
            onPress={() => onWebsite(item, !onSite)}
            style={styles.siteBtn}
          />
          <DeleteButton
            label="🗑 Sil"
            busy={isBusy}
            onConfirm={() => onDelete(item.coupon_id)}
            style={styles.deleteBtn}
          />
        </View>
      </View>
    </View>
  );
}

export default function CouponsScreen() {
  const [form, setForm] = useState({
    code: '',
    discount_type: 'fixed',
    discount_value: '',
    usage_limit: '0',
    expiry_date: '',
    show_on_website: false,
  });
  const [busy, setBusy] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: 'info' });
  const [websiteInfo, setWebsiteInfo] = useState(null);

  const loader = useCallback(async () => {
    const res = await CouponsAPI.list();
    setWebsiteInfo(res.website || null);
    return res.data || [];
  }, []);

  const { data: items, loading, refreshing, error, refresh } = useFetch(loader);

  const submitCreate = async (confirmReplace = false) => {
    await CouponsAPI.create({
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      usage_limit: Number(form.usage_limit || 0),
      expiry_date: form.expiry_date,
      show_on_website: form.show_on_website ? 1 : 0,
      confirm_replace_website: confirmReplace ? 1 : 0,
    });
    setFeedback({ message: 'Kupon oluşturuldu.', type: 'success' });
    showMessage('Başarılı', 'Kupon oluşturuldu.');
    setForm({
      code: '',
      discount_type: 'fixed',
      discount_value: '',
      usage_limit: '0',
      expiry_date: '',
      show_on_website: false,
    });
    refresh();
  };

  const onCreate = async () => {
    if (!form.code.trim() || !form.discount_value || !form.expiry_date) {
      const msg = 'Kod, indirim değeri ve son tarih (GG/AA/YYYY) zorunludur.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Eksik alan', msg);
      return;
    }
    setBusy('create');
    setFeedback({ message: '', type: 'info' });
    try {
      await submitCreate(false);
    } catch (err) {
      if (err?.needs_confirm) {
        showConfirm('Onay', err.message || 'Mevcut site kuponu değiştirilsin mi?', () => {
          submitCreate(true).catch((e) => {
            showMessage('Hata', e.message || 'Kupon oluşturulamadı.');
          });
        });
      } else {
        const msg = err.message || 'Kupon oluşturulamadı.';
        setFeedback({ message: msg, type: 'error' });
        showMessage('Hata', msg);
      }
    } finally {
      setBusy('');
    }
  };

  const applyWebsite = async (couponId, showOnWebsite, confirmReplace = false) => {
    await CouponsAPI.setWebsite(couponId, showOnWebsite, confirmReplace);
    refresh();
  };

  const onWebsite = async (item, showOnWebsite) => {
    setBusyId(item.coupon_id);
    try {
      await applyWebsite(item.coupon_id, showOnWebsite, false);
      showMessage('Başarılı', showOnWebsite ? 'Kupon sitede yayınlandı.' : 'Kupon siteden kaldırıldı.');
    } catch (err) {
      if (err?.needs_confirm) {
        showConfirm('Onay', err.message || 'Mevcut site kuponu değiştirilsin mi?', () => {
          applyWebsite(item.coupon_id, true, true)
            .then(() => showMessage('Başarılı', 'Kupon sitede yayınlandı.'))
            .catch((e) => showMessage('Hata', e.message || 'Güncellenemedi.'))
            .finally(() => refresh());
        });
      } else {
        showMessage('Hata', err.message || 'Güncellenemedi.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const onToggle = async (couponId) => {
    setBusyId(couponId);
    try {
      await CouponsAPI.toggle(couponId);
      refresh();
    } catch (err) {
      showMessage('Hata', err.message || 'Durum güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (couponId) => {
    setBusyId(couponId);
    try {
      await CouponsAPI.remove(couponId);
      showMessage('Başarılı', 'Kupon silindi.');
      refresh();
    } catch (err) {
      showMessage('Hata', err.message || 'Silinemedi.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageScaffold loading={loading} refreshing={refreshing} error={error} onRefresh={refresh}>
      <ActionFeedback
        message={feedback.message}
        type={feedback.type}
        onClear={() => setFeedback({ message: '', type: 'info' })}
      />
      {websiteInfo?.promo_code ? (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>🌐 Sitede gösterilen: {websiteInfo.promo_code}</Text>
        </View>
      ) : null}
      <FormCard title="Oluştur" icon="➕" borderColor={COLORS.primary}>
        <FormLabel>Kupon Kodu</FormLabel>
        <FormInput
          placeholder="Örn: YAZ2024"
          autoCapitalize="characters"
          value={form.code}
          onChangeText={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))}
        />
        <FormLabel>İndirim Tipi</FormLabel>
        <SelectField
          value={form.discount_type}
          options={DISCOUNT_TYPES}
          onChange={(v) => setForm((p) => ({ ...p, discount_type: v }))}
        />
        <FormLabel>İndirim Değeri</FormLabel>
        <FormInput
          placeholder="Örn: 15"
          keyboardType="decimal-pad"
          value={form.discount_value}
          onChangeText={(v) => setForm((p) => ({ ...p, discount_value: v }))}
        />
        <FormLabel>Kullanım Limiti (0 = Sınırsız)</FormLabel>
        <FormInput
          placeholder="0"
          keyboardType="number-pad"
          value={form.usage_limit}
          onChangeText={(v) => setForm((p) => ({ ...p, usage_limit: v }))}
        />
        <FormLabel>Son Kullanma Tarihi</FormLabel>
        <DateInput
          value={form.expiry_date}
          onChangeValue={(v) => setForm((p) => ({ ...p, expiry_date: v }))}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Web sitede göster</Text>
          <Switch
            value={form.show_on_website}
            onValueChange={(v) => setForm((p) => ({ ...p, show_on_website: v }))}
          />
        </View>
        <SubmitButton title="💾 Oluştur" loading={busy === 'create'} onPress={onCreate} />
      </FormCard>

      <Text style={styles.listTitle}>📋 Mevcut Kuponlar</Text>

      {(items || []).length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Henüz kupon oluşturulmamış.</Text>
        </View>
      ) : (
        items.map((item) => (
          <CouponCard
            key={String(item.coupon_id)}
            item={item}
            onToggle={onToggle}
            onDelete={onDelete}
            onWebsite={onWebsite}
            busyId={busyId}
          />
        ))
      )}
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },
  couponCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  couponTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  codeBadge: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  codeText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  statusBadge: { minHeight: 32, paddingHorizontal: 12, paddingVertical: 4 },
  couponMid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  discountValue: { fontSize: 22, fontWeight: '800', color: COLORS.success },
  usageText: { fontSize: 12, color: COLORS.textSecondary },
  usageBold: { color: COLORS.textPrimary, fontWeight: '700' },
  couponBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    gap: 8,
  },
  expiryText: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  expiryBold: { color: COLORS.textPrimary, fontWeight: '700' },
  bottomActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  siteBtn: { minHeight: 36, paddingHorizontal: 8, paddingVertical: 4 },
  deleteBtn: { minHeight: 36, paddingHorizontal: 10, paddingVertical: 4 },
  siteBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13, 110, 253, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  siteBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  switchLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  infoBanner: {
    backgroundColor: '#e7f1ff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoBannerText: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '600' },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
