import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Alert, Platform, Modal, TextInput, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IconAssets } from '../components/IconAssets';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteExhibitionById, computeYearMilestones } from '../utils/exhibitions';
import { Text, View } from '../components/Themed';
import { Exhibition, ExhibitionFormData } from '../../types/Exhibition';
import ExhibitionListItem from '../components/ExhibitionListItem';
import ExhibitionDetailModal from '../components/ExhibitionDetailModal';
import ExhibitionGalleryModal from '../components/ExhibitionGalleryModal';
import AddExhibitionModal from '../components/AddExhibitionModal';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '../../constants/Colors';
import { useColorScheme } from '../components/useColorScheme';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  DEFAULT_CAPTURE_POLICY,
  type CapturePolicy,
  loadCapturePolicy,
  saveCapturePolicy,
  loadCaptureMeta,
  saveCaptureMeta,
  updateCaptureMeta,
  getCurrentLocation,
  decideTargetExhibition,
} from '../utils/capturePolicy';

const STORAGE_KEY = '@exhibitions';
const APP_PHOTO_DIR = 'eyeseeit/';

export default function ListScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [capturePolicy, setCapturePolicy] = useState<CapturePolicy>(DEFAULT_CAPTURE_POLICY);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<CapturePolicy>(DEFAULT_CAPTURE_POLICY);

  useEffect(() => {
    loadExhibitions();
  }, []);

  // 전시 목록이 바뀌면 선택된 전시도 동기화
  useEffect(() => {
    if (selectedExhibition) {
      const updated = exhibitions.find(e => e.id === selectedExhibition.id) || null;
      setSelectedExhibition(updated);
    }
  }, [exhibitions]);

  // 카메라 화면에서 돌아온 후에도 최신 상태를 반영
  useFocusEffect(
    React.useCallback(() => {
      loadExhibitions();
    }, [])
  );
  // 초기 로딩 시 현재 연도로 필터 적용
  useEffect(() => {
    const current = new Date().getFullYear();
    setSelectedYear(current);
  }, []);

  // 정책 로드
  useEffect(() => {
    (async () => {
      const p = await loadCapturePolicy();
      setCapturePolicy(p);
      setPolicyDraft(p);
    })();
  }, []);

  // 탭 바 두 번째 아이콘(플러스) 탭 → 이 화면으로 이동하면서 전시 추가 모달 열기
  useEffect(() => {
    if (params?.openAdd) {
      setShowAddModal(true);
      try {
        // 파라미터 제거하여 재오픈 방지
        router.setParams({ openAdd: undefined as any });
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.openAdd]);

  const loadExhibitions = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedExhibitions = JSON.parse(stored);
        // 기존 데이터에 isFavorite 필드가 없을 경우 기본값 false로 설정
        const exhibitionsWithFavorites = parsedExhibitions.map((exhibition: Exhibition) => ({
          ...exhibition,
          isFavorite: exhibition.isFavorite ?? false
        }));
        const sorted = exhibitionsWithFavorites.sort((a: Exhibition, b: Exhibition) => 
          new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
        );
        setExhibitions(sorted);
        // 웹에서는 data URL 그대로 유지 (마이그레이션 비활성화)
      }
    } catch (error) {
      console.error('Failed to load exhibitions:', error);
      Alert.alert('오류', '전시 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // data:image/... 형태를 파일 시스템에 저장하고 uri로 교체
  const ensurePhotosDir = async () => {
    const dir = (FileSystem.documentDirectory || '') + APP_PHOTO_DIR;
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    } catch {}
    return dir;
  };

  const saveDataUrlToFile = async (dataUrl: string): Promise<string> => {
    const commaIndex = dataUrl.indexOf(',');
    const meta = commaIndex > -1 ? dataUrl.slice(0, commaIndex) : '';
    const base64 = commaIndex > -1 ? dataUrl.slice(commaIndex + 1) : '';
    let ext = 'jpg';
    if (meta.includes('image/png')) ext = 'png';
    else if (meta.includes('image/webp')) ext = 'webp';
    else if (meta.includes('image/jpeg') || meta.includes('image/jpg')) ext = 'jpg';
    const dir = await ensurePhotosDir();
    const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const fileUri = dir + filename;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return fileUri;
  };

  const migrateDataUrlsToFiles = async (list: Exhibition[]): Promise<{ changed: boolean; list: Exhibition[] }> => {
    let changed = false;
    const migrated = await Promise.all(list.map(async (ex) => {
      const photos = ex.photos || [];
      const needs = photos.some((p) => typeof p === 'string' && p.startsWith('data:'));
      if (!needs) return ex;
      changed = true;
      const newPhotos: string[] = [];
      for (const p of photos) {
        if (typeof p === 'string' && p.startsWith('data:')) {
          try {
            const uri = await saveDataUrlToFile(p);
            newPhotos.push(uri);
          } catch {
            newPhotos.push(p);
          }
        } else {
          newPhotos.push(p);
        }
      }
      return { ...ex, photos: newPhotos } as Exhibition;
    }));
    return { changed, list: migrated };
  };

  // 파일 소유/정리 유틸
  const isAppPhotoUri = (uri: string) => {
    const dir = (FileSystem.documentDirectory || '') + APP_PHOTO_DIR;
    return typeof uri === 'string' && uri.startsWith(dir);
  };

  const getExtFromUri = (uri: string) => {
    const m = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
    return (m && m[1]) ? m[1] : 'jpg';
  };

  const copyUriToAppFile = async (uri: string): Promise<string> => {
    const dir = await ensurePhotosDir();
    const ext = getExtFromUri(uri);
    const dest = `${dir}photo_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    } catch (e) {
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
        return dest;
      } catch {
        return uri; // 실패 시 원본 유지
      }
    }
  };

  const deleteAppPhotoIfOwned = async (uri: string) => {
    if (!isAppPhotoUri(uri)) return;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch {}
  };

  const deleteAppPhotos = async (uris: string[]) => {
    for (const u of uris) {
      await deleteAppPhotoIfOwned(u);
    }
  };

  const saveExhibitions = async (newExhibitions: Exhibition[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newExhibitions));
    } catch (error) {
      console.error('Failed to save exhibitions:', error);
      Alert.alert('오류', '전시 정보를 저장하는데 실패했습니다.');
    }
  };

  const handleAddExhibition = async (data: ExhibitionFormData) => {
    const newExhibition: Exhibition = {
      id: Date.now().toString(),
      ...data,
      photos: [], // 빈 사진 배열로 초기화
      curator: data.curator ?? '',
      notes: data.notes ?? '',
      floorPlanPhotos: data.floorPlanPhotos ?? [],
      posterPhotos: data.posterPhotos ?? [],
      with: data.with ?? '',
      link: data.link ?? '',
      contact: data.contact ?? '',
      isFavorite: false, // 즐겨찾기 초기값
      visitDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedExhibitions = [newExhibition, ...exhibitions];
    const sortedByVisitDate = [...updatedExhibitions].sort(
      (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
    );
    setExhibitions(sortedByVisitDate);
    await saveExhibitions(sortedByVisitDate);
  };

  const handleUpdateExhibition = async (id: string, data: ExhibitionFormData) => {
    const prev = exhibitions.find(e => e.id === id) || null;
    const updatedExhibitions = exhibitions.map(exhibition =>
      exhibition.id === id
        ? { ...exhibition, ...data, updatedAt: new Date().toISOString() }
        : exhibition
    );
    // 방문 날짜 변경 시 최신 방문일 순으로 재정렬
    const sortedByVisitDate = [...updatedExhibitions].sort(
      (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
    );
    setExhibitions(sortedByVisitDate);
    // 상세 모달이 열려 있는 경우, 선택된 전시도 즉시 갱신
    if (selectedExhibition && selectedExhibition.id === id) {
      const updatedItem = sortedByVisitDate.find(e => e.id === id) || null;
      setSelectedExhibition(updatedItem);
    }
    await saveExhibitions(sortedByVisitDate);
    // 섹션 사진 제거분 정리
    if (prev) {
      const prevFloor = prev.floorPlanPhotos || [];
      const prevPoster = prev.posterPhotos || [];
      const next = sortedByVisitDate.find(e => e.id === id) || prev;
      const nextFloor = next.floorPlanPhotos || [];
      const nextPoster = next.posterPhotos || [];
      const removedFloor = prevFloor.filter(u => !nextFloor.includes(u));
      const removedPoster = prevPoster.filter(u => !nextPoster.includes(u));
      await deleteAppPhotos([...removedFloor, ...removedPoster]);
    }
  };

  const handleUpdatePhotos = async (exhibitionId: string, photos: string[]) => {
    const prev = exhibitions.find(e => e.id === exhibitionId);
    const updatedExhibitions = exhibitions.map(exhibition =>
      exhibition.id === exhibitionId
        ? { ...exhibition, photos, updatedAt: new Date().toISOString() }
        : exhibition
    );
    setExhibitions(updatedExhibitions);
    // 상세 모달이 열려 있는 경우, 선택된 전시의 사진도 즉시 갱신
    if (selectedExhibition && selectedExhibition.id === exhibitionId) {
      const updatedItem = updatedExhibitions.find(e => e.id === exhibitionId) || null;
      setSelectedExhibition(updatedItem);
    }
    await saveExhibitions(updatedExhibitions);
    // 제거된 파일 정리
    if (prev) {
      const removed = (prev.photos || []).filter(u => !photos.includes(u));
      await deleteAppPhotos(removed);
    }
  };

  const handleAddPhoto = async (exhibitionId: string) => {
    const addFromWebGallery = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const files = Array.from(target.files);
          const readAsDataURL = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const dataUrls = await Promise.all(files.map(readAsDataURL));
          const uris: string[] = dataUrls; // 웹에서는 data URL 그대로 저장
          const exhibition = exhibitions.find(e => e.id === exhibitionId);
          if (exhibition) {
            const newPhotos = [...(exhibition.photos || []), ...uris];
            await handleUpdatePhotos(exhibitionId, newPhotos);
            Alert.alert('성공', `${uris.length}장의 사진이 추가되었습니다.`);
          }
        }
      };
      input.click();
    };

    const addFromWebCamera = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      // 모바일 브라우저에서 카메라 촬영 힌트
      // @ts-ignore
      input.capture = 'environment';
      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          const file = target.files[0];
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = String(reader.result);
            const exhibition = exhibitions.find(e => e.id === exhibitionId);
            if (exhibition) {
              const newPhotos = [...(exhibition.photos || []), dataUrl]; // data URL 그대로 저장
              await handleUpdatePhotos(exhibitionId, newPhotos);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    };

    const addFromNativeGallery = async () => {
      if (Platform.OS === 'android') {
        // Android: 문서 선택기로 다중 선택 지원
        const result: any = await DocumentPicker.getDocumentAsync({ type: ['image/*'], multiple: true });
        // 취소 처리
        // 최신 버전은 result.assets, 구버전은 type: 'success' | 'cancel'
        let uris: string[] = [];
        if ((result as any)?.assets) {
          uris = (result.assets as any[]).map((a: any) => a.uri).filter(Boolean);
        } else if (result.type === 'success' && result.uri) {
          uris = [result.uri];
        }
        if (uris.length === 0) return;
        const exhibition = exhibitions.find(e => e.id === exhibitionId);
        if (!exhibition) return;
        const copied: string[] = [];
        for (const u of uris) {
          copied.push(await copyUriToAppFile(u));
        }
        const newPhotos = [...(exhibition.photos || []), ...copied];
        await handleUpdatePhotos(exhibitionId, newPhotos);
        Alert.alert('성공', `${uris.length}장의 사진이 추가되었습니다.`);
        return;
      }

      // iOS: ImagePicker 다중 선택
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsMultipleSelection: true,
      });
      if (result.canceled) return;
      const assetUris = (result.assets || []).map(a => a.uri).filter(Boolean);
      const uris: string[] = [];
      for (const u of assetUris) {
        uris.push(await copyUriToAppFile(u));
      }
      if (uris.length === 0) return;
      const exhibition = exhibitions.find(e => e.id === exhibitionId);
      if (!exhibition) return;
      const newPhotos = [...(exhibition.photos || []), ...uris];
      await handleUpdatePhotos(exhibitionId, newPhotos);
      Alert.alert('성공', `${uris.length}장의 사진이 추가되었습니다.`);
    };

    const addFromNativeCamera = async () => {
      // 커스텀 카메라 화면으로 이동하여 즉시 저장 + 연속 촬영
      router.push({ pathname: '/camera', params: { targetId: exhibitionId } });
    };

    if (Platform.OS === 'web') {
      Alert.alert('사진 추가', '방법을 선택하세요', [
        { text: '촬영', onPress: addFromWebCamera },
        { text: '갤러리에서 선택', onPress: addFromWebGallery },
        { text: '취소', style: 'cancel' },
      ]);
    } else {
      Alert.alert('사진 추가', '방법을 선택하세요', [
        { text: '촬영', onPress: addFromNativeCamera },
        { text: '갤러리에서 선택', onPress: addFromNativeGallery },
        { text: '취소', style: 'cancel' },
      ]);
    }
  };

  const handleDeleteExhibition = async (id: string) => {
    const target = exhibitions.find(e => e.id === id);
    if (target) {
      const owned = [
        ...(target.photos || []),
        ...(target.floorPlanPhotos || []),
        ...(target.posterPhotos || []),
      ].filter(Boolean) as string[];
      await deleteAppPhotos(owned);
    }
    const updated = await deleteExhibitionById(id);
    setExhibitions(updated);
  };

  const handleToggleFavorite = async (id: string) => {
    const target = exhibitions.find(exhibition => exhibition.id === id);
    if (!target) return;

    const performToggle = async () => {
      const updatedExhibitions = exhibitions.map(exhibition =>
        exhibition.id === id
          ? { ...exhibition, isFavorite: !exhibition.isFavorite, updatedAt: new Date().toISOString() }
          : exhibition
      );
      setExhibitions(updatedExhibitions);
      if (selectedExhibition && selectedExhibition.id === id) {
        const toggled = updatedExhibitions.find(e => e.id === id) || null;
        setSelectedExhibition(toggled);
      }
      await saveExhibitions(updatedExhibitions);
    };

    if (showFavoritesOnly && target.isFavorite) {
      Alert.alert('알림', '정말 좋아요 취소하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: () => {
            performToggle();
          },
        },
      ]);
      return;
    }

    await performToggle();
  };

  const addPhotoUsingPolicy = async (finalUri: string) => {
    try {
      const [policy, meta, currentLocation] = await Promise.all([
        loadCapturePolicy(),
        loadCaptureMeta(),
        getCurrentLocation().catch(() => null),
      ]);

      const { targetExhibitionId, createNew } = await decideTargetExhibition({
        exhibitions,
        policy,
        meta,
        currentLocation,
      });

      if (createNew || !targetExhibitionId) {
        const now = new Date();
        const newEx: Exhibition = {
          id: now.getTime().toString(),
          name: '임시전',
          artist: 'Various Artists',
          location: '서울',
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
        const updated = [newEx, ...exhibitions];
        setExhibitions(updated);
        await saveExhibitions(updated);
        await updateCaptureMeta(newEx.id, currentLocation);
        return;
      }

      // append to decided exhibition
      const target = exhibitions.find(e => e.id === targetExhibitionId);
      if (!target) {
        // fallback: create new if target not found
        const now = new Date();
        const newEx: Exhibition = {
          id: now.getTime().toString(),
          name: '임시전',
          artist: 'Various Artists',
          location: '서울',
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
        const updated = [newEx, ...exhibitions];
        setExhibitions(updated);
        await saveExhibitions(updated);
        await updateCaptureMeta(newEx.id, currentLocation);
        return;
      }
      const newPhotos = [...(target.photos || []), finalUri];
      await handleUpdatePhotos(target.id, newPhotos);
      await updateCaptureMeta(target.id, currentLocation);
    } catch (e) {
      console.error('addPhotoUsingPolicy failed', e);
    }
  };

  const handleItemPress = (exhibition: Exhibition) => {
    setSelectedExhibition(exhibition);
    setShowDetailModal(true);
  };

  const handleDatePress = (visitDate: string) => {
    // 갤러리 탭으로 이동하면서 특정 날짜로 스크롤하도록 파라미터 전달
    router.push({
      pathname: '/(tabs)/album',
      params: { scrollToDate: visitDate }
    });
  };

  const getFilteredExhibitions = () => {
    let list = exhibitions;
    if (showFavoritesOnly) {
      list = list.filter(exhibition => exhibition.isFavorite);
    }
    if (selectedYear) {
      list = list.filter(exhibition => {
        const y = new Date(exhibition.visitDate).getFullYear();
        return y === selectedYear;
      });
    }
    return list;
  };

  const availableYears = React.useMemo(() => {
    const current = new Date().getFullYear();
    let min = current;
    exhibitions.forEach((e) => {
      const y = new Date(e.visitDate).getFullYear();
      if (!Number.isNaN(y)) min = Math.min(min, y);
    });
    const years: number[] = [];
    for (let y = current; y >= min; y--) years.push(y);
    return years;
  }, [exhibitions]);

  const filteredExhibitions = getFilteredExhibitions();

  // 날짜가 같은 전시가 여러 개여도, 화면 하단(오래된 쪽)에서 5의 배수번째만 배지 표시
  // → 화면 표시 순서를 그대로(as-is) 사용하고, 아래쪽에서부터 카운트(countFromOldest)
  const yearMilestonesById = React.useMemo(
    () => computeYearMilestones(filteredExhibitions, { order: 'as-is', countFromOldest: true }),
    [filteredExhibitions]
  );

  const renderItem = ({ item, index }: { item: Exhibition; index: number }) => {
    const prev = filteredExhibitions[index - 1];
    const isFirstOfDate = index === 0 || prev?.visitDate !== item.visitDate;
    const curD = new Date(item.visitDate);
    const prevD = prev ? new Date(prev.visitDate) : null;
    const isFirstOfMonth =
      index === 0 || !prevD || prevD.getFullYear() !== curD.getFullYear() || prevD.getMonth() !== curD.getMonth();
    return (
      <ExhibitionListItem 
        exhibition={item} 
        onPress={() => handleItemPress(item)} 
        onToggleFavorite={handleToggleFavorite}
        onDatePress={handleDatePress}
        showDate={isFirstOfDate}
        showMonth={isFirstOfMonth}
        milestoneBadge={yearMilestonesById[item.id]}
      />
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <FontAwesome
        name="folder-open"
        size={64}
        color={Colors[colorScheme ?? 'light'].tabIconDefault}
      />
      <Text style={styles.emptyTitle}>전시 목록이 비어있습니다</Text>
      <Text style={styles.emptySubtitle}>새로운 전시를 추가해보세요</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#e6ffdb" style="dark" />
      {/* 헤더 - 연도 칩, 즐겨찾기 토글, 메뉴 */}
      <LinearGradient
        colors={["#21df5a", "#21df5a", "#3de36f", "#74eb98", "#90ef98", "#ffffff"]}
        locations={[0, 0.24, 0.46, 0.71, 0.85, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingTop: insets.top + 16,
          paddingBottom: 16,
        }}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: 'transparent',
              borderBottomColor: 'transparent',
            },
          ]}
        >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.yearChip, { backgroundColor: '#8ffbdc', borderColor: '#008c2a' }]}
            activeOpacity={0.7}
            onPress={() => setShowYearPicker(true)}
          >
            <Text style={[styles.yearChipText, { color: '#191c19' }]}>{selectedYear ?? new Date().getFullYear()}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          {/* 검색: 탭바에서 제거했으므로 상단 우측(하트 왼쪽)에 배치 */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/search')}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Feather
              name={'search'}
              size={30}
              color={'#ffffff'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <FontAwesome
              name={showFavoritesOnly ? 'heart' : 'heart-o'}
              size={30}
              color={'#ffffff'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            onPress={() => setShowMenu(true)}
          >
            <Feather name="menu" size={30} color={'#ffffff'} />
          </TouchableOpacity>
        </View>
        </View>
      </LinearGradient>

      <FlatList
        data={filteredExhibitions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          filteredExhibitions.length === 0
            ? styles.emptyList
            : [styles.list, styles.listWithFooter]
        }
        ListEmptyComponent={renderEmpty}
        extraData={{
          count: filteredExhibitions.length,
          years: availableYears.join(','),
        }}
      />

      <ExhibitionDetailModal
        visible={showDetailModal}
        exhibition={selectedExhibition}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedExhibition(null);
        }}
        onSave={handleUpdateExhibition}
        onDelete={handleDeleteExhibition}
        onUpdatePhotos={handleUpdatePhotos}
        onOpenGallery={() => {
          setShowDetailModal(false);
          setShowGalleryModal(true);
        }}
        onAddPhoto={() => {
          if (selectedExhibition) {
            handleAddPhoto(selectedExhibition.id);
          }
        }}
        onToggleFavorite={handleToggleFavorite}
      />

      <ExhibitionGalleryModal
        visible={showGalleryModal}
        exhibition={selectedExhibition}
        onClose={() => {
          setShowGalleryModal(false);
          setSelectedExhibition(null);
        }}
        onUpdatePhotos={handleUpdatePhotos}
      />

      <AddExhibitionModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddExhibition}
      />

      {/* 햄버거 메뉴 드롭다운 */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
          style={styles.menuOverlay}
        >
          <View
            style={[
              styles.dropdownMenu,
              { top: insets.top + 64, right: 12 },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.8}
              onPress={() => {
                setShowMenu(false);
                setShowAddModal(true);
              }}
            >
              <Text style={styles.menuItemText}>전시 추가</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowMenu(false);
                    setPolicyDraft(capturePolicy);
                    setShowPolicyModal(true);
                  }}
                >
                  <Text style={styles.menuItemText}>캡처 정책</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.8}
                  onPress={async () => {
                    setShowMenu(false);
                    // 간단 더미 데이터 추가 (웹 테스트용)
                    const now = new Date();
                    const dataUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="%23cfc"/></svg>';
                    const a: Exhibition = {
                      id: String(now.getTime()),
                      name: '더미전 A',
                      artist: 'Dummy',
                      location: 'Seoul',
                      review: '',
                      photos: [dataUrl],
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
                    const past = new Date(now.getTime() - 24*60*60*1000);
                    const b: Exhibition = {
                      id: String(now.getTime() - 1),
                      name: '더미전 B',
                      artist: 'Dummy',
                      location: 'Busan',
                      review: '',
                      photos: [dataUrl],
                      curator: '',
                      notes: '',
                      floorPlanPhotos: [],
                      posterPhotos: [],
                      with: '',
                      link: '',
                      contact: '',
                      isFavorite: false,
                      visitDate: past.toISOString().split('T')[0],
                      createdAt: past.toISOString(),
                      updatedAt: past.toISOString(),
                    };
                    const updated = [a, b, ...exhibitions];
                    setExhibitions(updated);
                    await saveExhibitions(updated);
                  }}
                >
                  <Text style={styles.menuItemText}>더미 데이터 추가</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.8}
                  onPress={async () => {
                    setShowMenu(false);
                    await saveCaptureMeta({ lastExhibitionId: null, lastCaptureAt: null, lastLocation: null });
                  }}
                >
                  <Text style={styles.menuItemText}>메타 초기화</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 연도 선택 모달 */}
      <Modal
        visible={showYearPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <View style={styles.yearModalOverlay}>
          <View style={styles.yearModal}>
            <Text style={styles.yearModalTitle}>연도 선택</Text>
            <FlatList
              data={availableYears}
              keyExtractor={(item) => String(item)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.yearItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedYear(item);
                    setShowYearPicker(false);
                  }}
                >
                  <Text style={styles.yearItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.yearListContent}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity style={styles.yearCloseButton} onPress={() => setShowYearPicker(false)}>
              <Text style={styles.yearCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 정책 설정 모달 (웹 전용) */}
      {Platform.OS === 'web' && (
        <Modal
          visible={showPolicyModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPolicyModal(false)}
        >
          <View style={styles.yearModalOverlay}>
            <View style={styles.yearModal}>
              <Text style={styles.yearModalTitle}>캡처 정책</Text>
              <Text style={styles.menuItemText}>시간 창(분)</Text>
              <TextInput
                style={[styles.inputLike]}
                keyboardType="numeric"
                value={String(policyDraft.timeWindowMinutes)}
                onChangeText={(t) => setPolicyDraft({ ...policyDraft, timeWindowMinutes: Math.max(0, parseInt(t || '0', 10) || 0) })}
              />
              <Text style={[styles.menuItemText, { marginTop: 8 }]}>거리 임계값(m)</Text>
              <TextInput
                style={[styles.inputLike]}
                keyboardType="numeric"
                value={String(policyDraft.distanceThresholdMeters)}
                onChangeText={(t) => setPolicyDraft({ ...policyDraft, distanceThresholdMeters: Math.max(0, parseInt(t || '0', 10) || 0) })}
              />
              <Text style={[styles.menuItemText, { marginTop: 8 }]}>모드</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                {(['auto','force-new','force-existing'] as const).map(m => (
                  <TouchableOpacity key={m} onPress={() => setPolicyDraft({ ...policyDraft, mode: m })} style={[styles.yearCloseButton, { backgroundColor: policyDraft.mode === m ? '#e6f5e9' : '#f5f5f5', borderRadius: 8 }]}>
                    <Text style={{ color: '#007AFF', fontWeight: '700' }}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
                <TouchableOpacity onPress={() => setShowPolicyModal(false)} style={styles.yearCloseButton}>
                  <Text style={styles.yearCloseText}>닫기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    setCapturePolicy(policyDraft);
                    await saveCapturePolicy(policyDraft);
                    setShowPolicyModal(false);
                  }}
                  style={styles.yearCloseButton}
                >
                  <Text style={styles.yearCloseText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* 플로팅 추가 버튼: 상세/갤러리/추가 모달이 아닐 때만 노출 */}
      {!showDetailModal && !showGalleryModal && !showAddModal && (
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: '#21df5a' },
          ]}
          onPress={async () => {
            // 플랫폼별로 즉시 촬영/업로드 실행 후, 가장 최근 전시에 사진 추가
            try {
              if (Platform.OS === 'web') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                // @ts-ignore - 힌트용 속성
                input.capture = 'environment';
                input.onchange = async (event) => {
                  const target = event.target as HTMLInputElement;
                  if (!target.files || !target.files[0]) return;
                  const file = target.files[0];
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const uri = String(reader.result);
                    // 웹에서는 항상 더미 전시 생성
                    const now = new Date();
                    const dummy: Exhibition = {
                      id: now.getTime().toString(),
                      name: '임시전',
                      artist: 'Various Artists',
                      location: '서울',
                      review: '',
                      photos: [uri],
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
                    await addPhotoUsingPolicy(uri);
                    return;
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
                return;
              }

              // 커스텀 카메라 화면으로 이동하여 즉시 저장 + 연속 촬영
              router.push('/camera');
            } catch (e) {
              console.error(e);
              Alert.alert('오류', '촬영/업로드 처리 중 문제가 발생했습니다.');
            }
          }}
          activeOpacity={0.85}
        >
          <RNView style={styles.fabIcon}>
            <FontAwesome name="camera" size={26} color="#ffffff" />
          </RNView>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#e6ffdb',
    borderBottomWidth: 1,
    borderBottomColor: '#e6ffdb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
  },
  filterButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#dcf3e5',
  },
  addButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#dcf3e5',
  },
  list: {
    paddingVertical: 0,
  },
  listWithFooter: {
    paddingBottom: 140, // allow space for one more card-height at bottom
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  yearChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
  },
  yearChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fabIcon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  yearModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  yearModal: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  yearModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  yearListContent: {
    paddingVertical: 8,
  },
  yearItem: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  yearItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  yearCloseButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  yearCloseText: {
    color: '#007AFF',
    fontWeight: '700',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.001)',
  },
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 8,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuItemText: {
    fontSize: 14,
    color: '#222',
    fontWeight: '600',
  },
  inputLike: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    backgroundColor: '#ffffff',
    color: '#222',
  },
});
