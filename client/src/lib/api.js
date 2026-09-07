const TOKEN_KEY = 'nexusai.token';

/**
 * Backend manzili. Lokalda bo'sh qoladi — Vite proxy '/api' ni 8787 portga uzatadi.
 * Vercel'da VITE_API_URL ga backend origin'i yoziladi (masalan https://nexusai-api.up.railway.app).
 */
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const apiUrl = (path) => `${API_BASE}/api${path}`;

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body, raw = false, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    setToken(null);
    if (!location.pathname.startsWith('/login')) location.href = '/login';
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `Xato ${res.status}`);
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, formData) => request(p, { method: 'POST', body: formData, raw: true }),
};

/**
 * Oqimli chat. SSE'ni fetch orqali o'qiydi (POST kerak bo'lgani uchun EventSource emas).
 */
export async function streamMessage(conversationId, payload, handlers = {}) {
  const res = await fetch(apiUrl(`/chat/conversations/${conversationId}/stream`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: 'Oqim ochilmadi' }));
    throw new Error(err.error);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const evLine = frame.split('\n').find((l) => l.startsWith('event:'));
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!evLine || !dataLine) continue;
      const event = evLine.slice(6).trim();
      let data;
      try { data = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
      handlers[event]?.(data);
    }
  }
}
