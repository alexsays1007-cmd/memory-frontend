import { fetchApi, requestApi } from './client.js';
import { mockDiaryDates, mockDiaryEntries } from '../fixtures/mockDiary.js';

const useMocks = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

export function getDiaryDates() {
  if (useMocks) {
    return Promise.resolve({ dates: mockDiaryDates });
  }
  return fetchApi('/diary/dates');
}

export function getDiaryByDate(date) {
  if (useMocks) {
    const entries = mockDiaryEntries[date] || [];
    return Promise.resolve({ data: entries });
  }
  return fetchApi('/diary', { date });
}

export function updateDiaryEntry(id, payload) {
  return requestApi(`/diary/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function hideDiaryEntry(id) {
  return requestApi(`/diary/${id}/hide`, {
    method: 'POST',
  });
}

export function restoreDiaryEntry(id) {
  return requestApi(`/diary/${id}/restore`, {
    method: 'POST',
  });
}

/** Fetch handoff.md content */
export function getHandoff() {
  return fetchApi('/handoff');
}

export async function getHandoffCurrent(source = 'telegram') {
  if (source === 'wechat') {
    return fetchApi('/handoff/wechat/current');
  }
  try {
    return await fetchApi('/handoff/current');
  } catch {
    return getHandoff();
  }
}

export function getHandoffPrevious(source = 'telegram') {
  return fetchApi(source === 'wechat' ? '/handoff/wechat/previous' : '/handoff/previous');
}

export function updateHandoffCurrent(source, content, options = {}) {
  const endpoint = source === 'wechat' ? '/handoff/wechat/current' : '/handoff/current';
  return requestApi(endpoint, {
    method: 'PUT',
    body: {
      content,
      ...(source === 'wechat' ? {
        expectedSha256: options.expectedSha256,
        allowLargeRemoval: options.allowLargeRemoval === true,
      } : {}),
    },
  });
}
