import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import { useAuth } from '../providers/AuthProvider';

const BRAND_GREEN = '#c8f560';

const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, isLoading } = useAuth();

  return (
    <LinearGradient
      colors={['#1a1a1a', '#0d0d0d']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* 로고 영역 */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo-text.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>전시 기록의 새로운 방법</Text>
        </View>

        {/* 로그인 버튼 영역 */}
        <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 40 }]}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={signInWithGoogle}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <FontAwesomeIcon name="google" size={20} color="#4285F4" style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Google로 계속하기</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.termsText}>
            로그인 시 서비스 이용약관 및 개인정보처리방침에 동의합니다.
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  logo: {
    width: 200,
    height: 60,
  },
  tagline: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '300',
  },
  buttonContainer: {
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});

export default LoginScreen;
