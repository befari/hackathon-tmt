const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

export const api = {
  // Threat Models
  listThreatModels: () => request<any>('/threat-models'),
  getThreatModel: (id: string) => request<any>(`/threat-models/${id}`),
  createThreatModel: (data: { name: string; description?: string; repoUrl?: string }) =>
    request<any>('/threat-models', { method: 'POST', body: JSON.stringify(data) }),
  updateThreatModel: (id: string, data: Record<string, any>) =>
    request<any>(`/threat-models/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteThreatModel: (id: string) =>
    request<any>(`/threat-models/${id}`, { method: 'DELETE' }),

  // Components
  getComponents: (modelId: string) => request<any>(`/threat-models/${modelId}/components`),
  createComponent: (modelId: string, data: Record<string, any>) =>
    request<any>(`/threat-models/${modelId}/components`, { method: 'POST', body: JSON.stringify(data) }),

  // Data Flows
  getDataFlows: (modelId: string) => request<any>(`/threat-models/${modelId}/data-flows`),
  createDataFlow: (modelId: string, data: Record<string, any>) =>
    request<any>(`/threat-models/${modelId}/data-flows`, { method: 'POST', body: JSON.stringify(data) }),

  // Threats
  listThreats: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return request<any>(`/threats${query}`);
  },
  getThreat: (id: string) => request<any>(`/threats/${id}`),
  updateThreat: (id: string, data: Record<string, any>) =>
    request<any>(`/threats/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Comments
  getComments: (params: Record<string, string>) =>
    request<any>(`/comments?${new URLSearchParams(params)}`),
  createComment: (data: Record<string, any>) =>
    request<any>('/comments', { method: 'POST', body: JSON.stringify(data) }),
  resolveComment: (id: string) =>
    request<any>(`/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ resolved: true }) }),

  // Reviews
  listReviews: (threatModelId: string) =>
    request<any>(`/reviews?threatModelId=${threatModelId}`),
  getReview: (id: string) => request<any>(`/reviews/${id}`),
  createReview: (data: { name: string; threatModelId: string; reviewerName?: string }) =>
    request<any>('/reviews', { method: 'POST', body: JSON.stringify(data) }),

  // Chat
  getChatHistory: (threatModelId: string) => request<any>(`/chat/${threatModelId}`),
  sendMessage: (threatModelId: string, message: string) =>
    request<any>(`/chat/${threatModelId}`, { method: 'POST', body: JSON.stringify({ message }) }),
};
