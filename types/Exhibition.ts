export interface Exhibition {
  id: string;
  name: string;
  artist: string;
  location: string;
  review: string;
  // 새 필드들
  curator?: string;                // 1. 텍스트
  notes?: string;                  // 2. 텍스트 (접힘/펼침)
  floorPlanPhotos?: string[];      // 3. 사진 배열 (접힘/펼침)
  posterPhotos?: string[];         // 4. 사진 배열 (접힘/펼침)
  with?: string;                   // 5. 텍스트
  link?: string;                   // 6. 텍스트 (URL)
  contact?: string;                // 7. 텍스트
  visitDate: string;
  photos: string[];        // 사진 URI 배열 추가
  isFavorite: boolean;     // 즐겨찾기 여부
  createdAt: string;
  updatedAt: string;
}

export interface ExhibitionFormData {
  name: string;
  artist: string;
  location: string;
  review: string;
  // 편집 폼에서도 선택적으로 사용할 수 있도록 정의 (UI에서 사용 시 확장)
  curator?: string;
  notes?: string;
  floorPlanPhotos?: string[];
  posterPhotos?: string[];
  with?: string;
  link?: string;
  contact?: string;
  visitDate?: string;
}