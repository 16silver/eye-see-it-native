// 항상 라이트 모드로 고정되도록 훅을 재정의합니다 (iOS/Android)
export function useColorScheme(): 'light' {
  return 'light';
}
