/**
 * Parses a date string and converts it to local time.
 * If the date string has no timezone offset (like +08:00 or Z), 
 * it is treated as UTC by appending 'Z'.
 * Otherwise, it is parsed as-is.
 */
export function parseToLocalDate(dateStr) {
  if (!dateStr) return null;
  
  let parsedStr = dateStr;
  
  // Check if string ends with a timezone indicator (e.g., Z, +08:00, -0500)
  // Simple check: does it contain '+' or '-' in the time part, or end with 'Z'?
  // A typical SQLite UTC timestamp looks like "2026-05-04 10:00:00"
  // A timezone-aware one looks like "2026-05-04 18:00:00+08:00" or "2026-05-04T18:00:00Z"
  
  // Normalize space to 'T' for proper ISO 8601 parsing in some older browsers
  parsedStr = parsedStr.replace(' ', 'T');

  const hasTimezone = /Z|[+-]\d{2}:?\d{2}$/.test(parsedStr);
  
  if (!hasTimezone) {
    // Treat as UTC by appending Z
    parsedStr += 'Z';
  }

  const date = new Date(parsedStr);
  return isNaN(date.getTime()) ? null : date;
}

export function formatTime(dateStr) {
  const date = parseToLocalDate(dateStr);
  if (!date) return '';
  
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(dateStr) {
  const date = parseToLocalDate(dateStr);
  if (!date) return '';
  
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(dateStr) {
  const date = parseToLocalDate(dateStr);
  if (!date) return '';
  
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}
