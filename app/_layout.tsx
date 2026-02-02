import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { useEffect, useRef, useState } from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import 'react-native-reanimated';
import Colors from '../constants/Colors';
import { Text, View } from './components/Themed';
import { SafeAreaProvider } from 'react-native-safe-area-context';
 
import { ABeeZee_400Regular } from '@expo-google-fonts/abeezee';

import { useColorScheme } from './components/useColorScheme';
import AnimatedSplash from './components/AnimatedSplash';

const MIN_SPLASH_MS = 2500;

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const colorScheme = useColorScheme();
  const [showDetails, setShowDetails] = useState(false);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <FontAwesome
        name="exclamation-triangle"
        size={48}
        color={Colors[colorScheme ?? 'light'].tint}
      />
      <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 16 }}>문제가 발생했어요</Text>
      <Text style={{ color: '#666', textAlign: 'center', marginTop: 8 }} numberOfLines={showDetails ? undefined : 3}>
        {showDetails ? String(error?.stack || error?.message) : String(error?.message || '알 수 없는 오류가 발생했습니다.')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
        <TouchableOpacity
          onPress={retry}
          activeOpacity={0.8}
          style={{ backgroundColor: Colors[colorScheme ?? 'light'].accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginRight: 10 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>다시 시도</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowDetails(v => !v)}
          activeOpacity={0.8}
          style={{ backgroundColor: '#f0f0f0', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
        >
          <Text style={{ color: '#333', fontWeight: '600' }}>{showDetails ? '간단히' : '자세히'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ABeeZee_400Regular,
    ...FontAwesome.font,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const appStartAtRef = useRef<number>(Date.now());

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // 미디어(스플래시 이미지 등) 사전 로드
  useEffect(() => {
    (async () => {
      try {
        await Asset.loadAsync([
          require('../assets/images/splash.png'),
          require('../assets/images/icon.png'),
        ]);
      } finally {
        setAssetsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !assetsLoaded) return;
    const elapsed = Date.now() - appStartAtRef.current;
    // iOS에서는 네이티브 스플래시를 즉시 숨기고(=0), 인앱 스플래시로 2.5초 고정 연출
    // 기타 플랫폼은 네이티브 스플래시를 최소 2.5초 유지
    const remaining = Platform.OS === 'ios' ? 0 : Math.max(0, MIN_SPLASH_MS - elapsed);
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, remaining);
    return () => clearTimeout(timer);
  }, [loaded, assetsLoaded]);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  if (!loaded || !assetsLoaded) {
    return null;
  }

  if (isLoading) {
    return <AnimatedSplash onFinish={handleLoadingComplete} />;
  }

  // 네이티브 환경에서는 네이티브 스플래시만 사용하고, 바로 앱으로 진입

  return (
    <SafeAreaProvider>
      <RootLayoutNav />
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

