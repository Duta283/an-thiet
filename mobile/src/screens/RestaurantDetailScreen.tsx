import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
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
import { formatDistance, haversineM } from '../utils/geo';

/**
 * Đặc tả 08 mục 2: khối "Thông tin nhanh" (icon + text ngắn) dưới tên quán,
 * danh sách nội dung có header đếm, Check-in là nút chính nổi bật hơn Để dành.
 */
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
  const [distanceM, setDistanceM] = useState<number | null>(null);

  const load = useCallback(() => {
    api.restaurantDetail(id).then(setRestaurant).catch(console.warn);
    api.restaurantContents(id).then(setContents).catch(console.warn);
  }, [id]);

  useEffect(load, [load]);

  // Khoảng cách tới vị trí hiện tại — chỉ khi đã có quyền, không bật prompt ở màn này
  useEffect(() => {
    if (!restaurant) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getLastKnownPositionAsync();
        if (pos && !cancelled) {
          setDistanceM(
            haversineM(
              pos.coords.latitude,
              pos.coords.longitude,
              restaurant.lat,
              restaurant.lng,
            ),
          );
        }
      } catch {
        /* im lặng — thông tin phụ */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurant]);

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Đang tải…</Text>
      </View>
    );
  }

  const price =
    restaurant.priceMin && restaurant.priceMax
      ? `${Math.round(restaurant.priceMin / 1000)}k–${Math.round(restaurant.priceMax / 1000)}k`
      : null;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={contents}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <ContentItemCard item={item} />}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <Text style={styles.name}>{restaurant.name}</Text>
            {!!restaurant.address && (
              <Text style={styles.muted}>{restaurant.address}</Text>
            )}

            {/* Thông tin nhanh: hàng icon + text ngắn */}
            <View style={styles.quickRow}>
              {price && (
                <QuickInfo icon="pricetag-outline" text={price} />
              )}
              {distanceM !== null && (
                <QuickInfo
                  icon="location-outline"
                  text={`cách ${formatDistance(distanceM)}`}
                />
              )}
              <QuickInfo
                icon="restaurant-outline"
                text={restaurant.cuisineTypes.join(' · ')}
              />
            </View>

            {(restaurant.verifiedContentCount ?? 0) > 0 ? (
              <View style={styles.verifiedRow}>
                <Ionicons name="shield-checkmark" size={15} color={colors.verified} />
                <Text style={styles.stats}>
                  {restaurant.verifiedContentCount} nội dung "ăn thiệt" ·{' '}
                  {restaurant.contentCount ?? 0} tổng
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.verifiedRow}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('Checkin', {
                    restaurantId: restaurant.id,
                    restaurantName: restaurant.name,
                    restaurantLat: restaurant.lat,
                    restaurantLng: restaurant.lng,
                  })
                }
              >
                <Ionicons name="sparkles" size={15} color={colors.primary} />
                <Text style={styles.firstCta}>
                  Chưa có ai check-in — hãy là người đầu tiên xác thực quán này!
                </Text>
              </TouchableOpacity>
            )}

            {/* Check-in = nút chính; Để dành = nút phụ nhẹ hơn */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('Checkin', {
                    restaurantId: restaurant.id,
                    restaurantName: restaurant.name,
                    restaurantLat: restaurant.lat,
                    restaurantLng: restaurant.lng,
                  })
                }
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
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
                <Ionicons
                  name={saved ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.secondaryBtnText}>
                  {saved ? 'Đã để dành' : 'Để dành'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {contents.length > 0 && (
            <Text style={styles.sectionHeader}>
              Nội dung về quán ({contents.length})
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.border} />
          <Text style={styles.empty}>
            Chưa có nội dung về quán này{'\n'}Là người đầu tiên check-in nhé!
          </Text>
        </View>
      }
    />
  );
}

function QuickInfo({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.quickItem}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.quickText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  header: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 6,
    padding: 16,
  },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13.5 },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  quickItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  quickText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  verifiedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
  },
  stats: { color: colors.verified, fontSize: 13.5, fontWeight: '600' },
  firstCta: { color: colors.primary, flex: 1, fontSize: 13.5, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    flex: 1.7,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  secondaryBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  sectionHeader: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyBox: { alignItems: 'center', gap: 8, paddingTop: 36 },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
