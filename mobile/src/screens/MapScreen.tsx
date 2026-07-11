import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api/client';
import type { Restaurant } from '../api/types';
import { DEFAULT_CENTER, GOONG_MAPTILES_KEY } from '../config';
import { colors } from '../theme';

/**
 * Bản đồ qua MapLibre GL trong WebView (tương thích style Goong).
 *
 * QUYẾT ĐỊNH KỸ THUẬT (v0): dùng WebView để chạy được ngay trong Expo Go,
 * không cần native build — đủ cho pilot demo. Khi vào giai đoạn polish,
 * chuyển sang @maplibre/maplibre-react-native (native, mượt hơn) + Goong tiles;
 * API backend không đổi.
 */
export function MapScreen({ navigation }: { navigation: any }) {
  const webref = useRef<WebView>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

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

  // MapLibre GL (mở, tương thích style Goong). Style:
  // - Có Goong Maptiles Key → tile Goong (tối ưu địa chỉ VN)
  // - Chưa có key (đang chờ Goong kích hoạt tài khoản) → fallback OSM raster,
  //   đủ dùng cho pilot; publish lại với APP_GOONG_MAPTILES_KEY là tự chuyển.
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
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {restaurants.length} quán quanh Quận 7 (pilot)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 8,
  },
  bannerText: { color: colors.textMuted, textAlign: 'center' },
});
