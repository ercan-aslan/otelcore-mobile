import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PageScaffold from '../components/PageScaffold';
import MobileCard from '../components/MobileCard';
import FormCard, { FormInput, FormLabel } from '../components/FormCard';
import DateInput from '../components/DateInput';
import { SubmitButton } from '../components/SelectField';
import TabPills from '../components/TabPills';
import AppPressable, { DeleteButton } from '../components/AppPressable';
import { InventoryAPI, ResourceAPI } from '../api';
import { useFetch } from '../hooks/useFetch';
import { useAppNavigation } from '../context/NavigationContext';
import { COLORS } from '../theme';
import { EXPLORE_TYPES, STATUS_LABELS } from '../utils/format';
import { showMessage, showConfirm } from '../utils/alert';

const DIM = 'rgba(0,0,0,0.58)';

function InventoryModal({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function costText(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
}

function ActionRow({ actions = [] }) {
  return (
    <View style={styles.actionRow}>
      {actions.map((action) =>
        action.delete ? (
          <DeleteButton
            key={action.label}
            label={action.label}
            busy={action.disabled}
            onConfirm={action.onPress}
            style={styles.actionBtn}
          />
        ) : (
          <AppPressable
            key={action.label}
            title={action.label}
            color={action.color || COLORS.primary}
            variant="outline"
            disabled={action.disabled}
            onPress={action.onPress}
            style={styles.actionBtn}
          />
        )
      )}
    </View>
  );
}

async function runResourceAction(fn, onSuccess, successMsg = 'İşlem kaydedildi.') {
  try {
    await fn();
    showMessage('Başarılı', successMsg);
    onSuccess?.();
  } catch (err) {
    showMessage('Hata', err.message || 'İşlem başarısız.');
  }
}

function ResourceListScreen({ title, subtitle, resource, renderItem, emptyText, refreshKey, headerForm }) {
  const loader = useCallback(() => ResourceAPI.get(resource), [resource, refreshKey]);
  const { data, loading, refreshing, error, refresh } = useFetch(loader);
  const items = data?.data || [];

  return (
    <PageScaffold
      title={title}
      subtitle={subtitle}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
    >
      {headerForm}
      {items.length === 0 ? (
        <Text style={styles.empty}>{emptyText || 'Kayıt bulunamadı.'}</Text>
      ) : (
        items.map((item, index) => renderItem(item, index, refresh))
      )}
    </PageScaffold>
  );
}

export function InventoryScreen() {
  const { navigateTo } = useAppNavigation();
  const [tick, setTick] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ item_name: '', quantity: '0' });
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [tab, setTab] = useState('critical');
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({ quantity: '', supplier: '', cost: '', eta: '' });

  const bump = () => setTick((t) => t + 1);

  const openModal = (type, item) => {
    setDraft({
      quantity: type === 'receive' ? String(item.order_qty || '') : '',
      supplier: type === 'receive' ? String(item.order_supplier || '') : '',
      cost: type === 'receive' ? costText(item.order_cost ?? item.last_purchase_cost) : '',
      eta: '',
    });
    setModal({ type, item });
  };

  const closeModal = () => setModal(null);

  const runSave = async (fn, successMsg, nextTab) => {
    const id = modal?.item?.inventory_id;
    if (!id) return;
    setBusyId(id);
    try {
      await fn(id);
      closeModal();
      if (nextTab) setTab(nextTab);
      bump();
      showMessage('Başarılı', successMsg);
    } catch (err) {
      showMessage('Hata', err.message || 'Kaydedilemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const onPlaceOrder = () => {
    const qty = Number(draft.quantity || 0);
    if (qty <= 0 || !draft.supplier.trim()) {
      showMessage('Eksik alan', 'Adet ve nereden alındığı zorunludur.');
      return;
    }
    runSave(
      (id) =>
        InventoryAPI.placeOrder(id, {
          quantity: qty,
          supplier: draft.supplier.trim(),
          cost: draft.cost,
          eta: draft.eta || '',
        }),
      'Sipariş kaydedildi.',
      'orders'
    );
  };

  const onReceive = () => {
    const qty = Number(draft.quantity || 0);
    if (qty <= 0) {
      showMessage('Eksik alan', 'Teslim adedi zorunludur.');
      return;
    }
    runSave(
      (id) => InventoryAPI.receiveOrder(id, { quantity: qty, cost: draft.cost }),
      'Teslim alındı.',
      'stock'
    );
  };

  const onAddStock = () => {
    const qty = Number(draft.quantity || 0);
    if (qty <= 0 || !draft.supplier.trim()) {
      showMessage('Eksik alan', 'Adet ve nereden alındığı zorunludur.');
      return;
    }
    runSave(
      (id) =>
        InventoryAPI.addStock(id, {
          quantity: qty,
          supplier: draft.supplier.trim(),
          cost: draft.cost,
        }),
      'Stok güncellendi.',
      'stock'
    );
  };

  const onCreate = async () => {
    if (!form.item_name.trim()) {
      showMessage('Eksik alan', 'Ürün adı zorunludur.');
      return;
    }
    setCreating(true);
    try {
      await InventoryAPI.create(form.item_name.trim(), Number(form.quantity || 0));
      setForm({ item_name: '', quantity: '0' });
      setFormOpen(false);
      bump();
      showMessage('Başarılı', 'Ürün eklendi.');
    } catch (err) {
      showMessage('Hata', err.message || 'Eklenemedi.');
    } finally {
      setCreating(false);
    }
  };

  const loader = useCallback(() => ResourceAPI.get('inventory'), [tick]);
  const { data, loading, refreshing, error, refresh } = useFetch(loader);
  const allItems = data?.data || [];
  const items =
    tab === 'stock'
      ? allItems.filter((i) => i.status === 'in_stock')
      : tab === 'orders'
        ? allItems.filter((i) => i.status === 'ordered')
        : allItems.filter((i) => i.status === 'needed');

  return (
    <PageScaffold
      title="📦 Stok"
      subtitle="Kritik · Sipariş · Stok"
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
      headerExtra={
        <TabPills
          tabs={[
            { key: 'critical', label: 'Kritikler', shortLabel: 'Kritik' },
            { key: 'orders', label: 'Sipariş', shortLabel: 'Sipariş' },
            { key: 'stock', label: 'Stoktakiler', shortLabel: 'Stok' },
          ]}
          activeKey={tab}
          onChange={setTab}
        />
      }
    >
      <AppPressable
        title="Takvime dön"
        color={COLORS.textSecondary}
        variant="outline"
        onPress={() => navigateTo('calendar')}
        style={{ marginBottom: 10 }}
      />

      <View style={styles.drawer}>
        <Pressable
          onPress={() => setFormOpen((open) => !open)}
          style={styles.drawerHead}
          accessibilityRole="button"
          accessibilityState={{ expanded: formOpen }}
        >
          <Text style={styles.drawerTitle}>Yeni ürün ekle</Text>
          <Ionicons name={formOpen ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.accent} />
        </Pressable>
        {formOpen ? (
          <View style={styles.drawerBody}>
            <FormInput
              placeholder="Ürün adı"
              value={form.item_name}
              onChangeText={(v) => setForm((p) => ({ ...p, item_name: v }))}
            />
            <FormInput
              placeholder="Miktar"
              keyboardType="number-pad"
              value={form.quantity}
              onChangeText={(v) => setForm((p) => ({ ...p, quantity: v }))}
            />
            <SubmitButton title="Ekle" loading={creating} onPress={onCreate} />
          </View>
        ) : null}
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>
          {tab === 'stock' ? 'Stokta kayıt yok.' : tab === 'orders' ? 'Açık sipariş yok.' : 'Kritik kayıt yok.'}
        </Text>
      ) : (
        items.map((item) => (
          <MobileCard
            key={String(item.inventory_id)}
            borderColor={
              item.status === 'needed'
                ? COLORS.danger
                : item.status === 'ordered'
                  ? COLORS.warning
                  : COLORS.success
            }
          >
            <View style={styles.stockHead}>
              <View style={styles.stockInfo}>
                <Text style={styles.title} numberOfLines={2}>{item.item_name}</Text>
                <Text style={styles.meta}>
                  Stok: {item.quantity} {item.unit || 'adet'} · min {item.min_quantity ?? 5}
                </Text>
                {item.status === 'ordered' ? (
                  <Text style={styles.meta}>
                    Sipariş: {item.order_qty || '—'}
                    {item.order_supplier ? ` · ${item.order_supplier}` : ''}
                    {Number(item.order_cost) > 0 ? ` · ${item.order_cost} TL` : ''}
                    {item.order_eta ? ` · ${item.order_eta}` : ''}
                  </Text>
                ) : null}
              </View>
              {tab === 'critical' ? (
                <AppPressable
                  title="Sipariş ver"
                  color={COLORS.warning}
                  disabled={busyId === item.inventory_id}
                  onPress={() => openModal('order', item)}
                  style={styles.statusBtn}
                  textStyle={styles.statusBtnText}
                />
              ) : null}
              {tab === 'orders' ? (
                <AppPressable
                  title="Teslim alındı"
                  color={COLORS.success}
                  disabled={busyId === item.inventory_id}
                  onPress={() => openModal('receive', item)}
                  style={styles.statusBtn}
                  textStyle={styles.statusBtnText}
                />
              ) : null}
              {tab === 'stock' ? (
                <AppPressable
                  title="Stok ekle"
                  color={COLORS.primary}
                  disabled={busyId === item.inventory_id}
                  onPress={() => openModal('add', item)}
                  style={styles.statusBtn}
                  textStyle={styles.statusBtnText}
                />
              ) : null}
            </View>
          </MobileCard>
        ))
      )}

      <InventoryModal
        visible={modal?.type === 'order'}
        title="Sipariş ver"
        onClose={closeModal}
      >
        <FormLabel>Adet</FormLabel>
        <FormInput
          placeholder="Kaç adet"
          keyboardType="number-pad"
          value={draft.quantity}
          onChangeText={(v) => setDraft((p) => ({ ...p, quantity: v }))}
        />
        <FormLabel>Nereden</FormLabel>
        <FormInput
          placeholder="Tedarikçi / mağaza"
          value={draft.supplier}
          onChangeText={(v) => setDraft((p) => ({ ...p, supplier: v }))}
        />
        <FormLabel>Tutar (TL)</FormLabel>
        <FormInput
          placeholder="Opsiyonel"
          keyboardType="decimal-pad"
          value={draft.cost}
          onChangeText={(v) => setDraft((p) => ({ ...p, cost: v }))}
        />
        <FormLabel>Tahmini geliş (zorunlu değil)</FormLabel>
        <DateInput value={draft.eta} onChangeValue={(v) => setDraft((p) => ({ ...p, eta: v || '' }))} />
        <SubmitButton title="Kaydet" loading={busyId != null} onPress={onPlaceOrder} />
        <AppPressable title="Vazgeç" color={COLORS.textPrimary} variant="outline" onPress={closeModal} style={{ marginTop: 8 }} />
      </InventoryModal>

      <InventoryModal
        visible={modal?.type === 'receive'}
        title="Teslim alındı"
        onClose={closeModal}
      >
        {modal?.item?.order_supplier ? (
          <Text style={styles.meta}>Sipariş: {modal.item.order_supplier}</Text>
        ) : null}
        <FormLabel>Adet</FormLabel>
        <FormInput
          placeholder="Kaç adet teslim alındı"
          keyboardType="number-pad"
          value={draft.quantity}
          onChangeText={(v) => setDraft((p) => ({ ...p, quantity: v }))}
        />
        <FormLabel>Satın alma ücreti (TL)</FormLabel>
        <FormInput
          placeholder={costText(modal?.item?.order_cost) ? String(modal.item.order_cost) : 'Boş bırakılabilir'}
          keyboardType="decimal-pad"
          value={draft.cost}
          onChangeText={(v) => setDraft((p) => ({ ...p, cost: v }))}
        />
        <SubmitButton title="Kaydet" loading={busyId != null} onPress={onReceive} />
        <AppPressable title="Vazgeç" color={COLORS.textPrimary} variant="outline" onPress={closeModal} style={{ marginTop: 8 }} />
      </InventoryModal>

      <InventoryModal
        visible={modal?.type === 'add'}
        title="Stok ekle"
        onClose={closeModal}
      >
        <FormLabel>Adet</FormLabel>
        <FormInput
          placeholder="Kaç adet"
          keyboardType="number-pad"
          value={draft.quantity}
          onChangeText={(v) => setDraft((p) => ({ ...p, quantity: v }))}
        />
        <FormLabel>Nereden</FormLabel>
        <FormInput
          placeholder="Tedarikçi / mağaza"
          value={draft.supplier}
          onChangeText={(v) => setDraft((p) => ({ ...p, supplier: v }))}
        />
        <FormLabel>Tutar (TL)</FormLabel>
        <FormInput
          placeholder="Opsiyonel"
          keyboardType="decimal-pad"
          value={draft.cost}
          onChangeText={(v) => setDraft((p) => ({ ...p, cost: v }))}
        />
        <SubmitButton title="Kaydet" loading={busyId != null} onPress={onAddStock} />
        <AppPressable title="Vazgeç" color={COLORS.textPrimary} variant="outline" onPress={closeModal} style={{ marginTop: 8 }} />
      </InventoryModal>
    </PageScaffold>
  );
}

export function GuestsScreen() {
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState({
    user_name: '',
    user_surname: '',
    user_phone: '',
    user_email: '',
  });
  const [creating, setCreating] = useState(false);
  const bump = () => setTick((t) => t + 1);

  const onCreate = async () => {
    if (!form.user_name.trim()) {
      showMessage('Eksik alan', 'Ad zorunludur.');
      return;
    }
    setCreating(true);
    try {
      await ResourceAPI.action('guests', { action: 'create', ...form });
      setForm({ user_name: '', user_surname: '', user_phone: '', user_email: '' });
      bump();
      showMessage('Başarılı', 'Misafir eklendi.');
    } catch (err) {
      showMessage('Hata', err.message || 'Eklenemedi.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ResourceListScreen
      title="👥 Misafirler"
      resource="guests"
      refreshKey={tick}
      headerForm={
        <FormCard title="Misafir ekle" icon="➕" borderColor={COLORS.primary}>
          <FormInput
            placeholder="Ad"
            value={form.user_name}
            onChangeText={(v) => setForm((p) => ({ ...p, user_name: v }))}
          />
          <FormInput
            placeholder="Soyad"
            value={form.user_surname}
            onChangeText={(v) => setForm((p) => ({ ...p, user_surname: v }))}
          />
          <FormInput
            placeholder="Telefon"
            keyboardType="phone-pad"
            value={form.user_phone}
            onChangeText={(v) => setForm((p) => ({ ...p, user_phone: v }))}
          />
          <FormInput
            placeholder="E-posta"
            autoCapitalize="none"
            value={form.user_email}
            onChangeText={(v) => setForm((p) => ({ ...p, user_email: v }))}
          />
          <SubmitButton title="Kaydet" loading={creating} onPress={onCreate} />
        </FormCard>
      }
      renderItem={(item) => (
        <MobileCard key={String(item.user_id)} borderColor={COLORS.primary}>
          <Text style={styles.title}>
            {item.user_name} {item.user_surname || ''}
          </Text>
          <Text style={styles.meta}>📞 {item.user_phone || '—'}</Text>
          <Text style={styles.meta}>✉️ {item.user_email || '—'}</Text>
          <Text style={styles.meta}>
            TC: {item.user_tc || '—'} · Pasaport: {item.user_passport || '—'}
          </Text>
          <ActionRow
            actions={[
              {
                label: 'Sil',
                color: COLORS.danger,
                delete: true,
                onPress: () =>
                  runResourceAction(
                    () => ResourceAPI.action('guests', { action: 'delete', user_id: item.user_id }),
                    bump,
                    'Misafir silindi.'
                  ),
              },
            ]}
          />
        </MobileCard>
      )}
    />
  );
}

export function ExtraProductsScreen() {
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState({
    product_name: '',
    product_price: '',
    product_category: 'Genel',
  });
  const [creating, setCreating] = useState(false);
  const bump = () => setTick((t) => t + 1);

  const onCreate = async () => {
    if (!form.product_name.trim()) {
      showMessage('Eksik alan', 'Ürün adı zorunludur.');
      return;
    }
    setCreating(true);
    try {
      await ResourceAPI.action('extra_products', {
        action: 'create',
        product_name: form.product_name.trim(),
        product_price: Number(form.product_price || 0),
        product_category: form.product_category.trim() || 'Genel',
        status: 'active',
      });
      setForm({ product_name: '', product_price: '', product_category: 'Genel' });
      bump();
      showMessage('Başarılı', 'Ürün eklendi.');
    } catch (err) {
      showMessage('Hata', err.message || 'Eklenemedi.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ResourceListScreen
      title="🛒 Ekstra Ürünler"
      resource="extra_products"
      refreshKey={tick}
      headerForm={
        <FormCard title="Ürün ekle" icon="➕" borderColor={COLORS.primary}>
          <FormInput
            placeholder="Ürün adı"
            value={form.product_name}
            onChangeText={(v) => setForm((p) => ({ ...p, product_name: v }))}
          />
          <FormInput
            placeholder="Fiyat (₺)"
            keyboardType="decimal-pad"
            value={form.product_price}
            onChangeText={(v) => setForm((p) => ({ ...p, product_price: v }))}
          />
          <FormInput
            placeholder="Kategori"
            value={form.product_category}
            onChangeText={(v) => setForm((p) => ({ ...p, product_category: v }))}
          />
          <SubmitButton title="Ekle" loading={creating} onPress={onCreate} />
        </FormCard>
      }
      renderItem={(item) => (
        <MobileCard key={String(item.product_id)} borderColor={COLORS.primary}>
          <Text style={styles.title}>{item.product_name}</Text>
          <Text style={styles.meta}>{item.product_category}</Text>
          <Text style={styles.discount}>₺{Number(item.product_price).toFixed(2)}</Text>
          <Text style={styles.meta}>{STATUS_LABELS[item.status] || item.status}</Text>
          <ActionRow
            actions={[
              {
                label: item.status === 'active' ? 'Pasifleştir' : 'Aktifleştir',
                color: COLORS.warning,
                onPress: () =>
                  runResourceAction(
                    () =>
                      ResourceAPI.action('extra_products', {
                        action: 'toggle',
                        product_id: item.product_id,
                      }),
                    bump
                  ),
              },
              {
                label: 'Sil',
                color: COLORS.danger,
                delete: true,
                onPress: () =>
                  runResourceAction(
                    () =>
                      ResourceAPI.action('extra_products', {
                        action: 'delete',
                        product_id: item.product_id,
                      }),
                    bump,
                    'Ürün silindi.'
                  ),
              },
            ]}
          />
        </MobileCard>
      )}
    />
  );
}

export function RoomFeaturesScreen() {
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const bump = () => setTick((t) => t + 1);

  const onCreate = async () => {
    if (!name.trim()) {
      showMessage('Eksik alan', 'Özellik adı zorunludur.');
      return;
    }
    setCreating(true);
    try {
      await ResourceAPI.action('room_features', { action: 'create', feature_name: name.trim() });
      setName('');
      bump();
      showMessage('Başarılı', 'Özellik eklendi.');
    } catch (err) {
      showMessage('Hata', err.message || 'Eklenemedi.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ResourceListScreen
      title="⭐ Oda Özellikleri"
      resource="room_features"
      refreshKey={tick}
      headerForm={
        <FormCard title="Özellik ekle" icon="➕" borderColor={COLORS.info}>
          <FormInput placeholder="Özellik adı" value={name} onChangeText={setName} />
          <SubmitButton title="Ekle" color={COLORS.info} loading={creating} onPress={onCreate} />
        </FormCard>
      }
      renderItem={(item) => (
        <MobileCard key={String(item.feature_id)} borderColor={COLORS.info}>
          <Text style={styles.title}>{item.feature_name}</Text>
          <Text style={styles.meta}>İkon: {item.feature_icon || 'bi-check'}</Text>
          <ActionRow
            actions={[
              {
                label: 'Sil',
                color: COLORS.danger,
                delete: true,
                onPress: () =>
                  runResourceAction(
                    () =>
                      ResourceAPI.action('room_features', {
                        action: 'delete',
                        feature_id: item.feature_id,
                      }),
                    bump
                  ),
              },
            ]}
          />
        </MobileCard>
      )}
    />
  );
}

export function RoomTypesScreen() {
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const bump = () => setTick((t) => t + 1);

  const onCreate = async () => {
    if (!name.trim()) {
      showMessage('Eksik alan', 'Tip adı zorunludur.');
      return;
    }
    setCreating(true);
    try {
      await ResourceAPI.action('room_types', { action: 'create', type_name: name.trim() });
      setName('');
      bump();
      showMessage('Başarılı', 'Oda tipi eklendi.');
    } catch (err) {
      showMessage('Hata', err.message || 'Eklenemedi.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ResourceListScreen
      title="🏷️ Oda Tipleri"
      resource="room_types"
      refreshKey={tick}
      headerForm={
        <FormCard title="Tip ekle" icon="➕" borderColor={COLORS.primary}>
          <FormInput placeholder="Tip adı" value={name} onChangeText={setName} />
          <SubmitButton title="Ekle" loading={creating} onPress={onCreate} />
        </FormCard>
      }
      renderItem={(item) => (
        <MobileCard key={String(item.type_id)} borderColor={COLORS.primary}>
          <Text style={styles.title}>{item.type_name}</Text>
          <Text style={styles.meta}>ID: #{item.type_id}</Text>
          <ActionRow
            actions={[
              {
                label: 'Sil',
                color: COLORS.danger,
                delete: true,
                onPress: () =>
                  runResourceAction(
                    () =>
                      ResourceAPI.action('room_types', {
                        action: 'delete',
                        type_id: item.type_id,
                      }),
                    bump
                  ),
              },
            ]}
          />
        </MobileCard>
      )}
    />
  );
}

export function ExploreScreen() {
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  return (
    <ResourceListScreen
      title="🧭 Kaş Rehberi"
      resource="explore"
      refreshKey={tick}
      renderItem={(item) => (
        <MobileCard key={String(item.id)} borderColor={COLORS.success}>
          <Text style={styles.title}>{item.title_tr || item.slug}</Text>
          <Text style={styles.meta}>
            {EXPLORE_TYPES[item.type] || item.type} · {item.distance || '—'} · {item.duration || '—'}
          </Text>
          <Text style={styles.meta} numberOfLines={2}>
            {item.desc_tr || 'Açıklama yok'}
          </Text>
          <Text style={styles.meta}>{item.status == 1 ? 'Aktif' : 'Pasif'}</Text>
          <ActionRow
            actions={[
              {
                label: item.status == 1 ? 'Pasifleştir' : 'Aktifleştir',
                color: COLORS.warning,
                onPress: () =>
                  runResourceAction(
                    () => ResourceAPI.action('explore', { action: 'toggle', id: item.id }),
                    bump
                  ),
              },
              {
                label: 'Sil',
                color: COLORS.danger,
                delete: true,
                onPress: () =>
                  runResourceAction(
                    () => ResourceAPI.action('explore', { action: 'delete', id: item.id }),
                    bump
                  ),
              },
            ]}
          />
        </MobileCard>
      )}
    />
  );
}

export function QRCodesScreen() {
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState({ title: '', content: '' });
  const [creating, setCreating] = useState(false);
  const bump = () => setTick((t) => t + 1);

  const onCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      showMessage('Eksik alan', 'Başlık ve içerik zorunludur.');
      return;
    }
    setCreating(true);
    try {
      await ResourceAPI.action('qrcodes', { action: 'create', ...form });
      setForm({ title: '', content: '' });
      bump();
      showMessage('Başarılı', 'QR kod eklendi.');
    } catch (err) {
      showMessage('Hata', err.message || 'Eklenemedi.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ResourceListScreen
      title="📱 QR Kod Yönetimi"
      resource="qrcodes"
      refreshKey={tick}
      headerForm={
        <FormCard title="QR ekle" icon="➕" borderColor={COLORS.primaryDark}>
          <FormInput
            placeholder="Başlık"
            value={form.title}
            onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
          />
          <FormInput
            placeholder="URL veya metin"
            autoCapitalize="none"
            value={form.content}
            onChangeText={(v) => setForm((p) => ({ ...p, content: v }))}
          />
          <SubmitButton title="Kaydet" color={COLORS.primaryDark} loading={creating} onPress={onCreate} />
        </FormCard>
      }
      renderItem={(item) => (
        <MobileCard key={String(item.id)} borderColor={COLORS.primaryDark}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>ID: #{item.id}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {item.content || 'İçerik yok'}
          </Text>
          <ActionRow
            actions={[
              {
                label: 'Sil',
                color: COLORS.danger,
                delete: true,
                onPress: () =>
                  runResourceAction(
                    () => ResourceAPI.action('qrcodes', { action: 'delete', id: item.id }),
                    bump
                  ),
              },
            ]}
          />
        </MobileCard>
      )}
    />
  );
}

export function PoliciesScreen() {
  return (
    <ResourceListScreen
      title="📜 Politikalar"
      resource="policies"
      renderItem={(item) => (
        <MobileCard key={String(item.page_id)} borderColor={COLORS.primary}>
          <Text style={styles.title}>{item.page_title}</Text>
          <Text style={styles.meta}>Slug: {item.page_slug}</Text>
          <Text style={styles.meta}>Güncelleme: {item.updated_at}</Text>
          <Text style={styles.hint}>İçerik düzenleme web panelinden yapılır.</Text>
        </MobileCard>
      )}
    />
  );
}

export function GalleryScreen() {
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  return (
    <ResourceListScreen
      title="🖼️ Galeri"
      resource="gallery"
      refreshKey={tick}
      renderItem={(item) => (
        <MobileCard
          key={String(item.gallery_id)}
          borderColor={item.is_showcase == 1 ? COLORS.accent : COLORS.border}
        >
          <Text style={styles.title}>{item.title || 'Görsel'}</Text>
          <Text style={styles.meta}>{item.category || 'Genel'}</Text>
          <Text style={styles.meta}>
            {item.is_showcase == 1 ? '⭐ Vitrin' : 'Galeri'} · {item.image_path}
          </Text>
          <ActionRow
            actions={[
              {
                label: item.is_showcase == 1 ? 'Vitrinden Çıkar' : 'Vitrine Al',
                color: COLORS.warning,
                onPress: () =>
                  runResourceAction(
                    () =>
                      ResourceAPI.action('gallery', {
                        action: 'toggle_showcase',
                        gallery_id: item.gallery_id,
                      }),
                    bump
                  ),
              },
              {
                label: 'Sil',
                color: COLORS.danger,
                delete: true,
                onPress: () =>
                  runResourceAction(
                    () =>
                      ResourceAPI.action('gallery', {
                        action: 'delete',
                        gallery_id: item.gallery_id,
                      }),
                    bump
                  ),
              },
            ]}
          />
        </MobileCard>
      )}
    />
  );
}

export function StaffScreen() {
  return (
    <ResourceListScreen
      title="👔 Personel & Yetki"
      resource="staff"
      renderItem={(item) => (
        <MobileCard
          key={String(item.admin_id)}
          borderColor={item.is_super == 1 ? COLORS.accent : COLORS.primary}
        >
          <Text style={styles.title}>{item.admin_adsoyad || item.admin_kadi}</Text>
          <Text style={styles.meta}>@{item.admin_kadi}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {item.is_super == 1 ? 'Süper Admin' : item.role_name || 'Personel'}
            </Text>
          </View>
          <Text style={styles.hint}>Personel ekleme/düzenleme web panelinden yapılır.</Text>
        </MobileCard>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { color: COLORS.textMuted, textAlign: 'center', padding: 24 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textSecondary },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, fontStyle: 'italic' },
  discount: { fontSize: 18, fontWeight: '800', color: COLORS.success, marginTop: 6 },
  stockHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stockInfo: { flex: 1, minWidth: 0 },
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
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
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
  stockMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 4,
    maxWidth: '58%',
  },
  statusBtn: {
    minHeight: 28,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBtnText: { fontSize: 10, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
});
