import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import type { Profile, TrustBreakdown } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { getFirebaseAuth, isFirebaseMode } from '../auth/firebase';
import { colors } from '../theme';

/**
 * Đặc tả 08 mục 4: avatar tròn, 3 số liệu thành card bấm được,
 * card Điểm tin cậy giữ nguyên style (khuôn mẫu card toàn app),
 * khối Cài đặt, rút khoảng trắng.
 */
export function ProfileScreen() {
  const { userId, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trust, setTrust] = useState<TrustBreakdown | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    api.profile(userId).then(setProfile).catch(console.warn);
    api.trust(userId).then(setTrust).catch(console.warn);
  }, [userId]);

  useEffect(load, [load]);

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>
          {userId ? 'Đang tải…' : 'Chưa đăng nhập'}
        </Text>
      </View>
    );
  }

  const initial = (profile.displayName || '?').trim().charAt(0).toUpperCase();
  const version = Constants.expoConfig?.version ?? '0.1.0';

  function comingSoon(feature: string) {
    Alert.alert(feature, 'Tính năng sẽ có ở bản cập nhật sau.');
  }

  async function changePassword() {
    if (!isFirebaseMode()) {
      Alert.alert('Đổi mật khẩu', 'Chỉ khả dụng khi đăng nhập Firebase.');
      return;
    }
    const email = getFirebaseAuth().currentUser?.email;
    if (!email) return;
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      Alert.alert('Đã gửi email', `Link đổi mật khẩu đã gửi tới ${email}.`);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
    >
      {/* Avatar + tên */}
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.mutedSmall}>
            Thành viên từ {new Date(profile.createdAt).toLocaleDateString('vi-VN')}
          </Text>
        </View>
      </View>

      {/* 3 số liệu — card bấm được */}
      <View style={styles.statsCard}>
        <StatBox
          icon="people-outline"
          value={profile.followerCount}
          label="Follower"
          onPress={() => comingSoon('Danh sách follower')}
        />
        <View style={styles.statDivider} />
        <StatBox
          icon="person-add-outline"
          value={profile.followingCount}
          label="Đang theo dõi"
          onPress={() => comingSoon('Danh sách đang theo dõi')}
        />
        <View style={styles.statDivider} />
        <StatBox
          icon="checkmark-circle-outline"
          value={profile.verifiedContentCount}
          label={'Ăn thiệt'}
          onPress={() => comingSoon('Nội dung "ăn thiệt" của bạn')}
        />
      </View>

      {/* Điểm tin cậy — giữ nguyên style làm khuôn mẫu */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Điểm tin cậy</Text>
        <Text style={styles.score}>
          {Math.round(profile.trustScore * 100)}/100
        </Text>
        {trust && (
          <View style={{ gap: 4, marginTop: 8 }}>
            <Row
              label="Tỷ lệ nội dung đã xác thực"
              value={`${Math.round(trust.components.verifiedRatio * 100)}%`}
            />
            <Row
              label="Follower đáng tin cậy"
              value={String(trust.components.trustedFollowers)}
            />
            <Row
              label="Tuổi tài khoản"
              value={`${trust.components.accountAgeDays} ngày`}
            />
            <Row
              label="Nội dung bị report"
              value={`${Math.round(trust.components.reportedRatio * 100)}%`}
            />
          </View>
        )}
        <Text style={[styles.mutedSmall, { marginTop: 8 }]}>
          Điểm này chỉ dùng xếp hạng hiển thị nội dung — Ăn Gì Ta? không có
          điểm sao và không bán thứ hạng.
        </Text>
      </View>

      {/* Cài đặt */}
      <View style={styles.settingsCard}>
        <SettingRow
          icon="notifications-outline"
          label="Thông báo"
          onPress={() => comingSoon('Thông báo')}
        />
        <SettingRow
          icon="key-outline"
          label="Đổi mật khẩu"
          onPress={changePassword}
        />
        <SettingRow
          icon="information-circle-outline"
          label={`Về Ăn Gì Ta? — phiên bản ${version}`}
          onPress={() =>
            Alert.alert(
              'Ăn Gì Ta?',
              `Tìm quán ăn thật — không điểm sao, không quảng cáo.\n\nPhiên bản ${version} (pilot Quận 7)`,
            )
          }
        />
        <SettingRow
          icon="log-out-outline"
          label="Đăng xuất"
          danger
          onPress={signOut}
          last
        />
      </View>
    </ScrollView>
  );
}

function StatBox({
  icon,
  value,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.statBox, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function SettingRow({
  icon,
  label,
  onPress,
  danger,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingRow,
        !last && styles.settingRowBorder,
        pressed && { opacity: 0.6 },
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? colors.danger : colors.textMuted}
      />
      <Text style={[styles.settingLabel, danger && { color: colors.danger }]}>
        {label}
      </Text>
      {!danger && (
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      )}
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.mutedSmall}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  container: { gap: 12, padding: 16 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  mutedSmall: { color: colors.textMuted, fontSize: 13 },
  statsCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    paddingVertical: 12,
  },
  statBox: { alignItems: 'center', flex: 1, gap: 2 },
  statDivider: { backgroundColor: colors.border, width: 1 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  scoreCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  scoreLabel: { color: colors.textMuted, fontSize: 13 },
  score: { color: colors.primary, fontSize: 36, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  settingsCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
  },
  settingRowBorder: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  settingLabel: { color: colors.text, flex: 1, fontSize: 15 },
});
