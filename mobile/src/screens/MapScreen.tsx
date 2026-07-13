import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api/client';
import type { Restaurant } from '../api/types';
import { RestaurantCard } from '../components/RestaurantCard';
import { DEFAULT_CENTER, GOONG_MAPTILES_KEY } from '../config';
import { colors } from '../theme';

/**
 * Bản đồ qua MapLibre GL trong WebView (tương thích style Goong).
 * Đặc tả 08: ẩn icon POI không liên quan của nền Goong (giữ pin quán của app);
 * thanh dưới bấm được → mở danh sách quán trượt lên.
 */
export function MapScreen({ navigation }: { navigation: any }) {
  const webref = useRef<WebView>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    api
      .nearbyRestaurants(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, 6000)
      .then(setRestaurants)
      .catch(() => setRestaurants([]));
  }, []);

  useEffect(() => {
    if (restaurants.length && webref.current) {
      webref.current.postMessage(JSON.stringify(restaurants));
    }
  }, [restaurants]);

  const hasGoongKey =
    GOONG_MAPTILES_KEY && !GOONG_MAPTILES_KEY.startsWith('YOUR_');

  const styleExpr = hasGoongKey
    ? `'https://tiles.goong.io/assets/goong_map_web.json?api_key=${GOONG_MAPTILES_KEY}'`
    : `{
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      }`;

  const html = `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>html,body,#map{margin:0;height:100%}</style>
  </head><body><div id="map"></div><script>
    var map = new maplibregl.Map({
      container: 'map',
      style: ${styleExpr},
      center: [${DEFAULT_CENTER.lng}, ${DEFAULT_CENTER.lat}],
      zoom: 13
    });
    // Ẩn POI nền không liên quan (shop, dịch vụ...) — giữ đường/địa danh lớn
    map.on('load', function () {
      map.getStyle().layers.forEach(function (l) {
        if (/poi|shop|amenity/i.test(l.id)) {
          try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch (e) {}
        }
      });
    });
    function render(list) {
      list.forEach(function (r) {
        var marker = new maplibregl.Marker({ color: '${colors.primary}' })
          .setLngLat([r.lng, r.lat]).addTo(map);
        marker.getElement().addEventListener('click', function () {
          window.ReactNativeWebView.postMessage(r.id);
        });
      });
    }
    document.addEventListener('message', function (e) { render(JSON.parse(e.data)); });
    window.addEventListener('message', function (e) { render(JSON.parse(e.data)); });
  </script></body></html>`;

  return (
    <View style={styles.container}>
      <WebView
        ref={webref}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={(e) =>
          navigation.navigate('RestaurantDetail', { id: e.nativeEvent.data })
        }
      />

      {/* Danh sách trượt lên */}
      {listOpen && (
        <View style={styles.sheet}>
          <FlatList
            data={restaurants}
            keyExtractor={(r) => r.id}
            numColumns={2}
            contentContainerStyle={{ padding: 6 }}
            renderItem={({ item }) => (
              <RestaurantCard
                data={{
                  id: item.id,
                  name: item.name,
                  cuisineTypes: item.cuisineTypes,
                  priceMin: item.priceMin,
                  priceMax: item.priceMax,
                  distanceM: item.distanceM,
                }}
                onPress={() =>
                  navigation.navigate('RestaurantDetail', { id: item.id })
                }
              />
            )}
          />
        </View>
      )}

      {/* Thanh dưới — bấm để mở/đóng danh sách */}
      <Pressable
        style={({ pressed }) => [styles.banner, pressed && { opacity: 0.7 }]}
        onPress={() => setListOpen((v) => !v)}
      >
        <Ionicons
          name={listOpen ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={colors.textMuted}
        />
        <Text style={styles.bannerText}>
          {restaurants.length} quán quanh Quận 7 (pilot)
          {listOpen ? '' : ' — chạm để xem danh sách'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sheet: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    bottom: 40,
    height: '55%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  banner: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    padding: 10,
  },
  bannerText: { color: colors.textMuted, fontSize: 13.5 },
});
