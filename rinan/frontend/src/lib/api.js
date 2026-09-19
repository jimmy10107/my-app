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
  submitPlanting: ({ accessToken, plantType, message }) =>
    request('/api/plantings', { method: 'POST', body: { accessToken, plantType, message } }),

  adminLogin: (password) => request('/api/auth/login', { method: 'POST', body: { password } }),

  pendingPlantings: (token) => request('/api/plantings/pending', { token }),

  approvePlanting: (id, token) => request(`/api/plantings/${id}/approve`, { method: 'POST', token }),

  rejectPlanting: (id, token) => request(`/api/plantings/${id}/reject`, { method: 'POST', token }),

  visitStats: (token) => request('/api/visits/stats', { token }),
};
