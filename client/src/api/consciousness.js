import { fetchApi } from './client.js';

export function getConsciousnessLog(params = {}) {
  return fetchApi('/consciousness', params);
}

export function getActionTypes() {
  return fetchApi('/consciousness/action-types');
}
