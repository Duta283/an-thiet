import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { flush, initAnalytics, trackSessionResume } from './src/analytics';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { CheckinScreen } from './src/screens/CheckinScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MapScreen } from './src/screens/MapScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { RestaurantDetailScreen } from './src/screens/RestaurantDetailScreen';
import { SavedScreen } from './src/screens/SavedScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarIcon: ({ color }) => {
          const icons: Record<string, string> = {
            'Khám phá': '🔍',
            'Bản đồ': '🗺️',
            'Để dành': '🔖',
            'Cá nhân': '👤',
          };
          return <Text style={{ color, fontSize: 18 }}>{icons[route.name]}</Text>;
        },
      })}
    >
      <Tab.Screen name="Khám phá" component={SearchScreen} />
      <Tab.Screen name="Bản đồ" component={MapScreen} />
      <Tab.Screen name="Để dành" component={SavedScreen} />
      <Tab.Screen name="Cá nhân" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { userId, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!userId) return <LoginScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RestaurantDetail"
          component={RestaurantDetailScreen as any}
          options={{ title: 'Quán' }}
        />
        <Stack.Screen
          name="Checkin"
          component={CheckinScreen as any}
          options={{ title: 'Check-in xác thực' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    initAnalytics();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
        void flush(); // đẩy nốt queue trước khi bị treo
      } else if (state === 'active' && backgroundedAt.current) {
        trackSessionResume(Date.now() - backgroundedAt.current);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}
