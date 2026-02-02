# iOS 빌드 및 App Store 배포 가이드

이 문서는 EyeSeeIt 앱의 iOS 버전을 빌드하고 App Store에 배포하는 전체 과정을 설명합니다.

---

## 목차

1. [사전 준비 사항](#1-사전-준비-사항)
2. [Apple Developer 설정](#2-apple-developer-설정)
3. [Xcode 프로젝트 설정](#3-xcode-프로젝트-설정)
4. [앱 빌드 및 Archive](#4-앱-빌드-및-archive)
5. [App Store Connect 설정](#5-app-store-connect-설정)
6. [앱 업로드](#6-앱-업로드)
7. [TestFlight 베타 테스트](#7-testflight-베타-테스트)
8. [App Store 심사 제출](#8-app-store-심사-제출)
9. [심사 후 처리](#9-심사-후-처리)
10. [문제 해결](#10-문제-해결)

---

## 1. 사전 준비 사항

### 필수 소프트웨어

- **macOS** (최신 버전 권장)
- **Xcode** 15.0 이상 (App Store에서 설치)
- **CocoaPods** (터미널에서 `sudo gem install cocoapods`)
- **Node.js** 18 이상
- **Apple Developer Program 멤버십** (연간 $99 USD / ₩129,000)

### 개발 환경 확인

```bash
# Node.js 버전 확인
node --version

# CocoaPods 버전 확인
pod --version

# Xcode 버전 확인
xcodebuild -version
```

### iOS 의존성 설치

```bash
# 프로젝트 루트에서
npm install

# ios 폴더로 이동하여 Pod 설치
cd ios
pod install
```

---

## 2. Apple Developer 설정

### 2.1 Apple Developer Program 가입

1. [Apple Developer](https://developer.apple.com/programs/) 접속
2. "Enroll" 클릭하여 가입 진행
3. Apple ID로 로그인
4. 개인 또는 조직으로 등록 (조직은 D-U-N-S 번호 필요)
5. 연간 멤버십 비용 결제

### 2.2 인증서(Certificate) 생성

#### 방법 1: Xcode 자동 관리 (권장)

1. Xcode → Preferences → Accounts
2. Apple ID 추가 및 로그인
3. 프로젝트에서 "Automatically manage signing" 체크

#### 방법 2: 수동 생성

1. [Apple Developer Portal](https://developer.apple.com/account) 접속
2. Certificates, Identifiers & Profiles 선택
3. Certificates → "+" 버튼 클릭
4. "Apple Distribution" 선택
5. CSR(Certificate Signing Request) 파일 업로드
   - Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
6. 인증서 다운로드 및 더블클릭하여 Keychain에 설치

### 2.3 App ID 등록

1. Apple Developer Portal → Identifiers
2. "+" 버튼 클릭 → App IDs 선택
3. Platform: iOS 선택
4. Description: `EyeSeeIt` 입력
5. Bundle ID: `com.yourcompany.eyeseeit` 형식으로 입력
6. 필요한 Capabilities 선택:
   - ✅ Push Notifications (Firebase 사용 시)
   - ✅ Sign In with Apple (Google 로그인 외 추가 시)
   - ✅ Associated Domains (필요 시)

### 2.4 Provisioning Profile 생성

1. Apple Developer Portal → Profiles
2. "+" 버튼 클릭
3. "App Store Connect" 선택 (배포용)
4. 위에서 생성한 App ID 선택
5. Distribution Certificate 선택
6. 프로파일 이름 입력 (예: `EyeSeeIt_AppStore`)
7. 다운로드 및 더블클릭하여 설치

---

## 3. Xcode 프로젝트 설정

### 3.1 프로젝트 열기

```bash
# ios 폴더에서 workspace 파일 열기
open EyeSeeItRN.xcworkspace
```

> ⚠️ **중요**: `.xcodeproj`가 아닌 `.xcworkspace` 파일을 열어야 합니다.

### 3.2 기본 설정 확인

1. 프로젝트 네비게이터에서 `EyeSeeItRN` 선택
2. TARGETS → `EyeSeeItRN` 선택
3. **General** 탭에서 확인:
   - **Display Name**: 앱 이름 (현재: `eyeseeit`)
   - **Bundle Identifier**: 고유 식별자 설정
   - **Version**: 1.0.0 (App Store 표시 버전)
   - **Build**: 1 (업로드마다 증가 필요)

### 3.3 Signing & Capabilities 설정

1. **Signing & Capabilities** 탭 선택
2. Team: Apple Developer 계정 선택
3. Bundle Identifier: App ID와 일치하게 설정
4. Signing Certificate: "Apple Distribution" 선택
5. Provisioning Profile: 위에서 생성한 App Store 프로파일 선택

### 3.4 앱 아이콘 확인

앱 아이콘은 `EyeSeeItRN/Images.xcassets/AppIcon.appiconset/`에 위치합니다.

**App Store 제출 시 필요한 아이콘 크기**:
- 1024x1024 px (App Store 표시용) - ✅ 현재 포함됨

### 3.5 권한 설명 (Privacy Descriptions) 확인

`Info.plist`에서 앱이 사용하는 기능에 대한 설명 확인:

| 키 | 설명 | 예시 |
|---|---|---|
| `NSCameraUsageDescription` | 카메라 사용 이유 | "전시회 사진 촬영을 위해 카메라에 접근합니다" |
| `NSPhotoLibraryUsageDescription` | 사진 라이브러리 접근 이유 | "사진을 저장하고 불러오기 위해 접근합니다" |
| `NSLocationWhenInUseUsageDescription` | 위치 서비스 사용 이유 | "주변 전시회를 찾기 위해 위치 정보를 사용합니다" |

> ⚠️ **중요**: 권한 설명이 비어있거나 불명확하면 심사에서 거절됩니다.

### 3.6 버전 관리

```bash
# 프로젝트 루트에서 버전 업데이트 (package.json과 iOS/Android 동시 업데이트)
npm run version:patch  # 1.0.0 → 1.0.1
npm run version:minor  # 1.0.0 → 1.1.0
npm run version:major  # 1.0.0 → 2.0.0
```

---

## 4. 앱 빌드 및 Archive

### 4.1 빌드 설정

1. Xcode 상단의 스킴(Scheme) 선택
2. Device를 **"Any iOS Device (arm64)"** 로 선택
3. Product → Scheme → Edit Scheme
4. Run/Archive의 Build Configuration을 **"Release"** 로 설정

### 4.2 Archive 생성

1. **Product → Archive** 선택 (또는 `⌘ + Shift + B` 후 Archive)
2. 빌드 완료까지 대기 (수 분 소요)
3. 성공 시 Organizer 창이 자동으로 열림

### 4.3 CLI로 Archive 생성 (선택사항)

```bash
# ios 폴더에서 실행
xcodebuild -workspace EyeSeeItRN.xcworkspace \
  -scheme EyeSeeItRN \
  -configuration Release \
  -archivePath build/EyeSeeItRN.xcarchive \
  archive
```

---

## 5. App Store Connect 설정

### 5.1 새 앱 등록

1. [App Store Connect](https://appstoreconnect.apple.com) 접속
2. "My Apps" 선택
3. "+" 버튼 → "New App" 클릭
4. 다음 정보 입력:
   - **Platforms**: iOS 선택
   - **Name**: 앱 이름 (App Store에 표시)
   - **Primary Language**: Korean (한국어)
   - **Bundle ID**: Xcode 프로젝트와 동일하게 선택
   - **SKU**: 고유 식별자 (예: `eyeseeit_ios_v1`)

### 5.2 앱 정보 입력

#### App Information 탭

- **Privacy Policy URL**: 개인정보처리방침 URL (필수)
- **Category**: 적절한 카테고리 선택 (예: Lifestyle, Photo & Video)
- **Age Rating**: 설문 응답 후 자동 결정

#### App Store 탭 (버전 정보)

##### 스크린샷 (필수)

| 기기 | 크기 | 필요 수량 |
|---|---|---|
| iPhone 6.9" | 1320 x 2868 px (또는 가로) | 최소 1장, 최대 10장 |
| iPhone 6.7" | 1290 x 2796 px | 최소 1장 |
| iPhone 6.5" | 1284 x 2778 px | 최소 1장 |
| iPad Pro 13" | 2064 x 2752 px | iPad 지원 시 필수 |

> 💡 **팁**: 시뮬레이터에서 `⌘ + S`로 스크린샷 캡처 가능

##### 앱 설명

- **Promotional Text** (170자): 업데이트 없이 수정 가능한 홍보 문구
- **Description** (4000자): 앱 상세 설명
- **Keywords** (100자): 검색 키워드 (쉼표로 구분)
- **Support URL**: 고객 지원 페이지 URL
- **Marketing URL**: 마케팅 웹사이트 (선택)

##### 버전 정보

- **What's New in This Version**: 이번 버전 업데이트 내용

---

## 6. 앱 업로드

### 6.1 Xcode Organizer에서 업로드

1. **Window → Organizer** 열기
2. 생성한 Archive 선택
3. **"Distribute App"** 클릭
4. **"App Store Connect"** 선택 → Next
5. **"Upload"** 선택 → Next
6. 배포 옵션 확인:
   - ✅ Include bitcode for iOS content
   - ✅ Strip Swift symbols
   - ✅ Upload your app's symbols
7. 자동으로 서명 선택 또는 수동 선택
8. **Upload** 클릭

### 6.2 Transporter 앱 사용 (대안)

1. App Store에서 **Transporter** 앱 설치
2. Xcode에서 Archive → Export → App Store Connect 용 IPA 내보내기
3. Transporter에서 IPA 파일 드래그 앤 드롭
4. **Deliver** 클릭

### 6.3 CLI로 업로드 (대안)

```bash
# IPA 내보내기
xcodebuild -exportArchive \
  -archivePath build/EyeSeeItRN.xcarchive \
  -exportPath build/output \
  -exportOptionsPlist ExportOptions.plist

# App Store Connect에 업로드
xcrun altool --upload-app \
  -f build/output/EyeSeeItRN.ipa \
  -t ios \
  -u "your@email.com" \
  -p "@keychain:AC_PASSWORD"
```

### 6.4 업로드 후 확인

1. App Store Connect → Activity 탭
2. 업로드된 빌드가 "Processing" 상태로 표시
3. 처리 완료까지 15-30분 소요
4. 처리 완료 후 TestFlight 탭에서 빌드 확인 가능

---

## 7. TestFlight 베타 테스트

### 7.1 내부 테스터 추가

1. App Store Connect → TestFlight 탭
2. **Internal Testing** → "App Store Connect Users" 선택
3. 테스터 추가 (최대 100명)
4. 빌드 선택 후 테스트 시작

### 7.2 외부 테스터 추가

1. **External Testing** → "+" → 새 그룹 생성
2. 테스터 이메일 추가 (최대 10,000명)
3. 빌드 선택
4. **Beta App Review Information** 입력:
   - 테스트 안내 사항
   - 로그인이 필요한 경우 테스트 계정 정보
5. **Submit for Review** 클릭
6. 외부 테스트는 Apple 검토 후 활성화 (보통 24-48시간)

### 7.3 테스터 피드백 확인

1. TestFlight 탭 → Crashes & Feedback
2. 테스터가 제출한 피드백 및 충돌 보고서 확인

---

## 8. App Store 심사 제출

### 8.1 심사 준비 체크리스트

- [ ] 모든 메타데이터 입력 완료
- [ ] 스크린샷 업로드 완료
- [ ] 개인정보처리방침 URL 유효
- [ ] 앱 설명에 오타 없음
- [ ] 빌드 선택 완료
- [ ] 연령 등급 설정 완료
- [ ] 수출 규정 준수 확인

### 8.2 심사 제출

1. App Store Connect → 앱 선택
2. iOS App → 새 버전 준비 상태 확인
3. 업로드된 빌드 선택
4. **"Add for Review"** 클릭
5. **Submit to App Review** 클릭

### 8.3 심사 정보 입력

- **Sign-In required**: 로그인 필요 시 테스트 계정 제공
- **Contact Information**: 심사팀 연락처
- **Notes**: 심사자에게 전달할 특이사항

### 8.4 심사 기간

- **일반적으로**: 24-48시간
- **복잡한 앱**: 최대 1주일
- [App Review Status](https://developer.apple.com/app-store/review/)에서 실시간 확인

---

## 9. 심사 후 처리

### 9.1 승인된 경우

1. **App Store 공개 설정**:
   - **수동 릴리즈**: "Manually release this version" 선택 후 원하는 시점에 공개
   - **자동 릴리즈**: 승인 즉시 App Store에 공개
   - **예약 릴리즈**: 특정 날짜에 자동 공개

2. 릴리즈 후 확인:
   - App Store에서 앱 검색
   - 설치 및 동작 테스트

### 9.2 거절된 경우

1. **Resolution Center** 확인
2. 거절 사유 상세 검토
3. **일반적인 거절 사유**:
   - 앱 충돌 또는 버그
   - 불완전한 메타데이터
   - 권한 설명 부족
   - 가이드라인 위반
   - 숨겨진 기능 존재
4. 문제 수정 후 재제출
5. 이의가 있는 경우 Reply to App Review 사용

### 9.3 업데이트 제출

1. App Store Connect에서 새 버전 생성
2. **Build Number** 증가 필수 (예: 1 → 2)
3. 새 기능/수정 사항 설명 입력
4. 새 빌드 업로드 및 심사 제출

---

## 10. 문제 해결

### 일반적인 빌드 오류

#### Pod 설치 오류

```bash
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
```

#### 서명 오류

```
error: No signing certificate "iOS Distribution" found
```

- Xcode → Preferences → Accounts → 인증서 재다운로드
- Keychain Access에서 만료된 인증서 삭제

#### 아키텍처 오류

```bash
# arm64 시뮬레이터 제외 (M1/M2 Mac에서)
# Podfile에 추가:
post_install do |installer|
  installer.pods_project.build_configurations.each do |config|
    config.build_settings["EXCLUDED_ARCHS[sdk=iphonesimulator*]"] = "arm64"
  end
end
```

### 업로드 오류

#### ITMS-90717: Invalid App Store Icon

- 아이콘에 알파 채널이 있으면 안 됨
- PNG 파일에서 투명도 제거

#### ITMS-90809: Deprecated API Usage

- UIWebView 등 deprecated API 사용 시 발생
- react-native-webview 등 최신 라이브러리 사용 확인

### 심사 거절 대응

#### 4.2 Minimum Functionality

- 앱의 기능이 너무 단순함
- 웹사이트를 앱으로 감싼 것처럼 보임
- **해결**: 네이티브 기능 추가, 오프라인 기능 구현

#### 5.1.1 Data Collection and Storage

- 불필요한 개인정보 수집
- **해결**: 필요한 데이터만 수집, 개인정보처리방침 상세화

#### 2.1 App Completeness

- 앱 충돌 또는 불완전한 기능
- **해결**: 철저한 테스트 후 재제출

---

## 유용한 명령어 모음

```bash
# iOS 클린 빌드
npm run clean:ios

# Metro 캐시 클리어
npx react-native start --reset-cache

# iOS 시뮬레이터 실행
npm run ios

# 특정 기기에서 실행
npx react-native run-ios --device "iPhone 15 Pro"

# Release 빌드 테스트
npx react-native run-ios --configuration Release
```

---

## 참고 자료

- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [React Native iOS 배포 문서](https://reactnative.dev/docs/publishing-to-app-store)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

---

## 체크리스트 요약

### 배포 전 체크리스트

- [ ] Apple Developer Program 멤버십 활성화
- [ ] Distribution Certificate 생성 완료
- [ ] App ID 등록 완료
- [ ] Provisioning Profile 생성 및 설치
- [ ] Bundle Identifier 설정
- [ ] 앱 버전 및 빌드 번호 설정
- [ ] 앱 아이콘 (1024x1024) 준비
- [ ] 모든 권한 설명 작성
- [ ] Release 빌드 테스트 완료

### App Store Connect 체크리스트

- [ ] 앱 등록 완료
- [ ] 스크린샷 업로드 (모든 필수 크기)
- [ ] 앱 설명 작성
- [ ] 키워드 설정
- [ ] 개인정보처리방침 URL 등록
- [ ] 지원 URL 등록
- [ ] 연령 등급 설정
- [ ] 빌드 업로드 및 선택
- [ ] 심사 정보 입력

---

*마지막 업데이트: 2026년 1월*
