import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';
import type { CheckinResult } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import { formatDistance, haversineM } from '../utils/geo';

/**
 * Đặc tả 08 mục 3: giữ layout, thêm (1) dòng trạng thái GPS trước khi bấm,
 * (2) loading + kết quả rõ lý do thất bại (tính khoảng cách client-side làm hint).
 */

interface CapturedPhoto {
  uri: string;
  exif: Record<string, unknown> | null;
}

export function exifDateToIso(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

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

type GpsState =
  | { status: 'locating' }
  | { status: 'ready'; lat: number; lng: number; accuracy: number }
  | { status: 'denied' };

export function CheckinScreen({
  route,
  navigation,
}: {
  route: {
    params: {
      restaurantId: string;
      restaurantName: string;
      restaurantLat?: number;
      restaurantLng?: number;
    };
  };
  navigation: any;
}) {
  const { restaurantId, restaurantName, restaurantLat, restaurantLng } =
    route.params;
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [gps, setGps] = useState<GpsState>({ status: 'locating' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [failHint, setFailHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { userId } = useAuth();
  const trustBefore = useRef<number | null>(null);
  const [trustDelta, setTrustDelta] = useState<number | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  // Điểm tin cậy trước check-in — để hiển thị mức tăng ở màn thành công (mục 5)
  useEffect(() => {
    if (!userId) return;
    api
      .trust(userId)
      .then((t) => {
        trustBefore.current = t.trustScore;
      })
      .catch(() => {});
  }, [userId]);

  // Lấy vị trí NGAY khi mở màn — người dùng thấy trạng thái trước khi bấm
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setGps({ status: 'denied' });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        if (!cancelled) {
          setGps({
            status: 'ready',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? 999,
          });
        }
      } catch {
        if (!cancelled) setGps({ status: 'denied' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function takePhoto() {
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) throw new Error('Cần quyền camera để chụp ảnh xác thực');
      const res = await ImagePicker.launchCameraAsync({ exif: true, quality: 0.7 });
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
    if (gps.status !== 'ready') return;
    setBusy(true);
    setError(null);
    try {
      const exifPayload = photo ? extractExifPayload(photo.exif) : null;
      const res = await api.checkin({
        restaurantId,
        lat: gps.lat,
        lng: gps.lng,
        accuracy: gps.accuracy,
        caption: caption || undefined,
        mediaType: photo ? 'image' : 'text',
        ...(exifPayload ? { exif: exifPayload } : {}),
      });
      // Hint lý do thất bại (client-side, khớp logic backend)
      if (!res.isVerified && restaurantLat !== undefined && restaurantLng !== undefined) {
        const d = haversineM(gps.lat, gps.lng, restaurantLat, restaurantLng);
        if (d > 100 + gps.accuracy) {
          setFailHint(`Bạn đang cách quán ~${formatDistance(d)} — cần có mặt tại quán để xác thực.`);
        } else if (gps.accuracy > 50) {
          setFailHint(`Tín hiệu GPS đang kém (±${Math.round(gps.accuracy)}m) — thử ra chỗ thoáng rồi check-in lại.`);
        }
      }
      // Mức tăng điểm tin cậy — "khoảnh khắc thưởng" (mục 5)
      if (res.isVerified && userId && trustBefore.current !== null) {
        try {
          const after = await api.trust(userId);
          const delta = Math.round((after.trustScore - trustBefore.current) * 100);
          setTrustDelta(delta > 0 ? delta : 0);
        } catch {
          setTrustDelta(null);
        }
      }
      setResult(res);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }).start();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Ionicons
            name={result.isVerified ? 'checkmark-circle' : 'close-circle'}
            size={88}
            color={result.isVerified ? colors.verified : colors.danger}
          />
        </Animated.View>
        <Text style={styles.resultTitle}>
          {result.isVerified ? 'Ăn thiệt — đã xác thực!' : 'Chưa xác thực được'}
        </Text>
        {result.isVerified && trustDelta !== null && (
          <Animated.View
            style={[styles.deltaBadge, { transform: [{ scale: scaleAnim }] }]}
          >
            <Ionicons name="trending-up" size={16} color="#fff" />
            <Text style={styles.deltaText}>
              {trustDelta > 0
                ? `+${trustDelta} điểm tin cậy`
                : 'Điểm tin cậy sẽ tăng khi bạn check-in đều'}
            </Text>
          </Animated.View>
        )}
        {result.verifications.map((v) => (
          <View key={v.method} style={styles.methodRow}>
            <Ionicons
              name={v.result === 'passed' ? 'checkmark' : 'close'}
              size={15}
              color={v.result === 'passed' ? colors.verified : colors.danger}
            />
            <Text style={styles.muted}>
              {v.method === 'gps' ? 'Vị trí GPS' : v.method === 'exif' ? 'Ảnh chụp tại chỗ' : 'QR'}
              : {v.result === 'passed' ? 'đạt' : 'không đạt'}
              {v.confidence != null && v.result === 'passed'
                ? ` (tin cậy ${Math.round(v.confidence * 100)}%)`
                : ''}
            </Text>
          </View>
        ))}
        {!result.isVerified && (
          <Text style={[styles.muted, styles.hintText]}>
            {failHint ?? 'Hãy đứng gần quán hơn và bật GPS chính xác cao rồi thử lại.'}
          </Text>
        )}
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
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
        Ăn Gì Ta? xác thực bạn thật sự ở quán bằng GPS và ảnh chụp tại chỗ —
        không điểm sao, không quảng cáo, chỉ nội dung thật.
      </Text>

      <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={26} color={colors.textMuted} />
            <Text style={styles.photoBtnText}>Chụp ảnh tại quán</Text>
            <Text style={styles.photoBenefit}>
              Thêm lớp xác thực thứ 2 — nội dung được tin cậy cao hơn
            </Text>
          </View>
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

      {/* Dòng trạng thái GPS — đặc tả 08 mục 3 */}
      <View style={styles.gpsRow}>
        {gps.status === 'locating' && (
          <>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Text style={styles.gpsText}>Đang xác định vị trí…</Text>
          </>
        )}
        {gps.status === 'ready' && (
          <>
            <Ionicons name="locate" size={15} color={colors.verified} />
            <Text style={[styles.gpsText, { color: colors.verified }]}>
              Đã xác định vị trí (±{Math.round(gps.accuracy)}m)
            </Text>
          </>
        )}
        {gps.status === 'denied' && (
          <View style={styles.deniedBox}>
            <View style={styles.gpsRow}>
              <Ionicons name="location-outline" size={15} color={colors.textMuted} />
              <Text style={styles.gpsText}>
                Cần vị trí để xác thực bạn đang ở quán — chỉ dùng lúc check-in.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.settingsBtnText}>Mở Cài đặt để cấp quyền</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.primaryBtn, gps.status !== 'ready' && styles.primaryBtnDisabled]}
        onPress={submit}
        disabled={busy || gps.status !== 'ready'}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>
            {gps.status === 'locating'
              ? 'Đang chờ vị trí…'
              : gps.status === 'denied'
                ? 'Cần quyền vị trí để check-in'
                : 'Xác thực vị trí & đăng'}
          </Text>
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
    gap: 8,
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 14 },
  photoBtn: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    minHeight: 120,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 120,
  },
  photoBtnText: { color: colors.textMuted, fontSize: 14 },
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
  gpsRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  gpsText: { color: colors.textMuted, fontSize: 13.5 },
  error: { color: colors.danger },
  primaryBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 24,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '700', textAlign: 'center' },
  methodRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  deltaBadge: {
    alignItems: 'center',
    backgroundColor: colors.verified,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  deltaText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  deniedBox: { gap: 8 },
  settingsBtn: {
    alignSelf: 'flex-start',
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  settingsBtnText: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
  photoBenefit: { color: colors.textMuted, fontSize: 12, paddingHorizontal: 16, textAlign: 'center' },
  resultTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  hintText: { marginTop: 8, paddingHorizontal: 12, textAlign: 'center' },
});
