import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { Text, View } from './Themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { Exhibition } from '../types/Exhibition';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import IoniconsIcon from 'react-native-vector-icons/Ionicons';
import Colors from '../constants/Colors';
import { useColorScheme } from './useColorScheme';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 40) / 4; // 4열 그리드

interface ExhibitionGalleryModalProps {
  visible: boolean;
  exhibition: Exhibition | null;
  onClose: () => void;
  onUpdatePhotos: (exhibitionId: string, photos: string[]) => void;
}

export default function ExhibitionGalleryModal({
  visible,
  exhibition,
  onClose,
  onUpdatePhotos,
}: ExhibitionGalleryModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const pickImageFromGallery = () => {
    if (!exhibition) return;

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true; // 여러 파일 선택 가능
      input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          let processedCount = 0;
          const totalFiles = target.files.length;
          const collected: string[] = [];
          Array.from(target.files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              collected.push(result);
              processedCount++;
              if (processedCount === totalFiles) {
                const newPhotos = [...(exhibition.photos || []), ...collected];
                onUpdatePhotos(exhibition.id, newPhotos);
                Alert.alert('성공', `${totalFiles}장의 사진이 추가되었습니다.`);
              }
            };
            reader.readAsDataURL(file);
          });
        }
      };
      input.click();
    } else {
      // iOS: ImagePicker 다중 선택
      (async () => {
        const result = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.85,
          selectionLimit: 0,
        });
        if (result.didCancel) return;
        const uris = (result.assets || []).map(a => a.uri).filter(Boolean) as string[];
        if (uris.length === 0) return;
        const newPhotos = [...(exhibition.photos || []), ...uris];
        onUpdatePhotos(exhibition.id, newPhotos);
        Alert.alert('성공', `${uris.length}장의 사진이 추가되었습니다.`);
      })();
    }
  };

  const deletePhoto = (photoIndex: number) => {
    if (!exhibition){
        console.log('exhibition is null');
        return;
    }

    Alert.alert(
      '사진 삭제',
      '이 사진을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            const newPhotos = exhibition.photos.filter((_, index) => index !== photoIndex);
            onUpdatePhotos(exhibition.id, newPhotos);
            Alert.alert('성공', '사진이 삭제되었습니다.');
          },
        },
      ]
    );
  };

  const renderPhotoItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.photoItem}>
      <TouchableOpacity
        style={styles.photoContainer}
        onPress={() => setSelectedPhoto(item)}
        onLongPress={() => deletePhoto(index)}
      >
        <Image source={{ uri: item }} style={styles.photoImage} />
      </TouchableOpacity>
    </View>
  );

  const renderAddButton = () => (
    <TouchableOpacity style={styles.addButton} onPress={pickImageFromGallery}>
      <FontAwesomeIcon
        name="plus"
        size={24}
        color={Colors[colorScheme ?? 'light'].tint}
      />
      <Text style={styles.addButtonText}>사진 추가</Text>
    </TouchableOpacity>
  );

  if (!exhibition) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <FontAwesomeIcon
              name="times"
              size={24}
              color={Colors[colorScheme ?? 'light'].text}
            />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>
            {exhibition.name} 사진들 ({exhibition.photos?.length || 0}장)
          </Text>
          
          <View style={styles.headerButton} />
        </View>

        <FlatList
          data={exhibition.photos || []}
          renderItem={renderPhotoItem}
          keyExtractor={(item, index) => index.toString()}
          numColumns={4}
          style={styles.photoGrid}
          contentContainerStyle={styles.photoGridContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesomeIcon
                name="image"
                size={64}
                color={Colors[colorScheme ?? 'light'].tabIconDefault}
              />
              <Text style={styles.emptyTitle}>사진이 없습니다</Text>
              <Text style={styles.emptySubtitle}>첫 번째 사진을 추가해보세요</Text>
              {renderAddButton()}
            </View>
          }
        />

        {/* 고정된 사진 추가 버튼 */}
        <TouchableOpacity style={styles.fixedAddButton} onPress={pickImageFromGallery}>
          <FontAwesomeIcon
            name="plus"
            size={24}
            color="white"
          />
        </TouchableOpacity>

        {/* 사진 상세보기 모달 */}
        <Modal visible={!!selectedPhoto} animationType="fade">
          <View style={styles.photoModalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedPhoto(null)}
            >
              <IoniconsIcon name="close" size={30} color="white" />
            </TouchableOpacity>
            {selectedPhoto && (
              <Image source={{ uri: selectedPhoto }} style={styles.fullScreenImage} />
            )}
          </View>
        </Modal>
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
    flex: 1,
    textAlign: 'center',
  },
  photoGrid: {
    flex: 1,
  },
  photoGridContent: {
    padding: 8,
  },
  photoItem: {
    width: (width - 40) / 4,
    height: (width - 40) / 4,
    margin: 3,
  },
  photoContainer: {
    flex: 1,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    resizeMode: 'cover',
  },
  addButton: {
    width: (width - 40) / 4,
    height: (width - 40) / 4,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 3,
  },
  addButtonText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
    marginBottom: 24,
  },
  photoModalContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: width,
    resizeMode: 'contain',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  fixedAddButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
  },
}); 