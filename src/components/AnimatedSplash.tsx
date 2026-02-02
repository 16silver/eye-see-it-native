import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Image, Dimensions } from 'react-native';

interface AnimatedSplashProps {
  onFinish?: () => void;
}

const { width } = Dimensions.get('window');
const DISPLAY_DURATION_MS = 2500;
const ICON_WIDTH_RATIO = 0.42; // 화면 너비 대비 아이콘 크기 비율 (splash.png 참고값)
const splash = require('../../assets/images/splash.png');

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  useEffect(() => {
    const timer = setTimeout(() => onFinish && onFinish(), DISPLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onFinish]);


  return (
    <View style={styles.container}>
      <View style={styles.centerWrap}>
        <Image
          source={splash}
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
          resizeMode="contain"
        />
        <Text style={styles.appName}>eyeseeit</Text>
      </View>
    </View>
  );
}

const ICON_SIZE = Math.min(160, width * ICON_WIDTH_RATIO);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1ED760',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  appName: {
    marginTop: 16,
    color: '#0b1a0b',
    fontSize: 28,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});


