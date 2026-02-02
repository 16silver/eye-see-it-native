import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Firebase Console > 프로젝트 설정 > 일반에서 웹 클라이언트 ID 확인
// 또는 google-services.json의 oauth_client에서 client_type: 3인 client_id
const WEB_CLIENT_ID = '994266106458-4qmv51luvfh06m6g8j3npecsapvq78h1.apps.googleusercontent.com';

// Google Sign-In 초기화
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,
  });
};

// Google 로그인
export const signInWithGoogle = async (): Promise<FirebaseAuthTypes.UserCredential | null> => {
  try {
    // Google Play Services 확인
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Google 로그인 수행
    const signInResult = await GoogleSignin.signIn();
    
    // ID 토큰 가져오기
    const idToken = signInResult.data?.idToken;
    
    if (!idToken) {
      throw new Error('Google 로그인에서 ID 토큰을 받지 못했습니다.');
    }
    
    // Firebase 인증 정보 생성
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    
    // Firebase에 로그인
    return await auth().signInWithCredential(googleCredential);
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      console.log('사용자가 로그인을 취소했습니다.');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      console.log('로그인이 진행 중입니다.');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      console.log('Google Play Services를 사용할 수 없습니다.');
    } else {
      console.error('Google 로그인 오류:', error);
    }
    return null;
  }
};

// 로그아웃
export const signOut = async (): Promise<void> => {
  try {
    // Google에서 로그아웃
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
    
    // Firebase에서 로그아웃
    await auth().signOut();
  } catch (error) {
    console.error('로그아웃 오류:', error);
  }
};

// 현재 사용자 가져오기
export const getCurrentUser = (): FirebaseAuthTypes.User | null => {
  return auth().currentUser;
};

// 인증 상태 변경 리스너
export const onAuthStateChanged = (
  callback: (user: FirebaseAuthTypes.User | null) => void
): (() => void) => {
  return auth().onAuthStateChanged(callback);
};
