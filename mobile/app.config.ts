import { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Config động theo kênh phát hành — merge lên app.json.
 * Env đến từ eas.json (profile preview/production) hoặc shell khi
 * `eas update`. Local dev không set gì → fallback trong src/config.ts.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  // OTA update qua EAS Update — bản trong tay đội seed tự nhận code mới.
  // 'sdkVersion' để chạy được trong EXPO GO (kênh A pilot); khi chuyển sang
  // build standalone TestFlight/Play (kênh B) thì đổi thành 'appVersion'.
  runtimeVersion: { policy: 'sdkVersion' },
  updates: process.env.EAS_PROJECT_ID
    ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` }
    : config.updates,
  extra: {
    ...config.extra,
    apiBase: process.env.APP_API_BASE ?? null,
    authMode: process.env.APP_AUTH_MODE ?? null,
    goongMaptilesKey: process.env.APP_GOONG_MAPTILES_KEY ?? null,
    eas: process.env.EAS_PROJECT_ID
      ? { projectId: process.env.EAS_PROJECT_ID }
      : (config.extra as Record<string, unknown> | undefined)?.eas,
  },
});
