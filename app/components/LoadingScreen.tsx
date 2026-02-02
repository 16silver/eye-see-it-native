import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Dimensions, ImageBackground } from 'react-native';
import Colors from '../../constants/Colors';

const { width, height } = Dimensions.get('window');

interface LoadingScreenProps {
  onLoadingComplete?: () => void;
}

export default function LoadingScreen({ onLoadingComplete }: LoadingScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.98)).current;
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    setTimeout(() => { Animated.timing(dot1Anim, { toValue: 1, duration: 250, useNativeDriver: true }).start(); }, 700);
    setTimeout(() => { Animated.timing(dot2Anim, { toValue: 1, duration: 250, useNativeDriver: true }).start(); }, 900);
    setTimeout(() => { Animated.timing(dot3Anim, { toValue: 1, duration: 250, useNativeDriver: true }).start(); }, 1100);

    const timer = setTimeout(() => { onLoadingComplete?.(); }, 2000);
    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, dot1Anim, dot2Anim, dot3Anim, onLoadingComplete]);

  return (
    <ImageBackground
      source={require('../../assets/images/splash.png')}
      resizeMode="contain"
      style={styles.container}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}
      >
        <Animated.View style={[styles.centerBlock, { transform: [{ scale: scaleAnim }] }]}
        >
          <Text style={styles.appName}>Eye See It</Text>
          <Text style={styles.appDescription}>전시회 관람 기록 앱</Text>

          <View style={styles.loadingContainer}>
            <Animated.View style={[styles.loadingDot, { opacity: dot1Anim }]} />
            <Animated.View style={[styles.loadingDot, { opacity: dot2Anim }]} />
            <Animated.View style={[styles.loadingDot, { opacity: dot3Anim }]} />
          </View>
        </Animated.View>
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  appDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 26,
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: '#ffffff',
    opacity: 0.5,
  },
}); 