import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FormCard, { FormInput, FormLabel } from './FormCard';
import { SubmitButton } from './SelectField';
import { ReservationAPI } from '../api';
import { COLORS } from '../theme';
import { showMessage } from '../utils/alert';

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

  const fileName = String(asset?.fileName || '');
  if (fileName.includes('.')) {
    const fromName = fileName.split('.').pop()?.toLowerCase() || '';
    if (fromName === 'jpeg') return 'jpg';
    if (['jpg', 'png', 'webp'].includes(fromName)) return fromName;
  }

  const uri = String(asset?.uri || '');
  if (uri.includes('.')) {
    const fromUri = uri.split('.').pop()?.toLowerCase() || '';
    if (fromUri === 'jpeg') return 'jpg';
    if (['jpg', 'png', 'webp'].includes(fromUri)) return fromUri;
  }

  return 'jpg';
}

const EMPTY_GUEST = {
  guest_row_id: 0,
  is_primary: false,
  user_name: '',
  user_surname: '',
  user_phone: '',
  user_email: '',
  user_tc: '',
  user_passport: '',
  user_nationality: '',
  user_birth_date: '',
  id_document_path: '',
  id_document_url: '',
};

function normalizeGuest(raw = {}, index = 0) {
  return {
    ...EMPTY_GUEST,
    ...raw,
    guest_row_id: Number(raw.guest_row_id || 0),
    is_primary: index === 0 || Boolean(raw.is_primary),
    user_name: raw.user_name || raw.guest_name || '',
    user_surname: raw.user_surname || raw.guest_surname || '',
  };
}

export default function StayingGuestsCard({ reservationId, initialGuests = [], adults = 1, onSaved }) {
  const [guests, setGuests] = useState(() =>
    (initialGuests.length ? initialGuests : [{ ...EMPTY_GUEST, is_primary: true }]).map(normalizeGuest)
  );
  const [busy, setBusy] = useState('');
  const [uploadingIndex, setUploadingIndex] = useState(null);

  useEffect(() => {
    if (initialGuests?.length) {
      setGuests(initialGuests.map(normalizeGuest));
    }
  }, [initialGuests]);

  const updateGuest = useCallback((index, field, value) => {
    setGuests((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }, []);

  const applyOcrFields = useCallback((index, fields) => {
    if (!fields || typeof fields !== 'object') return;
    setGuests((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item };
        if (fields.user_name) next.user_name = fields.user_name;
        if (fields.user_surname) next.user_surname = fields.user_surname;
        if (fields.user_tc) next.user_tc = fields.user_tc;
        if (fields.user_passport) next.user_passport = fields.user_passport;
        if (fields.user_nationality) next.user_nationality = fields.user_nationality;
        if (fields.user_birth_date) next.user_birth_date = fields.user_birth_date;
        if (fields.user_phone) next.user_phone = fields.user_phone;
        if (fields.user_email) next.user_email = fields.user_email;
        return next;
      })
    );
  }, []);

  const lookupGuest = useCallback(async (index) => {
    const guest = guests[index];
    if (!guest) return;

    const tc = String(guest.user_tc || '').trim();
    const passport = String(guest.user_passport || '').trim();
    if (tc.length < 5 && passport.length < 5) return;

    try {
      const res = await ReservationAPI.fetchGuest({
        user_tc: tc,
        user_passport: passport,
        user_name: guest.user_name,
        user_surname: guest.user_surname,
        reservation_id: reservationId,
      });
      if (!res?.found && !res?.data?.user_name) {
        return;
      }
      const profile = res.data || res;
      setGuests((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                user_name: profile.user_name || item.user_name,
                user_surname: profile.user_surname || item.user_surname,
                user_phone: profile.user_phone || item.user_phone,
                user_email: profile.user_email || item.user_email,
                user_nationality: profile.user_nationality || item.user_nationality,
                user_birth_date: profile.user_birth_date || item.user_birth_date,
                user_tc: profile.user_tc || item.user_tc,
                user_passport: profile.user_passport || item.user_passport,
              }
            : item
        )
      );
      showMessage('Bilgi', 'Kayıtlı misafir bilgileri dolduruldu.');
    } catch {
      // Sessiz — yeni misafir olabilir
    }
  }, [guests, reservationId]);

  const addGuest = () => {
    setGuests((prev) => [...prev, normalizeGuest({}, prev.length)]);
  };

  const removeGuest = (index) => {
    if (index === 0) return;
    setGuests((prev) => prev.filter((_, i) => i !== index));
  };

  const saveGuests = async () => {
    const missingBirthDate = guests.some((guest) => !String(guest.user_birth_date || '').trim());
    if (missingBirthDate) {
      showMessage('Hata', 'Tüm konaklayanlar için doğum tarihi zorunludur.');
      return;
    }

    setBusy('save');
    try {
      const payload = guests.map((guest, index) => ({
        ...guest,
        is_primary: index === 0,
      }));
      const res = await ReservationAPI.updateGuests(reservationId, payload);
      const saved = res?.staying_guests || res?.guests || payload;
      setGuests(saved.map(normalizeGuest));
      showMessage('Başarılı', res?.message || 'Konaklayan kişiler kaydedildi.');
      if (res?.warnings?.length) {
        showMessage('Uyarı', res.warnings.join(' '));
      }
      onSaved?.(saved);
    } catch (err) {
      showMessage('Hata', err.message || 'Kayıt başarısız.');
    } finally {
      setBusy('');
    }
  };

  const pickPhoto = async (index) => {
    if (!ImagePicker) {
      showMessage(
        'Kurulum gerekli',
        'Fotoğraf için mobil projede expo-image-picker kurulu olmalı. npm install expo-image-picker'
      );
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

    if (result.canceled || !result.assets?.[0]?.base64) {
      return;
    }

    setUploadingIndex(index);
    try {
      const asset = result.assets[0];
      const guest = guests[index];
      const upload = await ReservationAPI.uploadGuestId(reservationId, {
        guest_row_id: guest.guest_row_id || 0,
        image_base64: asset.base64,
        extension: extensionFromAsset(asset),
      });
      updateGuest(index, 'id_document_path', upload.id_document_path || '');
      updateGuest(index, 'id_document_url', upload.id_document_url || '');
      const ocrFields = upload.ocr_fields || upload.meta?.ocr_fields || {};
      const ocrMessage = upload?.ocr?.error || upload?.meta?.message || '';
      const filled = [
        ocrFields.user_name && `Ad: ${ocrFields.user_name}`,
        ocrFields.user_surname && `Soyad: ${ocrFields.user_surname}`,
        ocrFields.user_tc && `TC: ${ocrFields.user_tc}`,
        ocrFields.user_passport && `Pasaport: ${ocrFields.user_passport}`,
      ].filter(Boolean);
      if (filled.length > 0) {
        applyOcrFields(index, ocrFields);
        showMessage('OCR', `${filled.join('\n')}\n\nAlanları kontrol edip kaydedin.`);
      } else if (upload?.ocr?.ok === false && ocrMessage) {
        showMessage('OCR uyarısı', `Fotoğraf kaydedildi.\n${ocrMessage}`);
      } else {
        showMessage('Başarılı', upload?.meta?.message || 'Kimlik fotoğrafı kaydedildi.');
      }
      await lookupGuest(index);
    } catch (err) {
      showMessage('Hata', err.message || 'Fotoğraf yüklenemedi.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const hint = useMemo(
    () => `${guests.length} kişi · rezervasyon yetişkin: ${adults}`,
    [guests.length, adults]
  );

  return (
    <FormCard title="Konaklayan Kişiler" icon="👥" borderColor={COLORS.info}>
      <Text style={styles.subtitle}>{hint}</Text>
      {guests.map((guest, index) => (
        <View key={`guest-${index}-${guest.guest_row_id || 'new'}`} style={styles.guestBlock}>
          <View style={styles.guestHeader}>
            <Text style={styles.guestTitle}>{index === 0 ? 'Ana Misafir' : `Konaklayan #${index + 1}`}</Text>
            {index > 0 ? (
              <Text style={styles.removeLink} onPress={() => removeGuest(index)}>
                Kaldır
              </Text>
            ) : null}
          </View>

          <View style={styles.row2}>
            <View style={styles.half}>
              <FormLabel>TC Kimlik</FormLabel>
              <FormInput
                value={guest.user_tc}
                onChangeText={(v) => updateGuest(index, 'user_tc', v)}
                onBlur={() => lookupGuest(index)}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.half}>
              <FormLabel>Pasaport</FormLabel>
              <FormInput
                value={guest.user_passport}
                onChangeText={(v) => updateGuest(index, 'user_passport', v)}
                onBlur={() => lookupGuest(index)}
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={styles.half}>
              <FormLabel>Ad</FormLabel>
              <FormInput value={guest.user_name} onChangeText={(v) => updateGuest(index, 'user_name', v)} />
            </View>
            <View style={styles.half}>
              <FormLabel>Soyad</FormLabel>
              <FormInput value={guest.user_surname} onChangeText={(v) => updateGuest(index, 'user_surname', v)} />
            </View>
          </View>

          <FormLabel>Telefon</FormLabel>
          <FormInput
            keyboardType="phone-pad"
            value={guest.user_phone}
            onChangeText={(v) => updateGuest(index, 'user_phone', v)}
          />

          <View style={styles.row2}>
            <View style={styles.half}>
              <FormLabel>Uyruk</FormLabel>
              <FormInput value={guest.user_nationality} onChangeText={(v) => updateGuest(index, 'user_nationality', v)} />
            </View>
            <View style={styles.half}>
              <FormLabel>Doğum Tarihi</FormLabel>
              <FormInput
                placeholder="YYYY-MM-DD"
                value={guest.user_birth_date}
                onChangeText={(v) => updateGuest(index, 'user_birth_date', v)}
              />
            </View>
          </View>

          <FormLabel>E-posta</FormLabel>
          <FormInput
            keyboardType="email-address"
            autoCapitalize="none"
            value={guest.user_email}
            onChangeText={(v) => updateGuest(index, 'user_email', v)}
          />

          {guest.id_document_url ? (
            <Text style={styles.photoHint}>📷 Kimlik/pasaport fotoğrafı yüklü</Text>
          ) : null}

          <View style={styles.photoRow}>
            <SubmitButton
              title="Galeriden Yükle"
              color={COLORS.warning}
              loading={uploadingIndex === index}
              onPress={() => pickPhoto(index)}
            />
          </View>
        </View>
      ))}

      <SubmitButton title="Konaklayan Kişi Ekle" color={COLORS.primary} onPress={addGuest} />
      <SubmitButton title="Tüm Konaklayanları Kaydet" loading={busy === 'save'} onPress={saveGuests} />
    </FormCard>
  );
}

const styles = StyleSheet.create({
  guestBlock: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafbfc',
  },
  guestHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  guestTitle: { fontWeight: '800', color: COLORS.textPrimary },
  removeLink: { color: COLORS.danger, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  photoRow: { gap: 8, marginTop: 8 },
  photoHint: { fontSize: 12, color: COLORS.success, marginTop: 4 },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  identityStatus: { fontSize: 12, color: COLORS.info, marginBottom: 8, fontWeight: '600' },
});
