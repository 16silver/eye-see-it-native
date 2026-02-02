import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Dimensions, Image } from 'react-native';

const { width } = Dimensions.get('window');

interface LoadingScreenProps {
  onLoadingComplete?: () => void;
}

// 눈 컴포넌트
const Eye = ({ style }: { style?: object }) => (
  <View style={[styles.eye, style]}>
    <View style={styles.pupil} />
  </View>
);

export default function LoadingScreen({ onLoadingComplete }: LoadingScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // 페이드인 및 스케일 애니메이션
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2초 후 로딩 완료
    const timer = setTimeout(() => {
      onLoadingComplete?.();
    }, 2000);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, onLoadingComplete]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* 눈 로고 */}
        <View style={styles.eyesContainer}>
          <Eye style={styles.leftEye} />
          <Eye style={styles.rightEye} />
        </View>

        {/* 앱 이름 */}
        <Image
          source={require('../../assets/images/logo-text.png')}
          style={styles.logoText}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const BRAND_GREEN = '#00D26A';
const EYE_SIZE = width * 0.18;
const PUPIL_SIZE = EYE_SIZE * 0.45;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  eyesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  eye: {
    width: EYE_SIZE,
    height: EYE_SIZE * 1.3,
    backgroundColor: '#FFFFFF',
    borderRadius: EYE_SIZE * 0.65,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: EYE_SIZE * 0.15,
    paddingLeft: EYE_SIZE * 0.15,
    marginHorizontal: 6,
  },
  leftEye: {
    transform: [{ rotate: '-15deg' }],
  },
  rightEye: {
    transform: [{ rotate: '15deg' }],
  },
  pupil: {
    width: PUPIL_SIZE,
    height: PUPIL_SIZE,
    backgroundColor: BRAND_GREEN,
    borderRadius: PUPIL_SIZE / 2,
  },
  logoText: {
    width: width * 0.5,
    height: 40,
  },
});
