import { requestApi } from './client';

export async function previewImport(conversation, { session, title } = {}) {
  return requestApi('/import/preview', {
    method: 'POST',
    body: { conversation, session, title },
  });
}

export async function executeImport(conversation, { session, title, replace } = {}) {
  return requestApi('/import/execute', {
    method: 'POST',
    body: { conversation, session, title, replace },
  });
}
