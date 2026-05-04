import { fetchApi } from './client.js';

export function getDiaryDates() {
  return fetchApi('/diary/dates');
}

export function getDiaryByDate(date) {
  return fetchApi('/diary', { date });
}
