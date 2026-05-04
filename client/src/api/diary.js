import { fetchApi } from './client.js';
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
