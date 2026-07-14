import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import type { SavedRow } from '../api/types';
import { RestaurantCard } from '../components/RestaurantCard';
import { colors } from '../theme';

export function SavedScreen({ navigation }: { navigation: any }) {
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.savedList());
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={rows}
      keyExtractor={(r) => r.id}
      numColumns={2}
      contentContainerStyle={{ padding: 6 }}
      refreshing={loading}
      onRefresh={load}
      renderItem={({ item }) => (
        <RestaurantCard
          data={{
            id: item.restaurantId,
            name: item.name,
            cuisineTypes: item.cuisineTypes,
            thumbnailUrl: item.thumbnailUrl || null,
          }}
          onPress={() =>
            navigation.navigate('RestaurantDetail', { id: item.restaurantId })
          }
        />
      )}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Ionicons name="bookmark-outline" size={36} color={colors.border} />
          <Text style={styles.empty}>
            Chưa có quán nào để dành{'\n'}Thấy quán ưng ý ở tab Khám phá,{'\n'}bấm "Để dành" là nó nằm ở đây
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  emptyBox: { alignItems: 'center', gap: 10, paddingTop: 56 },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
