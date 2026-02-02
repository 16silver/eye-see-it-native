export const IconAssets = {
  tab: {
    list: {
      active: require('../../assets/images/icons/tab-list-active.png'),
      inactive: require('../../assets/images/icons/tab-list.png'),
    },
    calendar: {
      active: require('../../assets/images/icons/tab-calendar-active.png'),
      inactive: require('../../assets/images/icons/tab-calendar.png'),
    },
    map: {
      active: require('../../assets/images/icons/tab-map-active.png'),
      inactive: require('../../assets/images/icons/tab-map.png'),
    },
  },
  camera: {
    default: require('../../assets/images/icons/camera.png'),
    // 선택 사항: 눌림/하이라이트 상태용 이미지가 있다면 아래 파일을 추가하세요
    // pressed: require('../../assets/images/icons/camera-pressed.png'),
  },
} as const;

export type TabIconKey = keyof typeof IconAssets.tab;


