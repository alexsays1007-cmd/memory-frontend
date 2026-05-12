
/**
 * Safely get the message text content.
 */
export function getMessageText(item) {
  return item?.content || '';
}

/**
 * Get the role of a message (user / assistant / system).
 */
export function getMessageRole(item) {
  return item?.role || 'unknown';
}

/**
 * Get the source/channel of a message.
 */
export function getMessageSource(item) {
  return item?.channel || item?.source || '';
}

/**
 * Get the created timestamp string (compatible with multiple field names).
 */
export function getMessageCreated(item) {
  return item?.created || item?.created_at || item?.timestamp || '';
}

/**
 * Check if a message should be hidden by default.
 * System messages, hidden messages, internal/silent/error messages are all hidden.
 */
export function isSystemOrHidden(item) {
  if (!item) return true;
  if (item.hidden === 1 || item.hidden === true) return true;
  if (item.visibility === 'hidden') return true;
  if (item.role === 'system') return true;
  if (item.direction === 'internal') return true;
  const kind = (item.kind || '').toLowerCase();
  if (['silent', 'error', 'system'].includes(kind)) return true;
  return false;
}

/**
 * Check if a message is favorited.
 */
export function isFavorited(item) {
  return item?.favorite === 1 || item?.favorite === true;
}

/**
 * Format a source/channel for display.
 */
export function formatSource(channel) {
  const map = {
    'telegram': 'TG',
    'wechat': 'WeChat',
    'app': 'App',
  };
  return map[(channel || '').toLowerCase()] || channel || '';
}

/**
 * Check if a message content is "long" and should be collapsible.
 */
export function isLongMessage(content, threshold = 1200) {
  return (content || '').length > threshold;
}
