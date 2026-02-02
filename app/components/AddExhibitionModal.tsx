import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  FlatList,
  Platform,
  View as RNView,
} from 'react-native';
import { Text, View } from './Themed';
import { ExhibitionFormData } from '../../types/Exhibition';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '../../constants/Colors';
import { useColorScheme } from './useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Camera, CameraView } from 'expo-camera';
import { toast } from '../utils/toast';

function ToggleSection({ title, children, previewText, previewLines = 0 }: { title: string; children: React.ReactNode; previewText?: string; previewLines?: number }) {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity onPress={() => setOpen(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
        <FontAwesome name={open ? 'chevron-down' : 'chevron-right'} size={14} color="#808080" />
        <Text style={{ marginLeft: 6, fontSize: 15, fontWeight: '600', color: '#666' }}>{title}</Text>
      </TouchableOpacity>
      {!open && !!previewText && previewLines > 0 && (
        <Text style={{ color: '#9a9a9a', fontSize: 14, lineHeight: 20 }} numberOfLines={previewLines} ellipsizeMode="tail">
          {previewText}
        </Text>
      )}
      {open && (
        <View style={{ marginTop: 8 }}>
          {children}
        </View>
      )}
    </View>
  );
}

interface AddExhibitionModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: ExhibitionFormData) => void;
}

const APP_PHOTO_DIR = 'eyeseeit/';
const APP_MEDIA_ALBUM = 'eyeseeit';

export default function AddExhibitionModal({
  visible,
  onClose,
  onAdd,
}: AddExhibitionModalProps) {
  const colorScheme = useColorScheme();
  const [formData, setFormData] = useState<ExhibitionFormData>({
    name: '',
    artist: '',
    location: '',
    review: '',
    curator: '',
    notes: '',
    floorPlanPhotos: [],
    posterPhotos: [],
    with: '',
    link: '',
    contact: '',
  });
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);

  // Camera states
  const [cameraVisible, setCameraVisible] = useState(false);
  const [activeSection, setActiveSection] = useState<'floorPlanPhotos' | 'posterPhotos' | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [captureCount, setCaptureCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@exhibitions');
        if (!raw) return;
        const list = JSON.parse(raw) as Array<{ location?: string }>;
        const uniq = Array.from(
          new Set(
            list
              .map(v => (v.location || '').trim())
              .filter(Boolean)
          )
        ).slice(0, 30);
        setLocationSuggestions(uniq);
      } catch (e) {
        // noop: 추천 장소 로드 실패해도 무시
      }
    })();
  }, [visible]);

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.artist.trim() || !formData.location.trim()) {
      Alert.alert('오류', '전시명, 작가, 장소는 필수 입력 항목입니다.');
      return;
    }

    onAdd(formData);
    toast('전시가 저장되었습니다');
    setFormData({ name: '', artist: '', location: '', review: '', curator: '', notes: '', floorPlanPhotos: [], posterPhotos: [], with: '', link: '', contact: '' });
    onClose();
  };

  const handleClose = () => {
    setFormData({ name: '', artist: '', location: '', review: '', curator: '', notes: '', floorPlanPhotos: [], posterPhotos: [], with: '', link: '', contact: '' });
    onClose();
  };

  // --- Camera Helpers ---
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
    } catch {
      // fallback: read/write
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
      return dest;
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android',
      });
      if (result.uri && activeSection) {
        // 1. Gallery export
        if (hasMediaPermission) {
          try {
            const asset = await MediaLibrary.createAssetAsync(result.uri);
            let album = await MediaLibrary.getAlbumAsync(APP_MEDIA_ALBUM);
            if (!album) {
              await MediaLibrary.createAlbumAsync(APP_MEDIA_ALBUM, asset, false);
            } else {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
          } catch {}
        }
        // 2. Internal copy
        const finalUri = await copyUriToAppFile(result.uri);
        
        // 3. Update state
        const arr = (activeSection === 'floorPlanPhotos' ? formData.floorPlanPhotos : formData.posterPhotos) || [];
        const next = [...arr, finalUri];
        setFormData(prev => activeSection === 'floorPlanPhotos' 
          ? { ...prev, floorPlanPhotos: next }
          : { ...prev, posterPhotos: next }
        );
        
        setCaptureCount(c => c + 1);
        toast('사진이 추가되었습니다');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openCamera = async (section: 'floorPlanPhotos' | 'posterPhotos') => {
    const { status: camStatus } = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(camStatus === 'granted');
    const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
    setHasMediaPermission(mediaStatus === 'granted');

    if (camStatus === 'granted') {
      setActiveSection(section);
      setCaptureCount(0);
      setCameraVisible(true);
    } else {
      Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
    }
  };

  // --- End Camera Helpers ---

  const addPhotoToSection = async (section: 'floorPlanPhotos' | 'posterPhotos') => {
    const append = (uri: string) => {
      const arr = (section === 'floorPlanPhotos' ? formData.floorPlanPhotos : formData.posterPhotos) || [];
      const next = [...arr, uri];
      setFormData(section === 'floorPlanPhotos' ? { ...formData, floorPlanPhotos: next } : { ...formData, posterPhotos: next });
      toast('사진이 추가되었습니다');
    };

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            append(result);
          };
          reader.readAsDataURL(target.files[0]);
        }
      };
      input.click();
      return;
    }

    Alert.alert('사진 추가', '방법을 선택하세요', [
      { 
        text: '촬영', 
        onPress: () => openCamera(section)
      },
      { text: '갤러리에서 선택', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsMultipleSelection: true });
        if (!result.canceled && result.assets) {
          for (const asset of result.assets) {
            // 갤러리 선택 시에도 내부 복사 권장 (원본 삭제 대비)
            const copied = await copyUriToAppFile(asset.uri);
            append(copied);
          }
        }
      }},
      { text: '취소', style: 'cancel' }
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      {!cameraVisible ? (
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
              <FontAwesome
                name="times"
                size={24}
                color={Colors[colorScheme ?? 'light'].text}
              />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>새 전시 추가</Text>
            
            <TouchableOpacity onPress={handleAdd} style={styles.headerButton}>
              <FontAwesome
                name="check"
                size={24}
                color={Colors[colorScheme ?? 'light'].tint}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.field}>
              <Text style={styles.label}>작가 *</Text>
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.artist}
                onChangeText={(text) => setFormData({ ...formData, artist: text })}
                placeholder="작가명을 입력하세요"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>전시명 *</Text>
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="전시명을 입력하세요"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>장소 *</Text>
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                placeholder="전시 장소를 입력하세요"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
              <TouchableOpacity
                style={styles.suggestToggle}
                onPress={() => setShowLocationSuggestions(v => !v)}
                activeOpacity={0.7}
              >
                <FontAwesome name={showLocationSuggestions ? 'chevron-down' : 'chevron-right'} size={12} color="#6f6f6f" />
                <Text style={styles.suggestToggleText}>추천 장소 보기</Text>
              </TouchableOpacity>
              {showLocationSuggestions && (
                <View style={styles.suggestWrap}>
                  {locationSuggestions.length === 0 ? (
                    <Text style={styles.suggestEmpty}>추천 장소가 없습니다.</Text>
                  ) : (
                    <View style={styles.chips}>
                      {locationSuggestions.map((loc) => (
                        <TouchableOpacity
                          key={loc}
                          onPress={() => setFormData({ ...formData, location: loc })}
                          style={[
                            styles.chip,
                            formData.location.trim() === loc ? styles.chipActive : undefined,
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, formData.location.trim() === loc ? styles.chipTextActive : undefined]}>
                            {loc}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* curator */}
            <View style={styles.field}>
              <Text style={styles.label}>curator</Text>
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.curator}
                onChangeText={(text) => setFormData({ ...formData, curator: text })}
                placeholder="전인자"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            </View>

            {/* notes (토글, 2줄 미리보기) */}
            <ToggleSection title="Notes" previewText={formData.notes || ''} previewLines={2}>
              <TextInput
                style={[styles.input, styles.reviewInput, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="메모를 입력하세요"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </ToggleSection>

            {/* 3. floor plan / leaflet */}
            <ToggleSection title="Floor plan / Leaflet">
              {formData.floorPlanPhotos && formData.floorPlanPhotos.length > 0 ? (
                <FlatList
                  data={formData.floorPlanPhotos}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={[styles.photoItem, { width: 120, height: 90 }]}>                  
                      <Image source={{ uri: item }} style={[styles.photoImage, { width: '100%', height: '100%' }]} />
                    </View>
                  )}
                  keyExtractor={(item, index) => `floor-${index}`}
                  contentContainerStyle={styles.photoList}
                />
              ) : (
                <Text style={styles.noPhotosText}>There are no photos to display.</Text>
              )}
              <TouchableOpacity style={styles.sectionAddButton} onPress={() => addPhotoToSection('floorPlanPhotos')}>
                <FontAwesome name="plus" size={14} color="#0c4b1f" />
                <Text style={styles.sectionAddText}>사진 추가</Text>
              </TouchableOpacity>
            </ToggleSection>

            {/* 4. poster */}
            <ToggleSection title="Poster">
              {formData.posterPhotos && formData.posterPhotos.length > 0 ? (
                <FlatList
                  data={formData.posterPhotos}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={[styles.photoItem, { width: 120, height: 90 }]}>                  
                      <Image source={{ uri: item }} style={[styles.photoImage, { width: '100%', height: '100%' }]} />
                    </View>
                  )}
                  keyExtractor={(item, index) => `poster-${index}`}
                  contentContainerStyle={styles.photoList}
                />
              ) : (
                <Text style={styles.noPhotosText}>There are no photos to display.</Text>
              )}
              <TouchableOpacity style={styles.sectionAddButton} onPress={() => addPhotoToSection('posterPhotos')}>
                <FontAwesome name="plus" size={14} color="#0c4b1f" />
                <Text style={styles.sectionAddText}>사진 추가</Text>
              </TouchableOpacity>
            </ToggleSection>

            {/* with */}
            <View style={styles.field}>
              <Text style={styles.label}>with</Text>
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.with}
                onChangeText={(text) => setFormData({ ...formData, with: text })}
                placeholder="함께 간 사람"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            </View>

            {/* link */}
            <View style={styles.field}>
              <Text style={styles.label}>link</Text>
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.link}
                onChangeText={(text) => setFormData({ ...formData, link: text })}
                placeholder="링크"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* contact */}
            <View style={styles.field}>
              <Text style={styles.label}>contact</Text>
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.contact}
                onChangeText={(text) => setFormData({ ...formData, contact: text })}
                placeholder="연락처"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.note}>* 필수 입력 항목</Text>
          </ScrollView>
        </View>
      ) : (
        /* --- Embedded Camera View --- */
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {hasCameraPermission ? (
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="back"
              flash={flash}
              ratio={Platform.OS === 'android' ? '16:9' : undefined}
            >
              <RNView style={styles.camTopBar}>
                <TouchableOpacity
                  onPress={() => setCameraVisible(false)}
                  style={styles.camBtn}
                >
                  <FontAwesome name="times" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  {activeSection === 'floorPlanPhotos' ? '도면/리플렛' : '포스터'} ({captureCount})
                </Text>
                <TouchableOpacity
                  onPress={() => setFlash(f => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'))}
                  style={styles.camBtn}
                >
                  <FontAwesome 
                    name={flash === 'on' ? 'flash' : flash === 'auto' ? 'bolt' : 'flash'} 
                    size={20} 
                    color={flash === 'off' ? '#ccc' : '#fff'} 
                  />
                </TouchableOpacity>
              </RNView>
              <RNView style={styles.camBottomBar}>
                <TouchableOpacity onPress={takePicture} style={styles.captureOuter}>
                  <RNView style={styles.captureInner} />
                </TouchableOpacity>
              </RNView>
            </CameraView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff' }}>카메라 권한이 필요합니다.</Text>
              <TouchableOpacity onPress={() => setCameraVisible(false)} style={{ marginTop: 20, padding: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>닫기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: 'transparent',
  },
  reviewInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  note: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 40,
  },
  suggestToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  suggestToggleText: {
    color: '#6f6f6f',
    fontSize: 13,
  },
  suggestWrap: {
    marginTop: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 8,
    padding: 10,
  },
  suggestEmpty: {
    color: '#9a9a9a',
    fontSize: 13,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#f2f7f3',
    borderWidth: 1,
    borderColor: '#d4ead7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chipActive: {
    backgroundColor: '#e6f5e9',
    borderColor: '#2e7d32',
  },
  chipText: {
    fontSize: 12,
    color: '#2e7d32',
  },
  chipTextActive: {
    fontWeight: '700',
  },
  photoList: {
    paddingVertical: 8,
  },
  photoItem: {
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  noPhotosText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 8,
  },
  sectionAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f5e9',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cfead7',
  },
  sectionAddText: {
    marginLeft: 6,
    color: '#2e7d32',
    fontWeight: '600',
  },
  // Camera styles
  camTopBar: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  camBtn: {
    padding: 10,
  },
  camBottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff2d55',
  },
});
