import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Phân biệt trực quan BẮT BUỘC (định hướng PO):
 * - "Ăn thiệt ✓": nội dung user đã xác thực tại quán
 * - "Nguồn: TikTok/Threads": nội dung tổng hợp, luôn kèm credit
 */
export function VerifiedBadge() {
  return (
    <View style={[styles.badge, { backgroundColor: colors.verified }]}>
      <Text style={styles.text}>Ăn thiệt ✓</Text>
    </View>
  );
}

export function AggregatedBadge({ platform }: { platform: string | null }) {
  return (
    <View style={[styles.badge, { backgroundColor: colors.aggregated }]}>
      <Text style={styles.text}>
        Nguồn: {platform === 'tiktok' ? 'TikTok' : 'Threads'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
