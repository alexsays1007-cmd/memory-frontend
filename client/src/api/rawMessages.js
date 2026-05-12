import { fetchApi, requestApi } from './client.js';

/**
 * Fetch raw messages with filters and pagination.
 * @param {Object} params - Query parameters
 * @param {string} [params.channel] - wechat | telegram
 * @param {string} [params.agent] - codex | claude
 * @param {string} [params.role] - user | assistant | system
 * @param {string} [params.session] - session ID
 * @param {string} [params.date] - YYYY-MM-DD
 * @param {string} [params.q] - search keyword
 * @param {number} [params.favorite] - 1 for favorites only
 * @param {number} [params.page] - page number
 * @param {number} [params.pageSize] - items per page
 * @param {string} [params.sort] - asc | desc
 */
export function getRawMessages(params = {}) {
  return fetchApi('/raw-messages', params);
}

/** Fetch available channels */
export function getRawMessageChannels() {
  return fetchApi('/raw-messages/channels');
}

/** Fetch dates that have messages */
export function getRawMessageDates(params = {}) {
  return fetchApi('/raw-messages/dates', params);
}

/** Toggle favorite on a message */
export function toggleFavorite(id, favorite) {
  return requestApi(`/raw-messages/${id}/favorite`, {
    method: 'PATCH',
    body: favorite !== undefined ? { favorite } : {},
  });
}

/** Soft-hide a message */
export function hideMessage(id) {
  return requestApi(`/raw-messages/${id}/hide`, { method: 'POST' });
}

/** Restore a hidden message */
export function restoreMessage(id) {
  return requestApi(`/raw-messages/${id}/restore`, { method: 'POST' });
}
