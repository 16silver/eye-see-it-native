import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  Pressable,
  Image,
  FlatList,
  Platform as RNPlatform,
} from 'react-native';
import { Text, View } from './Themed';
import { Exhibition, ExhibitionFormData } from '../types/Exhibition';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import Colors from '../constants/Colors';
import { useColorScheme } from './useColorScheme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toast } from '../utils/toast';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';

// 단순 토글 섹션 컴포넌트 (기본 접힘)
function ToggleSection({ title, children, previewText, previewLines = 0 }: { title: string; children: React.ReactNode; previewText?: string; previewLines?: number }) {
  const [open, setOpen] = React.useState(false);
  const handleToggle = () => {
    setOpen(v => !v);
  };
  return (
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity onPress={handleToggle} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>{title}</Text>
        <FontAwesomeIcon name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#aaa" />
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

interface ExhibitionDetailModalProps {
  visible: boolean;
  exhibition: Exhibition | null;
  onClose: () => void;
  onSave: (id: string, data: ExhibitionFormData) => void;
  onDelete: (id: string) => void;
  onOpenGallery?: () => void;
  onAddPhoto?: () => void;
  onToggleFavorite?: (exhibitionId: string) => void;
  onUpdatePhotos?: (exhibitionId: string, photos: string[]) => void;
}

export default function ExhibitionDetailModal({
  visible,
  exhibition,
  onClose,
  onSave,
  onDelete,
  onOpenGallery,
  onAddPhoto,
  onToggleFavorite,
  onUpdatePhotos,
}: ExhibitionDetailModalProps) {
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
    visitDate: undefined,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  const confirmAndDeleteMainPhoto = (photoIndex: number) => {
    if (!exhibition) return;
    const doDelete = () => {
      const newPhotos = (exhibition.photos || []).filter((_, idx) => idx !== photoIndex);
      onUpdatePhotos && onUpdatePhotos(exhibition.id, newPhotos);
      toast('사진이 삭제되었습니다');
    };
    if (RNPlatform.OS === 'web') {
      const confirmed = (globalThis as any).confirm ? (globalThis as any).confirm('이 사진을 삭제하시겠습니까?') : true;
      if (confirmed) doDelete();
      return;
    }
    Alert.alert('사진 삭제', '이 사진을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: doDelete },
    ]);
  };

  const confirmAndDeleteSectionPhoto = (section: 'floorPlanPhotos' | 'posterPhotos', photoIndex: number) => {
    if (!exhibition) return;
    const currentArr = section === 'floorPlanPhotos' ? (exhibition.floorPlanPhotos || []) : (exhibition.posterPhotos || []);
    const doDelete = () => {
      const updatedArr = currentArr.filter((_, idx) => idx !== photoIndex);
      const payload = section === 'floorPlanPhotos'
        ? { ...formData, floorPlanPhotos: updatedArr }
        : { ...formData, posterPhotos: updatedArr };
      setFormData(payload);
      onSave(exhibition.id, payload);
      toast('사진이 삭제되었습니다');
    };
    if (RNPlatform.OS === 'web') {
      const confirmed = (globalThis as any).confirm ? (globalThis as any).confirm('이 사진을 삭제하시겠습니까?') : true;
      if (confirmed) doDelete();
      return;
    }
    Alert.alert('사진 삭제', '이 사진을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: doDelete },
    ]);
  };

  React.useEffect(() => {
    if (exhibition) {
      setFormData({
        name: exhibition.name,
        artist: exhibition.artist,
        location: exhibition.location,
        review: exhibition.review,
        curator: exhibition.curator ?? '',
        notes: exhibition.notes ?? '',
        floorPlanPhotos: exhibition.floorPlanPhotos ?? [],
        posterPhotos: exhibition.posterPhotos ?? [],
        with: exhibition.with ?? '',
        link: exhibition.link ?? '',
        contact: exhibition.contact ?? '',
        visitDate: exhibition.visitDate,
      });
    }
    setIsEditing(false);
  }, [exhibition]);

  const handleSave = () => {
    if (!exhibition) return;
    
    if (!formData.name.trim() || !formData.artist.trim() || !formData.location.trim()) {
      Alert.alert('오류', '전시명, 작가, 장소는 필수 입력 항목입니다.');
      return;
    }

    onSave(exhibition.id, formData);
    toast('저장되었습니다');
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!exhibition) return;
    
    // 웹에서는 RN Alert 버튼형 UI가 제한적일 수 있어 confirm으로 처리
    if (RNPlatform.OS === 'web') {
      const confirmed = (globalThis as any).confirm ? (globalThis as any).confirm('이 전시를 삭제하시겠습니까?') : true;
      if (!confirmed) return;
      onDelete(exhibition.id);
      toast('삭제되었습니다');
      onClose();
      return;
    }

    Alert.alert(
      '전시 삭제',
      '이 전시를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            onDelete(exhibition.id);
            toast('삭제되었습니다');
            onClose();
          },
        },
      ]
    );
  };

  // 메인 전시 사진 추가 (다중 선택)
  const addMainPhotos = async () => {
    if (!exhibition) return;

    const appendMany = (uris: string[]) => {
      if (!uris.length) return;
      const updated = [...(exhibition.photos || []), ...uris];
      onUpdatePhotos && onUpdatePhotos(exhibition.id, updated);
      toast(`${uris.length}장의 사진이 추가되었습니다`);
    };

    // Web
    if (RNPlatform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const files = Array.from(target.files);
          const uris: string[] = [];
          let processed = 0;
          files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              uris.push(result);
              processed++;
              if (processed === files.length) appendMany(uris);
            };
            reader.readAsDataURL(file);
          });
        }
      };
      input.click();
      return;
    }

    // Native
    Alert.alert('사진 추가', '방법을 선택하세요', [
      {
        text: '촬영',
        onPress: () => navigation.navigate('Camera' as never, { targetId: exhibition.id, section: 'photos' } as never),
      },
      {
        text: '갤러리에서 선택',
        onPress: async () => {
          try {
            const result = await launchImageLibrary({
              mediaType: 'photo',
              quality: 0.85,
              selectionLimit: 0,
            });
            if (!result.didCancel && result.assets?.length) {
              const uris = result.assets.map(a => a.uri).filter(Boolean) as string[];
              appendMany(uris);
            }
          } catch (e: any) {
            console.error(e);
            Alert.alert('오류', '사진을 불러오지 못했습니다.');
          }
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  };

  // 개별 섹션(3,4) 사진 추가 - 다중 선택 지원
  const addPhotoToSection = async (section: 'floorPlanPhotos' | 'posterPhotos') => {
    const appendManyAndSave = (uris: string[]) => {
      if (!exhibition || uris.length === 0) return;
      const current = (section === 'floorPlanPhotos' ? formData.floorPlanPhotos : formData.posterPhotos) || [];
      const updatedArr = [...current, ...uris];
      const payload = section === 'floorPlanPhotos'
        ? { ...formData, floorPlanPhotos: updatedArr }
        : { ...formData, posterPhotos: updatedArr };
      setFormData(payload);
      onSave(exhibition.id, payload);
      toast(`${uris.length}장의 사진이 추가되었습니다`);
    };

    if (RNPlatform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const files = Array.from(target.files);
          const uris: string[] = [];
          let processed = 0;
          files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              uris.push(result);
              processed++;
              if (processed === files.length) {
                appendManyAndSave(uris);
              }
            };
            reader.readAsDataURL(file);
          });
        }
      };
      input.click();
      return;
    }

    // Native: 갤러리/카메라 선택 (iOS 다중, Android 다중)
    Alert.alert('사진 추가', '방법을 선택하세요', [
      {
        text: '촬영',
        onPress: () => {
          if (!exhibition) return;
          const sec = section === 'floorPlanPhotos' ? 'floor' : 'poster';
          navigation.navigate('Camera' as never, { targetId: exhibition.id, section: sec } as never);
        }
      },
      {
        text: '갤러리에서 선택',
        onPress: async () => {
          try {
            const result = await launchImageLibrary({
              mediaType: 'photo',
            quality: 0.85,
              selectionLimit: 0,
          });
            if (!result.didCancel && result.assets?.length) {
            const uris = result.assets.map(a => a.uri).filter(Boolean) as string[];
            appendManyAndSave(uris);
            }
          } catch (e: any) {
            Alert.alert('권한 필요', '갤러리 권한이 필요합니다.');
          }
        }
      },
      { text: '취소', style: 'cancel' }
    ]);
  };

  if (!exhibition) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <FontAwesomeIcon
              name="times"
              size={24}
              color={Colors[colorScheme ?? 'light'].text}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={isEditing ? handleSave : () => setIsEditing(true)}
            style={styles.headerButton}
          >
            <FontAwesomeIcon
              name={isEditing ? "check" : "edit"}
              size={24}
              color={Colors[colorScheme ?? 'light'].tint}
            />
          </TouchableOpacity>
        </View>

        {/* 전시 목록 아이템과 동일한 형태의 헤더 (메인 페이지 스타일 적용) */}
        <View style={styles.exhibitionHeader}>
          <View style={styles.dateBox}>
            <Text style={styles.dateMonthSmallAligned} allowFontScaling={false}>{new Date(exhibition.visitDate).getMonth() + 1}</Text>
            <Text style={styles.dateDayBigAligned} allowFontScaling={false}>{new Date(exhibition.visitDate).getDate()}</Text>
          </View>
          
          <View style={styles.textContainer}>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.artist}
                onChangeText={(text) => setFormData({ ...formData, artist: text })}
                placeholder="작가"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            ) : (
              <Text style={styles.titleDetail} numberOfLines={1} ellipsizeMode="tail">
                {exhibition.artist}
              </Text>
            )}
            <View style={styles.titleRow}>
              {isEditing ? (
                <TextInput
                  style={[styles.input, { color: Colors[colorScheme ?? 'light'].text, fontStyle: 'italic' }]}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="전시명"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                />
              ) : (
                <View style={styles.highlightWrapDetail}>
                  <Text style={styles.artistPill} numberOfLines={1} ellipsizeMode="tail">
                    {exhibition.name}
                  </Text>
                </View>
              )}
            </View>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                placeholder="장소"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            ) : (
              <Text style={styles.locationDetail} numberOfLines={1} ellipsizeMode="tail">
                {exhibition.location}
              </Text>
            )}
          </View>
          
          {onToggleFavorite && (
            <TouchableOpacity 
              style={styles.favoriteContainer}
              onPress={() => onToggleFavorite(exhibition.id)}
              activeOpacity={0.7}
            >
              {exhibition.isFavorite ? (
                <View style={{ width: 30, height: 30, position: 'relative' }}>
                  <FontAwesomeIcon name="heart" size={30} color="#21df5a" style={{ position: 'absolute', left: 0, top: 0 }} />
                  <FontAwesomeIcon name="heart-o" size={30} color="#00be39" style={{ position: 'absolute', left: 0, top: 0 }} />
                </View>
              ) : (
                <FontAwesomeIcon name="heart-o" size={30} color={'#00be39'} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          

          {/* 1. curator (텍스트, 즉시 표시) */}
          <View style={styles.field}>
            <Text style={styles.label}>Curator</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.curator}
                onChangeText={(text) => setFormData({ ...formData, curator: text })}
                placeholder="큐레이터"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            ) : (
              <Text style={styles.value}>{exhibition.curator || '-'}</Text>
            )}
          </View>

          {/* 2. notes (텍스트, 토글 접힘/펼침, 2줄 미리보기) */}
          <ToggleSection title="Notes" previewText={exhibition.notes || ''} previewLines={2}>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.reviewInput, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="메모"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.value}>{exhibition.notes || '-'}</Text>
            )}
          </ToggleSection>

          {/* 3. floor plan / leaflet (사진, 토글) */}
          <ToggleSection title="Floor plan / Leaflet">
            {formData.floorPlanPhotos && formData.floorPlanPhotos.length > 0 ? (
              <FlatList
                data={formData.floorPlanPhotos}
                horizontal
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[styles.photoItem, { width: 120, height: 90 }]}
                    activeOpacity={0.8}
                    onLongPress={() => confirmAndDeleteSectionPhoto('floorPlanPhotos', index)}
                  >
                    <Image source={{ uri: item }} style={[styles.photoImage, { width: '100%', height: '100%' }]} />
                    <TouchableOpacity
                      style={styles.photoDeleteBadge}
                      onPress={() => confirmAndDeleteSectionPhoto('floorPlanPhotos', index)}
                    >
                      <FontAwesomeIcon name="times" size={12} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                keyExtractor={(item, index) => `floor-${index}`}
                contentContainerStyle={styles.photoList}
              />
            ) : (
              <Text style={styles.noPhotosText}>사진이 없습니다.</Text>
            )}
            <TouchableOpacity style={styles.sectionAddButton} onPress={() => addPhotoToSection('floorPlanPhotos')}>
              <FontAwesomeIcon name="plus" size={14} color="#0c4b1f" />
              <Text style={styles.sectionAddText}>사진 추가</Text>
            </TouchableOpacity>
          </ToggleSection>

          {/* 4. poster (사진, 토글) */}
          <ToggleSection title="Poster">
            {formData.posterPhotos && formData.posterPhotos.length > 0 ? (
              <FlatList
                data={formData.posterPhotos}
                horizontal
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[styles.photoItem, { width: 120, height: 90 }]}
                    activeOpacity={0.8}
                    onLongPress={() => confirmAndDeleteSectionPhoto('posterPhotos', index)}
                  >
                    <Image source={{ uri: item }} style={[styles.photoImage, { width: '100%', height: '100%' }]} />
                    <TouchableOpacity
                      style={styles.photoDeleteBadge}
                      onPress={() => confirmAndDeleteSectionPhoto('posterPhotos', index)}
                    >
                      <FontAwesomeIcon name="times" size={12} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                keyExtractor={(item, index) => `poster-${index}`}
                contentContainerStyle={styles.photoList}
              />
            ) : (
              <Text style={styles.noPhotosText}>사진이 없습니다.</Text>
            )}
            <TouchableOpacity style={styles.sectionAddButton} onPress={() => addPhotoToSection('posterPhotos')}>
              <FontAwesomeIcon name="plus" size={14} color="#0c4b1f" />
              <Text style={styles.sectionAddText}>사진 추가</Text>
            </TouchableOpacity>
          </ToggleSection>

          {/* 5. with (텍스트, 즉시 표시) */}
          <View style={styles.field}>
            <Text style={styles.label}>With</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.with}
                onChangeText={(text) => setFormData({ ...formData, with: text })}
                placeholder="함께 간 사람"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            ) : (
              <Text style={styles.value}>{exhibition.with || '-'}</Text>
            )}
          </View>

          {/* 6. link (텍스트, 즉시 표시) */}
          <View style={styles.field}>
            <Text style={styles.label}>Link</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.link}
                onChangeText={(text) => setFormData({ ...formData, link: text })}
                placeholder="관련 링크(예: 웹사이트)"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            ) : (
              <Text style={styles.value}>{exhibition.link || '-'}</Text>
            )}
          </View>

          {/* 7. contact (텍스트, 즉시 표시) */}
          <View style={styles.field}>
            <Text style={styles.label}>Contact</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
                value={formData.contact}
                onChangeText={(text) => setFormData({ ...formData, contact: text })}
                placeholder="연락처"
                placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
            ) : (
              <Text style={styles.value}>{exhibition.contact || '-'}</Text>
            )}
          </View>

          

          <View style={styles.field}>
            <Text style={styles.label}>Visit date</Text>
            {isEditing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {RNPlatform.OS === 'web' ? (
                  <input
                    type="date"
                    style={{ padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fff' }}
                    value={(formData.visitDate || exhibition.visitDate).slice(0, 10)}
                    min={'1970-01-01'}
                    max={new Date().toISOString().slice(0,10)}
                    onChange={(e: any) => setFormData({ ...formData, visitDate: String(e.target.value) })}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(v => !v)}
                      style={[styles.sectionAddButton, { paddingVertical: 10 }]}
                      activeOpacity={0.7}
                    >
                      <FontAwesomeIcon name="calendar" size={14} color="#0c4b1f" />
                      <Text style={[styles.sectionAddText, { marginLeft: 8 }]}>{(formData.visitDate || exhibition.visitDate).slice(0, 10)}</Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={(function(){
                          const iso = (formData.visitDate || exhibition.visitDate).slice(0,10);
                          const parts = iso.split('-').map(Number);
                          return new Date(parts[0], (parts[1]||1)-1, parts[2]||1);
                        })()}
                        mode="date"
                        display={RNPlatform.OS === 'android' ? 'calendar' : 'inline'}
                        minimumDate={new Date(1970,0,1)}
                        maximumDate={new Date()}
                        onChange={(event: any, selectedDate?: Date) => {
                          if (RNPlatform.OS === 'android') setShowDatePicker(false);
                          if (selectedDate) {
                            const y = selectedDate.getFullYear();
                            const m = String(selectedDate.getMonth() + 1).padStart(2,'0');
                            const d = String(selectedDate.getDate()).padStart(2,'0');
                            setFormData({ ...formData, visitDate: `${y}-${m}-${d}` });
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </View>
            ) : (
              <Text style={styles.value}>{exhibition.visitDate}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              📸 전시 사진 ({exhibition.photos?.length || 0}장)
            </Text>
            {exhibition.photos && exhibition.photos.length > 0 ? (
              <FlatList
                data={exhibition.photos}
                horizontal
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={styles.photoItem}
                    activeOpacity={0.8}
                    onLongPress={() => confirmAndDeleteMainPhoto(index)}
                  >
                    <Image source={{ uri: item }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.photoDeleteBadge}
                      onPress={() => confirmAndDeleteMainPhoto(index)}
                    >
                      <FontAwesomeIcon name="times" size={12} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.photoList}
              />
            ) : (
              <Text style={styles.noPhotosText}>사진이 없습니다.</Text>
            )}
            <TouchableOpacity style={styles.sectionAddButton} onPress={addMainPhotos}>
              <FontAwesomeIcon name="plus" size={14} color="#0c4b1f" />
              <Text style={styles.sectionAddText}>사진 추가</Text>
            </TouchableOpacity>
          </View>

        {isEditing && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>
      {/* 하단 고정 삭제 버튼 (좌측 하단, 아이콘만) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={handleDelete} style={styles.bottomDeleteIconButton} activeOpacity={0.8}>
          <FontAwesomeIcon name="trash" size={20} color="#ff4444" />
        </TouchableOpacity>
      </View>
      </View>
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
  value: {
    fontSize: 15,
    lineHeight: 22,
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ff4444',
    padding: 16,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
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
  photoDeleteBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotosText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 8,
  },
  photoActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addPhotoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 6,
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
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bottomDeleteIconButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exhibitionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e6f5e9',
  },
  dateBox: {
    width: 56,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    position: 'relative',
  },
  dateMonthSmallAligned: {
    position: 'absolute',
    left: -2,
    top: -2,
    zIndex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#838383',
    textAlign: 'left',
    fontFamily: 'ABeeZee_400Regular',
    includeFontPadding: false,
  },
  dateDayBigAligned: {
    fontSize: 36,
    fontWeight: '400',
    color: '#838383',
    textAlign: 'center',
    lineHeight: 36,
    fontFamily: 'ABeeZee_400Regular',
    includeFontPadding: false,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleDetail: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  highlightWrapDetail: {
    paddingHorizontal: 0,
    paddingVertical: 2,
    borderRadius: 0,
    alignSelf: 'flex-start',
  },
  artistPill: {
    fontSize: 13,
    color: '#6f6f6f',
    fontStyle: 'italic',
    marginBottom: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  locationDetail: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  favoriteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
});