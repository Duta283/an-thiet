import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
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
          }}
          onPress={() =>
            navigation.navigate('RestaurantDetail', { id: item.restaurantId })
          }
        />
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>
          Chưa có quán để dành — bấm "Để dành" ở trang quán
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, padding: 24, textAlign: 'center' },
});
