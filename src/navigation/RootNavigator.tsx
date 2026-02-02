import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import type { RootStackParamList } from './types';
import { useAuth } from '../providers/AuthProvider';

import TabNavigator from './TabNavigator';
import CameraScreen from '../screens/CameraScreen';
import AlbumScreen from '../screens/tabs/AlbumScreen';
import ModalScreen from '../screens/ModalScreen';
import LoginScreen from '../screens/LoginScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // 로딩 중일 때 로딩 화면 표시
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d' }}>
        <ActivityIndicator size="large" color="#c8f560" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!isAuthenticated ? (
        // 로그인하지 않은 경우
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
      ) : (
        // 로그인한 경우
        <>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="Album"
            component={AlbumScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="Modal"
            component={ModalScreen}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
