import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Image, Alert, Modal, Dimensions, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IoniconsIcon from 'react-native-vector-icons/Ionicons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exhibition } from '../../types/Exhibition';
import Colors from '../../constants/Colors';
import { useColorScheme } from '../../components/useColorScheme';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import type { RootStackScreenProps } from '../../navigation/types';
import {
  loadCapturePolicy,
  loadCaptureMeta,
  getCurrentLocation,
  decideTargetExhibition,
  updateCaptureMeta,
} from '../../utils/capturePolicy';
import { ensureLocalDb, nearestOpenLocal, validateWithServer, syncExhibitions } from '../../services/exhibitions';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

type PhotoItem = { uri: string; exhibitionId: string; exhibitionName: string; exhibitionArtist: string };

export default function AlbumScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const route = useRoute<RootStackScreenProps<'Album'>['route']>();
  const params = route.params || {};
  const flatListRef = useRef<FlatList>(null);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isBackCamera, setIsBackCamera] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraSupportsWeb, setCameraSupportsWeb] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice(isBackCamera ? 'back' : 'front');
  const { hasPermission: permission, requestPermission } = useCameraPermission();
  const [viewMode, setViewMode] = useState<'all' | 'exhibition'>('all');
  const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);
  const [viewerPhotos, setViewerPhotos] = useState<PhotoItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const viewerListRef = useRef<FlatList<PhotoItem>>(null);

  useEffect(() => {
    loadExhibitions();
  }, []);
  
  // 탭으로 돌아올 때마다 최신 데이터로 새로고침
  useFocusEffect(React.useCallback(() => {
    loadExhibitions();
  }, []));
  useEffect(() => {
    // 웹에서는 react-native-vision-camera가 지원되지 않음
    if (Platform.OS === 'web') {
      setCameraSupportsWeb(false);
    }
  }, []);


  // 특정 날짜로 스크롤하는 기능
  useEffect(() => {
    if (params.scrollToDate && viewMode === 'all') {
      const { sortedDates } = getPhotosByDate();
      const targetIndex = sortedDates.findIndex(date => date === params.scrollToDate);
      if (targetIndex !== -1 && flatListRef.current) {
        // 약간의 지연을 두어 데이터가 로드된 후 스크롤
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: targetIndex,
            animated: true,
            viewPosition: 0.1
          });
        }, 500);
      }
    }
  }, [params.scrollToDate, exhibitions, viewMode]);

  const loadExhibitions = async () => {
    try {
      const stored = await AsyncStorage.getItem('@exhibitions');
      if (stored) {
        const parsedExhibitions = JSON.parse(stored);
        // 기존 데이터에 isFavorite 필드가 없을 경우 기본값 false로 설정
        const exhibitionsWithFavorites = parsedExhibitions.map((exhibition: Exhibition) => ({
          ...exhibition,
          isFavorite: exhibition.isFavorite ?? false
        }));
        setExhibitions(exhibitionsWithFavorites.sort((a: Exhibition, b: Exhibition) => 
          new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
        ));
      }
    } catch (error) {
      console.error('Failed to load exhibitions:', error);
      Alert.alert('오류', '전시 목록을 불러오는데 실패했습니다.');
    }
  };

  const saveExhibitions = async (newExhibitions: Exhibition[]) => {
    try {
      await AsyncStorage.setItem('@exhibitions', JSON.stringify(newExhibitions));
    } catch (error) {
      console.error('Failed to save exhibitions:', error);
      Alert.alert('오류', '전시 정보를 저장하는데 실패했습니다.');
    }
  };

  // 모든 사진을 날짜별로 그룹화하여 가져오기
  const getPhotosByDate = () => {
    const photosByDate: { [key: string]: PhotoItem[] } = {};
    
    exhibitions.forEach(exhibition => {
      if (!exhibition?.visitDate) return;
      if (!exhibition?.photos || exhibition.photos.length === 0) return;

      const visitDate = exhibition.visitDate;
      if (!photosByDate[visitDate]) {
        photosByDate[visitDate] = [];
      }
      exhibition.photos.forEach(photo => {
        if (!photo) return;
        photosByDate[visitDate].push({
          uri: photo,
          exhibitionId: exhibition.id,
          exhibitionName: exhibition.name || '',
          exhibitionArtist: exhibition.artist || '',
        });
      });
    });
    
    // 날짜별로 정렬 (최신 날짜부터)
    const sortedDates = Object.keys(photosByDate).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
    
    return { photosByDate, sortedDates };
  };

  // 모든 사진을 하나의 배열로 가져오기 (기존 호환성 유지)
  const getAllPhotos = () => {
    const { photosByDate } = getPhotosByDate();
    const allPhotos: PhotoItem[] = [];
    Object.values(photosByDate).forEach(photos => {
      allPhotos.push(...photos);
    });
    return allPhotos;
  };

  // 날짜 순서에 맞춰 전 flattened 리스트를 생성
  const getFlattenedPhotos = (): PhotoItem[] => {
    const { photosByDate, sortedDates } = getPhotosByDate();
    const list: PhotoItem[] = [];
    sortedDates.forEach(date => {
      const bucket = photosByDate[date] || [];
      list.push(...bucket);
    });
    return list;
  };

  const openPhotoViewer = (target: PhotoItem) => {
    const list = getFlattenedPhotos();
    const idx = list.findIndex(
      (p) => p.uri === target.uri && p.exhibitionId === target.exhibitionId
    );
    if (idx === -1) return;
    setViewerPhotos(list);
    setSelectedIndex(idx);
    setSelectedPhoto(list[idx].uri);
  };

  // 사진이 있는 전시만 필터링
  const getExhibitionsWithPhotos = () => {
    return exhibitions.filter(exhibition => 
      exhibition.photos && exhibition.photos.length > 0
    );
  };

  const takePicture = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: false,
      });

      // 정책 기반 결정: 새 전시 생성 여부 혹은 기존 전시 추가
      await addPhotoUsingPolicy('file://' + photo.path);
      setIsCameraVisible(false);
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    }
  };

  const pickImageFromGallery = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          const file = target.files[0];
          const reader = new FileReader();
          reader.onload = async (e) => {
            const result = e.target?.result as string;
            try {
              await addPhotoUsingPolicy(result);
            } catch (error) {
              console.error('Failed to add photo:', error);
              Alert.alert('오류', '사진 추가에 실패했습니다.');
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      // Android / iOS
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.85,
      });
      if (result.didCancel) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      try {
        await addPhotoUsingPolicy(uri);
      } catch (error) {
        console.error('Failed to add photo:', error);
        Alert.alert('오류', '사진 추가에 실패했습니다.');
      }
    }
  };

  // 정책 기반 사진 추가 공통 함수
  const addPhotoUsingPolicy = async (finalUri: string) => {
    try {
      const [policy, meta, currentLocation] = await Promise.all([
        loadCapturePolicy(),
        loadCaptureMeta(),
        getCurrentLocation().catch(() => null),
      ]);
      // 최신 전시 데이터 동기화 (백그라운드, 실패 무시)
      if (currentLocation) {
        ensureLocalDb().then(() => syncExhibitions({ center: { lat: currentLocation.lat, lon: currentLocation.lng }, radiusM: 10000 }).catch(() => {}));
      } else {
        ensureLocalDb().catch(() => {});
      }
      const { targetExhibitionId, createNew } = await decideTargetExhibition({
        exhibitions,
        policy,
        meta,
        currentLocation,
      });
      if (createNew || !targetExhibitionId) {
        const now = new Date();
        // 근접 오픈 전시 자동 추천 (로컬 → 서버 검증)
        let suggestionTitle: string | null = null;
        let suggestionVenue: string | null = null;
        let suggestionDistance: number | null = null;
        if (currentLocation) {
          const local = await nearestOpenLocal({ lat: currentLocation.lat, lon: currentLocation.lng, atIso: now.toISOString(), radiusM: Math.max(policy.distanceThresholdMeters * 3, 3000) });
          const server = await validateWithServer({ lat: currentLocation.lat, lon: currentLocation.lng, atIso: now.toISOString(), radiusM: Math.max(policy.distanceThresholdMeters * 3, 3000) }).catch(() => null);
          const best = server || local;
          if (best) {
            suggestionTitle = best.title;
            suggestionVenue = best.venue_name;
            suggestionDistance = best.distance_m;
          }
        }
        const newExhibition: Exhibition = {
          id: now.getTime().toString(),
          name: suggestionTitle || '임시전',
          artist: 'Various Artists',
          location: suggestionVenue || '서울',
          review: '',
          photos: [finalUri],
          curator: '',
          notes: suggestionTitle ? `자동 추천됨: ${suggestionTitle}${suggestionDistance != null ? ` (${suggestionDistance}m)` : ''}` : '',
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
        const updated = [newExhibition, ...exhibitions];
        setExhibitions(updated);
        await saveExhibitions(updated);
        setSelectedExhibition(newExhibition);
        await updateCaptureMeta(newExhibition.id, currentLocation);
        if (suggestionTitle) {
          let msg = `근처 전시 '${suggestionTitle}'로 자동 채움`;
          if (suggestionDistance != null) msg += ` (${suggestionDistance}m)`;
          Alert.alert('자동 추천', msg);
        }
        return;
      }
      const target = exhibitions.find(e => e.id === targetExhibitionId);
      if (!target) {
        // fallback: create new
        const now = new Date();
        const newExhibition: Exhibition = {
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
        const updated = [newExhibition, ...exhibitions];
        setExhibitions(updated);
        await saveExhibitions(updated);
        setSelectedExhibition(newExhibition);
        await updateCaptureMeta(newExhibition.id, currentLocation);
        return;
      }
      const newPhotos = [...(target.photos || []), finalUri];
      const updatedExhibitions = exhibitions.map(e =>
        e.id === target.id ? { ...e, photos: newPhotos, updatedAt: new Date().toISOString() } : e
      );
      setExhibitions(updatedExhibitions);
      await saveExhibitions(updatedExhibitions);
      await updateCaptureMeta(target.id, currentLocation);
    } catch (e) {
      console.error('addPhotoUsingPolicy(album) failed', e);
    }
  };

  const deletePhoto = (photoUri: string, exhibitionId: string) => {
    Alert.alert(
      '사진 삭제',
      '이 사진을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const exhibition = exhibitions.find(e => e.id === exhibitionId);
              if (exhibition) {
                const newPhotos = exhibition.photos.filter(photo => photo !== photoUri);
                const updatedExhibitions = exhibitions.map(e =>
                  e.id === exhibitionId ? { ...e, photos: newPhotos, updatedAt: new Date().toISOString() } : e
                );
                setExhibitions(updatedExhibitions);
                await saveExhibitions(updatedExhibitions);
                
                // 선택된 전시가 있다면 해당 전시의 사진도 업데이트
                if (selectedExhibition && selectedExhibition.id === exhibitionId) {
                  setSelectedExhibition({ ...selectedExhibition, photos: newPhotos });
                }
                
                Alert.alert('성공', '사진이 삭제되었습니다.');
              }
            } catch (error) {
              console.error('Failed to delete photo:', error);
              Alert.alert('오류', '사진 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const renderPhotoItem = ({ item }: { item: PhotoItem }) => (
    <TouchableOpacity 
      style={styles.photoItem}
      onPress={() => openPhotoViewer(item)}
      onLongPress={() => {
        if (item.exhibitionId) deletePhoto(item.uri, item.exhibitionId);
      }}
    >
      <Image source={{ uri: item.uri }} style={styles.photoImage} />
    </TouchableOpacity>
  );

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  };

  const renderDateSection = ({ item: date }: { item: string }) => {
    const { photosByDate } = getPhotosByDate();
    const photos = photosByDate[date] || [];
    if (!photos.length) return null;
    
    return (
      <View style={styles.dateSection}>
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{formatDateHeader(date)}</Text>
          <Text style={styles.photoCountText}>{photos.length}장</Text>
        </View>
        <FlatList
          data={photos}
          renderItem={({ item: photo, index }) => (
            <TouchableOpacity 
              key={`${date}-${index}`}
              style={styles.photoItem}
              onPress={() => openPhotoViewer(photo)}
              onLongPress={() => deletePhoto(photo.uri, photo.exhibitionId)}
            >
              <Image source={{ uri: photo.uri }} style={styles.photoImage} />
            </TouchableOpacity>
          )}
          keyExtractor={(photo, index) => `${date}-${index}`}
          numColumns={4}
          scrollEnabled={false}
          contentContainerStyle={styles.photoGridContent}
        />
      </View>
    );
  };

  const deleteExhibition = (exhibitionId: string) => {
    Alert.alert(
      '전시 삭제',
      '이 전시를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const updatedExhibitions = exhibitions.filter(exhibition => exhibition.id !== exhibitionId);
              setExhibitions(updatedExhibitions);
              await saveExhibitions(updatedExhibitions);
              
              // 선택된 전시가 삭제된 전시라면 선택 해제
              if (selectedExhibition && selectedExhibition.id === exhibitionId) {
                setSelectedExhibition(null);
                setViewMode('exhibition');
              }
              
              Alert.alert('성공', '전시가 삭제되었습니다.');
            } catch (error) {
              console.error('Failed to delete exhibition:', error);
              Alert.alert('오류', '전시 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const renderExhibitionItem = ({ item }: { item: Exhibition }) => (
    <TouchableOpacity 
      style={styles.exhibitionItem}
      onPress={() => {
        setSelectedExhibition(item);
        setViewMode('exhibition');
      }}
      onLongPress={() => deleteExhibition(item.id)}
    >
      <View style={styles.exhibitionIcon}>
        <FontAwesomeIcon
          name="folder"
          size={32}
          color={Colors[colorScheme ?? 'light'].tint}
        />
      </View>
      <View style={styles.exhibitionInfo}>
        <Text style={styles.exhibitionName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.exhibitionArtist} numberOfLines={1}>
          {item.artist}
        </Text>
        <Text style={styles.photoCount}>
          {item.photos?.length || 0}장의 사진
        </Text>
      </View>
      <View style={styles.exhibitionArrow}>
        <FontAwesomeIcon
          name="chevron-right"
          size={16}
          color={Colors[colorScheme ?? 'light'].tabIconDefault}
        />
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <FontAwesomeIcon
        name="image"
        size={64}
        color={Colors[colorScheme ?? 'light'].tabIconDefault}
      />
      <Text style={styles.emptyTitle}>
        {viewMode === 'all' ? '사진이 없습니다' : '전시별 사진이 없습니다'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {viewMode === 'all' 
          ? '전시를 추가하고 사진을 촬영해보세요' 
          : '전시 상세에서 사진을 추가해보세요'
        }
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#f5f5f5" barStyle="dark-content" />

      {/* 커스텀 헤더 */}
      <View style={[styles.customHeader, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <IoniconsIcon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>앨범</Text>
        <View style={styles.headerRight} />
      </View>

      {/* viewMode에 따라 표시 분기: 기본은 날짜별 목록 */}
      {viewMode === 'all' ? (
        <FlatList
          ref={flatListRef}
          key="all-photos-by-date"
          data={getPhotosByDate().sortedDates}
          renderItem={renderDateSection}
          keyExtractor={(date) => date}
          style={styles.dateList}
          contentContainerStyle={styles.dateListContent}
          ListEmptyComponent={renderEmpty}
          onScrollToIndexFailed={(info) => {
            // 스크롤 실패 시 대체 처리
            console.log('Scroll to index failed:', info);
          }}
        />
      ) : selectedExhibition ? (
        <View style={styles.exhibitionView}>
          <View style={styles.exhibitionHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setSelectedExhibition(null);
                setViewMode('exhibition');
              }}
            >
              <FontAwesomeIcon name="arrow-left" size={20} color={Colors[(colorScheme ?? 'light') as 'light' | 'dark'].tint} />
              <Text style={styles.backButtonText}>전시별 보기</Text>
            </TouchableOpacity>
            <Text style={styles.exhibitionTitle}>{selectedExhibition?.name ?? ''}</Text>
          </View>
          <FlatList
            key={`exhibition-photos-${selectedExhibition.id}`}
            data={selectedExhibition.photos || []}
            renderItem={renderPhotoItem}
            keyExtractor={(item, index) => index.toString()}
            numColumns={4}
            style={styles.photoGrid}
            contentContainerStyle={styles.photoGridContent}
            ListEmptyComponent={renderEmpty}
          />
        </View>
      ) : (
        <FlatList
          key="exhibition-list"
          data={getExhibitionsWithPhotos()}
          renderItem={renderExhibitionItem}
          keyExtractor={(item) => item.id}
          style={styles.exhibitionList}
          contentContainerStyle={styles.exhibitionListContent}
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* 카메라 모달 */}
      <Modal visible={isCameraVisible} animationType="slide">
        <View style={styles.cameraContainer}>
          {Platform.OS !== 'web' || cameraSupportsWeb ? (
            <>
              {/* 권한 상태 처리 */}
              {!permission ? (
                <View style={styles.permissionContainer}>
                  <Text style={styles.permissionText}>카메라 권한이 필요합니다.</Text>
                  <TouchableOpacity style={styles.webCameraButton} onPress={requestPermission}>
                    <Text style={styles.webCameraButtonText}>권한 허용</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {device && (
                    <Camera
                      ref={cameraRef}
                      style={{ flex: 1 }}
                      device={device}
                      isActive={isCameraVisible}
                      photo={true}
                      onInitialized={() => setIsCameraReady(true)}
                    />
                  )}
                  <View style={styles.cameraControls}>
                    <TouchableOpacity style={styles.cameraButton} onPress={() => setIsBackCamera(v => !v)}>
                      <IoniconsIcon name="camera-reverse" size={30} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cameraButton} onPress={takePicture} disabled={!isCameraReady}>
                      <IoniconsIcon name="radio-button-on" size={48} color={isCameraReady ? '#fff' : 'rgba(255,255,255,0.5)'} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cameraButton} onPress={() => setIsCameraVisible(false)}>
                      <IoniconsIcon name="close" size={30} color="white" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center' }}>
                      안드로이드 일부 기기에서는 셔터음이 시스템 정책/법규로 인해 꺼지지 않을 수 있어요.
                      무음 모드/볼륨 조절로 완화가 가능할 수 있습니다.
                    </Text>
                  </View>
                </>
              )}
            </>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <IoniconsIcon name="camera" size={100} color="#ccc" />
              <Text style={styles.cameraPlaceholderText}>웹에서는 카메라가 제한적입니다</Text>
              <Text style={styles.cameraPlaceholderSubtext}>
                모바일 앱에서 카메라 기능을 사용하거나 갤러리에서 사진을 선택하세요
              </Text>
              <TouchableOpacity style={styles.webCameraButton} onPress={pickImageFromGallery}>
                <Text style={styles.webCameraButtonText}>갤러리에서 사진 선택</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.webCameraButton, { marginTop: 12, backgroundColor: '#555' }]} onPress={() => setIsCameraVisible(false)}>
                <Text style={styles.webCameraButtonText}>닫기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* 사진 상세보기 모달 */}
      <Modal visible={selectedIndex !== null} animationType="fade" onRequestClose={() => {
        setSelectedIndex(null);
        setViewerPhotos([]);
        setSelectedPhoto(null);
      }}>
        <View style={styles.photoModalContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => {
              setSelectedIndex(null);
              setViewerPhotos([]);
              setSelectedPhoto(null);
            }}
          >
            <IoniconsIcon name="close" size={30} color="white" />
          </TouchableOpacity>

          <FlatList
            ref={viewerListRef}
            data={viewerPhotos}
            horizontal
            pagingEnabled
            initialScrollIndex={selectedIndex ?? 0}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, idx) => `${item.exhibitionId}-${idx}-${item.uri}`}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / width);
              setSelectedIndex(page);
              setSelectedPhoto(viewerPhotos[page]?.uri ?? null);
            }}
            renderItem={({ item }) => (
              <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: item.uri }} style={styles.fullScreenImage} />
                <View style={styles.viewerInfo}>
                  <Text style={styles.viewerTitle}>{item.exhibitionName || '전시명 없음'}</Text>
                  <Text style={styles.viewerSubtitle}>{item.exhibitionArtist || '작가 미상'}</Text>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 40,
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
    gap: 10,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeModeButton: {
    backgroundColor: Colors.light.tint,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    color: '#007AFF',
  },
  activeModeButtonText: {
    color: 'white',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  buttonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '600',
  },
  photoGrid: {
    flex: 1,
  },
  photoGridContent: {
    padding: 8,
  },
  photoItem: {
    width: (width - 40) / 4, // 4열 그리드용 고정 크기
    height: (width - 40) / 4,
    margin: 3,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    resizeMode: 'cover',
  },
  photoLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  photoLabelText: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
  },
  exhibitionList: {
    flex: 1,
  },
  exhibitionListContent: {
    padding: 16,
  },
  exhibitionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
  },
  exhibitionIcon: {
    marginRight: 16,
  },
  exhibitionInfo: {
    flex: 1,
  },
  exhibitionName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  exhibitionArtist: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  photoCount: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  exhibitionArrow: {
    marginLeft: 12,
  },
  exhibitionView: {
    flex: 1,
  },
  exhibitionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 6,
  },
  exhibitionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
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
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  cameraPlaceholderText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  cameraPlaceholderSubtext: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  webCameraButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  webCameraButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingTop: 20,
  },
  cameraButton: {
    padding: 15,
  },
  photoModalContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: height,
    resizeMode: 'contain',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  dateList: {
    flex: 1,
  },
  dateListContent: {
    padding: 8,
  },
  dateSection: {
    marginBottom: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  photoCountText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
}); 