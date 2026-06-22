import crypto from 'crypto';

function splitList(value = '') {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function validateInitData(initDataRaw, botToken) {
  if (!initDataRaw || !botToken) return null;

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) return null;

  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) return null;

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

export function verifyTelegramUser(req) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const allowedIds = splitList(process.env.TELEGRAM_ALLOWED_USER_IDS);

  const initData = req.get('x-telegram-init-data') || '';
  if (!initData) return false;

  const user = validateInitData(initData, botToken);
  if (!user) return false;

  if (allowedIds.length > 0 && !allowedIds.includes(String(user.id))) {
    return false;
  }

  req.telegramUser = user;
  return true;
}
