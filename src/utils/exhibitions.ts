import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exhibition } from '../../types/Exhibition';

export const EXHIBITIONS_KEY = '@exhibitions';

export async function loadExhibitions(): Promise<Exhibition[]> {
  const raw = await AsyncStorage.getItem(EXHIBITIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Exhibition[];
  } catch {
    return [];
  }
}

export async function saveExhibitions(exhibitions: Exhibition[]): Promise<void> {
  await AsyncStorage.setItem(EXHIBITIONS_KEY, JSON.stringify(exhibitions));
}

export async function deleteExhibitionById(targetId: string): Promise<Exhibition[]> {
  const list = await loadExhibitions();
  const updated = list.filter(item => item.id !== targetId);
  await saveExhibitions(updated);
  return updated;
}

/**
 * 연도별 누적 전시 개수에서 5개 단위 마일스톤을 계산합니다.
 * 반환은 전시 ID -> 해당 시점 누적 개수(5, 10, 15, ...) 매핑입니다.
 */
export function computeYearMilestones(
  exhibitions: Exhibition[],
  options?: { order?: 'asc' | 'desc' | 'as-is'; countFromOldest?: boolean }
): Record<string, number> {
  const order = options?.order ?? 'asc';
  let ordered: Exhibition[];
  if (order === 'as-is') {
    ordered = exhibitions;
  } else {
    // 방문일 기준 정렬(asc 또는 desc). 동일 날짜는 생성일/ID로 보조 정렬
    ordered = [...exhibitions].sort((a, b) => {
      const ad = new Date(a.visitDate).getTime();
      const bd = new Date(b.visitDate).getTime();
      if (ad !== bd) return order === 'asc' ? ad - bd : bd - ad;
      const ac = new Date(a.createdAt).getTime();
      const bc = new Date(b.createdAt).getTime();
      if (ac !== bc) return order === 'asc' ? ac - bc : bc - ac;
      return order === 'asc'
        ? String(a.id).localeCompare(String(b.id))
        : String(b.id).localeCompare(String(a.id));
    });
  }

  // 화면이 최신순(내림차순)인 상태에서 "아래쪽(오래된 방향)에서 5의 배수" 기준으로 고정하려면,
  // 표시 배열(as-is)을 역순으로 세어야 정확한 항목에 배지가 붙습니다.
  const iter: Exhibition[] = options?.countFromOldest ? [...ordered].reverse() : ordered;

  const yearToCount: Record<number, number> = {};
  const idToMilestone: Record<string, number> = {};
  iter.forEach((ex) => {
    const y = new Date(ex.visitDate).getFullYear();
    // 화면 표시 순서를 그대로 누적하려면 정렬 결과에 맞춰 카운트합니다.
    const next = (yearToCount[y] || 0) + 1;
    yearToCount[y] = next;
    if (next % 5 === 0) {
      idToMilestone[ex.id] = next;
    }
  });
  return idToMilestone;
}


