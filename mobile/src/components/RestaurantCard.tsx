import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export interface RestaurantCardData {
  id: string;
  name: string;
  address?: string | null;
  cuisineTypes: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  verifiedCount?: number;
  distanceM?: number;
}

function formatPrice(min?: number | null, max?: number | null): string {
  if (!min && !max) return '';
  const f = (n: number) => `${Math.round(n / 1000)}k`;
  if (min && max) return `${f(min)}–${f(max)}`;
  return f((min || max)!);
}

export function RestaurantCard({
  data,
  onPress,
}: {
  data: RestaurantCardData;
  onPress: () => void;
}) {
  const price = formatPrice(data.priceMin, data.priceMax);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.name} numberOfLines={1}>
          {data.name}
        </Text>
        {data.verifiedCount !== undefined && data.verifiedCount > 0 && (
          <Text style={styles.verified}>✓ {data.verifiedCount}</Text>
        )}
      </View>
      {!!data.address && (
        <Text style={styles.muted} numberOfLines={1}>
          {data.address}
        </Text>
      )}
      <View style={styles.row}>
        <Text style={styles.muted}>
          {data.cuisineTypes.join(' · ')}
          {price ? `  ·  ${price}` : ''}
        </Text>
        {data.distanceM !== undefined && (
          <Text style={styles.muted}>
            {data.distanceM < 1000
              ? `${Math.round(data.distanceM)}m`
              : `${(data.distanceM / 1000).toFixed(1)}km`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    marginHorizontal: 12,
    marginVertical: 5,
    padding: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' },
  verified: { color: colors.verified, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13 },
});
