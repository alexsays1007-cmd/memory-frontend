import { useEffect, useState } from 'react';

export function isTelegramWebApp() {
  return !!window.Telegram?.WebApp?.initData;
}

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData || '';
}

function applyTelegramTheme(wa) {
  if (!wa?.themeParams) return;
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
    if (wa.themeParams[tgKey]) {
      root.style.setProperty(cssVar, wa.themeParams[tgKey]);
    }
  });
}

export function useTelegram() {
  const [ready, setReady] = useState(false);
  const [inTelegram, setInTelegram] = useState(() => isTelegramWebApp());

  useEffect(() => {
    if (inTelegram) {
      const wa = window.Telegram.WebApp;
      wa.ready();
      wa.expand();
      applyTelegramTheme(wa);
      setReady(true);
      return;
    }

    if (!window.location.hostname.startsWith('tg.')) return;

    // On tg.* subdomain, wait for Telegram SDK bridge to initialize
    // before deciding to redirect — initData may arrive asynchronously
    const timer = setTimeout(() => {
      if (isTelegramWebApp()) {
        setInTelegram(true);
      } else {
        window.location.replace(
          window.location.href.replace(
            window.location.hostname,
            window.location.hostname.replace('tg.', 'memory.')
          )
        );
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [inTelegram]);

  return { tg: inTelegram ? window.Telegram?.WebApp : null, inTelegram, ready };
}
