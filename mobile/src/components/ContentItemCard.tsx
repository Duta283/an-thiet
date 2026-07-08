import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import type { ContentItem, OembedResult } from '../api/types';
import { colors } from '../theme';
import { AggregatedBadge, VerifiedBadge } from './VerifiedBadge';

/**
 * Post tổng hợp: trích dẫn + credit + link-out về post gốc.
 * - TikTok: caption trích dẫn lưu sẵn trong DB (Spike 1: được phép).
 * - Threads: DB KHÔNG lưu nội dung (điều khoản Meta) — caption lấy tươi
 *   qua /contents/:id/oembed tại thời điểm hiển thị.
 */
export function ContentItemCard({ item }: { item: ContentItem }) {
  const needsOembed =
    item.origin === 'aggregated' && item.caption == null;
  const [oembed, setOembed] = useState<OembedResult | null>(null);
  const [oembedFailed, setOembedFailed] = useState(false);

  useEffect(() => {
    if (!needsOembed) return;
    let cancelled = false;
    api
      .oembed(item.id)
      .then((r) => {
        if (!cancelled) setOembed(r);
      })
      .catch(() => {
        if (!cancelled) setOembedFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, needsOembed]);

  const text =
    item.caption ??
    oembed?.text ??
    (needsOembed && !oembedFailed && !oembed ? 'Đang tải nội dung gốc…' : null);
  const author = item.sourceAuthor ?? oembed?.authorName ?? null;

  return (
    <View style={styles.card}>
      {item.isVerified ? (
        <VerifiedBadge />
      ) : item.origin === 'aggregated' ? (
        <AggregatedBadge platform={item.sourcePlatform} />
      ) : null}

      {!!text && <Text style={styles.caption}>{text}</Text>}
      {oembedFailed && needsOembed && (
        <Text style={styles.mutedNote}>
          Không tải được nội dung — xem trực tiếp trên nền tảng gốc
        </Text>
      )}

      {item.origin === 'aggregated' ? (
        <Pressable
          onPress={() => item.sourceUrl && Linking.openURL(item.sourceUrl)}
        >
          <Text style={styles.credit}>
            Theo {author ?? 'tác giả gốc'} — xem bài gốc ↗
          </Text>
        </Pressable>
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
  mutedNote: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  credit: { color: colors.aggregated, fontSize: 13, fontWeight: '600' },
  author: { color: colors.textMuted, fontSize: 13 },
});
