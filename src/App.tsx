import React, { useEffect, useState } from 'react';
import { StatusBar, useColorScheme, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation/RootNavigator';
import AnimatedSplash from './components/AnimatedSplash';
import { AuthProvider } from './providers/AuthProvider';

export default function App() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // 앱 초기화 로직
    const prepare = async () => {
      try {
        // 필요한 초기화 작업 수행
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    };

    prepare();
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (!isReady) {
    return null;
  }

  if (showSplash) {
    return <AnimatedSplash onFinish={handleSplashFinish} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar
            barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
            backgroundColor="transparent"
            translucent
          />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
