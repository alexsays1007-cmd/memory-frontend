// Theme configuration
// Supports: light mode, dark mode (预留), Telegram Mini App 主题变量映射

export const theme = {
  colors: {
    morandi: {
      fogPurple: '#9B8EA8',
      apricot: '#E8C4A0',
      softGray: '#B8B0B8',
    },
  },
  // Telegram Mini App 主题变量映射 (预留)
  telegramThemeMap: {
    bg_color: '--color-bg-primary',
    secondary_bg_color: '--color-bg-secondary',
    text_color: '--color-text-primary',
    hint_color: '--color-text-tertiary',
    link_color: '--color-accent',
    button_color: '--color-accent',
    button_text_color: '--color-text-inverse',
  },
};

// 应用 Telegram 主题 (预留)
export function applyTelegramTheme(tgThemeParams) {
  if (!tgThemeParams) return;

  const root = document.documentElement;
  Object.entries(theme.telegramThemeMap).forEach(([tgKey, cssVar]) => {
    if (tgThemeParams[tgKey]) {
      root.style.setProperty(cssVar, tgThemeParams[tgKey]);
    }
  });
}

// 切换深色模式 (预留)
export function toggleDarkMode(enabled) {
  document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
}
