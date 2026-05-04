import { fetchApi } from './client.js';

export function getMemories(params = {}) {
  return fetchApi('/memories', params);
}

export function getMemoryTags() {
  return fetchApi('/memories/tags');
}

export function getMemoryAgents() {
  return fetchApi('/memories/agents');
}

export function getMemoryChannels() {
  return fetchApi('/memories/channels');
}
