import { useEffect, useState } from 'react';

const tg = window.Telegram?.WebApp;

export function isTelegramWebApp() {
  return !!tg?.initData;
}

export function getTelegramInitData() {
  return tg?.initData || '';
}

export function useTelegram() {
  const [ready, setReady] = useState(false);
  const inTelegram = isTelegramWebApp();

  useEffect(() => {
    if (!inTelegram) return;

    tg.ready();
    tg.expand();

    if (tg.themeParams) {
      const root = document.documentElement;
      const map = {
        bg_color: '--color-bg-primary',
        secondary_bg_color: '--color-bg-secondary',
        text_color: '--color-text-primary',
        hint_color: '--color-text-tertiary',
        link_color: '--color-accent',
        button_color: '--color-accent',
        button_text_color: '--color-text-inverse',
      };
      Object.entries(map).forEach(([tgKey, cssVar]) => {
        if (tg.themeParams[tgKey]) {
          root.style.setProperty(cssVar, tg.themeParams[tgKey]);
        }
      });
    }

    setReady(true);
  }, [inTelegram]);

  return { tg, inTelegram, ready };
}
