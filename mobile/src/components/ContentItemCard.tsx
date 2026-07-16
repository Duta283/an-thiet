import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import type { ContentItem, OembedResult } from '../api/types';
import { colors } from '../theme';
import { AggregatedBadge, VerifiedBadge } from './VerifiedBadge';

/**
 * Post tổng hợp: trích dẫn + credit + link-out về post gốc.
 * - TikTok: caption trích dẫn lưu sẵn (Spike 1: được phép).
 * - Threads: KHÔNG lưu nội dung (tuân thủ) — thử lấy text qua oEmbed;
 *   không có text thì hiện KHUNG LINK-PREVIEW TRUNG TÍNH (doc 05 mục 3:
 *   không dùng copy "Không tải được..." vì đọc như lỗi — đây là giới hạn
 *   tuân thủ đã biết, không phải bug).
 */
export function ContentItemCard({ item }: { item: ContentItem }) {
  const needsOembed = item.origin === 'aggregated' && item.caption == null;
  const [oembed, setOembed] = useState<OembedResult | null>(null);

  useEffect(() => {
    if (!needsOembed) return;
    let cancelled = false;
    api
      .oembed(item.id)
      .then((r) => {
        if (!cancelled) setOembed(r);
      })
      .catch(() => {
        /* im lặng — khung link-preview đã là fallback tử tế */
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, needsOembed]);

  const text = item.caption ?? oembed?.text ?? null;
  const author = item.sourceAuthor ?? oembed?.authorName ?? null;
  const platformLabel = item.sourcePlatform === 'tiktok' ? 'TikTok' : 'Threads';

  function openSource() {
    if (item.sourceUrl) Linking.openURL(item.sourceUrl);
  }

  return (
    <View style={styles.card}>
      {item.isVerified ? (
        <VerifiedBadge />
      ) : item.origin === 'aggregated' ? (
        <AggregatedBadge platform={item.sourcePlatform} />
      ) : null}

      {!!text && <Text style={styles.caption}>{text}</Text>}

      {!!item.thumbnailUrl && (
        <Pressable onPress={openSource}>
          <Image source={{ uri: item.thumbnailUrl }} style={styles.sourceThumb} />
        </Pressable>
      )}

      {!!item.photoUrls?.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.photoRow}>
            {item.photoUrls.map((u) => (
              <Image key={u} source={{ uri: u }} style={styles.photo} />
            ))}
          </View>
        </ScrollView>
      )}

      {item.origin === 'aggregated' ? (
        text ? (
          <Pressable onPress={openSource}>
            <Text style={styles.credit}>
              Theo {author ?? 'tác giả gốc'} — xem bài gốc ↗
            </Text>
          </Pressable>
        ) : (
          /* Khung link-preview trung tính — nội dung thật, xem trên nền tảng gốc */
          <Pressable
            style={({ pressed }) => [
              styles.linkPreview,
              pressed && { opacity: 0.7 },
            ]}
            onPress={openSource}
          >
            <View style={styles.linkPreviewIcon}>
              <Ionicons name="open-outline" size={20} color={colors.aggregated} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkPreviewTitle}>
                Nội dung gốc trên {platformLabel}
                {author ? ` · ${author}` : ''}
              </Text>
              <Text style={styles.linkPreviewSub}>Nhấn để xem ↗</Text>
            </View>
          </Pressable>
        )
      ) : (
        <Text style={styles.author}>
          {item.userDisplayName ?? 'Người dùng'} · check-in tại quán
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  caption: { color: colors.text, fontSize: 15, lineHeight: 21 },
  sourceThumb: { borderRadius: 10, height: 170, width: '100%' },
  photoRow: { flexDirection: 'row', gap: 8 },
  photo: { borderRadius: 10, height: 110, width: 110 },
  credit: { color: colors.aggregated, fontSize: 13, fontWeight: '600' },
  author: { color: colors.textMuted, fontSize: 13 },
  linkPreview: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  linkPreviewIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF1FE',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  linkPreviewTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  linkPreviewSub: { color: colors.textMuted, fontSize: 12.5 },
});
