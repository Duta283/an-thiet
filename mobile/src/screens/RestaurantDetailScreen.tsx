import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';
import type { ContentItem, Restaurant } from '../api/types';
import { ContentItemCard } from '../components/ContentItemCard';
import { colors } from '../theme';

export function RestaurantDetailScreen({
  route,
  navigation,
}: {
  route: { params: { id: string } };
  navigation: any;
}) {
  const { id } = route.params;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    api.restaurantDetail(id).then(setRestaurant).catch(console.warn);
    api.restaurantContents(id).then(setContents).catch(console.warn);
  }, [id]);

  useEffect(load, [load]);

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Đang tải…</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={contents}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <ContentItemCard item={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.name}>{restaurant.name}</Text>
          {!!restaurant.address && (
            <Text style={styles.muted}>{restaurant.address}</Text>
          )}
          <Text style={styles.muted}>
            {restaurant.cuisineTypes.join(' · ')}
          </Text>
          <Text style={styles.stats}>
            {restaurant.verifiedContentCount ?? 0} nội dung "ăn thiệt" ·{' '}
            {restaurant.contentCount ?? 0} tổng
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() =>
                navigation.navigate('Checkin', {
                  restaurantId: restaurant.id,
                  restaurantName: restaurant.name,
                })
              }
            >
              <Text style={styles.primaryBtnText}>Check-in tại quán</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              disabled={saved}
              onPress={async () => {
                try {
                  await api.saveRestaurant(restaurant.id);
                  setSaved(true);
                } catch (e) {
                  console.warn(e);
                }
              }}
            >
              <Text style={styles.secondaryBtnText}>
                {saved ? 'Đã để dành ✓' : 'Để dành'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>Chưa có nội dung về quán này</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  header: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 4,
    padding: 16,
  },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 14 },
  stats: { color: colors.verified, fontSize: 14, fontWeight: '600', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    padding: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  secondaryBtn: {
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  empty: { color: colors.textMuted, padding: 24, textAlign: 'center' },
});
