import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from '../components/Themed';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#e6ffdb" style="dark" />
      <Text style={styles.soon}>곧 추가 예정입니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soon: {
    fontSize: 18,
    fontWeight: '600',
  },
}); 