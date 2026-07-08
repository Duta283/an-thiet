import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';
import type { CheckinResult } from '../api/types';
import { colors } from '../theme';

/**
 * Check-in xác thực v0: GPS bắt buộc + ảnh chụp tại chỗ (EXIF) tuỳ chọn.
 *
 * Ảnh BẮT BUỘC chụp trong luồng (launchCameraAsync) — không cho chọn từ
 * thư viện, vì app mạng xã hội thường strip EXIF (đúng thiết kế mục 4.1).
 * Nếu ảnh không có geotag GPS (tuỳ quyền/thiết bị), app nói rõ và
 * check-in tiếp tục với GPS đơn thuần — không giả mạo exif từ vị trí.
 *
 * TODO(Spike 2): gắn Play Integrity / DeviceCheck token.
 */

interface CapturedPhoto {
  uri: string;
  exif: Record<string, unknown> | null;
}

/** EXIF "YYYY:MM:DD HH:mm:ss" → ISO; null nếu không parse được */
export function exifDateToIso(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Rút payload exif hợp lệ từ ảnh; null nếu thiếu geotag */
export function extractExifPayload(
  exif: Record<string, unknown> | null,
): { lat: number; lng: number; takenAt: string } | null {
  if (!exif) return null;
  const lat = exif.GPSLatitude;
  const lng = exif.GPSLongitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const signedLat = exif.GPSLatitudeRef === 'S' ? -Math.abs(lat) : lat;
  const signedLng = exif.GPSLongitudeRef === 'W' ? -Math.abs(lng) : lng;
  const takenAt =
    exifDateToIso(exif.DateTimeOriginal) ??
    exifDateToIso(exif.DateTime) ??
    new Date().toISOString();
  return { lat: signedLat, lng: signedLng, takenAt };
}

export function CheckinScreen({
  route,
  navigation,
}: {
  route: { params: { restaurantId: string; restaurantName: string } };
  navigation: any;
}) {
  const { restaurantId, restaurantName } = route.params;
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function takePhoto() {
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) throw new Error('Cần quyền camera để chụp ảnh xác thực');
      const res = await ImagePicker.launchCameraAsync({
        exif: true,
        quality: 0.7,
      });
      if (!res.canceled && res.assets[0]) {
        setPhoto({
          uri: res.assets[0].uri,
          exif: (res.assets[0].exif as Record<string, unknown>) ?? null,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Cần quyền vị trí để xác thực bạn đang ở quán');
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const exifPayload = photo ? extractExifPayload(photo.exif) : null;
      const res = await api.checkin({
        restaurantId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? 999,
        caption: caption || undefined,
        mediaType: photo ? 'image' : 'text',
        ...(exifPayload ? { exif: exifPayload } : {}),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <View style={styles.center}>
        <Text
          style={[
            styles.resultIcon,
            !result.isVerified && { color: colors.danger },
          ]}
        >
          {result.isVerified ? '✓' : '✕'}
        </Text>
        <Text style={styles.resultTitle}>
          {result.isVerified ? 'Ăn thiệt — đã xác thực!' : 'Chưa xác thực được'}
        </Text>
        {result.verifications.map((v) => (
          <Text key={v.method} style={styles.muted}>
            {v.method.toUpperCase()}: {v.result}
            {v.confidence != null ? ` (tin cậy ${Math.round(v.confidence * 100)}%)` : ''}
          </Text>
        ))}
        {!result.isVerified && (
          <Text style={[styles.muted, { marginTop: 8, textAlign: 'center' }]}>
            Hãy đứng gần quán hơn và bật GPS chính xác cao rồi thử lại.
          </Text>
        )}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.primaryBtnText}>Xong</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const exifOk = photo ? extractExifPayload(photo.exif) !== null : false;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check-in: {restaurantName}</Text>
      <Text style={styles.muted}>
        Ăn Thiệt xác thực bạn thật sự ở quán bằng GPS và ảnh chụp tại chỗ —
        không điểm sao, không quảng cáo, chỉ nội dung thật.
      </Text>

      <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
        ) : (
          <Text style={styles.photoBtnText}>📷 Chụp ảnh tại quán (khuyến khích)</Text>
        )}
      </TouchableOpacity>
      {photo && (
        <Text style={exifOk ? styles.exifOk : styles.exifWarn}>
          {exifOk
            ? '✓ Ảnh có geotag — sẽ dùng làm bằng chứng thứ 2'
            : 'Ảnh không có geotag (kiểm tra quyền vị trí của Camera) — check-in vẫn tiếp tục bằng GPS'}
        </Text>
      )}

      <TextInput
        style={styles.input}
        placeholder="Bạn ăn gì, thấy sao? (không bắt buộc)"
        placeholderTextColor={colors.textMuted}
        value={caption}
        onChangeText={setCaption}
        multiline
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Xác thực vị trí & đăng</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.bg, flex: 1, gap: 12, padding: 16 },
  center: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 14 },
  photoBtn: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 120,
    overflow: 'hidden',
  },
  photoBtnText: { color: colors.textMuted, fontSize: 15 },
  photoPreview: { height: 180, width: '100%' },
  exifOk: { color: colors.verified, fontSize: 13 },
  exifWarn: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    minHeight: 90,
    padding: 12,
    textAlignVertical: 'top',
  },
  error: { color: colors.danger },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 12,
    minWidth: 200,
    padding: 14,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  resultIcon: { color: colors.verified, fontSize: 56, fontWeight: '800' },
  resultTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
});
