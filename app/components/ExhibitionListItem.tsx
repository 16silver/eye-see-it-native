import React from 'react';
import { StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Text, View } from './Themed';
import { Exhibition } from '../../types/Exhibition';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '../../constants/Colors';
import { useColorScheme } from './useColorScheme';

interface ExhibitionListItemProps {
  exhibition: Exhibition;
  onPress: () => void;
  onToggleFavorite: (exhibitionId: string) => void;
  onDatePress?: (visitDate: string) => void;
  showDate?: boolean;
  showMonth?: boolean;
  milestoneBadge?: number; // 5개 단위 누적 개수 표시
}

export default function ExhibitionListItem({ exhibition, onPress, onToggleFavorite, onDatePress, showDate = true, showMonth = true, milestoneBadge }: ExhibitionListItemProps) {
  const colorScheme = useColorScheme();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: Colors[colorScheme ?? 'light'].surface,
          opacity: pressed ? 0.8 : 1,
        }
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.content,
          {
            backgroundColor: Colors[colorScheme ?? 'light'].card,
          },
        ]}
      >
        {/* 5개 단위 배지 - 상단 좌측 (구분선 가장 왼쪽) */}
        {!!milestoneBadge && (
          <View style={styles.milestoneBadge}>
            <Text style={styles.milestoneText}>{milestoneBadge}</Text>
          </View>
        )}
        <TouchableOpacity 
          style={styles.dateContainer}
          onPress={() => onDatePress?.(exhibition.visitDate)}
          activeOpacity={0.7}
        >
          {showDate && (
            <>
              {/* 좌상단에 작은 월, 중앙에 큰 일 (월:일 = 4:9) */}
              {showMonth && (
                <Text style={[styles.dateMonthSmall, { color: '#c4c4c4' }]} allowFontScaling={false}>
                  {new Date(exhibition.visitDate).getMonth() + 1}
                </Text>
              )}
              <Text style={[styles.dateDayBig, { color: '#c4c4c4' }]} allowFontScaling={false}>
                {new Date(exhibition.visitDate).getDate()}
              </Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={styles.textContainer}>
          <View
            style={[
              styles.highlightWrap,
            ]}
          >
            <Text
              style={[styles.title, { color: '#191c19' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {exhibition.isFavorite ? (
                <Text style={{ backgroundColor: Colors[colorScheme ?? 'light'].highlightBg }}>
                  {exhibition.artist}
                </Text>
              ) : (
                exhibition.artist
              )}
            </Text>
          </View>
          <View style={{ height: 6 }} />
          <View style={styles.titleRow}>
            <View style={styles.titleTextHolder}>
              <View
                style={[
                  styles.highlightWrap,
                ]}
              >
                <Text
                  style={[styles.artist, { color: '#191c19' }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {exhibition.isFavorite ? (
                    <Text style={{ backgroundColor: Colors[colorScheme ?? 'light'].highlightBg }}>
                      {exhibition.name}
                    </Text>
                  ) : (
                    exhibition.name
                  )}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.highlightWrap}>
            <Text style={[styles.location, { color: '#838383' }]} numberOfLines={1} ellipsizeMode="tail">
              {exhibition.location}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.favoriteContainer}
          onPress={() => onToggleFavorite(exhibition.id)}
          activeOpacity={0.7}
        >
          {exhibition.isFavorite ? (
            <View style={{ width: 30, height: 30, position: 'relative' }}>
              <FontAwesome name="heart" size={30} color="#21df5a" style={{ position: 'absolute', left: 0, top: 0 }} />
              <FontAwesome name="heart-o" size={30} color="#00be39" style={{ position: 'absolute', left: 0, top: 0 }} />
            </View>
          ) : (
            <FontAwesome name="heart-o" size={30} color={'#00be39'} />
          )}
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: '#d9d9d9',
    marginHorizontal: 0,
    marginVertical: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  dateContainer: {
    width: 56,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    position: 'relative',
  },
  dateMonthSmall: {
    position: 'absolute',
    left: -2,
    top: -6,
    zIndex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#c4c4c4',
    textAlign: 'left',
    fontFamily: 'ABeeZee_400Regular',
    includeFontPadding: false,
  },
  dateDayBig: {
    fontSize: 36,
    fontWeight: '400',
    color: '#c4c4c4',
    textAlign: 'center',
    lineHeight: 36,
    fontFamily: 'ABeeZee_400Regular',
    includeFontPadding: false,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleTextHolder: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
  },
  highlightWrap: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    alignSelf: 'stretch',
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  artist: {
    fontSize: 13,
    color: '#6f6f6f',
    fontStyle: 'italic',
    marginBottom: 2,
    paddingRight: 2, // 기울임 마지막 글자 잘림 방지
    flexShrink: 1,
    minWidth: 0,
  },
  location: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  favoriteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  milestoneBadge: {
    position: 'absolute',
    left: 8,
    top: -10, // 상단 구분선 쪽으로 살짝 올림
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff007b',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  milestoneText: {
    fontSize: 11,
    color: '#e9ffa8',
    fontWeight: '700',
    lineHeight: 12,
  },
});