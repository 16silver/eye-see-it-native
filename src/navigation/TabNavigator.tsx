import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Image, Platform } from 'react-native';
import type { TabParamList } from './types';

// Screens
import HomeScreen from '../screens/tabs/HomeScreen';
import CalendarScreen from '../screens/tabs/CalendarScreen';
import MapScreen from '../screens/tabs/MapScreen';

const Tab = createBottomTabNavigator<TabParamList>();

const BRAND_GREEN = '#00D26A';

// 탭 아이콘 컴포넌트
const TabIcon = ({ focused, activeIcon, inactiveIcon }: { 
  focused: boolean; 
  activeIcon: any; 
  inactiveIcon: any; 
}) => (
  <Image
    source={focused ? activeIcon : inactiveIcon}
    style={styles.tabIcon}
    resizeMode="contain"
  />
);

export default function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        tabBarActiveTintColor: BRAND_GREEN,
        tabBarInactiveTintColor: '#B0B0B0',
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              activeIcon={require('../../assets/images/icons/tab-list-active.png')}
              inactiveIcon={require('../../assets/images/icons/tab-list.png')}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              activeIcon={require('../../assets/images/icons/tab-calendar-active.png')}
              inactiveIcon={require('../../assets/images/icons/tab-calendar.png')}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              activeIcon={require('../../assets/images/icons/tab-map-active.png')}
              inactiveIcon={require('../../assets/images/icons/tab-map.png')}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 12,
    height: Platform.OS === 'ios' ? 85 : 65,
  },
  tabIcon: {
    width: 32,
    height: 32,
  },
});
