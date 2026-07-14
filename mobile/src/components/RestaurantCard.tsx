import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export interface RestaurantCardData {
  id: string;
  name: string;
  address?: string | null; // giữ trong props nhưng KHÔNG hiển thị — feedback team: bớt chữ
  cuisineTypes: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  thumbnailUrl?: string | null;
  verifiedCount?: number;
  distanceM?: number;
}

const CUISINE_EMOJI: Record<string, string> = {
  bun: '🍜',
  'com-tam': '🍚',
  lau: '🍲',
  'banh-canh': '🍜',
  oc: '🐚',
  'hai-san': '🦐',
  'mien-tay': '🌾',
};

function cuisineEmoji(types: string[]): string {
  for (const t of types) {
    if (CUISINE_EMOJI[t]) return CUISINE_EMOJI[t];
  }
  return '🍽️';
}

function formatPrice(min?: number | null, max?: number | null): string {
  if (!min && !max) return '';
  const f = (n: number) => `${Math.round(n / 1000)}k`;
  if (min && max) return `${f(min)}–${f(max)}`;
  return f((min || max)!);
}

/**
 * Tile dạng lưới 2 cột (feedback đội seed: "ô vuông giống GrabFood, bớt chữ").
 * Khối ảnh đang là emoji món ăn — placeholder chờ pipeline ảnh quán thật
 * (cần PO/design chốt nguồn ảnh, xem mục bàn giao).
 */
export function RestaurantCard({
  data,
  onPress,
}: {
  data: RestaurantCardData;
  onPress: () => void;
}) {
  const price = formatPrice(data.priceMin, data.priceMax);
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      onPress={onPress}
    >
      <View style={styles.visual}>
        {data.thumbnailUrl ? (
          <Image
            source={{ uri: data.thumbnailUrl }}
            style={styles.visualImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.visualEmoji}>{cuisineEmoji(data.cuisineTypes)}</Text>
        )}
        {data.verifiedCount !== undefined && data.verifiedCount > 0 && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedBadgeText}>✓ {data.verifiedCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {data.name}
        </Text>
        <View style={styles.metaRow}>
          {!!price && <Text style={styles.price}>{price}</Text>}
          {data.distanceM !== undefined && (
            <Text style={styles.distance}>
              {data.distanceM < 1000
                ? `${Math.round(data.distanceM)}m`
                : `${(data.distanceM / 1000).toFixed(1)}km`}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    flex: 1,
    margin: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  tilePressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  visual: {
    alignItems: 'center',
    backgroundColor: colors.card,
    height: 92,
    justifyContent: 'center',
  },
  visualEmoji: { fontSize: 42 },
  visualImage: { height: '100%', width: '100%' },
  verifiedBadge: {
    backgroundColor: colors.verified,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    right: 6,
    top: 6,
  },
  verifiedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  info: { gap: 2, padding: 10 },
  // 2 dòng + minHeight để các tile trong cùng hàng cao đều nhau
  name: { color: colors.text, fontSize: 14.5, fontWeight: '700', lineHeight: 19, minHeight: 38 },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  price: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  distance: { color: colors.textMuted, fontSize: 12 },
});
