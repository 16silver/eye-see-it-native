import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

// Tab Navigator 파라미터
export type TabParamList = {
  Calendar: undefined;
  Home: undefined;
  Map: undefined;
  Search: undefined;
};

// Root Stack Navigator 파라미터
export type RootStackParamList = {
  Login: undefined;
  Tabs: NavigatorScreenParams<TabParamList>;
  Camera: { targetId?: string; section?: string };
  Album: { scrollToDate?: string };
  Modal: undefined;
};

// Screen Props 타입
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

// Navigation 타입 선언 (useNavigation 훅용)
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
