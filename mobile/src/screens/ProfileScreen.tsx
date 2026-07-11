import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { api } from '../api/client';
import type { Profile, TrustBreakdown } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

/**
 * Trust score hiển thị kèm breakdown DIỄN GIẢI ĐƯỢC —
 * nguyên tắc mục 4.2: người dùng phải hiểu vì sao điểm của họ như vậy.
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

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <Text style={styles.name}>{profile.displayName}</Text>
      <Text style={styles.muted}>
        {profile.followerCount} follower · {profile.followingCount} đang theo dõi ·{' '}
        {profile.verifiedContentCount} nội dung "ăn thiệt"
      </Text>

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
        <Text style={[styles.muted, { marginTop: 8 }]}>
          Điểm này chỉ dùng xếp hạng hiển thị nội dung — Ăn Gì Ta? không có
          điểm sao và không bán thứ hạng.
        </Text>
      </View>

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  container: { gap: 8, padding: 16 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13 },
  scoreCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  scoreLabel: { color: colors.textMuted, fontSize: 13 },
  score: { color: colors.primary, fontSize: 36, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  signOut: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  signOutText: { color: colors.danger, fontWeight: '600', textAlign: 'center' },
});
