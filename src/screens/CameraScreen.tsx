import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView, Text as RNText, Platform, Alert, Modal, TextInput, KeyboardAvoidingView, Linking, Animated, Image } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Text, View } from '../components/Themed';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../constants/Colors';
import { useColorScheme } from '../components/useColorScheme';
import { Exhibition } from '../types/Exhibition';
import type { RootStackScreenProps } from '../navigation/types';
import {
  loadCapturePolicy,
  loadCaptureMeta,
  updateCaptureMeta,
  getCurrentLocation,
  decideTargetExhibition,
} from '../utils/capturePolicy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SectionParam = 'photos' | 'floor' | 'poster';
const APP_PHOTO_DIR = 'eyeseeit/';
const APP_MEDIA_ALBUM = 'eyeseeit';

export default function CameraScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackScreenProps<'Camera'>['navigation']>();
  const route = useRoute<RootStackScreenProps<'Camera'>['route']>();
  const { targetId, section } = route.params || {};
  const cameraRef = useRef<Camera | null>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [blocked, setBlocked] = useState(false);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState<boolean>(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  
  // 새로 생성된 전시 ID 추적
  const [newExhibitionId, setNewExhibitionId] = useState<string | null>(null);
  const newExhibitionIdRef = useRef<string | null>(null);
  
  // 전시 정보 입력 모달
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [exhibitionName, setExhibitionName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [location, setLocation] = useState('');

  // 촬영 피드백: 플래시 애니메이션 및 썸네일
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  // 플래시 효과 트리거
  const triggerFlash = useCallback(() => {
    flashAnim.setValue(0.7);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [flashAnim]);

  // 화면 진입 시 즉시 카메라 권한 요청
  useEffect(() => {
    (async () => {
      if (!hasPermission) {
        const result = await requestPermission();
        if (!result) {
          setBlocked(true);
        }
      }
    })();
  }, [hasPermission, requestPermission]);

  // 안드로이드 네비게이션 바 숨김 (immersive)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // Navigation bar immersive mode 제거: 기본 시스템 동작 사용
  }, []);

  // 뒤로가기 시 모달 표시 (하드웨어 버튼, 제스처 포함)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // 새 전시가 생성되었고 모달이 아직 표시되지 않았으면
      if (newExhibitionIdRef.current && !showInfoModal) {
        // 기본 뒤로가기 동작 방지
        e.preventDefault();
        // 모달 표시
        setShowInfoModal(true);
      }
    });
    return unsubscribe;
  }, [navigation, showInfoModal]);

  const ensurePhotosDir = useCallback(async () => {
    const dir = RNFS.DocumentDirectoryPath + '/' + APP_PHOTO_DIR;
    try {
      const exists = await RNFS.exists(dir);
      if (!exists) {
        await RNFS.mkdir(dir);
      }
    } catch {}
    return dir;
  }, []);

  const getExtFromUri = (uri: string) => {
    const m = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
    return (m && m[1]) ? m[1] : 'jpg';
  };

  const copyUriToAppFile = useCallback(async (uri: string): Promise<string> => {
    const dir = await ensurePhotosDir();
    const ext = getExtFromUri(uri);
    const dest = `${dir}photo_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const sourceUri = uri.replace('file://', '');
    try {
      await RNFS.copyFile(sourceUri, dest);
      return 'file://' + dest;
    } catch {
      try {
        const base64 = await RNFS.readFile(sourceUri, 'base64');
        await RNFS.writeFile(dest, base64, 'base64');
        return 'file://' + dest;
      } catch {
        return uri;
      }
    }
  }, [ensurePhotosDir]);

  // 갤러리에 저장하고, 성공하면 그 asset uri를 반환, 실패하면 원본 uri 반환
  const saveToGallery = async (uri: string): Promise<string | null> => {
    if (!hasMediaLibraryPermission) return null;
    try {
      await CameraRoll.saveAsset(uri, { type: 'photo', album: APP_MEDIA_ALBUM });
      return uri;
    } catch (e) {
      console.warn('Failed to save to gallery', e);
      return null;
    }
  };

  const saveToExhibitions = useCallback(async (finalUri: string) => {
    try {
      const raw = await AsyncStorage.getItem('@exhibitions');
      const list: Exhibition[] = raw ? JSON.parse(raw) : [];
      const now = new Date();

      // Section parameter mapping
      const sectionParam: SectionParam = (section === 'floor' || section === 'poster') ? section : 'photos';

      if (targetId) {
        const idx = list.findIndex(e => e.id === String(targetId));
        if (idx !== -1) {
          const target = list[idx];
          if (sectionParam === 'floor') {
            const arr = [...(target.floorPlanPhotos || []), finalUri];
            list[idx] = { ...target, floorPlanPhotos: arr, updatedAt: now.toISOString() };
          } else if (sectionParam === 'poster') {
            const arr = [...(target.posterPhotos || []), finalUri];
            list[idx] = { ...target, posterPhotos: arr, updatedAt: now.toISOString() };
          } else {
            const arr = [...(target.photos || []), finalUri];
            list[idx] = { ...target, photos: arr, updatedAt: now.toISOString() };
          }
          await AsyncStorage.setItem('@exhibitions', JSON.stringify(list));
          // capture meta는 메인 사진에 대해서만 갱신
          if (sectionParam === 'photos') {
            await updateCaptureMeta(String(targetId), null);
          }
          return;
        }
      }

      // 정책 기반 자동 결정 (메인 사진에 저장)
      const [policy, meta, currentLocation] = await Promise.all([
        loadCapturePolicy(),
        loadCaptureMeta(),
        getCurrentLocation().catch(() => null),
      ]);
      const decision = await decideTargetExhibition({
        exhibitions: list,
        policy,
        meta,
        currentLocation,
      });
      if (decision.createNew || !decision.targetExhibitionId) {
        const newEx: Exhibition = {
          id: now.getTime().toString(),
          name: '(전시명)',
          artist: '(작가명)',
          location: '(장소)',
          review: '',
          photos: [finalUri],
          curator: '',
          notes: '',
          floorPlanPhotos: [],
          posterPhotos: [],
          with: '',
          link: '',
          contact: '',
          isFavorite: false,
          visitDate: now.toISOString().split('T')[0],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        const updated = [newEx, ...list];
        await AsyncStorage.setItem('@exhibitions', JSON.stringify(updated));
        await updateCaptureMeta(newEx.id, currentLocation);
        // 새 전시가 생성되었음을 기록 (뒤로가기 시 모달 표시)
        newExhibitionIdRef.current = newEx.id;
        setNewExhibitionId(newEx.id);
      } else {
        const idx2 = list.findIndex(e => e.id === decision.targetExhibitionId);
        if (idx2 !== -1) {
          const t = list[idx2];
          const arr = [...(t.photos || []), finalUri];
          list[idx2] = { ...t, photos: arr, updatedAt: now.toISOString() };
          await AsyncStorage.setItem('@exhibitions', JSON.stringify(list));
          await updateCaptureMeta(t.id, currentLocation);
        } else {
          // 타겟 전시가 삭제된 경우 새 전시 생성 후 모달 표시
          const fallback: Exhibition = {
            id: now.getTime().toString(),
            name: '(전시명)',
            artist: '(작가명)',
            location: '(장소)',
            review: '',
            photos: [finalUri],
            curator: '',
            notes: '',
            floorPlanPhotos: [],
            posterPhotos: [],
            with: '',
            link: '',
            contact: '',
            isFavorite: false,
            visitDate: now.toISOString().split('T')[0],
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };
          const updated = [fallback, ...list];
          await AsyncStorage.setItem('@exhibitions', JSON.stringify(updated));
          await updateCaptureMeta(fallback.id, currentLocation);
          newExhibitionIdRef.current = fallback.id;
          setNewExhibitionId(fallback.id);
        }
      }
    } catch (e) {
      console.error('saveToExhibitions failed', e);
      Alert.alert('오류', '사진을 저장하는 중 문제가 발생했습니다.');
    }
  }, [section, targetId]);

  const takeAndSave = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const result = await cameraRef.current.takePhoto({
        enableShutterSound: false,
        qualityPrioritization: 'speed',
        enableAutoRedEyeReduction: false,
        enableAutoDistortionCorrection: false,
      });
      if (result?.path) {
        const capturedUri = 'file://' + result.path;
        // 플래시 효과 및 썸네일 업데이트
        triggerFlash();
        setLastPhotoUri(capturedUri);
        // 저장 작업을 백그라운드로 수행하여 다음 촬영 대기 최소화
        (async () => {
          try {
            const galleryUri = hasMediaLibraryPermission ? await saveToGallery(capturedUri) : null;
            const finalUri = await copyUriToAppFile(galleryUri || capturedUri);
            await saveToExhibitions(finalUri);
            setSavedCount((c) => c + 1);
          } catch (e) {
            console.error(e);
            Alert.alert('오류', '사진 저장 중 문제가 발생했습니다.');
          }
        })();
      }
    } catch (e) {
      console.error(e);
    } finally {
      // 촬영 완료 후 바로 다음 촬영 가능하도록 해제
      setIsCapturing(false);
    }
  }, [isCapturing, copyUriToAppFile, saveToExhibitions, hasMediaLibraryPermission, triggerFlash]);

  const flashIcon = useMemo(() => {
    return flash === 'on' ? 'flash' : 'flash';
  }, [flash]);

  // 뒤로가기 처리: 새 전시가 생성되었으면 정보 입력 모달 표시
  const handleBack = useCallback(() => {
    if (newExhibitionIdRef.current) {
      setShowInfoModal(true);
    } else {
      navigation.goBack();
    }
  }, [navigation]);

  // 전시 정보 저장
  const saveExhibitionInfo = useCallback(async () => {
    if (!newExhibitionId) {
      navigation.goBack();
      return;
    }
    
    try {
      const raw = await AsyncStorage.getItem('@exhibitions');
      const list: Exhibition[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(e => e.id === newExhibitionId);
      
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          name: exhibitionName.trim() || '(전시명)',
          artist: artistName.trim() || '(작가명)',
          location: location.trim() || '(장소)',
          updatedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem('@exhibitions', JSON.stringify(list));
      }
    } catch (e) {
      console.error('Failed to save exhibition info', e);
    }
    
    newExhibitionIdRef.current = null;
    setShowInfoModal(false);
    navigation.goBack();
  }, [newExhibitionId, exhibitionName, artistName, location, navigation]);

  // 권한 없음 또는 차단됨
  if (!hasPermission || device == null) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <FontAwesomeIcon name="camera" size={48} color="#999" style={{ marginBottom: 16 }} />
        <Text style={styles.permissionText}>카메라 권한이 필요합니다.</Text>
        <Text style={styles.permissionSubtext}>
          사진을 촬영하려면 카메라 접근 권한을 허용해 주세요.
        </Text>
        {blocked ? (
          // 이미 차단된 경우 설정으로 이동
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionButtonText}>설정에서 권한 허용하기</Text>
          </TouchableOpacity>
        ) : (
          // 아직 요청 가능한 경우
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={async () => {
              const result = await requestPermission();
              if (!result) {
                setBlocked(true);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionButtonText}>권한 요청</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.permissionButtonBack}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonBackText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {device && (
        <Camera
          ref={cameraRef}
          style={{ flex: 1 }}
          device={device}
          isActive={true}
          photo={true}
          photoQualityBalance="speed"
        />
      )}

      {/* 플래시 효과 오버레이 */}
      <Animated.View 
        style={[styles.flashOverlay, { opacity: flashAnim }]} 
        pointerEvents="none" 
      />

      {/* 상단 바 */}
      <RNView style={[styles.topBar, { paddingTop: insets.top + 8, paddingBottom: 12 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.topBtn} activeOpacity={0.8}>
          <FontAwesomeIcon name="chevron-left" size={20} color="#ffffff" />
        </TouchableOpacity>
        <RNView style={styles.topCenter}>
          <RNText style={styles.counterText}>저장됨 {savedCount}장</RNText>
        </RNView>
        <TouchableOpacity
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
          style={styles.topBtn}
          activeOpacity={0.8}
        >
          <FontAwesomeIcon name={flashIcon} size={20} color="#ffffff" />
        </TouchableOpacity>
      </RNView>
      {/* 하단 캡처 바 */}
      <RNView style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {/* 썸네일 미리보기 (카메라 버튼 왼쪽) */}
        <RNView style={styles.thumbnailContainer}>
          {lastPhotoUri && (
            <Image source={{ uri: lastPhotoUri }} style={styles.thumbnail} />
          )}
        </RNView>
        
        <TouchableOpacity
          onPress={takeAndSave}
          activeOpacity={0.8}
          style={[styles.captureButton, isCapturing && { opacity: 0.7 }]}
          disabled={isCapturing}
        >
          <RNView style={styles.captureInner} />
        </TouchableOpacity>
        
        {/* 오른쪽 빈 공간 (균형 맞추기) */}
        <RNView style={styles.thumbnailContainer} />
      </RNView>

      {/* 전시 정보 입력 모달 */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => saveExhibitionInfo()}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <RNView style={styles.modalContent}>
            <RNText style={styles.modalTitle}>전시 정보 입력</RNText>
            <RNText style={styles.modalSubtitle}>새로운 전시가 생성되었습니다. 정보를 입력해 주세요.</RNText>
            
            <RNView style={styles.inputGroup}>
              <RNText style={styles.inputLabel}>작가명</RNText>
              <TextInput
                style={styles.textInput}
                placeholder="(작가명)"
                placeholderTextColor="#999"
                value={artistName}
                onChangeText={setArtistName}
                autoFocus
              />
            </RNView>
            
            <RNView style={styles.inputGroup}>
              <RNText style={styles.inputLabel}>전시명</RNText>
              <TextInput
                style={styles.textInput}
                placeholder="(전시명)"
                placeholderTextColor="#999"
                value={exhibitionName}
                onChangeText={setExhibitionName}
              />
            </RNView>
            
            <RNView style={styles.inputGroup}>
              <RNText style={styles.inputLabel}>장소</RNText>
              <TextInput
                style={styles.textInput}
                placeholder="(장소)"
                placeholderTextColor="#999"
                value={location}
                onChangeText={setLocation}
              />
            </RNView>
            
            <RNView style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSkip}
                onPress={() => {
                  newExhibitionIdRef.current = null;
                  setShowInfoModal(false);
                  navigation.goBack();
                }}
                activeOpacity={0.8}
              >
                <RNText style={styles.modalButtonSkipText}>건너뛰기</RNText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonSave}
                onPress={saveExhibitionInfo}
                activeOpacity={0.8}
              >
                <RNText style={styles.modalButtonSaveText}>저장</RNText>
              </TouchableOpacity>
            </RNView>
          </RNView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topBtn: {
    padding: 8,
  },
  topCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 30,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  thumbnailContainer: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  modalButtonSkip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalButtonSkipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#21df5a',
    alignItems: 'center',
  },
  modalButtonSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  permissionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#00D26A',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionButtonSecondary: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  permissionButtonSecondaryText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionButtonBack: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  permissionButtonBackText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
});
