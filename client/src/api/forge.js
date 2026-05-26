import { fetchApi, requestApi } from './client.js';

export function getForgeStatus() {
  return fetchApi('/forge/status');
}

export function saveForgeConfig(payload) {
  return requestApi('/forge/config', {
    method: 'PATCH',
    body: payload,
  });
}

export function runForgeCheck() {
  return requestApi('/forge/run-check', {
    method: 'POST',
  });
}

export function manualForgeCutover(retainTokens) {
  return requestApi('/forge/manual-cutover', {
    method: 'POST',
    body: { retainTokens },
  });
}
