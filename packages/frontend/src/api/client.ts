const API_BASE = '/api';

let tokenProvider: (() => Promise<string | null>) | null = null;

export function setTokenProvider(provider: () => Promise<string | null>) {
  tokenProvider = provider;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delay = 1000): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Retry on 502/503/504 (proxy errors when backend is restarting)
      if (res.status >= 502 && res.status <= 504 && attempt < retries) {
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      // Network error (backend down) — retry
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but satisfies TS
  return fetch(url, options);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (tokenProvider) {
    const token = await tokenProvider();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetchWithRetry(`${API_BASE}${path}`, {
    ...options,
    headers,
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
  generateThreats: (id: string, diagramId?: string) =>
    request<any>(`/threat-models/${id}/generate-threats`, {
      method: 'POST',
      body: JSON.stringify(diagramId ? { diagramId } : {}),
    }),

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

  // Auth
  getMe: () => request<any>('/auth/me'),
  joinShareLink: (token: string) => request<any>(`/auth/share/${token}`),

  // Members
  listMembers: (modelId: string) => request<any>(`/threat-models/${modelId}/members`),
  addMember: (modelId: string, data: { email: string; role: string }) =>
    request<any>(`/threat-models/${modelId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  updateMember: (modelId: string, memberId: string, data: { role: string }) =>
    request<any>(`/threat-models/${modelId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeMember: (modelId: string, memberId: string) =>
    request<any>(`/threat-models/${modelId}/members/${memberId}`, { method: 'DELETE' }),

  // Share Links
  listShareLinks: (modelId: string) => request<any>(`/threat-models/${modelId}/share-links`),
  createShareLink: (modelId: string, data: { role: string; expiresAt?: string }) =>
    request<any>(`/threat-models/${modelId}/share-links`, { method: 'POST', body: JSON.stringify(data) }),
  deleteShareLink: (modelId: string, linkId: string) =>
    request<any>(`/threat-models/${modelId}/share-links/${linkId}`, { method: 'DELETE' }),

  // TM7 Import
  importTm7: async (file: File, contributeAsReference = false): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (contributeAsReference) {
      formData.append('contributeAsReference', 'true');
    }
    const headers: Record<string, string> = {};
    if (tokenProvider) {
      const token = await tokenProvider();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetchWithRetry(`${API_BASE}/tm7/import`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Import failed');
    }
    return res.json();
  },

  // AI Feedback
  submitFeedback: (generationId: string, rating: number, comment?: string) =>
    request<any>('/tm7/feedback', {
      method: 'POST',
      body: JSON.stringify({ generationId, rating, comment }),
    }),
  listReferences: () => request<any>('/tm7/references'),
  deleteReference: (id: string) =>
    request<any>(`/tm7/references/${id}`, { method: 'DELETE' }),
};
