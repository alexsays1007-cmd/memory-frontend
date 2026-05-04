import { fetchApi } from './client.js';
import { mockPulseLogs, mockActionTypes } from '../fixtures/mockPulseLogs.js';

const useMocks = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

export function getConsciousnessLog(params = {}) {
  if (useMocks) {
    let data = [...mockPulseLogs];
    if (params.action_type) {
      data = data.filter(item => item.action_type === params.action_type);
    }
    if (params.date_from) {
      const from = new Date(params.date_from);
      data = data.filter(item => new Date(item.created_at) >= from);
    }
    if (params.date_to) {
      const to = new Date(params.date_to + 'T23:59:59');
      data = data.filter(item => new Date(item.created_at) <= to);
    }
    return Promise.resolve({ data, total: data.length });
  }
  return fetchApi('/consciousness', params);
}

export function getActionTypes() {
  if (useMocks) {
    return Promise.resolve({ action_types: mockActionTypes });
  }
  return fetchApi('/consciousness/action-types');
}
