import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';
import type { SearchHit } from '../api/types';
import { RestaurantCard } from '../components/RestaurantCard';
import { colors } from '../theme';

/** Facet "dịp" — trục search khác biệt của Ăn Thiệt */
const OCCASIONS = [
  { key: '', label: 'Tất cả' },
  { key: 'an-khuya', label: 'Ăn khuya' },
  { key: 'hen-ho', label: 'Hẹn hò' },
  { key: 'gia-dinh', label: 'Gia đình' },
  { key: 'hop-nhom', label: 'Họp nhóm' },
  { key: 'an-trua', label: 'Ăn trưa' },
];

const PRICES = [
  { key: 0, label: 'Mọi giá' },
  { key: 50000, label: '≤50k' },
  { key: 100000, label: '≤100k' },
  { key: 200000, label: '≤200k' },
];

export function SearchScreen({ navigation }: { navigation: any }) {
  const [q, setQ] = useState('');
  const [occasion, setOccasion] = useState('');
  const [priceMax, setPriceMax] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search({
        q,
        occasion: occasion || undefined,
        priceMax: priceMax || undefined,
      });
      setHits(res.hits);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [q, occasion, priceMax]);

  useEffect(() => {
    run();
  }, [occasion, priceMax]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Món gì, quán gì? (vd: bún mắm)"
        placeholderTextColor={colors.textMuted}
        value={q}
        onChangeText={setQ}
        onSubmitEditing={run}
        returnKeyType="search"
      />

      <View style={styles.chips}>
        {OCCASIONS.map((o) => (
          <Chip
            key={o.key}
            label={o.label}
            active={occasion === o.key}
            onPress={() => setOccasion(o.key)}
          />
        ))}
      </View>
      <View style={styles.chips}>
        {PRICES.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            active={priceMax === p.key}
            onPress={() => setPriceMax(p.key)}
          />
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={hits}
        keyExtractor={(h) => h.id}
        refreshing={loading}
        onRefresh={run}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>
              Chưa có kết quả — thử từ khoá/bộ lọc khác
            </Text>
          )
        }
        renderItem={({ item }) => (
          <RestaurantCard
            data={{
              id: item.id,
              name: item.name,
              address: item.address,
              cuisineTypes: item.cuisine_types,
              priceMin: item.price_min || null,
              priceMax: item.price_max || null,
              verifiedCount: item.verified_count,
            }}
            onPress={() =>
              navigation.navigate('RestaurantDetail', { id: item.id })
            }
          />
        )}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.bg, flex: 1, paddingTop: 8 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginHorizontal: 12,
    padding: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  chip: {
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  empty: { color: colors.textMuted, padding: 24, textAlign: 'center' },
  error: { color: colors.danger, paddingHorizontal: 12, paddingTop: 8 },
});
