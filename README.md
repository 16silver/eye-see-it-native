# Eye See It 👁️

전시 관람 기록을 관리하는 React Native 앱입니다. 전시 정보를 기록하고, 사진을 저장하며, 즐겨찾기 기능을 통해 관심 있는 전시를 관리할 수 있습니다.

## ✨ 주요 기능

### 📝 전시 관리
- 전시 정보 추가, 수정, 삭제
- 전시명, 작가, 장소, 관람 후기 기록
- 관람일 자동 기록

### 📸 사진 관리
- 전시별 사진 추가 및 관리
- 갤러리 모드에서 사진 전체보기
- 사진 삭제 기능 (길게 누르기)

### ❤️ 즐겨찾기
- 전시 즐겨찾기 설정/해제
- 즐겨찾기 전시만 필터링하여 보기

### 📱 반응형 UI
- iOS와 Android 지원
- 다크/라이트 테마 자동 전환
- 직관적인 사용자 인터페이스

## 🛠️ 기술 스택

- **Framework**: React Native CLI (0.79.x)
- **Language**: TypeScript
- **Navigation**: React Navigation (Native Stack + Bottom Tabs)
- **Storage**: AsyncStorage
- **Camera**: react-native-vision-camera
- **Image Picker**: react-native-image-picker
- **Icons**: react-native-vector-icons
- **Platform**: iOS, Android

## 📁 프로젝트 구조

```
eye-see-it-native/
├── src/                      # 소스 코드
│   ├── App.tsx              # 앱 진입점
│   ├── navigation/          # 네비게이션 설정
│   │   ├── RootNavigator.tsx
│   │   ├── TabNavigator.tsx
│   │   └── types.ts
│   ├── screens/             # 화면 컴포넌트
│   │   ├── tabs/
│   │   │   ├── AlbumScreen.tsx
│   │   │   ├── CalendarScreen.tsx
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── MapScreen.tsx
│   │   │   └── SearchScreen.tsx
│   │   ├── CameraScreen.tsx
│   │   └── ModalScreen.tsx
│   ├── components/          # 재사용 가능한 컴포넌트
│   │   ├── ExhibitionListItem.tsx
│   │   ├── ExhibitionDetailModal.tsx
│   │   ├── ExhibitionGalleryModal.tsx
│   │   └── AddExhibitionModal.tsx
│   ├── types/               # TypeScript 타입 정의
│   │   └── Exhibition.ts
│   ├── constants/           # 상수 정의
│   │   └── Colors.ts
│   └── utils/               # 유틸리티 함수
├── android/                 # Android 네이티브 코드
├── ios/                     # iOS 네이티브 코드
├── index.js                 # 앱 등록 진입점
├── babel.config.js          # Babel 설정
├── metro.config.js          # Metro 번들러 설정
└── package.json             # 의존성 관리
```

## 🚀 시작하기

### 필수 요구사항

- Node.js (v18 이상)
- npm 또는 yarn
- **Android**: Android Studio, Android SDK, JDK 17+
- **iOS**: Xcode 15+, CocoaPods (macOS만 해당)

### 환경 설정

#### Android 환경 설정

1. **Android Studio 설치**
   - [Android Studio](https://developer.android.com/studio) 다운로드 및 설치
   - SDK Manager에서 다음 설치:
     - Android SDK Platform 35
     - Android SDK Build-Tools 35
     - NDK (Side by side) 27.1.x
     - CMake 3.22.1

2. **환경 변수 설정** (Windows)
   ```powershell
   # 사용자 환경 변수에 추가
   ANDROID_HOME = C:\Users\<사용자명>\AppData\Local\Android\Sdk
   
   # Path에 추가
   %ANDROID_HOME%\platform-tools
   %ANDROID_HOME%\tools
   ```

3. **환경 변수 설정** (macOS/Linux)
   ```bash
   # ~/.zshrc 또는 ~/.bashrc에 추가
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   ```

#### iOS 환경 설정 (macOS만 해당)

1. **Xcode 설치**
   - App Store에서 Xcode 설치
   - Command Line Tools 설치: `xcode-select --install`

2. **CocoaPods 설치**
   ```bash
   sudo gem install cocoapods
   ```

### 설치 및 실행

1. **저장소 클론**
   ```bash
   git clone <repository-url>
   cd eye-see-it-native
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **iOS 의존성 설치** (macOS만 해당)
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Metro 번들러 시작**
   ```bash
   npm start
   ```

5. **앱 실행**
   ```bash
   # Android
   npm run android
   
   # iOS (macOS만 해당)
   npm run ios
   ```

## 📦 Android 빌드

### Debug APK 빌드

```bash
cd android

# Debug APK 빌드
./gradlew assembleDebug

# 빌드된 APK 위치
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Release APK 빌드

1. **키스토어 생성** (최초 1회)
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **gradle.properties에 서명 정보 추가**
   ```properties
   MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
   MYAPP_RELEASE_KEY_ALIAS=my-key-alias
   MYAPP_RELEASE_STORE_PASSWORD=*****
   MYAPP_RELEASE_KEY_PASSWORD=*****
   ```

3. **Release APK 빌드**
   ```bash
   cd android
   ./gradlew assembleRelease
   
   # 빌드된 APK 위치
   # android/app/build/outputs/apk/release/app-release.apk
   ```

### Release AAB 빌드 (Google Play Store용)

```bash
cd android
./gradlew bundleRelease

# 빌드된 AAB 위치
# android/app/build/outputs/bundle/release/app-release.aab
```

### APK 설치

```bash
# USB 연결된 기기에 설치
adb install android/app/build/outputs/apk/debug/app-debug.apk

# 특정 APK 파일 설치
adb install path/to/your-app.apk
```

## 🍎 iOS 빌드

### Xcode를 사용한 빌드

1. **Xcode에서 프로젝트 열기**
   ```bash
   open ios/EyeSeeItRN.xcworkspace
   ```

2. **빌드 설정**
   - Signing & Capabilities에서 Team 선택
   - Bundle Identifier 설정

3. **빌드 및 실행**
   - Product → Run (⌘R) 또는
   - Product → Archive (배포용)

### 커맨드라인 빌드

```bash
# Debug 빌드
cd ios
xcodebuild -workspace EyeSeeItRN.xcworkspace -scheme EyeSeeItRN -configuration Debug -sdk iphoneos

# Release 빌드
xcodebuild -workspace EyeSeeItRN.xcworkspace -scheme EyeSeeItRN -configuration Release -sdk iphoneos -archivePath build/EyeSeeItRN.xcarchive archive
```

## ⏱️ 빌드 시간 참고

| 플랫폼 | 빌드 유형 | 첫 빌드 | 캐시된 빌드 |
|--------|-----------|---------|-------------|
| Android | Debug | 10-20분 | 1-3분 |
| Android | Release | 15-25분 | 2-5분 |
| iOS | Debug | 10-15분 | 1-2분 |
| iOS | Release | 15-20분 | 3-5분 |

> **참고**: 첫 빌드 시 Gradle/CocoaPods 의존성 다운로드로 인해 시간이 더 소요됩니다.

## 📱 사용법

### 전시 추가
1. 메인 화면에서 "+" 버튼 클릭
2. 전시 정보 입력 (전시명, 작가, 장소, 후기)
3. 저장 버튼 클릭

### 사진 추가
1. 전시 상세 페이지에서 "사진 추가" 버튼 클릭
2. 갤러리에서 사진 선택 또는 카메라로 촬영
3. 자동으로 전시에 연결됨

### 즐겨찾기 설정
1. 전시 목록에서 하트 아이콘 클릭
2. 즐겨찾기 필터 버튼으로 즐겨찾기 전시만 보기

### 사진 삭제
1. 갤러리 모달에서 사진을 길게 누르기
2. 확인 대화상자에서 "삭제" 선택

## 💾 데이터 저장

- **저장 위치**: AsyncStorage (로컬 저장소)
- **저장 키**: `@exhibitions`
- **데이터 형식**: JSON
- **사진 저장**: 앱 내부 파일 시스템 (`eyeseeit/` 디렉토리)

### 데이터 구조
```typescript
interface Exhibition {
  id: string;
  name: string;
  artist: string;
  location: string;
  review: string;
  visitDate: string;
  photos: string[];        // 파일 URI 배열
  isFavorite: boolean;     // 즐겨찾기 여부
  createdAt: string;
  updatedAt: string;
}
```

## 🔧 문제 해결

### Android 빌드 오류

**SDK 위치 오류**
```
SDK location not found.
```
→ `android/local.properties` 파일에 SDK 경로 설정:
```properties
sdk.dir=C:\\Users\\<사용자명>\\AppData\\Local\\Android\\Sdk
```

**CMake/Ninja 오류**
```
Could not find Ninja on PATH
```
→ Android Studio SDK Manager에서 CMake 설치:
- Settings → Languages & Frameworks → Android SDK → SDK Tools → CMake 체크

**JDK 버전 오류**
→ `android/gradle.properties`에 JDK 경로 설정:
```properties
org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr
```

### iOS 빌드 오류

**Pod 설치 오류**
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
```

**서명 오류**
→ Xcode에서 Signing & Capabilities 탭에서 Team 선택

## 🔐 인증 (로그인)

Eye See It은 Google 및 Kakao OAuth를 통한 소셜 로그인을 지원합니다.

### 환경 변수 설정

#### 백엔드 (Express 서버)

`server/.env` 파일에 다음 값을 설정하세요:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/eyeseeit
JWT_SECRET=your-secure-jwt-secret-key
GOOGLE_CLIENT_ID=your-web-client-id
KAKAO_REST_KEY=your-kakao-rest-key
ACCESS_TOKEN_TTL=15m
SESSION_TTL_DAYS=30
```

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/auth/oauth` | Google/Kakao 토큰으로 로그인 |
| POST | `/auth/refresh` | Access Token 갱신 |
| POST | `/auth/logout` | 세션 종료 |
| GET | `/auth/me` | 현재 사용자 정보 조회 |

## 🏷️ 버전 관리

이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 따르며, `package.json`을 단일 소스로 사용합니다.

### 버전 형식

```
MAJOR.MINOR.PATCH (예: 1.2.3)
```

- **MAJOR**: 호환되지 않는 API 변경
- **MINOR**: 하위 호환되는 기능 추가
- **PATCH**: 하위 호환되는 버그 수정

### 버전 변경 방법

**원하는 버전을 직접 지정할 경우:**

`package.json`의 `version` 필드를 원하는 값으로 수정 후:

```bash
npm run version:sync
```

**자동 증가할 경우:**

```bash
npm run version:patch   # 1.0.0 → 1.0.1
npm run version:minor   # 1.0.0 → 1.1.0
npm run version:major   # 1.0.0 → 2.0.0
```

### 빌드 번호 (versionCode / Build Number)

스토어 업로드 시 빌드 번호는 자동으로 증가합니다. 수동 조정이 필요한 경우:

- **Android**: `android/app/build.gradle`의 `versionCode`
- **iOS**: Xcode에서 `CURRENT_PROJECT_VERSION` 또는 `project.pbxproj` 직접 수정

## 🔧 개발 정보

### 주요 컴포넌트
- **ExhibitionListItem**: 전시 목록 아이템 렌더링
- **ExhibitionDetailModal**: 전시 상세 정보 표시 및 편집
- **ExhibitionGalleryModal**: 사진 갤러리 관리
- **AddExhibitionModal**: 새 전시 추가

### 상태 관리
- React Hooks (useState, useEffect) 사용
- AsyncStorage를 통한 데이터 영속성
- 로컬 상태 관리

### 스타일링
- StyleSheet API 사용
- 반응형 디자인
- 테마 기반 색상 시스템

## 🐛 알려진 이슈

- 대용량 이미지 처리 시 성능 이슈 가능성
- Android 일부 기기에서 카메라 셔터음 비활성화 불가 (시스템 정책)

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.

---

**Eye See It** - 전시 관람의 모든 순간을 기록하세요! 🎨
