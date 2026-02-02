import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView, Text as RNText, Platform, Alert, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from './components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../constants/Colors';
import { useColorScheme } from './components/useColorScheme';
import { Exhibition } from '../types/Exhibition';
import {
  loadCapturePolicy,
  loadCaptureMeta,
  updateCaptureMeta,
  getCurrentLocation,
  decideTargetExhibition,
} from './utils/capturePolicy';

type SectionParam = 'photos' | 'floor' | 'poster';
const APP_PHOTO_DIR = 'eyeseeit/';
const APP_MEDIA_ALBUM = 'eyeseeit';

export default function CameraScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { targetId, section } = useLocalSearchParams<{ targetId?: string; section?: SectionParam }>();
  const cameraRef = useRef<CameraView | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  
  // 새로 생성된 전시 ID 추적
  const [newExhibitionId, setNewExhibitionId] = useState<string | null>(null);
  
  // 전시 정보 입력 모달
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [exhibitionName, setExhibitionName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    (async () => {
      // 카메라 권한: 먼저 현재 상태 확인 후 부족할 때만 요청
      const currentCam = await Camera.getCameraPermissionsAsync();
      if (currentCam.status !== 'granted') {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } else {
        setHasPermission(true);
      }

      // 미디어 라이브러리 권한: 동일하게 확인 후 요청
      const currentMedia = await MediaLibrary.getPermissionsAsync();
      if (currentMedia.status !== 'granted') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        setHasMediaLibraryPermission(status === 'granted');
      } else {
        setHasMediaLibraryPermission(true);
      }

      if (currentCam.status !== 'granted') {
        Alert.alert('권한 필요', '카메라 권한이 필요합니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      }
    })();
  }, [router]);

  // 안드로이드 네비게이션 바 숨김 (immersive)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // Navigation bar immersive mode 제거: 기본 시스템 동작 사용
  }, []);

  const ensurePhotosDir = useCallback(async () => {
    const dir = (FileSystem.documentDirectory || '') + APP_PHOTO_DIR;
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
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
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    } catch {
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
        return dest;
      } catch {
        return uri;
      }
    }
  }, [ensurePhotosDir]);

  // 갤러리에 저장하고, 성공하면 그 asset uri를 반환, 실패하면 원본 uri 반환
  const saveToGallery = async (uri: string): Promise<string | null> => {
    if (!hasMediaLibraryPermission) return null;
    try {
      const asset = await MediaLibrary.createAssetAsync(uri);
      let album = await MediaLibrary.getAlbumAsync(APP_MEDIA_ALBUM);
      if (!album) {
        await MediaLibrary.createAlbumAsync(APP_MEDIA_ALBUM, asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }
      return asset.uri;
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
        // 새 전시가 생성되었음을 기록하고 즉시 입력 모달 표시
        setNewExhibitionId(newEx.id);
        setShowInfoModal(true);
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
          setNewExhibitionId(fallback.id);
          setShowInfoModal(true);
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
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android', // faster on Android
      });
      if (result?.uri) {
        const capturedUri = result.uri;
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
  }, [isCapturing, copyUriToAppFile, saveToExhibitions, hasMediaLibraryPermission]);

  const flashIcon = useMemo(() => {
    if (flash === 'on') return 'flash';
    if (flash === 'auto') return 'bolt';
    return 'flash';
  }, [flash]);

  // 뒤로가기 처리: 새 전시가 생성되었으면 정보 입력 모달 표시
  const handleBack = useCallback(() => {
    if (newExhibitionId) {
      setShowInfoModal(true);
    } else {
      router.back();
    }
  }, [newExhibitionId, router]);

  // 전시 정보 저장
  const saveExhibitionInfo = useCallback(async () => {
    if (!newExhibitionId) {
      router.back();
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
    
    setShowInfoModal(false);
    router.back();
  }, [newExhibitionId, exhibitionName, artistName, location, router]);

  if (hasPermission === null) {
    return <View style={{ flex: 1 }} />;
  }
  if (hasPermission === false) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>카메라 권한이 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        ref={(ref) => (cameraRef.current = ref)}
        style={{ flex: 1 }}
        facing="back"
        flash={flash}
        // 촬영음 억제: Android는 셔터 사운드가 기기 정책에 따르므로 완전 무음은 어려우나,
        // 지원되는 경우 사운드를 끄도록 설정
        playSoundOnCapture={false}
        ratio={Platform.OS === 'android' ? '16:9' : undefined}
      />
      {/* 상단 바 */}
      <RNView style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.topBtn} activeOpacity={0.8}>
          <FontAwesome name="chevron-left" size={20} color="#ffffff" />
        </TouchableOpacity>
        <RNView style={styles.topCenter}>
          <RNText style={styles.counterText}>저장됨 {savedCount}장</RNText>
        </RNView>
        <TouchableOpacity
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'))}
          style={styles.topBtn}
          activeOpacity={0.8}
        >
          <FontAwesome name={flashIcon} size={20} color="#ffffff" />
        </TouchableOpacity>
      </RNView>
      {/* 하단 캡처 바 */}
      <RNView style={styles.bottomBar}>
        <TouchableOpacity
          onPress={takeAndSave}
          activeOpacity={0.8}
          style={[styles.captureButton, isCapturing && { opacity: 0.7 }]}
          disabled={isCapturing}
        >
          <RNView style={styles.captureInner} />
        </TouchableOpacity>
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
              <RNText style={styles.inputLabel}>전시명</RNText>
              <TextInput
                style={styles.textInput}
                placeholder="(전시명)"
                placeholderTextColor="#999"
                value={exhibitionName}
                onChangeText={setExhibitionName}
                autoFocus
              />
            </RNView>
            
            <RNView style={styles.inputGroup}>
              <RNText style={styles.inputLabel}>작가명</RNText>
              <TextInput
                style={styles.textInput}
                placeholder="(작가명)"
                placeholderTextColor="#999"
                value={artistName}
                onChangeText={setArtistName}
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
                  setShowInfoModal(false);
                  router.back();
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
    height: 64,
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)',
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
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
});
