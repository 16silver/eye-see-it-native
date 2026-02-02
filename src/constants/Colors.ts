const tintColorLight = '#2e7d32'; // 메인 그린
const tintColorDark = '#b5efc4'; // 다크에서 포커스 그린 계열

export default {
  light: {
    // 기본
    text: '#111111',
    background: '#ffffff',
    tint: tintColorLight,
    tabIconDefault: '#9ac5a0',
    tabIconSelected: tintColorLight,

    // 역할 기반 토큰
    surface: '#ffffff',
    card: '#ffffff',
    headerBg: '#e6f5e9',
    border: '#e5e9e6',
    muted: '#6f6f6f',
    mutedSecondary: '#888888',
    iconDefault: '#7f7f7f',
    iconActive: tintColorLight,
    accent: tintColorLight,
    accentStrong: '#0c4b1f',
    highlightBg: '#bdffd6',
    badgeBg: '#e6f5e9',
    danger: '#d32f2f',
  },
  dark: {
    // 기본
    text: '#f5f5f5',
    background: '#0f0f0f',
    tint: tintColorDark,
    tabIconDefault: '#6aa979',
    tabIconSelected: tintColorDark,

    // 역할 기반 토큰
    surface: '#151515',
    card: '#1b1b1b',
    headerBg: '#0f2416',
    border: '#242b26',
    muted: '#bdbdbd',
    mutedSecondary: '#9e9e9e',
    iconDefault: '#bdbdbd',
    iconActive: tintColorDark,
    accent: tintColorDark,
    accentStrong: '#78d98d',
    highlightBg: '#163221',
    badgeBg: '#163221',
    danger: '#ef9a9a',
  },
};
