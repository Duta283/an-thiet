import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

/** Facet "dịp" — trục search khác biệt của Ăn Gì Ta? */
const OCCASIONS = [
  { key: '', label: 'Tất cả' },
  { key: 'an-khuya', label: '🌙 Khuya' },
  { key: 'hen-ho', label: '💛 Hẹn hò' },
  { key: 'gia-dinh', label: '👨‍👩‍👧 Gia đình' },
  { key: 'hop-nhom', label: '🍻 Nhóm' },
  { key: 'an-trua', label: '☀️ Trưa' },
];

const PRICES = [
  { key: 0, label: 'Mọi giá' },
  { key: 50000, label: '≤50k' },
  { key: 100000, label: '≤100k' },
  { key: 200000, label: '≤200k' },
];

/** Ngừng gõ bao lâu thì tự tìm — search-as-you-type, không cần nhấn enter */
const DEBOUNCE_MS = 350;

export function SearchScreen({ navigation }: { navigation: any }) {
  const [q, setQ] = useState('');
  const [occasion, setOccasion] = useState('');
  const [priceMax, setPriceMax] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const run = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.search({
        q,
        occasion: occasion || undefined,
        priceMax: priceMax || undefined,
      });
      // Bỏ response về muộn — chỉ nhận kết quả của lần gõ mới nhất
      if (seq === requestSeq.current) setHits(res.hits);
    } catch (e) {
      if (seq === requestSeq.current) setError(String(e));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [q, occasion, priceMax]);

  // Search-as-you-type (feedback đội seed: không phải nhấn enter)
  useEffect(() => {
    const t = setTimeout(run, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [run]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Món gì, quán gì?"
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

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
        numColumns={2}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🍜</Text>
              <Text style={styles.empty}>
                Chưa thấy quán nào khớp{'\n'}Thử từ khoá khác xem
              </Text>
            </View>
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
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.bg, flex: 1, paddingTop: 8 },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 15 },
  input: { color: colors.text, flex: 1, fontSize: 16, paddingVertical: 12 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  chip: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  grid: { paddingBottom: 24, paddingHorizontal: 6, paddingTop: 6 },
  emptyBox: { alignItems: 'center', gap: 8, paddingTop: 48 },
  emptyEmoji: { fontSize: 40 },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  error: { color: colors.danger, paddingHorizontal: 12, paddingTop: 8 },
});
