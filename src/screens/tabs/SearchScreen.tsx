import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from '../../components/Themed';
import { Exhibition } from '../../types/Exhibition';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import Colors from '../../constants/Colors';
import { useColorScheme } from '../../components/useColorScheme';

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<{ artist: string; name: string; location: string }>({ artist: '', name: '', location: '' });
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('@exhibitions');
      if (!raw) return;
      const parsed: Exhibition[] = JSON.parse(raw);
      setExhibitions(parsed);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fArtist = filters.artist.trim().toLowerCase();
    const fName = filters.name.trim().toLowerCase();
    const fLocation = filters.location.trim().toLowerCase();
    return exhibitions.filter((e) => {
      const hayArtist = (e.artist || '').toLowerCase();
      const hayName = (e.name || '').toLowerCase();
      const hayLocation = (e.location || '').toLowerCase();
      const matchQ = !q || hayArtist.includes(q) || hayName.includes(q) || hayLocation.includes(q);
      const matchArtist = !fArtist || hayArtist.includes(fArtist);
      const matchName = !fName || hayName.includes(fName);
      const matchLocation = !fLocation || hayLocation.includes(fLocation);
      return matchQ && matchArtist && matchName && matchLocation;
    }).sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  }, [query, filters, exhibitions]);

  const renderItem = ({ item }: { item: Exhibition }) => (
    <View style={styles.item}>
      <View style={styles.itemMain}>
        <Text style={styles.itemTitle} numberOfLines={1} ellipsizeMode="tail">{item.artist}</Text>
        <Text style={styles.itemSubtitle} numberOfLines={1} ellipsizeMode="tail">{item.name} · {item.location}</Text>
      </View>
      {!!(item.photos && item.photos[0]) && (
        <View style={styles.thumb}>
          {/* 썸네일은 RN Image로도 가능하지만, 단순 색 박스로 대체 */}
          <FontAwesomeIcon name="image" size={18} color={Colors[colorScheme ?? 'light'].tint} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <FontAwesomeIcon name="search" size={18} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="전체 검색 (작가/전시명/장소)"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.filters}>
        <TextInput
          style={styles.filterInput}
          placeholder="작가"
          value={filters.artist}
          onChangeText={(t) => setFilters({ ...filters, artist: t })}
        />
        <TextInput
          style={styles.filterInput}
          placeholder="전시명"
          value={filters.name}
          onChangeText={(t) => setFilters({ ...filters, name: t })}
        />
        <TextInput
          style={styles.filterInput}
          placeholder="장소"
          value={filters.location}
          onChangeText={(t) => setFilters({ ...filters, location: t })}
        />
        <TouchableOpacity style={styles.clearButton} onPress={() => { setQuery(''); setFilters({ artist: '', name: '', location: '' }); }}>
          <Text style={styles.clearText}>초기화</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={filtered.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={<Text style={styles.empty}>검색 결과가 없습니다</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e6e6e6' },
  title: { fontSize: 20, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchInput: { flex: 1, paddingVertical: 6 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  clearButton: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  clearText: { color: '#007AFF', fontWeight: '600' },
  list: { padding: 12 },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#888' },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  itemMain: { flex: 1, marginRight: 10 },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemSubtitle: { fontSize: 12, color: '#666' },
  thumb: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});



