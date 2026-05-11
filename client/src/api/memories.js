import { fetchApi, requestApi } from './client.js';
import { mockMemories, mockTags, mockAgents, mockChannels } from '../fixtures/mockMemories.js';

const useMocks = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

export function getMemories(params = {}) {
  if (useMocks) {
    let data = [...mockMemories];
    // Basic filtering to mimic backend
    if (params.q) {
      const q = params.q.toLowerCase();
      data = data.filter(m =>
        m.content.toLowerCase().includes(q) ||
        (m.tags && m.tags.toLowerCase().includes(q))
      );
    }
    if (params.tag) {
      data = data.filter(m => m.tags && m.tags.toLowerCase().includes(params.tag.toLowerCase()));
    }
    if (params.agent) {
      data = data.filter(m => m.agent === params.agent);
    }
    if (params.channel) {
      data = data.filter(m => m.channel === params.channel);
    }
    return Promise.resolve({ data, total: data.length });
  }
  return fetchApi('/memories', params);
}

export function getMemoryTags() {
  if (useMocks) {
    return Promise.resolve({ tags: mockTags });
  }
  return fetchApi('/memories/tags');
}

export function getMemoryAgents() {
  if (useMocks) {
    return Promise.resolve({ agents: mockAgents });
  }
  return fetchApi('/memories/agents');
}

export function getMemoryChannels() {
  if (useMocks) {
    return Promise.resolve({ channels: mockChannels });
  }
  return fetchApi('/memories/channels');
}

export function updateMemory(id, payload) {
  if (useMocks) {
    return Promise.resolve({ ok: true, memory: { id, ...payload } });
  }
  return requestApi(`/memories/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function hideMemory(id) {
  if (useMocks) {
    return Promise.resolve({ ok: true, id, deleted: 1 });
  }
  return requestApi(`/memories/${id}/hide`, {
    method: 'POST',
  });
}

export function restoreMemory(id) {
  if (useMocks) {
    return Promise.resolve({ ok: true, memory: { id, deleted: 0 } });
  }
  return requestApi(`/memories/${id}/restore`, {
    method: 'POST',
  });
}
