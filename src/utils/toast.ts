import { Alert, Platform, ToastAndroid } from 'react-native';

export function toast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('', message);
  }
}





