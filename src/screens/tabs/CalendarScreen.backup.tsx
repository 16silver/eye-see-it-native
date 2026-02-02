import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from '../../components/Themed';
import { Exhibition } from '../../types/Exhibition';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type DayCell = {
  dateKey: string;
  date: Date;
  inMonth: boolean;
  photoUri: string | null;
  exhibitionsCount: number;
};

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function seededIndexForDate(dateKey: string, total: number): number {
  if (total <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) | 0;
  }
  if (hash < 0) hash = -hash;
  return hash % total;
}

export default function CalendarScreen() {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const insets = useSafeAreaInsets();
  const [contentH, setContentH] = useState(0);
  const [barsH, setBarsH] = useState({ month: 0, week: 0 });

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('@exhibitions');
      if (!raw) return;
      const parsed: Exhibition[] = JSON.parse(raw);
      setExhibitions(parsed);
    })();
  }, []);

  const { photosByDate, countsByDate } = useMemo(() => {
    const photos: Record<string, string[]> = {};
    const counts: Record<string, number> = {};
    exhibitions.forEach((ex) => {
      const key = ex.visitDate;
      counts[key] = (counts[key] || 0) + 1;
      if (ex.photos && ex.photos.length > 0) {
        if (!photos[key]) photos[key] = [];
        photos[key].push(...ex.photos);
      }
    });
    return { photosByDate: photos, countsByDate: counts };
  }, [exhibitions]);

  const monthDays: DayCell[] = useMemo(() => {
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const start = new Date(first);
    const firstDOW = first.getDay(); // 0(日) ~ 6(土)
    start.setDate(first.getDate() - firstDOW);

    const totalCells = 42; // 6주 x 7일
    const days: DayCell[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = formatDateKey(d);
      const inMonth = d.getMonth() === viewDate.getMonth();
      const dayPhotos = photosByDate[key] || [];
      const photoUri = dayPhotos.length > 0 ? dayPhotos[seededIndexForDate(key, dayPhotos.length)] : null;
      const exhibitionsCount = countsByDate[key] || 0;
      days.push({ dateKey: key, date: d, inMonth, photoUri, exhibitionsCount });
    }
    return days;
  }, [viewDate, photosByDate, countsByDate]);

  const monthLabel = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth() + 1;
    return `${y}년 ${m}월`;
  }, [viewDate]);

  const goPrevMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const goToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const rowGap = 8;
  const cellHeight = useMemo(() => {
    if (!contentH) return 92;
    const available = contentH - barsH.month - barsH.week - 8; // grid 상단 여유
    const h = Math.floor(available / 6) - Math.floor(rowGap / 2);
    return Math.max(h, 72);
  }, [contentH, barsH]);

  const renderDay = ({ item }: { item: DayCell }) => {
    const dayNum = item.date.getDate();
    const photoH = Math.max(cellHeight - 28, 0);
    return (
      <TouchableOpacity style={[styles.dayCell, !item.inMonth && styles.dayCellOut, { height: cellHeight }]} activeOpacity={0.8}>
        <View style={styles.dayCellHeader}>
          <Text style={[styles.dayNumber, !item.inMonth && styles.dayNumberOut]}>
            {dayNum}
          </Text>
          {!!item.exhibitionsCount && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.exhibitionsCount}</Text>
            </View>
          )}
        </View>
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={[styles.dayPhoto, { height: photoH }]} resizeMode="cover" />
        ) : (
          <View style={[styles.dayPhoto, styles.dayPhotoEmpty, { height: photoH }]} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      <View style={{ flex: 1 }} onLayout={(e) => {
        const h = e?.nativeEvent?.layout?.height;
        if (typeof h === 'number') setContentH(h);
      }}>
        <View style={styles.monthBar} onLayout={(e) => {
          const h = e?.nativeEvent?.layout?.height;
          if (typeof h === 'number') setBarsH((v) => ({ ...v, month: h }));
        }}>
          <TouchableOpacity onPress={goPrevMonth} style={styles.navBtn} activeOpacity={0.8}>
            <Text style={styles.navText}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToday} activeOpacity={0.8}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goNextMonth} style={styles.navBtn} activeOpacity={0.8}>
            <Text style={styles.navText}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekHeader} onLayout={(e) => {
          const h = e?.nativeEvent?.layout?.height;
          if (typeof h === 'number') setBarsH((v) => ({ ...v, week: h }));
        }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
            <View key={w} style={styles.weekHeaderCell}>
              <Text style={styles.weekHeaderText}>{w}</Text>
            </View>
          ))}
        </View>

        <FlatList
          data={monthDays}
          keyExtractor={(d) => d.dateKey}
          renderItem={renderDay}
          numColumns={7}
          scrollEnabled={true}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 8 }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e6e6e6' },
  title: { fontSize: 20, fontWeight: '700' },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBtn: { padding: 8 },
  navText: { fontSize: 16, color: '#666' },
  monthLabel: { fontSize: 16, fontWeight: '700' },

  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  weekHeaderCell: { flex: 1, alignItems: 'center' },
  weekHeaderText: { fontSize: 12, color: '#888' },

  grid: { paddingHorizontal: 4 },
  dayCell: {
    flexBasis: '14.2857%',
    maxWidth: '14.2857%',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    margin: 0,
    padding: 6,
    backgroundColor: 'white',
  },
  dayCellOut: { backgroundColor: '#fafafa' },
  dayCellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayNumber: { fontWeight: '700', color: '#222' },
  dayNumberOut: { color: '#bbb' },
  badge: {
    backgroundColor: '#0c4b1f',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  dayPhoto: { width: '100%', borderRadius: 6, backgroundColor: '#efefef' },
  dayPhotoEmpty: { backgroundColor: '#f6f6f6' },
});
