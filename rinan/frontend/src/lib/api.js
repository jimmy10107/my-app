const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `請求失敗（${res.status}）`);
  }

  return data;
}

export const api = {
  submitPlanting: ({ accessToken, kioskSessionId, plantType, message, nickname }) =>
    request('/api/plantings', {
      method: 'POST',
      body: { accessToken, kioskSessionId, plantType, message, nickname },
    }),

  adminLogin: (password) => request('/api/auth/login', { method: 'POST', body: { password } }),

  pendingPlantings: (token) => request('/api/plantings/pending', { token }),

  approvePlanting: (id, token) => request(`/api/plantings/${id}/approve`, { method: 'POST', token }),

  rejectPlanting: (id, token) => request(`/api/plantings/${id}/reject`, { method: 'POST', token }),

  visitStats: (token) => request('/api/visits/stats', { token }),

  lineUserStats: (token) => request('/api/line-users/stats', { token }),

  plantingStats: (token) => request('/api/plantings/stats', { token }),

  createKioskSession: () => request('/api/kiosk/session', { method: 'POST' }),

  // CSV 下載不是 JSON，走獨立的 fetch + blob，觸發瀏覽器另存新檔。
  async downloadPlantingsCsv(token) {
    const res = await fetch(`${API_BASE_URL}/api/plantings/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `下載失敗（${res.status}）`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rinan-plantings-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
