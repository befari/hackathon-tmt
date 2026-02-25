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

  // Diagrams
  listDiagrams: (modelId: string) => request<any>(`/threat-models/${modelId}/diagrams`),
  createDiagram: (modelId: string, data: { name: string; description?: string }) =>
    request<any>(`/threat-models/${modelId}/diagrams`, { method: 'POST', body: JSON.stringify(data) }),

  // Components (scoped to diagram)
  addComponent: (modelId: string, diagramId: string, data: Record<string, any>) =>
    request<any>(`/threat-models/${modelId}/diagrams/${diagramId}/components`, { method: 'POST', body: JSON.stringify(data) }),

  // Data Flows (scoped to diagram)
  addDataFlow: (modelId: string, diagramId: string, data: Record<string, any>) =>
    request<any>(`/threat-models/${modelId}/diagrams/${diagramId}/data-flows`, { method: 'POST', body: JSON.stringify(data) }),

  // Component CRUD (by component ID)
  updateComponent: (id: string, data: Record<string, any>) =>
    request<any>(`/threat-models/components/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteComponent: (id: string) =>
    request<any>(`/threat-models/components/${id}`, { method: 'DELETE' }),

  // Data Flow CRUD (by data flow ID)
  updateDataFlow: (id: string, data: Record<string, any>) =>
    request<any>(`/threat-models/data-flows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDataFlow: (id: string) =>
    request<any>(`/threat-models/data-flows/${id}`, { method: 'DELETE' }),

  // Threats
  listThreats: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return request<any>(`/threats${query}`);
  },
  getThreat: (id: string) => request<any>(`/threats/${id}`),
  createThreat: (data: Record<string, any>) =>
    request<any>('/threats', { method: 'POST', body: JSON.stringify(data) }),
  updateThreat: (id: string, data: Record<string, any>) =>
    request<any>(`/threats/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteThreat: (id: string) =>
    request<any>(`/threats/${id}`, { method: 'DELETE' }),

  // Comments
  getComments: (params: Record<string, string>) =>
    request<any>(`/comments?${new URLSearchParams(params)}`),
  createComment: (data: Record<string, any>) =>
    request<any>('/comments', { method: 'POST', body: JSON.stringify(data) }),
  resolveComment: (id: string) =>
    request<any>(`/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ resolved: true }) }),
  getCommentCounts: (threatModelId: string) =>
    request<any>(`/comments/counts?threatModelId=${threatModelId}`),

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
