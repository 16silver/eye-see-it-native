import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'react-native';
import { IconAssets } from '../components/IconAssets';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '../../constants/Colors';
import { useColorScheme } from '../components/useColorScheme';
// removed useClientOnlyValue: we hide headers on all platforms

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarImageIcon({ routeName, focused }: { routeName: 'index' | 'calendar' | 'map'; focused: boolean }) {
  const source =
    routeName === 'index'
      ? focused ? IconAssets.tab.list.active : IconAssets.tab.list.inactive
      : routeName === 'calendar'
      ? focused ? IconAssets.tab.calendar.active : IconAssets.tab.calendar.inactive
      : focused ? IconAssets.tab.map.active : IconAssets.tab.map.inactive;
  return (
    <Image
      source={source}
      style={{ width: 30, height: 30, marginBottom: -2, resizeMode: 'contain' }}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarStyle: {
          borderTopColor: '#d4ead7',
        },
        tabBarShowLabel: false,
        headerShown: Platform.OS !== 'web',
        headerBackground: () => (
          <LinearGradient
            colors={['#21df5a', '#21df5a', '#3de36f', '#74eb98', '#90ef98', '#ffffff']}
            locations={[0, 0.24, 0.46, 0.71, 0.85, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1 }}
          />
        ),
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTintColor: '#0b0b0b',
        headerTitleStyle: { color: '#0b0b0b' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          headerTitle: '',
          tabBarIcon: ({ focused }) => <TabBarImageIcon routeName="index" focused={focused} />,
        }}
      />
      {/* 숨김 처리: 검색/추가 탭은 탭바에 노출하지 않음 */}
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="album" options={{ href: null }} />
      <Tabs.Screen
        name="calendar"
        options={{
          title: '캘린더',
          tabBarIcon: ({ focused }) => <TabBarImageIcon routeName="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: '지도',
          tabBarIcon: ({ focused }) => <TabBarImageIcon routeName="map" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
